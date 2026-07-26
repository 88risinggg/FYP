/**
 * WhatsApp Message Template Model
 *
 * CRUD operations for WhatsApp message templates.
 * Templates support placeholders: {{CustomerName}}, {{InvoiceNumber}},
 * {{Amount}}, {{DueDate}}, {{PaymentLink}}, {{CompanyName}}, etc.
 */

const { pool } = require("../config/db");

/**
 * Get all templates (optionally filtered by type or active status).
 * @param {Object} [filters]
 * @param {string} [filters.template_type]
 * @param {boolean} [filters.is_active]
 * @returns {Array}
 */
async function getAll(filters = {}) {
  const conditions = [];
  const params = [];

  if (filters.template_type) {
    conditions.push("template_type = ?");
    params.push(filters.template_type);
  }
  if (filters.is_active !== undefined) {
    conditions.push("is_active = ?");
    params.push(filters.is_active ? 1 : 0);
  }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const [rows] = await pool.query(
    `SELECT * FROM whatsapp_message_templates ${whereClause} ORDER BY template_type, is_default DESC, template_name`,
    params
  );
  return rows;
}

/**
 * Get a single template by ID.
 * @param {number} id
 * @returns {Object|null}
 */
async function getById(id) {
  const [rows] = await pool.query(
    "SELECT * FROM whatsapp_message_templates WHERE id = ?",
    [id]
  );
  return rows[0] || null;
}

/**
 * Get the active template for a specific notification type.
 * Returns the default template if available, otherwise the first active one.
 * @param {string} templateType
 * @returns {Object|null}
 */
async function getActiveByType(templateType) {
  const [rows] = await pool.query(
    `SELECT * FROM whatsapp_message_templates
     WHERE template_type = ? AND is_active = 1
     ORDER BY is_default DESC
     LIMIT 1`,
    [templateType]
  );
  return rows[0] || null;
}

/**
 * Create a new message template.
 * @param {Object} template
 * @returns {Object} Created template.
 */
async function create(template) {
  const {
    template_name,
    template_type,
    message_body,
    is_default = false,
    is_active = true,
    created_by = null
  } = template;

  const [result] = await pool.query(
    `INSERT INTO whatsapp_message_templates
      (template_name, template_type, message_body, is_default, is_active, created_by)
    VALUES (?, ?, ?, ?, ?, ?)`,
    [template_name, template_type, message_body, is_default ? 1 : 0, is_active ? 1 : 0, created_by]
  );

  return getById(result.insertId);
}

/**
 * Update an existing template.
 * @param {number} id
 * @param {Object} updates
 * @returns {Object|null} Updated template.
 */
async function update(id, updates) {
  const fields = [];
  const params = [];

  if (updates.template_name !== undefined) {
    fields.push("template_name = ?");
    params.push(updates.template_name);
  }
  if (updates.template_type !== undefined) {
    fields.push("template_type = ?");
    params.push(updates.template_type);
  }
  if (updates.message_body !== undefined) {
    fields.push("message_body = ?");
    params.push(updates.message_body);
  }
  if (updates.is_default !== undefined) {
    fields.push("is_default = ?");
    params.push(updates.is_default ? 1 : 0);
  }
  if (updates.is_active !== undefined) {
    fields.push("is_active = ?");
    params.push(updates.is_active ? 1 : 0);
  }

  if (fields.length === 0) return getById(id);

  params.push(id);
  await pool.query(
    `UPDATE whatsapp_message_templates SET ${fields.join(", ")} WHERE id = ?`,
    params
  );

  return getById(id);
}

/**
 * Delete a template (only non-default templates can be deleted).
 * @param {number} id
 * @returns {boolean}
 */
async function remove(id) {
  const [result] = await pool.query(
    "DELETE FROM whatsapp_message_templates WHERE id = ? AND is_default = 0",
    [id]
  );
  return result.affectedRows > 0;
}

/**
 * Set a template as the default for its type.
 * Unsets any other default for the same type.
 * @param {number} id
 * @returns {Object|null}
 */
async function setDefault(id) {
  const template = await getById(id);
  if (!template) return null;

  // Unset other defaults of the same type
  await pool.query(
    "UPDATE whatsapp_message_templates SET is_default = 0 WHERE template_type = ? AND id != ?",
    [template.template_type, id]
  );

  // Set this as default
  await pool.query(
    "UPDATE whatsapp_message_templates SET is_default = 1 WHERE id = ?",
    [id]
  );

  return getById(id);
}

/**
 * Get all available template types.
 * @returns {Array<string>}
 */
function getTemplateTypes() {
  return [
    "invoice_created",
    "invoice_sent",
    "payment_reminder",
    "overdue_notice",
    "payment_received",
    "subscription_started",
    "subscription_renewed",
    "subscription_expiring",
    "subscription_payment_failed",
    "subscription_cancelled",
    "subscription_invoice",
    "custom"
  ];
}

/**
 * Get supported placeholders.
 * @returns {Array<Object>}
 */
function getPlaceholders() {
  return [
    { key: "CustomerName", description: "Customer's full name" },
    { key: "InvoiceNumber", description: "Invoice number (e.g., INV-000001)" },
    { key: "InvoiceDate", description: "Invoice issue date" },
    { key: "DueDate", description: "Payment due date" },
    { key: "Amount", description: "Invoice amount" },
    { key: "PaymentLink", description: "Secure payment URL" },
    { key: "CompanyName", description: "Your company name" },
    { key: "BillingPeriod", description: "Subscription billing period" },
    { key: "PaymentDate", description: "Date payment was received" },
    { key: "SubscriptionName", description: "Name of the subscription" }
  ];
}

module.exports = {
  getAll,
  getById,
  getActiveByType,
  create,
  update,
  remove,
  setDefault,
  getTemplateTypes,
  getPlaceholders
};
