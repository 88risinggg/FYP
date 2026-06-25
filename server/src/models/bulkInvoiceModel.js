/**
 * Bulk Invoice Model
 *
 * Database queries for bulk invoice import validation and processing.
 */

const { pool } = require("../config/db");

/**
 * Find customers by their names (case-sensitive match).
 * Used during bulk upload validation to map customer names to IDs.
 *
 * @param {Object} connection - MySQL connection or pool.
 * @param {string[]} names - Array of customer names.
 * @returns {Object[]} Array of { customer_id, name }.
 */
async function findCustomersByNames(connection, names) {
  if (names.length === 0) return [];
  const [rows] = await connection.query(
    "SELECT customer_id, name FROM customer WHERE name IN (?)",
    [names]
  );
  return rows;
}

/**
 * Find existing invoices by their invoice numbers.
 * Used to detect duplicates during bulk upload.
 *
 * @param {Object} connection - MySQL connection or pool.
 * @param {string[]} invoiceNumbers - Array of invoiceId strings (e.g. "INV-0001").
 * @returns {Object[]} Array of { invoiceId }.
 */
async function findExistingInvoiceNumbers(connection, invoiceNumbers) {
  if (invoiceNumbers.length === 0) return [];
  const [rows] = await connection.query(
    "SELECT invoiceId FROM invoice WHERE invoiceId IN (?)",
    [invoiceNumbers]
  );
  return rows;
}

/**
 * Insert a single invoice during bulk processing.
 *
 * @param {Object} connection - MySQL connection.
 * @param {Object} data - { status, issue_date, due_date, invoiceId, total_amount, customer_id }
 * @returns {number} The insertId (invoice primary key).
 */
async function insertBulkInvoice(connection, data) {
  const [result] = await connection.query(
    `INSERT INTO invoice (status, issue_date, due_date, invoiceId, total_amount, customer_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [data.status, data.issue_date, data.due_date, data.invoiceId, data.total_amount, data.customer_id]
  );
  return result.insertId;
}

/**
 * Insert a single line item for a bulk-imported invoice.
 *
 * @param {Object} connection - MySQL connection.
 * @param {Object} data - { description, quantity, unit_price, amount, invoice_id }
 */
async function insertBulkInvoiceItem(connection, data) {
  await connection.query(
    `INSERT INTO invoice_item (description, quantity, unit_price, amount, invoice_invoice_id)
     VALUES (?, ?, ?, ?, ?)`,
    [data.description, data.quantity, data.unit_price, data.amount, data.invoice_id]
  );
}

module.exports = {
  findCustomersByNames,
  findExistingInvoiceNumbers,
  insertBulkInvoice,
  insertBulkInvoiceItem
};
