/**
 * WhatsApp Message Model
 *
 * Data-access layer for the whatsapp_messages table.
 * Handles message creation, status updates (from webhooks), queries for
 * Finance users, and duplicate prevention.
 *
 * Statuses: queued → sent → delivered → read | failed
 */

const { pool } = require("../config/db");

// ─── Message CRUD ─────────────────────────────────────────────────────────────

/**
 * Create a new message record (status = queued).
 * @param {Object} msg
 * @returns {number} Insert ID
 */
async function createMessage(msg) {
  const {
    customer_id,
    invoice_id = null,
    message_type,
    recipient_phone,
    recipient_name = null,
    message_body,
    template_id = null,
    sent_by = null
  } = msg;

  const [result] = await pool.query(
    `INSERT INTO whatsapp_messages
      (customer_id, invoice_id, message_type, recipient_phone, recipient_name, message_body, template_id, status, sent_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', ?)`,
    [customer_id, invoice_id, message_type, recipient_phone, recipient_name, message_body, template_id, sent_by]
  );

  return result.insertId;
}

/**
 * Update message after Twilio send attempt.
 * @param {number} messageId
 * @param {Object} update
 */
async function updateAfterSend(messageId, update) {
  const { status, twilio_message_sid, error_message, sent_at } = update;

  const fields = ["status = ?"];
  const params = [status];

  if (twilio_message_sid) { fields.push("twilio_message_sid = ?"); params.push(twilio_message_sid); }
  if (error_message) { fields.push("error_message = ?"); params.push(error_message); }
  if (sent_at) { fields.push("sent_at = ?"); params.push(sent_at); }
  if (status === "failed") { fields.push("failed_at = NOW()"); }

  params.push(messageId);
  await pool.query(`UPDATE whatsapp_messages SET ${fields.join(", ")} WHERE id = ?`, params);
}

/**
 * Update message status from a Twilio webhook callback.
 * @param {string} twilioSid — Twilio Message SID
 * @param {string} newStatus — queued | sent | delivered | read | failed
 * @param {string} [errorMessage]
 */
async function updateStatusFromWebhook(twilioSid, newStatus, errorMessage) {
  if (!twilioSid) return;

  const statusMap = {
    queued: "queued",
    sent: "sent",
    delivered: "delivered",
    read: "read",
    failed: "failed",
    undelivered: "failed"
  };

  const mappedStatus = statusMap[newStatus] || newStatus;
  const fields = ["status = ?"];
  const params = [mappedStatus];

  if (mappedStatus === "delivered") { fields.push("delivered_at = NOW()"); }
  if (mappedStatus === "read") { fields.push("read_at = NOW()"); }
  if (mappedStatus === "failed") {
    fields.push("failed_at = NOW()");
    if (errorMessage) { fields.push("error_message = ?"); params.push(errorMessage); }
  }

  params.push(twilioSid);
  await pool.query(
    `UPDATE whatsapp_messages SET ${fields.join(", ")} WHERE twilio_message_sid = ?`,
    params
  );
}

/**
 * Increment retry count for a failed message.
 * @param {number} messageId
 */
async function incrementRetry(messageId) {
  await pool.query(
    "UPDATE whatsapp_messages SET retry_count = retry_count + 1, status = 'queued', error_message = NULL WHERE id = ?",
    [messageId]
  );
}

// ─── Queries for Finance ──────────────────────────────────────────────────────

/**
 * Get messages for a specific invoice (communication history).
 * @param {number} invoiceId
 * @returns {Array}
 */
async function getByInvoiceId(invoiceId) {
  const [rows] = await pool.query(
    `SELECT wm.*, c.name AS customer_name
     FROM whatsapp_messages wm
     LEFT JOIN customer c ON c.customer_id = wm.customer_id
     WHERE wm.invoice_id = ?
     ORDER BY wm.created_at DESC`,
    [invoiceId]
  );
  return rows;
}

/**
 * Get messages with filters, pagination, and sorting.
 * @param {Object} filters
 * @returns {Object} { messages, total, page, limit, totalPages }
 */
async function getMessages(filters = {}) {
  const {
    page = 1,
    limit = 20,
    search = "",
    message_type = "",
    status = "",
    invoice_id = null,
    customer_id = null,
    sort_by = "created_at",
    sort_order = "DESC"
  } = filters;

  const conditions = [];
  const params = [];

  if (message_type) { conditions.push("wm.message_type = ?"); params.push(message_type); }
  if (status) { conditions.push("wm.status = ?"); params.push(status); }
  if (invoice_id) { conditions.push("wm.invoice_id = ?"); params.push(invoice_id); }
  if (customer_id) { conditions.push("wm.customer_id = ?"); params.push(customer_id); }
  if (search) {
    conditions.push("(c.name LIKE ? OR wm.recipient_phone LIKE ? OR i.invoiceId LIKE ?)");
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const allowedSorts = ["created_at", "sent_at", "message_type", "status"];
  const sortCol = allowedSorts.includes(sort_by) ? `wm.${sort_by}` : "wm.created_at";
  const sortDir = sort_order.toUpperCase() === "ASC" ? "ASC" : "DESC";

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM whatsapp_messages wm
     LEFT JOIN customer c ON c.customer_id = wm.customer_id
     LEFT JOIN invoice i ON i.invoice_id = wm.invoice_id
     ${whereClause}`,
    [...params]
  );
  const total = countRows[0].total;

  const offset = (page - 1) * limit;
  const queryParams = [...params, Number(limit), Number(offset)];

  const [rows] = await pool.query(
    `SELECT
       wm.*,
       c.name AS customer_name,
       i.invoiceId AS invoice_number
     FROM whatsapp_messages wm
     LEFT JOIN customer c ON c.customer_id = wm.customer_id
     LEFT JOIN invoice i ON i.invoice_id = wm.invoice_id
     ${whereClause}
     ORDER BY ${sortCol} ${sortDir}
     LIMIT ? OFFSET ?`,
    queryParams
  );

  return {
    messages: rows,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit)
  };
}

/**
 * Get the latest message status for an invoice.
 * @param {number} invoiceId
 * @returns {Object|null}
 */
async function getLatestForInvoice(invoiceId) {
  const [rows] = await pool.query(
    `SELECT status, message_type, sent_at, delivered_at, read_at, failed_at, error_message
     FROM whatsapp_messages
     WHERE invoice_id = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [invoiceId]
  );
  return rows[0] || null;
}

/**
 * Check if a message of a given type was already sent for an invoice today.
 * Used to prevent duplicate sends.
 * @param {number} invoiceId
 * @param {string} messageType
 * @returns {boolean}
 */
async function hasSentToday(invoiceId, messageType) {
  const [rows] = await pool.query(
    `SELECT id FROM whatsapp_messages
     WHERE invoice_id = ? AND message_type = ? AND status IN ('queued', 'sent', 'delivered', 'read')
     AND DATE(created_at) = CURDATE()
     LIMIT 1`,
    [invoiceId, messageType]
  );
  return rows.length > 0;
}

/**
 * Get failed messages eligible for retry (max 3 retries).
 * @param {number} [maxRetries=3]
 * @returns {Array}
 */
async function getRetryableMessages(maxRetries = 3) {
  const [rows] = await pool.query(
    `SELECT wm.*, c.whatsapp_number
     FROM whatsapp_messages wm
     LEFT JOIN customer c ON c.customer_id = wm.customer_id
     WHERE wm.status = 'failed' AND wm.retry_count < ?
     ORDER BY wm.created_at ASC
     LIMIT 50`,
    [maxRetries]
  );
  return rows;
}

/**
 * Get dashboard stats for message activity.
 * @returns {Object}
 */
async function getDashboardStats() {
  const [rows] = await pool.query(`
    SELECT
      COUNT(*) AS total_messages,
      SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) AS today_total,
      SUM(CASE WHEN DATE(created_at) = CURDATE() AND status IN ('sent', 'delivered', 'read') THEN 1 ELSE 0 END) AS today_sent,
      SUM(CASE WHEN DATE(created_at) = CURDATE() AND status = 'failed' THEN 1 ELSE 0 END) AS today_failed,
      SUM(CASE WHEN DATE(created_at) = CURDATE() AND status = 'queued' THEN 1 ELSE 0 END) AS today_queued,
      SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS total_delivered,
      SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) AS total_read,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS total_failed
    FROM whatsapp_messages
  `);

  const stats = rows[0] || {};
  return {
    total_messages: Number(stats.total_messages || 0),
    today_total: Number(stats.today_total || 0),
    today_sent: Number(stats.today_sent || 0),
    today_failed: Number(stats.today_failed || 0),
    today_queued: Number(stats.today_queued || 0),
    total_delivered: Number(stats.total_delivered || 0),
    total_read: Number(stats.total_read || 0),
    total_failed: Number(stats.total_failed || 0)
  };
}

// ─── Templates ────────────────────────────────────────────────────────────────

/**
 * Get all templates (optionally filtered).
 * @param {Object} [filters]
 * @returns {Array}
 */
async function getTemplates(filters = {}) {
  const conditions = [];
  const params = [];

  if (filters.template_type) { conditions.push("template_type = ?"); params.push(filters.template_type); }
  if (filters.is_active !== undefined) { conditions.push("is_active = ?"); params.push(filters.is_active ? 1 : 0); }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `SELECT * FROM whatsapp_templates ${whereClause} ORDER BY template_type, is_default DESC, template_name`,
    params
  );
  return rows;
}

/**
 * Get a template by ID.
 * @param {number} id
 * @returns {Object|null}
 */
async function getTemplateById(id) {
  const [rows] = await pool.query("SELECT * FROM whatsapp_templates WHERE id = ?", [id]);
  return rows[0] || null;
}

/**
 * Get the active default template for a message type.
 * @param {string} templateType
 * @returns {Object|null}
 */
async function getDefaultTemplate(templateType) {
  const [rows] = await pool.query(
    `SELECT * FROM whatsapp_templates
     WHERE template_type = ? AND is_active = 1
     ORDER BY is_default DESC
     LIMIT 1`,
    [templateType]
  );
  return rows[0] || null;
}

/**
 * Create a new template.
 * @param {Object} template
 * @returns {Object}
 */
async function createTemplate(template) {
  const { template_name, template_type, message_body, is_default = false, is_active = true, created_by = null } = template;

  const [result] = await pool.query(
    `INSERT INTO whatsapp_templates (template_name, template_type, message_body, is_default, is_active, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [template_name, template_type, message_body, is_default ? 1 : 0, is_active ? 1 : 0, created_by]
  );

  return getTemplateById(result.insertId);
}

/**
 * Update a template.
 * @param {number} id
 * @param {Object} updates
 * @returns {Object|null}
 */
async function updateTemplate(id, updates) {
  const fields = [];
  const params = [];

  if (updates.template_name !== undefined) { fields.push("template_name = ?"); params.push(updates.template_name); }
  if (updates.template_type !== undefined) { fields.push("template_type = ?"); params.push(updates.template_type); }
  if (updates.message_body !== undefined) { fields.push("message_body = ?"); params.push(updates.message_body); }
  if (updates.is_default !== undefined) { fields.push("is_default = ?"); params.push(updates.is_default ? 1 : 0); }
  if (updates.is_active !== undefined) { fields.push("is_active = ?"); params.push(updates.is_active ? 1 : 0); }

  if (fields.length === 0) return getTemplateById(id);

  params.push(id);
  await pool.query(`UPDATE whatsapp_templates SET ${fields.join(", ")} WHERE id = ?`, params);
  return getTemplateById(id);
}

/**
 * Delete a template (only non-default).
 * @param {number} id
 * @returns {boolean}
 */
async function deleteTemplate(id) {
  const [result] = await pool.query(
    "DELETE FROM whatsapp_templates WHERE id = ? AND is_default = 0",
    [id]
  );
  return result.affectedRows > 0;
}

/**
 * Set a template as default for its type.
 * @param {number} id
 * @returns {Object|null}
 */
async function setDefaultTemplate(id) {
  const template = await getTemplateById(id);
  if (!template) return null;

  await pool.query(
    "UPDATE whatsapp_templates SET is_default = 0 WHERE template_type = ? AND id != ?",
    [template.template_type, id]
  );
  await pool.query("UPDATE whatsapp_templates SET is_default = 1 WHERE id = ?", [id]);

  return getTemplateById(id);
}

/**
 * Get supported placeholders list.
 * @returns {Array<Object>}
 */
function getPlaceholders() {
  return [
    { key: "customer_name", description: "Customer's full name" },
    { key: "invoice_number", description: "Invoice number (e.g., INV-000001)" },
    { key: "invoice_amount", description: "Invoice total amount" },
    { key: "currency", description: "Currency symbol (e.g., $)" },
    { key: "due_date", description: "Payment due date" },
    { key: "company_name", description: "Your company name" },
    { key: "payment_link", description: "Secure payment URL" }
  ];
}

module.exports = {
  // Messages
  createMessage,
  updateAfterSend,
  updateStatusFromWebhook,
  incrementRetry,
  getByInvoiceId,
  getMessages,
  getLatestForInvoice,
  hasSentToday,
  getRetryableMessages,
  getDashboardStats,
  // Templates
  getTemplates,
  getTemplateById,
  getDefaultTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  setDefaultTemplate,
  getPlaceholders
};
