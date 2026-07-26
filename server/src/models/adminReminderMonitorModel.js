const { pool } = require("../config/db");
const { currentCompanyId } = require("../services/tenantContext");
const {
  APPLICATION_TIMEZONE,
  daysOverdue,
  nextReminderDue,
  reminderSequence,
  scheduledReminderType
} = require("../services/invoiceReminderSchedule");

const SUCCESS_STATUSES = new Set(["sent", "success", "successful", "delivered"]);
const FAILED_STATUSES = new Set(["failed"]);

function pad(value) {
  return String(value).padStart(2, "0");
}

function utcSqlDate(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

function timezoneOffsetMs(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false, timeZone
  }).formatToParts(date);
  const read = (type) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(read("year"), read("month") - 1, read("day"), read("hour") % 24, read("minute"), read("second"));
  return asUtc - date.getTime();
}

function todayUtcBounds(now = new Date(), timeZone = APPLICATION_TIMEZONE) {
  const localParts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone
  }).formatToParts(now);
  const read = (type) => Number(localParts.find((part) => part.type === type)?.value);
  const localMidnightAsUtc = Date.UTC(read("year"), read("month") - 1, read("day"));
  let start = new Date(localMidnightAsUtc - timezoneOffsetMs(new Date(localMidnightAsUtc), timeZone));
  start = new Date(localMidnightAsUtc - timezoneOffsetMs(start, timeZone));
  const end = new Date(start.getTime() + 86400000);
  return { start: utcSqlDate(start), end: utcSqlDate(end) };
}

function parseMetadata(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch { return {}; }
}

function reminderTypeFromLog(row) {
  const metadata = parseMetadata(row.metadata);
  return metadata.reminderType || String(row.actionDescription || "").replace(/^reminder:/i, "") || "payment_reminder";
}

function statusKind(value) {
  const normalized = String(value || "").toLowerCase();
  if (SUCCESS_STATUSES.has(normalized)) return "Sent";
  if (FAILED_STATUSES.has(normalized)) return "Failed";
  return "Pending";
}

function mapLog(row, retryCounts) {
  const metadata = parseMetadata(row.metadata);
  const reminderType = reminderTypeFromLog(row);
  const key = `${row.invoiceId}:${reminderType}`;
  return {
    id: row.id,
    invoiceId: Number(row.invoiceId) || null,
    invoiceNumber: row.invoiceNumber || `INV-${row.invoiceId}`,
    customerName: row.customerName || "-",
    customerEmail: row.customerEmail || metadata.customerEmail || "-",
    reminderType,
    reminderSequence: reminderSequence(reminderType),
    dueDate: row.dueDate,
    scheduledAt: row.processedAt,
    sentAt: statusKind(row.deliveryStatus) === "Sent" ? row.processedAt : null,
    attemptedAt: row.processedAt,
    processedAt: row.processedAt,
    currentReminderStatus: statusKind(row.deliveryStatus),
    deliveryStatus: statusKind(row.deliveryStatus),
    failureReason: metadata.errorMessage || row.failureReason || "-",
    retryCount: Number(retryCounts.get(key) || 0),
    invoiceStatus: row.invoiceStatus || "-",
    invoiceTotal: Number(row.invoiceTotal || 0),
    outstandingBalance: Math.max(Number(row.invoiceTotal || 0) - Number(row.confirmedPaid || 0), 0),
    daysOverdue: daysOverdue(row.dueDate),
    lastReminderSent: row.lastReminderSent || null,
    nextReminderDue: nextReminderDue(row.dueDate),
    reminderCount: Number(row.reminderCount || 0)
  };
}

function ruleRunsToday(rule, now = new Date()) {
  const dayName = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    timeZone: rule.timezone || APPLICATION_TIMEZONE
  }).format(now);
  if (rule.frequency === "Daily") return true;
  if (rule.frequency === "Weekdays") return dayName !== "Sat" && dayName !== "Sun";
  if (rule.frequency === "Weekly") return dayName === "Mon";
  return false;
}

function ruleIntervals(rule) {
  return [
    { type: "1st Reminder", days: rule.firstReminderDays },
    { type: "2nd Reminder", days: rule.secondReminderDays },
    { type: "Final Reminder", days: rule.finalReminderDays }
  ].filter((interval) => Number(interval.days) > 0);
}

async function getAdminReminderMonitorData() {
  const companyId = currentCompanyId();
  const bounds = todayUtcBounds();
  const [todayLogs] = await pool.query(
    `SELECT
       al.audit_log_id AS id,
       al.affected_record AS invoiceId,
       al.action_description AS actionDescription,
       al.status AS deliveryStatus,
       al.created_at AS processedAt,
       al.new_value AS metadata,
       i.invoiceId AS invoiceNumber,
       i.status AS invoiceStatus,
       i.total_amount AS invoiceTotal,
       i.due_date AS dueDate,
       c.name AS customerName,
       c.email AS customerEmail,
       COALESCE(payments.confirmedPaid, 0) AS confirmedPaid
     FROM audit_logs al
     LEFT JOIN invoice i ON i.invoice_id = CAST(al.affected_record AS UNSIGNED)
     LEFT JOIN customer c ON c.customer_id = i.customer_id
     LEFT JOIN (
       SELECT invoice_invoice_id,
         GREATEST(COALESCE(SUM(CASE
           WHEN LOWER(status) IN ('paid', 'completed', 'success', 'successful', 'verified') THEN amount
           WHEN LOWER(status) IN ('refunded', 'refund', 'reversed', 'reversal', 'chargeback') THEN -ABS(amount)
           ELSE 0 END), 0), 0) AS confirmedPaid
       FROM payment GROUP BY invoice_invoice_id
     ) payments ON payments.invoice_invoice_id = i.invoice_id
     WHERE al.company_id = ?
       AND LOWER(al.activity_type) = 'invoice_reminder'
       AND al.created_at >= ? AND al.created_at < ?
     ORDER BY al.created_at DESC, al.audit_log_id DESC`,
    [companyId, bounds.start, bounds.end]
  );

  let reminderTableLogs = [];
  let reminderTableHistory = [];
  try {
    [reminderTableLogs] = await pool.query(
      `SELECT CONCAT('reminder-log-', rl.reminder_log_id) AS id,
         rl.invoice_id AS invoiceId, CONCAT('reminder:', rl.reminder_type) AS actionDescription,
         rl.delivery_status AS deliveryStatus, rl.sent_at AS processedAt,
         JSON_OBJECT('reminderType', rl.reminder_type, 'customerEmail', rl.client_email, 'errorMessage', rl.error_message) AS metadata,
         i.invoiceId AS invoiceNumber, i.status AS invoiceStatus, i.total_amount AS invoiceTotal,
         i.due_date AS dueDate, c.name AS customerName, COALESCE(c.email, rl.client_email) AS customerEmail,
         COALESCE(payments.confirmedPaid, 0) AS confirmedPaid
       FROM reminder_logs rl
       LEFT JOIN invoice i ON i.invoice_id = rl.invoice_id
       LEFT JOIN customer c ON c.customer_id = i.customer_id
       LEFT JOIN (
         SELECT invoice_invoice_id, SUM(CASE WHEN LOWER(status) IN ('paid', 'completed', 'success', 'successful', 'verified') THEN amount ELSE 0 END) AS confirmedPaid
         FROM payment GROUP BY invoice_invoice_id
       ) payments ON payments.invoice_invoice_id = i.invoice_id
       WHERE rl.company_id = ?
         AND rl.sent_at >= ? AND rl.sent_at < ?
       ORDER BY rl.sent_at DESC, rl.reminder_log_id DESC`,
      [companyId, bounds.start, bounds.end]
    );
    [reminderTableHistory] = await pool.query(
      `SELECT invoice_id AS invoiceId, CONCAT('reminder:', reminder_type) AS actionDescription,
         SUM(LOWER(delivery_status) = 'failed') AS failedCount,
         SUM(LOWER(delivery_status) IN ('sent', 'success', 'successful', 'delivered')) AS reminderCount,
         MAX(CASE WHEN LOWER(delivery_status) IN ('sent', 'success', 'successful', 'delivered') THEN sent_at END) AS lastReminderSent
       FROM reminder_logs
       WHERE company_id = ?
       GROUP BY invoice_id, reminder_type`,
      [companyId]
    );
  } catch (error) {
    if (error?.code !== "ER_NO_SUCH_TABLE" && error?.code !== "ER_BAD_FIELD_ERROR") throw error;
  }

  const [history] = await pool.query(
    `SELECT affected_record AS invoiceId, action_description AS actionDescription,
       SUM(LOWER(status) = 'failed') AS failedCount,
       SUM(LOWER(status) IN ('sent', 'success', 'successful', 'delivered')) AS reminderCount,
       MAX(CASE WHEN LOWER(status) IN ('sent', 'success', 'successful', 'delivered') THEN created_at END) AS lastReminderSent
     FROM audit_logs
     WHERE company_id = ?
       AND LOWER(activity_type) = 'invoice_reminder'
     GROUP BY affected_record, action_description`,
    [companyId]
  );

  const retryCounts = new Map();
  const historyByKey = new Map();
  [...history, ...reminderTableHistory].forEach((row) => {
    const type = String(row.actionDescription || "").replace(/^reminder:/i, "");
    const key = `${row.invoiceId}:${type}`;
    const current = historyByKey.get(key) || {};
    const merged = {
      ...row,
      failedCount: Number(current.failedCount || 0) + Number(row.failedCount || 0),
      reminderCount: Number(current.reminderCount || 0) + Number(row.reminderCount || 0),
      lastReminderSent: !current.lastReminderSent || new Date(row.lastReminderSent || 0) > new Date(current.lastReminderSent)
        ? row.lastReminderSent
        : current.lastReminderSent
    };
    retryCounts.set(key, merged.failedCount);
    historyByKey.set(key, merged);
  });

  const processedByKey = new Map();
  [...todayLogs, ...reminderTableLogs]
    .sort((left, right) => new Date(right.processedAt || 0) - new Date(left.processedAt || 0))
    .forEach((row) => {
    const type = reminderTypeFromLog(row);
    const key = `${row.invoiceId}:${type}`;
    if (processedByKey.has(key)) return;
    const totals = historyByKey.get(`${row.invoiceId}:${type}`) || {};
    processedByKey.set(key, mapLog({ ...row, ...totals }, retryCounts));
    });
  const processed = Array.from(processedByKey.values());

  let ruleTableAvailable = false;
  let activeRules = [];
  try {
    [activeRules] = await pool.query(
      `SELECT reminder_setting_id AS id, frequency, reminder_time AS reminderTime,
         timezone, first_reminder_days AS firstReminderDays,
         second_reminder_days AS secondReminderDays, final_reminder_days AS finalReminderDays
       FROM reminder_settings
       WHERE company_id = ?
         AND is_enabled = 1
         AND LOWER(delivery_channel) = 'email'`,
      [companyId]
    );
    ruleTableAvailable = true;
  } catch (error) {
    if (error?.code !== "ER_NO_SUCH_TABLE" && error?.code !== "ER_BAD_FIELD_ERROR") throw error;
  }

  const [invoiceRows] = await pool.query(
    `SELECT i.invoice_id AS invoiceId, i.invoiceId AS invoiceNumber, i.status AS invoiceStatus,
       i.total_amount AS invoiceTotal, i.due_date AS dueDate,
       c.name AS customerName, c.email AS customerEmail,
       COALESCE(payments.confirmedPaid, 0) AS confirmedPaid
     FROM invoice i
     LEFT JOIN customer c ON c.customer_id = i.customer_id
     LEFT JOIN (
       SELECT invoice_invoice_id,
         GREATEST(COALESCE(SUM(CASE
           WHEN LOWER(status) IN ('paid', 'completed', 'success', 'successful', 'verified') THEN amount
           WHEN LOWER(status) IN ('refunded', 'refund', 'reversed', 'reversal', 'chargeback') THEN -ABS(amount)
           ELSE 0 END), 0), 0) AS confirmedPaid
       FROM payment GROUP BY invoice_invoice_id
     ) payments ON payments.invoice_invoice_id = i.invoice_id
     WHERE i.company_id = ?
       AND c.company_id = ?
       AND i.due_date IS NOT NULL
       AND LOWER(i.status) IN ('sent', 'viewed', 'overdue', 'unpaid', 'partially_paid', 'pending review')`,
    [companyId, companyId]
  );

  const pending = invoiceRows.flatMap((invoice) => {
    const outstandingBalance = Math.max(Number(invoice.invoiceTotal || 0) - Number(invoice.confirmedPaid || 0), 0);
    if (outstandingBalance <= 0) return [];
    const invoiceDaysOverdue = daysOverdue(invoice.dueDate);
    const scheduledTypes = ruleTableAvailable
      ? activeRules
        .filter((rule) => ruleRunsToday(rule))
        .flatMap((rule) => ruleIntervals(rule)
          .filter((interval) => invoiceDaysOverdue >= Number(interval.days))
          .map((interval) => ({ ...interval, ruleId: rule.id, reminderTime: rule.reminderTime })))
      : [{ type: scheduledReminderType(invoice.dueDate), days: invoiceDaysOverdue }].filter((item) => item.type);

    return scheduledTypes.flatMap((scheduled) => {
      const reminderType = scheduled.type;
      const key = `${invoice.invoiceId}:${reminderType}`;
      if (processedByKey.has(key)) return [];
      const totals = historyByKey.get(key) || {};
      if (reminderType !== "overdue_recurring" && Number(totals.reminderCount || 0) > 0) return [];
      return [{
        id: `scheduled-${scheduled.ruleId || "fixed"}-${key}`,
        ...invoice,
        reminderType,
        reminderSequence: reminderSequence(reminderType),
        scheduledAt: null,
        sentAt: null,
        attemptedAt: null,
        processedAt: null,
        currentReminderStatus: "Pending",
        deliveryStatus: "Pending",
        failureReason: "-",
        retryCount: Number(totals.failedCount || 0),
        outstandingBalance,
        daysOverdue: invoiceDaysOverdue,
        lastReminderSent: totals.lastReminderSent || null,
        nextReminderDue: ruleTableAvailable ? new Date().toISOString() : nextReminderDue(invoice.dueDate),
        reminderCount: Number(totals.reminderCount || 0)
      }];
    });
  });

  const scheduledToday = [...processed, ...pending];
  const sentToday = processed.filter((item) => item.deliveryStatus === "Sent");
  const failedToday = processed.filter((item) => item.deliveryStatus === "Failed");
  const overdueRequiringReminders = pending.filter((item) => Number(item.daysOverdue) > 0);

  return {
    timeZone: APPLICATION_TIMEZONE,
    counts: {
      sentToday: sentToday.length,
      scheduledToday: scheduledToday.length,
      failedToday: failedToday.length,
      overdueRequiringReminders: overdueRequiringReminders.length
    },
    details: { sentToday, scheduledToday, failedToday, overdueRequiringReminders }
  };
}

module.exports = { getAdminReminderMonitorData, todayUtcBounds };
