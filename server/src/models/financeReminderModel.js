/**
 * Finance Reminder Model
 *
 * Data-access layer for the unified finance_reminders table.
 * Consolidates invoice-level and subscription-level reminders
 * into a single module that Finance users can manage.
 *
 * Supports:
 * - Invoice due within 7 days
 * - Invoice due today
 * - Invoice overdue
 * - Payment failed
 * - Payment succeeded
 * - Subscription renewal due
 * - Invoice generation failed
 * - Bulk upload validation errors
 */

const { pool } = require("../config/db");

// ─── Reminder type → priority mapping (defaults) ──────────────────────────────

const REMINDER_PRIORITY_MAP = {
  invoice_due_7_days:              "Low",
  invoice_due_today:               "Medium",
  invoice_overdue:                 "High",
  payment_failed:                  "High",
  payment_succeeded:               "Low",
  subscription_renewal_due:        "Medium",
  invoice_generation_failed:       "High",
  bulk_upload_validation_error:    "Medium",
};

// ─── Reminder type → human-readable label ─────────────────────────────────────

const REMINDER_TYPE_LABELS = {
  invoice_due_7_days:              "Invoice due within 7 days",
  invoice_due_today:               "Invoice due today",
  invoice_overdue:                 "Invoice overdue",
  payment_failed:                  "Payment failed",
  payment_succeeded:               "Payment received",
  subscription_renewal_due:        "Subscription renewal approaching",
  invoice_generation_failed:       "Automatic invoice generation failed",
  bulk_upload_validation_error:    "Bulk upload contains validation errors",
};

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Fetch all finance reminders with optional filters.
 *
 * @param {number|null} companyId
 * @param {object} filters - { status, priority, reminderType, search, dateFrom, dateTo }
 * @returns {Promise<Array>}
 */
async function findAllFinanceReminders(companyId, filters = {}) {
  const conditions = [];
  const params = [];

  if (companyId) {
    conditions.push("fr.company_id = ?");
    params.push(companyId);
  }

  if (filters.status) {
    conditions.push("fr.status = ?");
    params.push(filters.status);
  } else {
    conditions.push("fr.status = 'Active'");
  }

  if (filters.priority) {
    conditions.push("fr.priority = ?");
    params.push(filters.priority);
  }

  if (filters.reminderType) {
    conditions.push("fr.reminder_type = ?");
    params.push(filters.reminderType);
  }

  if (filters.search) {
    conditions.push(
      "(fr.customer_name LIKE ? OR fr.invoice_number LIKE ? OR fr.title LIKE ? OR fr.message LIKE ?)"
    );
    const term = `%${filters.search}%`;
    params.push(term, term, term, term);
  }

  if (filters.dateFrom) {
    conditions.push("fr.created_at >= ?");
    params.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    conditions.push("fr.created_at <= ?");
    params.push(filters.dateTo);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `SELECT
       fr.reminder_id,
       fr.reminder_type,
       fr.priority,
       fr.title,
       fr.message,
       fr.invoice_id,
       fr.subscription_id,
       fr.customer_id,
       fr.company_id,
       fr.customer_name,
       fr.invoice_number,
       fr.amount,
       fr.due_date,
       fr.status,
       fr.resolved_at,
       fr.resolved_by,
       fr.notes,
       fr.created_at,
       fr.updated_at
     FROM finance_reminders fr
     ${where}
     ORDER BY
       FIELD(fr.priority, 'High', 'Medium', 'Low'),
       fr.created_at DESC
     LIMIT 500`,
    params
  );

  return rows;
}

/**
 * Get summary counts for the Finance reminder dashboard.
 */
async function getFinanceReminderSummary(companyId) {
  // Verify table exists first to avoid confusing error messages
  try {
    await pool.query("SELECT 1 FROM finance_reminders LIMIT 0");
  } catch (e) {
    // Table doesn't exist yet — return zeros
    return {
      total_active: 0, high_priority: 0, medium_priority: 0, low_priority: 0,
      overdue_count: 0, due_today_count: 0, due_soon_count: 0,
      payment_failed_count: 0, renewal_due_count: 0, generation_failed_count: 0,
    };
  }

  const companyFilter = companyId ? "AND fr.company_id = ?" : "";
  const params = companyId ? [companyId] : [];

  const [[totals]] = await pool.query(
    `SELECT
       COUNT(*) AS total_active,
       SUM(IF(fr.priority = 'High', 1, 0)) AS high_priority,
       SUM(IF(fr.priority = 'Medium', 1, 0)) AS medium_priority,
       SUM(IF(fr.priority = 'Low', 1, 0)) AS low_priority,
       SUM(IF(fr.reminder_type = 'invoice_overdue', 1, 0)) AS overdue_count,
       SUM(IF(fr.reminder_type = 'invoice_due_today', 1, 0)) AS due_today_count,
       SUM(IF(fr.reminder_type = 'invoice_due_7_days', 1, 0)) AS due_soon_count,
       SUM(IF(fr.reminder_type = 'payment_failed', 1, 0)) AS payment_failed_count,
       SUM(IF(fr.reminder_type = 'subscription_renewal_due', 1, 0)) AS renewal_due_count,
       SUM(IF(fr.reminder_type = 'invoice_generation_failed', 1, 0)) AS generation_failed_count
     FROM finance_reminders fr
     WHERE fr.status = 'Active'
       ${companyFilter}`,
    params
  );

  return {
    total_active:              Number(totals?.total_active || 0),
    high_priority:             Number(totals?.high_priority || 0),
    medium_priority:           Number(totals?.medium_priority || 0),
    low_priority:              Number(totals?.low_priority || 0),
    overdue_count:             Number(totals?.overdue_count || 0),
    due_today_count:           Number(totals?.due_today_count || 0),
    due_soon_count:            Number(totals?.due_soon_count || 0),
    payment_failed_count:      Number(totals?.payment_failed_count || 0),
    renewal_due_count:         Number(totals?.renewal_due_count || 0),
    generation_failed_count:   Number(totals?.generation_failed_count || 0),
  };
}

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Create a finance reminder. Prevents duplicates (same type + invoice/subscription + Active status).
 *
 * @param {object} data
 * @returns {Promise<{id: number, created: boolean}>}
 */
async function createFinanceReminder(data) {
  // Duplicate prevention
  const conditions = ["reminder_type = ?", "status = 'Active'"];
  const dupeParams = [data.reminderType];

  if (data.invoiceId) {
    conditions.push("invoice_id = ?");
    dupeParams.push(data.invoiceId);
  } else if (data.subscriptionId) {
    conditions.push("subscription_id = ?");
    dupeParams.push(data.subscriptionId);
  }

  const [existing] = await pool.query(
    `SELECT reminder_id FROM finance_reminders WHERE ${conditions.join(" AND ")} LIMIT 1`,
    dupeParams
  );

  if (existing.length > 0) {
    return { id: existing[0].reminder_id, created: false };
  }

  const priority = data.priority || REMINDER_PRIORITY_MAP[data.reminderType] || "Medium";
  const label = REMINDER_TYPE_LABELS[data.reminderType] || data.reminderType;
  const title = data.title || label;

  const [result] = await pool.query(
    `INSERT INTO finance_reminders
       (reminder_type, priority, title, message, invoice_id, subscription_id,
        customer_id, company_id, customer_name, invoice_number, amount, due_date, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.reminderType,
      priority,
      title,
      data.message || `${label}${data.customerName ? ` — ${data.customerName}` : ""}`,
      data.invoiceId || null,
      data.subscriptionId || null,
      data.customerId || null,
      data.companyId || null,
      data.customerName || null,
      data.invoiceNumber || null,
      data.amount || null,
      data.dueDate || null,
      data.notes || null,
    ]
  );

  return { id: result.insertId, created: true };
}

/**
 * Mark a reminder as completed.
 */
async function completeFinanceReminder(reminderId, userId) {
  const [result] = await pool.query(
    `UPDATE finance_reminders
     SET status = 'Completed', resolved_at = NOW(), resolved_by = ?
     WHERE reminder_id = ? AND status = 'Active'`,
    [userId || null, reminderId]
  );
  return result.affectedRows > 0;
}

/**
 * Dismiss a reminder.
 */
async function dismissFinanceReminder(reminderId, userId) {
  const [result] = await pool.query(
    `UPDATE finance_reminders
     SET status = 'Dismissed', resolved_at = NOW(), resolved_by = ?
     WHERE reminder_id = ? AND status = 'Active'`,
    [userId || null, reminderId]
  );
  return result.affectedRows > 0;
}

/**
 * Auto-resolve reminders for a given invoice when payment is received.
 */
async function autoResolveInvoiceReminders(invoiceId) {
  await pool.query(
    `UPDATE finance_reminders
     SET status = 'Completed', resolved_at = NOW(), notes = CONCAT(IFNULL(notes, ''), ' [Auto-resolved: payment received]')
     WHERE invoice_id = ? AND status = 'Active'
       AND reminder_type IN ('invoice_due_7_days', 'invoice_due_today', 'invoice_overdue', 'payment_failed')`,
    [invoiceId]
  );
}

/**
 * Generate invoice-based reminders by scanning unpaid invoices.
 * Called by the reminder notification scheduler.
 */
async function generateInvoiceReminders(companyId) {
  const today = new Date().toISOString().split("T")[0];
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  const weekAhead = sevenDaysFromNow.toISOString().split("T")[0];

  const companyFilter = companyId ? "AND i.company_id = ?" : "";
  const params = companyId ? [companyId] : [];
  let created = 0;

  // 1. Invoice due within 7 days
  const [dueSoon] = await pool.query(
    `SELECT i.invoice_id, i.invoiceId, i.total_amount, i.due_date, i.customer_id,
            i.company_id, c.name AS customer_name
     FROM invoice i
     INNER JOIN customer c ON c.customer_id = i.customer_id
     WHERE i.status IN ('Sent', 'Viewed')
       AND i.due_date BETWEEN ? AND ?
       AND i.invoiceId <> '__SETTINGS__'
       ${companyFilter}`,
    [today, weekAhead, ...params]
  );

  for (const inv of dueSoon) {
    const result = await createFinanceReminder({
      reminderType:  "invoice_due_7_days",
      invoiceId:     inv.invoice_id,
      customerId:    inv.customer_id,
      companyId:     inv.company_id,
      customerName:  inv.customer_name,
      invoiceNumber: inv.invoiceId,
      amount:        inv.total_amount,
      dueDate:       inv.due_date,
      message:       `Invoice ${inv.invoiceId} for ${inv.customer_name} is due on ${inv.due_date}`,
    });
    if (result.created) created++;
  }

  // 2. Invoice due today
  const [dueToday] = await pool.query(
    `SELECT i.invoice_id, i.invoiceId, i.total_amount, i.due_date, i.customer_id,
            i.company_id, c.name AS customer_name
     FROM invoice i
     INNER JOIN customer c ON c.customer_id = i.customer_id
     WHERE i.status IN ('Sent', 'Viewed')
       AND i.due_date = ?
       AND i.invoiceId <> '__SETTINGS__'
       ${companyFilter}`,
    [today, ...params]
  );

  for (const inv of dueToday) {
    const result = await createFinanceReminder({
      reminderType:  "invoice_due_today",
      invoiceId:     inv.invoice_id,
      customerId:    inv.customer_id,
      companyId:     inv.company_id,
      customerName:  inv.customer_name,
      invoiceNumber: inv.invoiceId,
      amount:        inv.total_amount,
      dueDate:       inv.due_date,
      message:       `Invoice ${inv.invoiceId} for ${inv.customer_name} (SGD ${Number(inv.total_amount).toFixed(2)}) is due today`,
    });
    if (result.created) created++;
  }

  // 3. Invoice overdue
  const [overdue] = await pool.query(
    `SELECT i.invoice_id, i.invoiceId, i.total_amount, i.due_date, i.customer_id,
            i.company_id, c.name AS customer_name
     FROM invoice i
     INNER JOIN customer c ON c.customer_id = i.customer_id
     WHERE i.status IN ('Sent', 'Viewed', 'Overdue')
       AND i.due_date < ?
       AND i.invoiceId <> '__SETTINGS__'
       ${companyFilter}`,
    [today, ...params]
  );

  for (const inv of overdue) {
    const result = await createFinanceReminder({
      reminderType:  "invoice_overdue",
      invoiceId:     inv.invoice_id,
      customerId:    inv.customer_id,
      companyId:     inv.company_id,
      customerName:  inv.customer_name,
      invoiceNumber: inv.invoiceId,
      amount:        inv.total_amount,
      dueDate:       inv.due_date,
      message:       `Invoice ${inv.invoiceId} for ${inv.customer_name} (SGD ${Number(inv.total_amount).toFixed(2)}) is overdue since ${inv.due_date}`,
    });
    if (result.created) created++;
  }

  return { created };
}

module.exports = {
  REMINDER_PRIORITY_MAP,
  REMINDER_TYPE_LABELS,
  findAllFinanceReminders,
  getFinanceReminderSummary,
  createFinanceReminder,
  completeFinanceReminder,
  dismissFinanceReminder,
  autoResolveInvoiceReminders,
  generateInvoiceReminders,
};
