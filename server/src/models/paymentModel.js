/**
 * Payment Model
 *
 * Database queries for payment processing and tracking.
 */

const { pool } = require("../config/db");

/**
 * Fetch all outstanding (unpaid) invoices for the payments workspace.
 *
 * @returns {Object[]} Array of unpaid invoice rows with customer details.
 */
async function findOutstandingInvoices() {
  const [rows] = await pool.query(`
    SELECT
      i.invoice_id,
      i.invoiceId,
      i.issue_date,
      i.due_date,
      i.total_amount,
      i.status AS database_status,
      c.name AS customer_name,
      c.email AS customer_email
    FROM invoice i
    INNER JOIN customer c ON c.customer_id = i.customer_id
    WHERE i.status <> 'Paid'
    ORDER BY i.due_date ASC, i.invoice_id DESC
  `);
  return rows;
}

/**
 * Fetch recent payment records with related invoice and customer data.
 *
 * @param {number} limit - Maximum number of payments to return.
 * @returns {Object[]} Array of payment rows.
 */
async function findRecentPayments(limit = 25) {
  const [rows] = await pool.query(`
    SELECT
      p.payment_id,
      p.payment_date,
      p.amount,
      p.status,
      p.transaction_id,
      p.invoice_invoice_id,
      pm.name AS payment_method,
      i.invoiceId,
      c.name AS customer_name
    FROM payment p
    LEFT JOIN payment_method pm ON pm.payment_method_id = p.payment_method_id
    LEFT JOIN invoice i ON i.invoice_id = p.invoice_invoice_id
    LEFT JOIN customer c ON c.customer_id = i.customer_id
    ORDER BY p.payment_date DESC, p.payment_id DESC
    LIMIT ?
  `, [limit]);
  return rows;
}

/**
 * Find or create a payment method by name.
 *
 * @param {Object} connection - MySQL connection.
 * @param {string} methodName - Payment method name (e.g. "Bank Transfer").
 * @returns {number} The payment_method_id.
 */
async function findOrCreatePaymentMethod(connection, methodName) {
  const [existingRows] = await connection.query(
    "SELECT payment_method_id FROM payment_method WHERE name = ? LIMIT 1",
    [methodName]
  );

  if (existingRows.length > 0) {
    return existingRows[0].payment_method_id;
  }

  const [result] = await connection.query(
    "INSERT INTO payment_method (name, description, is_active) VALUES (?, ?, 1)",
    [methodName, `${methodName} payments`]
  );
  return result.insertId;
}

/**
 * Insert a payment record.
 *
 * @param {Object} connection - MySQL connection.
 * @param {Object} data - { amount, status, transaction_id, invoice_id, payment_method_id }
 * @returns {number} The insertId (payment primary key).
 */
async function insertPayment(connection, data) {
  const [result] = await connection.query(
    `INSERT INTO payment (payment_date, amount, status, transaction_id, invoice_invoice_id, payment_method_id)
     VALUES (NOW(), ?, ?, ?, ?, ?)`,
    [String(data.amount), data.status, data.transaction_id, data.invoice_id, data.payment_method_id]
  );
  return result.insertId;
}

/**
 * Find an invoice by ID and lock for payment (FOR UPDATE).
 *
 * @param {Object} connection - MySQL connection.
 * @param {number} invoiceId - The invoice primary key.
 * @returns {Object|null} Invoice row or null.
 */
async function findInvoiceForPayment(connection, invoiceId) {
  const [rows] = await connection.query(
    "SELECT invoice_id, total_amount FROM invoice WHERE invoice_id = ? LIMIT 1 FOR UPDATE",
    [invoiceId]
  );
  return rows[0] || null;
}

/**
 * Find an invoice with customer email for Stripe link generation.
 *
 * @param {number} invoiceId - The invoice primary key.
 * @returns {Object|null} Invoice row with customer email.
 */
async function findInvoiceForStripe(invoiceId) {
  const [rows] = await pool.query(
    `SELECT i.invoice_id, i.invoiceId, i.total_amount, c.email
     FROM invoice i INNER JOIN customer c ON c.customer_id = i.customer_id
     WHERE i.invoice_id = ? LIMIT 1`,
    [invoiceId]
  );
  return rows[0] || null;
}

/**
 * Check fraud assessment status for an invoice.
 *
 * @param {Object} connection - MySQL connection or pool.
 * @param {number} invoiceId - The invoice primary key.
 * @returns {Object|null} Fraud assessment row or null.
 */
async function findFraudAssessment(connection, invoiceId) {
  const [rows] = await connection.query(
    "SELECT risk_score, risk_level, review_status FROM invoice_fraud_assessment WHERE invoice_id = ? LIMIT 1",
    [invoiceId]
  );
  return rows[0] || null;
}

module.exports = {
  findFraudAssessment,
  findInvoiceForPayment,
  findInvoiceForStripe,
  findOrCreatePaymentMethod,
  findOutstandingInvoices,
  findRecentPayments,
  insertPayment
};
