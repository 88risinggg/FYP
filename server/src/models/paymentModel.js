/**
 * Payment Model
 *
 * Database queries for payment processing and tracking.
 * payment_method is now stored inline as payment_method_name on the payment table.
 * Fraud assessment data is stored inline on the invoice table (risk_score, risk_level, review_status).
 */

const { pool } = require("../config/db");

/**
 * Fetch all outstanding (unpaid) invoices for the payments workspace.
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
    WHERE i.status <> 'Paid' AND i.invoiceId <> '__SETTINGS__'
    ORDER BY i.due_date ASC, i.invoice_id DESC
  `);
  return rows;
}

/**
 * Fetch recent payment records with related invoice and customer data.
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
      p.payment_method_name AS payment_method,
      i.invoiceId,
      c.name AS customer_name
    FROM payment p
    LEFT JOIN invoice i ON i.invoice_id = p.invoice_invoice_id
    LEFT JOIN customer c ON c.customer_id = i.customer_id
    ORDER BY p.payment_date DESC, p.payment_id DESC
    LIMIT ?
  `, [limit]);
  return rows;
}

/**
 * Store the payment method name directly (no separate table).
 * Returns a dummy ID for backward compatibility.
 */
async function findOrCreatePaymentMethod(connection, methodName) {
  // No longer using payment_method table - just return 0
  // The method name will be stored inline in the payment row
  return { methodName };
}

/**
 * Insert a payment record.
 */
async function insertPayment(connection, data) {
  const methodName = typeof data.payment_method_id === "object"
    ? data.payment_method_id.methodName
    : (data.payment_method_name || "Unknown");

  const [result] = await connection.query(
    `INSERT INTO payment (payment_date, amount, status, transaction_id, invoice_invoice_id, payment_method_name)
     VALUES (NOW(), ?, ?, ?, ?, ?)`,
    [String(data.amount), data.status, data.transaction_id, data.invoice_id, methodName]
  );
  return result.insertId;
}

/**
 * Find an invoice by ID and lock for payment (FOR UPDATE).
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
 * Check fraud assessment status for an invoice (inline on invoice table).
 */
async function findFraudAssessment(connection, invoiceId) {
  const [rows] = await connection.query(
    "SELECT risk_score, risk_level, review_status FROM invoice WHERE invoice_id = ? AND risk_score IS NOT NULL LIMIT 1",
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
