/**
 * WhatsApp Notification Model
 *
 * Data-access layer for WhatsApp notification settings, logs, and customer WhatsApp data.
 * All queries use parameterized statements. No business logic here — pure SQL.
 */

const { pool } = require("../config/db");

// ─── Notification Settings ────────────────────────────────────────────────────

/**
 * Get the current notification settings (single row).
 * @returns {Object|null}
 */
async function getSettings() {
  const [rows] = await pool.query("SELECT * FROM notification_settings LIMIT 1");
  if (!rows[0]) return null;
  const row = rows[0];
  // Parse reminder_days_before JSON
  if (typeof row.reminder_days_before === "string") {
    try { row.reminder_days_before = JSON.parse(row.reminder_days_before); } catch { row.reminder_days_before = [7, 3, 1]; }
  }
  return row;
}

/**
 * Update notification settings.
 * @param {Object} settings - Fields to update.
 * @returns {Object} Updated settings row.
 */
async function updateSettings(settings) {
  const {
    whatsapp_enabled,
    send_invoice_created,
    send_payment_received,
    send_payment_reminder,
    send_overdue_notice,
    send_subscription_invoice,
    reminder_days_before
  } = settings;

  const reminderJson = Array.isArray(reminder_days_before)
    ? JSON.stringify(reminder_days_before)
    : (reminder_days_before || "[7, 3, 1]");

  // Upsert: update existing row or insert if none exists
  const [existing] = await pool.query("SELECT id FROM notification_settings LIMIT 1");

  if (existing.length > 0) {
    await pool.query(
      `UPDATE notification_settings SET
        whatsapp_enabled = ?,
        send_invoice_created = ?,
        send_payment_received = ?,
        send_payment_reminder = ?,
        send_overdue_notice = ?,
        send_subscription_invoice = ?,
        reminder_days_before = ?,
        updated_at = NOW()
      WHERE id = ?`,
      [
        whatsapp_enabled ? 1 : 0,
        send_invoice_created ? 1 : 0,
        send_payment_received ? 1 : 0,
        send_payment_reminder ? 1 : 0,
        send_overdue_notice ? 1 : 0,
        send_subscription_invoice ? 1 : 0,
        reminderJson,
        existing[0].id
      ]
    );
  } else {
    await pool.query(
      `INSERT INTO notification_settings
        (whatsapp_enabled, send_invoice_created, send_payment_received, send_payment_reminder, send_overdue_notice, send_subscription_invoice, reminder_days_before)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        whatsapp_enabled ? 1 : 0,
        send_invoice_created ? 1 : 0,
        send_payment_received ? 1 : 0,
        send_payment_reminder ? 1 : 0,
        send_overdue_notice ? 1 : 0,
        send_subscription_invoice ? 1 : 0,
        reminderJson
      ]
    );
  }

  return getSettings();
}

// ─── Notification Logs ────────────────────────────────────────────────────────

/**
 * Insert a notification log entry.
 * @param {Object} log
 * @returns {number} Insert ID.
 */
async function createLog(log) {
  const {
    customer_id = null,
    invoice_id = null,
    notification_type,
    message,
    status = "pending",
    provider = "twilio",
    phone_number = null,
    message_id = null,
    sent_at = null,
    error_message = null
  } = log;

  const [result] = await pool.query(
    `INSERT INTO whatsapp_notification_logs
      (customer_id, invoice_id, notification_type, message, status, provider, phone_number, message_id, sent_at, error_message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [customer_id, invoice_id, notification_type, message, status, provider, phone_number, message_id, sent_at, error_message]
  );

  return result.insertId;
}

/**
 * Update log status after send attempt.
 * @param {number} logId
 * @param {Object} update - { status, message_id, sent_at, error_message, retry_count }
 */
async function updateLog(logId, update) {
  const fields = [];
  const params = [];

  if (update.status !== undefined) { fields.push("status = ?"); params.push(update.status); }
  if (update.message_id !== undefined) { fields.push("message_id = ?"); params.push(update.message_id); }
  if (update.sent_at !== undefined) { fields.push("sent_at = ?"); params.push(update.sent_at); }
  if (update.error_message !== undefined) { fields.push("error_message = ?"); params.push(update.error_message); }
  if (update.retry_count !== undefined) { fields.push("retry_count = ?"); params.push(update.retry_count); }

  if (fields.length === 0) return;

  params.push(logId);
  await pool.query(`UPDATE whatsapp_notification_logs SET ${fields.join(", ")} WHERE id = ?`, params);
}

/**
 * Get notification logs with filtering, pagination, search, and sorting.
 * @param {Object} filters - { page, limit, search, notification_type, status, sort_by, sort_order }
 * @returns {Object} { logs, total, page, limit, totalPages }
 */
async function getLogs(filters = {}) {
  const {
    page = 1,
    limit = 20,
    search = "",
    notification_type = "",
    status = "",
    sort_by = "created_at",
    sort_order = "DESC"
  } = filters;

  const conditions = [];
  const params = [];

  if (notification_type) {
    conditions.push("wl.notification_type = ?");
    params.push(notification_type);
  }

  if (status) {
    conditions.push("wl.status = ?");
    params.push(status);
  }

  if (search) {
    conditions.push("(c.name LIKE ? OR wl.phone_number LIKE ? OR i.invoiceId LIKE ?)");
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Validate sort column
  const allowedSorts = ["created_at", "sent_at", "notification_type", "status"];
  const sortCol = allowedSorts.includes(sort_by) ? `wl.${sort_by}` : "wl.created_at";
  const sortDir = sort_order.toUpperCase() === "ASC" ? "ASC" : "DESC";

  // Count total
  const countParams = [...params];
  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM whatsapp_notification_logs wl
     LEFT JOIN customer c ON c.customer_id = wl.customer_id
     LEFT JOIN invoice i ON i.invoice_id = wl.invoice_id
     ${whereClause}`,
    countParams
  );
  const total = countRows[0].total;

  // Fetch page
  const offset = (page - 1) * limit;
  params.push(Number(limit), Number(offset));

  const [rows] = await pool.query(
    `SELECT
       wl.id,
       wl.customer_id,
       wl.invoice_id,
       wl.notification_type,
       wl.message,
       wl.status,
       wl.provider,
       wl.phone_number,
       wl.message_id,
       wl.sent_at,
       wl.error_message,
       wl.retry_count,
       wl.created_at,
       c.name AS customer_name,
       i.invoiceId AS invoice_number
     FROM whatsapp_notification_logs wl
     LEFT JOIN customer c ON c.customer_id = wl.customer_id
     LEFT JOIN invoice i ON i.invoice_id = wl.invoice_id
     ${whereClause}
     ORDER BY ${sortCol} ${sortDir}
     LIMIT ? OFFSET ?`,
    params
  );

  return {
    logs: rows,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit)
  };
}

/**
 * Get dashboard stats for WhatsApp notifications.
 * @returns {Object} { today_sent, today_failed, today_pending, total_sent }
 */
async function getDashboardStats() {
  const [rows] = await pool.query(`
    SELECT
      SUM(CASE WHEN DATE(created_at) = CURDATE() AND status = 'sent' THEN 1 ELSE 0 END) AS today_sent,
      SUM(CASE WHEN DATE(created_at) = CURDATE() AND status = 'failed' THEN 1 ELSE 0 END) AS today_failed,
      SUM(CASE WHEN DATE(created_at) = CURDATE() AND status = 'pending' THEN 1 ELSE 0 END) AS today_pending,
      SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS total_sent
    FROM whatsapp_notification_logs
  `);

  const stats = rows[0] || {};
  return {
    today_sent: Number(stats.today_sent || 0),
    today_failed: Number(stats.today_failed || 0),
    today_pending: Number(stats.today_pending || 0),
    total_sent: Number(stats.total_sent || 0)
  };
}

/**
 * Get recent notification logs (for dashboard widget).
 * @param {number} limit
 * @returns {Array}
 */
async function getRecentLogs(limit = 10) {
  const [rows] = await pool.query(
    `SELECT
       wl.id,
       wl.notification_type,
       wl.status,
       wl.phone_number,
       wl.sent_at,
       wl.created_at,
       c.name AS customer_name,
       i.invoiceId AS invoice_number
     FROM whatsapp_notification_logs wl
     LEFT JOIN customer c ON c.customer_id = wl.customer_id
     LEFT JOIN invoice i ON i.invoice_id = wl.invoice_id
     ORDER BY wl.created_at DESC
     LIMIT ?`,
    [limit]
  );
  return rows;
}

/**
 * Check if a notification of a given type was already sent for an invoice today.
 * Used to prevent duplicate reminders.
 * @param {number} invoiceId
 * @param {string} notificationType
 * @returns {boolean}
 */
async function hasNotificationSentToday(invoiceId, notificationType) {
  const [rows] = await pool.query(
    `SELECT id FROM whatsapp_notification_logs
     WHERE invoice_id = ? AND notification_type = ? AND status = 'sent' AND DATE(sent_at) = CURDATE()
     LIMIT 1`,
    [invoiceId, notificationType]
  );
  return rows.length > 0;
}

/**
 * Get failed logs eligible for retry (max 3 retries).
 * @returns {Array}
 */
async function getRetryableLogs() {
  const [rows] = await pool.query(
    `SELECT * FROM whatsapp_notification_logs
     WHERE status = 'failed' AND retry_count < 3
     ORDER BY created_at ASC
     LIMIT 50`
  );
  return rows;
}

// ─── Customer WhatsApp Data ───────────────────────────────────────────────────

/**
 * Update customer WhatsApp number.
 * @param {number} customerId
 * @param {string} whatsappNumber
 * @returns {boolean}
 */
async function updateCustomerWhatsApp(customerId, whatsappNumber) {
  const [result] = await pool.query(
    "UPDATE customer SET whatsapp_number = ?, whatsapp_verified = FALSE WHERE customer_id = ?",
    [whatsappNumber, customerId]
  );
  return result.affectedRows > 0;
}

/**
 * Mark customer WhatsApp as verified.
 * @param {number} customerId
 * @returns {boolean}
 */
async function verifyCustomerWhatsApp(customerId) {
  const [result] = await pool.query(
    "UPDATE customer SET whatsapp_verified = TRUE WHERE customer_id = ?",
    [customerId]
  );
  return result.affectedRows > 0;
}

/**
 * Get customer with WhatsApp info.
 * @param {number} customerId
 * @returns {Object|null}
 */
async function getCustomerWithWhatsApp(customerId) {
  const [rows] = await pool.query(
    "SELECT customer_id, name, email, address, whatsapp_number, whatsapp_verified FROM customer WHERE customer_id = ?",
    [customerId]
  );
  return rows[0] || null;
}

/**
 * Get all customers with WhatsApp numbers for notification purposes.
 * @returns {Array}
 */
async function getCustomersWithWhatsApp() {
  const [rows] = await pool.query(
    `SELECT customer_id, name, email, whatsapp_number, whatsapp_verified
     FROM customer
     WHERE whatsapp_number IS NOT NULL AND whatsapp_number != ''`
  );
  return rows;
}

/**
 * Get invoices due within N days that haven't had a reminder sent today.
 * @param {number} daysBefore - Number of days before due date.
 * @returns {Array}
 */
async function getInvoicesDueInDays(daysBefore) {
  const [rows] = await pool.query(
    `SELECT
       i.invoice_id,
       i.invoiceId,
       i.due_date,
       i.total_amount,
       i.status,
       c.customer_id,
       c.name AS customer_name,
       c.whatsapp_number,
       c.whatsapp_verified
     FROM invoice i
     INNER JOIN customer c ON c.customer_id = i.customer_id
     WHERE i.status IN ('Sent', 'Viewed')
       AND DATE(i.due_date) = DATE_ADD(CURDATE(), INTERVAL ? DAY)
       AND c.whatsapp_number IS NOT NULL
       AND c.whatsapp_number != ''
       AND i.invoice_id NOT IN (
         SELECT invoice_id FROM whatsapp_notification_logs
         WHERE notification_type = 'payment_reminder' AND status = 'sent' AND DATE(sent_at) = CURDATE()
         AND invoice_id IS NOT NULL
       )`,
    [daysBefore]
  );
  return rows;
}

/**
 * Get overdue invoices that haven't had an overdue notice sent today.
 * @returns {Array}
 */
async function getOverdueInvoices() {
  const [rows] = await pool.query(
    `SELECT
       i.invoice_id,
       i.invoiceId,
       i.due_date,
       i.total_amount,
       i.status,
       c.customer_id,
       c.name AS customer_name,
       c.whatsapp_number,
       c.whatsapp_verified
     FROM invoice i
     INNER JOIN customer c ON c.customer_id = i.customer_id
     WHERE i.status = 'Overdue'
       AND c.whatsapp_number IS NOT NULL
       AND c.whatsapp_number != ''
       AND i.invoice_id NOT IN (
         SELECT invoice_id FROM whatsapp_notification_logs
         WHERE notification_type = 'overdue_notice' AND status = 'sent' AND DATE(sent_at) = CURDATE()
         AND invoice_id IS NOT NULL
       )`
  );
  return rows;
}

// ─── Webhook / Delivery Status Functions ──────────────────────────────────────

/**
 * Update a notification log by Twilio message SID.
 * Used by the status callback webhook.
 * @param {string} messageSid - The Twilio message SID.
 * @param {Object} update - { status, error_message }
 * @returns {boolean} Whether a log was found and updated.
 */
async function updateLogByMessageId(messageSid, update) {
  if (!messageSid) return false;

  const fields = [];
  const params = [];

  if (update.status !== undefined) {
    fields.push("status = ?");
    params.push(update.status);
    // Also update delivery_status column
    fields.push("delivery_status = ?");
    params.push(update.status);
  }
  if (update.error_message !== undefined) {
    fields.push("error_message = ?");
    params.push(update.error_message);
  }
  // Track delivered_at and read_at timestamps
  if (update.status === "delivered") {
    fields.push("delivered_at = NOW()");
  }
  if (update.status === "read") {
    fields.push("read_at = NOW()");
  }

  if (fields.length === 0) return false;

  params.push(messageSid);
  const [result] = await pool.query(
    `UPDATE whatsapp_notification_logs SET ${fields.join(", ")} WHERE message_id = ?`,
    params
  );
  return result.affectedRows > 0;
}

/**
 * Get communication history logs for a specific invoice.
 * @param {number} invoiceId
 * @returns {Array}
 */
async function getLogsByInvoiceId(invoiceId) {
  const [rows] = await pool.query(
    `SELECT
       wl.id,
       wl.notification_type,
       wl.message,
       wl.status,
       wl.delivery_status,
       wl.provider,
       wl.phone_number,
       wl.message_id,
       wl.sent_at,
       wl.delivered_at,
       wl.read_at,
       wl.error_message,
       wl.retry_count,
       wl.created_at,
       c.name AS customer_name
     FROM whatsapp_notification_logs wl
     LEFT JOIN customer c ON c.customer_id = wl.customer_id
     WHERE wl.invoice_id = ?
     ORDER BY wl.created_at DESC`,
    [invoiceId]
  );
  return rows;
}

/**
 * Get communication history logs for a specific customer.
 * @param {number} customerId
 * @param {number} [limit=50]
 * @returns {Array}
 */
async function getLogsByCustomerId(customerId, limit = 50) {
  const [rows] = await pool.query(
    `SELECT
       wl.id,
       wl.invoice_id,
       wl.notification_type,
       wl.message,
       wl.status,
       wl.delivery_status,
       wl.phone_number,
       wl.message_id,
       wl.sent_at,
       wl.delivered_at,
       wl.read_at,
       wl.error_message,
       wl.retry_count,
       wl.created_at,
       i.invoiceId AS invoice_number
     FROM whatsapp_notification_logs wl
     LEFT JOIN invoice i ON i.invoice_id = wl.invoice_id
     WHERE wl.customer_id = ?
     ORDER BY wl.created_at DESC
     LIMIT ?`,
    [customerId, limit]
  );
  return rows;
}

module.exports = {
  // Settings
  getSettings,
  updateSettings,
  // Logs
  createLog,
  updateLog,
  updateLogByMessageId,
  getLogs,
  getLogsByInvoiceId,
  getLogsByCustomerId,
  getDashboardStats,
  getRecentLogs,
  hasNotificationSentToday,
  getRetryableLogs,
  // Customer
  updateCustomerWhatsApp,
  verifyCustomerWhatsApp,
  getCustomerWithWhatsApp,
  getCustomersWithWhatsApp,
  // Scheduler helpers
  getInvoicesDueInDays,
  getOverdueInvoices
};
