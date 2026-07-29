/**
 * EVALUATION HEADER
 * FEATURE: SHARED / APPLICATION CORE
 * PURPOSE: Provides reusable integration Log Service business or integration operations.
 * LAYER: Backend service - contains reusable business rules or external integrations.
 * FIND RELATED CODE: Use Find All References to locate controllers, workers, or services that call it.
 */
/**
 * Integration Log Service
 *
 * Manages email_delivery_logs for tracking all outbound SMTP emails.
 * Provides deduplication, status tracking, and retry support.
 *
 * Statuses: pending → sent | failed
 * (SMTP acceptance does not guarantee inbox delivery — only "Sent" or "Failed")
 */

const { pool } = require("../config/db");

// ─── Email Delivery Logs ──────────────────────────────────────────────────────

/**
 * Create a pending email delivery log entry.
 *
 * @param {Object} params
 * @param {number|null} params.customerId
 * @param {number|null} params.invoiceId
 * @param {number|null} params.paymentId
 * @param {string} params.emailType - invoice_email | payment_link | payment_confirmation | payment_failure | reminder | overdue_reminder | test_email
 * @param {string} params.recipient
 * @param {string} params.subject
 * @param {string|null} params.deduplicationKey - Unique key to prevent duplicate sends
 * @param {string} params.triggeredBy - system | user | scheduler | webhook
 * @param {number|null} params.triggeredByUserId
 * @returns {number|null} Insert ID or null if duplicate
 */
async function createEmailLog(params) {
  const {
    customerId = null,
    invoiceId = null,
    paymentId = null,
    emailType,
    recipient,
    subject = null,
    deduplicationKey = null,
    triggeredBy = "system",
    triggeredByUserId = null
  } = params;

  try {
    const [result] = await pool.query(
      `INSERT INTO email_delivery_logs
        (customer_id, invoice_id, payment_id, email_type, recipient, subject, status, deduplication_key, triggered_by, triggered_by_user_id, last_attempted_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, NOW())`,
      [customerId, invoiceId, paymentId, emailType, recipient, subject, deduplicationKey, triggeredBy, triggeredByUserId]
    );
    return result.insertId;
  } catch (err) {
    // Duplicate deduplication_key — email already sent/logged
    if (err.code === "ER_DUP_ENTRY") {
      return null;
    }
    // Table may not exist yet (pre-migration) — log to console and continue
    if (err.code === "ER_NO_SUCH_TABLE") {
      return null;
    }
    throw err;
  }
}

/**
 * Mark an email log as sent.
 *
 * @param {number} logId
 * @param {string} smtpMessageId - Nodemailer message ID
 */
async function markEmailSent(logId, smtpMessageId) {
  if (!logId) return;
  try {
    await pool.query(
      "UPDATE email_delivery_logs SET status = 'sent', smtp_message_id = ?, sent_at = NOW() WHERE id = ?",
      [smtpMessageId || null, logId]
    );
  } catch { /* non-critical */ }
}

/**
 * Mark an email log as failed.
 *
 * @param {number} logId
 * @param {string} failureCode
 * @param {string} failureMessage
 */
async function markEmailFailed(logId, failureCode, failureMessage) {
  if (!logId) return;
  try {
    await pool.query(
      "UPDATE email_delivery_logs SET status = 'failed', failure_code = ?, failure_message = ?, last_attempted_at = NOW() WHERE id = ?",
      [failureCode || null, (failureMessage || "").substring(0, 500), logId]
    );
  } catch { /* non-critical */ }
}

/**
 * Check if an email with the given deduplication key has already been sent.
 *
 * @param {string} deduplicationKey
 * @returns {boolean}
 */
async function isDuplicateEmail(deduplicationKey) {
  if (!deduplicationKey) return false;
  try {
    const [rows] = await pool.query(
      "SELECT id, status FROM email_delivery_logs WHERE deduplication_key = ? LIMIT 1",
      [deduplicationKey]
    );
    if (rows.length === 0) return false;
    // Only consider it a duplicate if it was successfully sent
    return rows[0].status === "sent";
  } catch {
    return false;
  }
}

/**
 * Increment attempt count and update last_attempted_at for a retry.
 *
 * @param {number} logId
 */
async function incrementAttempt(logId) {
  if (!logId) return;
  try {
    await pool.query(
      "UPDATE email_delivery_logs SET attempt_count = attempt_count + 1, status = 'pending', last_attempted_at = NOW(), failure_code = NULL, failure_message = NULL WHERE id = ?",
      [logId]
    );
  } catch { /* non-critical */ }
}

/**
 * Get email delivery logs with filtering and pagination.
 *
 * @param {Object} filters
 * @returns {Object} { logs, total, page, limit, totalPages }
 */
async function getEmailLogs(filters = {}) {
  const { page = 1, limit = 20, email_type, status, invoice_id, customer_id } = filters;

  const conditions = [];
  const params = [];

  if (email_type) { conditions.push("email_type = ?"); params.push(email_type); }
  if (status) { conditions.push("status = ?"); params.push(status); }
  if (invoice_id) { conditions.push("invoice_id = ?"); params.push(invoice_id); }
  if (customer_id) { conditions.push("customer_id = ?"); params.push(customer_id); }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM email_delivery_logs ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    const offset = (page - 1) * limit;
    const [rows] = await pool.query(
      `SELECT * FROM email_delivery_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );

    return { logs: rows, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / limit) };
  } catch (err) {
    if (err.code === "ER_NO_SUCH_TABLE") {
      return { logs: [], total: 0, page: 1, limit: 20, totalPages: 0 };
    }
    throw err;
  }
}

/**
 * Get a single email log by ID.
 *
 * @param {number} logId
 * @returns {Object|null}
 */
async function getEmailLogById(logId) {
  try {
    const [rows] = await pool.query("SELECT * FROM email_delivery_logs WHERE id = ?", [logId]);
    return rows[0] || null;
  } catch {
    return null;
  }
}

/**
 * Get failed email logs eligible for retry.
 *
 * @param {number} maxAttempts
 * @returns {Array}
 */
async function getRetryableEmails(maxAttempts = 3) {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM email_delivery_logs WHERE status = 'failed' AND attempt_count < ? ORDER BY created_at DESC LIMIT 50`,
      [maxAttempts]
    );
    return rows;
  } catch {
    return [];
  }
}

module.exports = {
  createEmailLog,
  getEmailLogById,
  getEmailLogs,
  getRetryableEmails,
  incrementAttempt,
  isDuplicateEmail,
  markEmailFailed,
  markEmailSent
};
