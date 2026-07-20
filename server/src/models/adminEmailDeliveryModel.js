const { pool } = require("../config/db");
const { todayUtcBounds } = require("./adminReminderMonitorModel");

const SUCCESS = new Set(["sent", "success", "successful", "delivered", "accepted"]);
const FAILED = new Set(["failed", "rejected", "bounced", "error"]);
const PENDING = new Set(["pending", "queued", "processing", "scheduled"]);

function parseMetadata(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch { return {}; }
}

function deliveryKind(value, action = "") {
  const status = String(value || "").trim().toLowerCase();
  const normalizedAction = String(action || "").trim().toLowerCase();
  if (FAILED.has(status) || /(failed|rejected|bounced|error)/.test(normalizedAction)) return "Failed";
  if (PENDING.has(status)) return status === "processing" ? "Processing" : status === "scheduled" ? "Scheduled" : status === "queued" ? "Queued" : "Pending";
  if (SUCCESS.has(status) || ["invoice_sent", "scheduled_invoice_sent"].includes(normalizedAction)) return "Sent";
  return null;
}

function emailTypeFor(row, metadata) {
  const action = String(row.actionDescription || "").toLowerCase();
  const activity = String(row.activityType || "").toLowerCase();
  if (metadata.emailType) return metadata.emailType;
  if (activity.includes("reminder") || action.startsWith("reminder:")) return "Payment Reminder";
  if (action.includes("receipt")) return "Payment Receipt";
  if (action.includes("payment_confirmation")) return "Payment Confirmation";
  if (action.includes("proof_approved")) return "Payment Proof Approved";
  if (action.includes("proof_rejected")) return "Payment Proof Rejected";
  return "Invoice Issued";
}

function subjectFor(type, invoiceNumber, metadata) {
  if (metadata.subject) return metadata.subject;
  return "-";
}

function mapAuditRow(row) {
  const metadata = parseMetadata(row.metadata);
  const status = deliveryKind(row.deliveryStatus || row.auditStatus, row.actionDescription);
  if (!status) return null;
  const emailType = emailTypeFor(row, metadata);
  const invoiceNumber = row.invoiceNumber || metadata.invoiceNumber || "-";
  const occurredAt = row.occurredAt;
  return {
    id: `audit-${row.id}`,
    source: "Audit log",
    emailType,
    invoiceId: Number(row.invoiceId) || null,
    invoiceNumber,
    customerName: row.customerName || metadata.customerName || "-",
    recipientEmail: row.recipientEmail || metadata.customerEmail || metadata.recipientEmail || "-",
    subject: subjectFor(emailType, invoiceNumber === "-" ? null : invoiceNumber, metadata),
    deliveryStatus: status,
    provider: metadata.provider || (metadata.messageId ? "SMTP" : "-"),
    providerMessageId: metadata.messageId || null,
    reminderType: metadata.reminderType || row.reminderType || (String(row.actionDescription || "").startsWith("reminder:") ? String(row.actionDescription).replace(/^reminder:/i, "") : null),
    sentAt: status === "Sent" ? occurredAt : null,
    attemptedAt: status === "Failed" ? occurredAt : null,
    createdAt: occurredAt,
    scheduledAt: metadata.scheduledAt || null,
    processingStartedAt: metadata.processingStartedAt || null,
    failureReason: metadata.failureReason || metadata.errorMessage || metadata.message || null,
    errorCode: metadata.errorCode || metadata.code || null,
    retryCount: Number(metadata.retryCount || 0),
    lastRetryAt: metadata.lastRetryAt || null,
    invoiceStatus: row.invoiceStatus || "-",
    triggerSource: metadata.triggerSource || row.createdBy || "System"
  };
}

async function loadAuditDeliveries() {
  const [rows] = await pool.query(
    `SELECT al.audit_log_id AS id, al.activity_type AS activityType,
       al.action_description AS actionDescription, al.status AS auditStatus,
       al.delivery_status AS deliveryStatus, al.created_at AS occurredAt,
       al.new_value AS metadata, al.reminder_type AS reminderType,
       al.user_name AS createdBy,
       COALESCE(al.invoice_id, CAST(al.affected_record AS UNSIGNED)) AS invoiceId,
       COALESCE(al.customer_email, c.email) AS recipientEmail,
       i.invoiceId AS invoiceNumber, i.status AS invoiceStatus, c.name AS customerName
     FROM audit_logs al
     LEFT JOIN invoice i ON i.invoice_id = COALESCE(al.invoice_id, CAST(al.affected_record AS UNSIGNED))
     LEFT JOIN customer c ON c.customer_id = i.customer_id
     WHERE LOWER(COALESCE(al.module, '')) = 'invoice'
       AND (
         LOWER(COALESCE(al.activity_type, '')) IN ('invoice_reminder', 'email_delivery')
         OR LOWER(COALESCE(al.action_description, '')) IN (
           'invoice_sent', 'scheduled_invoice_sent', 'invoice_email_failed',
           'payment_receipt_sent', 'payment_receipt_email_failed',
           'payment_confirmation_sent', 'payment_confirmation_email_failed',
           'payment_proof_approved_email_sent', 'payment_proof_approved_email_failed',
           'payment_proof_rejected_email_sent', 'payment_proof_rejected_email_failed'
         )
       )
     ORDER BY al.created_at DESC, al.audit_log_id DESC
     LIMIT 5000`
  );
  return rows.map(mapAuditRow).filter(Boolean);
}

async function loadLegacyReminderDeliveries() {
  try {
    const [rows] = await pool.query(
      `SELECT rl.reminder_log_id AS id, rl.invoice_id AS invoiceId,
         rl.invoice_number AS invoiceNumber, c.name AS customerName,
         COALESCE(rl.client_email, c.email) AS recipientEmail,
         rl.reminder_type AS reminderType, rl.delivery_status AS deliveryStatus,
         rl.sent_at AS occurredAt, rl.error_message AS failureReason,
         i.status AS invoiceStatus
       FROM reminder_logs rl
       LEFT JOIN invoice i ON i.invoice_id = rl.invoice_id
       LEFT JOIN customer c ON c.customer_id = i.customer_id
       WHERE LOWER(COALESCE(rl.delivery_channel, 'email')) = 'email'
       ORDER BY rl.sent_at DESC, rl.reminder_log_id DESC
       LIMIT 5000`
    );
    return rows.map((row) => mapAuditRow({
      ...row,
      id: `reminder-${row.id}`,
      activityType: "invoice_reminder",
      actionDescription: `reminder:${row.reminderType}`,
      auditStatus: row.deliveryStatus,
      metadata: JSON.stringify({ reminderType: row.reminderType, failureReason: row.failureReason })
    })).map((row) => row ? { ...row, id: row.id.replace("audit-reminder-", "reminder-") } : null).filter(Boolean);
  } catch (error) {
    if (["ER_NO_SUCH_TABLE", "ER_BAD_FIELD_ERROR"].includes(error?.code)) return [];
    throw error;
  }
}

async function loadPendingScheduledInvoices() {
  const [rows] = await pool.query(
    `SELECT i.invoice_id AS invoiceId, i.invoiceId AS invoiceNumber,
       i.status AS invoiceStatus, i.scheduled_at AS scheduledAt,
       i.created_at AS createdAt, c.name AS customerName, c.email AS recipientEmail
     FROM invoice i
     LEFT JOIN customer c ON c.customer_id = i.customer_id
     WHERE LOWER(i.status) = 'scheduled' AND i.scheduled_at IS NOT NULL
     ORDER BY i.scheduled_at ASC, i.invoice_id ASC`
  );
  return rows.map((row) => ({
    id: `scheduled-invoice-${row.invoiceId}`,
    source: "Invoice scheduler",
    emailType: "Invoice Issued",
    invoiceId: Number(row.invoiceId),
    invoiceNumber: row.invoiceNumber || `INV-${row.invoiceId}`,
    customerName: row.customerName || "-",
    recipientEmail: row.recipientEmail || "-",
    subject: subjectFor("Invoice Issued", row.invoiceNumber),
    deliveryStatus: "Scheduled",
    provider: "-",
    providerMessageId: null,
    reminderType: null,
    sentAt: null,
    attemptedAt: null,
    createdAt: row.createdAt,
    scheduledAt: row.scheduledAt,
    processingStartedAt: null,
    failureReason: null,
    errorCode: null,
    retryCount: 0,
    lastRetryAt: null,
    invoiceStatus: row.invoiceStatus,
    triggerSource: "System"
  }));
}

function withinToday(value, bounds) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return time >= new Date(`${bounds.start}Z`).getTime() && time < new Date(`${bounds.end}Z`).getTime();
}

function applyFilters(records, options) {
  const status = String(options.status || "").toLowerCase();
  const emailType = String(options.emailType || "").toLowerCase();
  const keyword = String(options.keyword || "").trim().toLowerCase();
  const dateFrom = /^\d{4}-\d{2}-\d{2}$/.test(options.dateFrom || "") ? new Date(`${options.dateFrom}T00:00:00+08:00`).getTime() : null;
  const dateTo = /^\d{4}-\d{2}-\d{2}$/.test(options.dateTo || "") ? new Date(`${options.dateTo}T23:59:59.999+08:00`).getTime() : null;
  return records.filter((record) => {
    if (status && record.deliveryStatus.toLowerCase() !== status) return false;
    if (emailType && record.emailType.toLowerCase() !== emailType) return false;
    const date = new Date(record.sentAt || record.attemptedAt || record.scheduledAt || record.createdAt || 0).getTime();
    if (dateFrom && date < dateFrom) return false;
    if (dateTo && date > dateTo) return false;
    if (!keyword) return true;
    return [record.invoiceNumber, record.customerName, record.recipientEmail, record.subject, record.provider, record.reminderType]
      .some((value) => String(value || "").toLowerCase().includes(keyword));
  });
}

function deduplicateAndAddRetries(records) {
  const fingerprints = new Set();
  const unique = records.filter((record) => {
    if (record.source === "Invoice scheduler") return true;
    const timestamp = new Date(record.sentAt || record.attemptedAt || record.createdAt || 0).toISOString();
    const fingerprint = [record.invoiceId, record.emailType, record.reminderType, record.recipientEmail, record.deliveryStatus, timestamp].join("|").toLowerCase();
    if (fingerprints.has(fingerprint)) return false;
    fingerprints.add(fingerprint);
    return true;
  });
  const failures = new Map();
  return [...unique]
    .sort((a, b) => new Date(a.sentAt || a.attemptedAt || a.scheduledAt || a.createdAt || 0) - new Date(b.sentAt || b.attemptedAt || b.scheduledAt || b.createdAt || 0))
    .map((record) => {
      const key = [record.invoiceId, record.emailType, record.reminderType || ""].join("|");
      const previous = failures.get(key) || [];
      const enriched = {
        ...record,
        retryCount: Math.max(Number(record.retryCount || 0), previous.length),
        lastRetryAt: record.lastRetryAt || (previous.length ? previous[previous.length - 1] : null)
      };
      if (record.deliveryStatus === "Failed") failures.set(key, [...previous, record.attemptedAt || record.createdAt]);
      return enriched;
    });
}

async function getAdminEmailDeliveryData(options = {}) {
  const [audit, legacy, pending] = await Promise.all([
    loadAuditDeliveries(), loadLegacyReminderDeliveries(), loadPendingScheduledInvoices()
  ]);
  const byId = new Map([...audit, ...legacy, ...pending].map((record) => [record.id, record]));
  const records = deduplicateAndAddRetries(Array.from(byId.values()))
    .sort((a, b) => new Date(b.sentAt || b.attemptedAt || b.scheduledAt || b.createdAt || 0) - new Date(a.sentAt || a.attemptedAt || a.scheduledAt || a.createdAt || 0));
  const bounds = todayUtcBounds();
  const successfulToday = records.filter((record) => record.deliveryStatus === "Sent" && withinToday(record.sentAt, bounds));
  const failedToday = records.filter((record) => record.deliveryStatus === "Failed" && withinToday(record.attemptedAt || record.createdAt, bounds));
  const pendingDelivery = records.filter((record) => ["Pending", "Queued", "Processing", "Scheduled"].includes(record.deliveryStatus));
  const completed = successfulToday.length + failedToday.length;
  const summary = {
    successfulToday: successfulToday.length,
    failedToday: failedToday.length,
    pendingDelivery: pendingDelivery.length,
    deliveryRate: completed ? Number(((successfulToday.length / completed) * 100).toFixed(1)) : 0
  };
  const category = String(options.category || "logs").toLowerCase();
  const categoryRows = category === "successful-today" ? successfulToday
    : category === "failed-today" ? failedToday
      : category === "pending-delivery" ? pendingDelivery
        : category === "delivery-rate" ? [...successfulToday, ...failedToday]
          : records;
  const filtered = applyFilters(categoryRows, options);
  const page = Math.max(1, Number.parseInt(options.page, 10) || 1);
  const pageSize = Math.max(5, Math.min(100, Number.parseInt(options.pageSize, 10) || 20));
  return {
    summary,
    category,
    records: filtered.slice((page - 1) * pageSize, page * pageSize),
    pagination: { page, pageSize, total: filtered.length, totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)) },
    timeZone: "Asia/Singapore",
    successDefinition: "Accepted by the configured SMTP or email provider"
  };
}

module.exports = { deliveryKind, getAdminEmailDeliveryData };
