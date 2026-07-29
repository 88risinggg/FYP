/**
 * EVALUATION HEADER
 * FEATURE: INVOICE - SHARED
 * PURPOSE: Reads and writes invoice Model data in the database.
 * LAYER: Backend model - contains database queries and persistence operations.
 * FIND RELATED CODE: Use Find All References to locate the controller/service that requests this data.
 */
/**
 * Invoice Model
 *
 * Database queries for invoice CRUD operations.
 * All queries use parameterized statements to prevent SQL injection.
 */

const { pool } = require("../config/db");

/**
 * Fetch all invoices with customer details, ordered by newest first.
 *
 * @returns {Object[]} Array of invoice rows joined with customer data.
 */
async function findAllInvoices() {
  const [rows] = await pool.query(`
    SELECT
      i.invoice_id,
      i.invoiceId,
      i.status,
      i.issue_date,
      i.due_date,
      i.total_amount,
      i.customer_id,
      i.created_at,
      i.scheduled_at,
      c.name AS customer_name,
      c.email AS customer_email,
      c.address AS customer_address
    FROM invoice i
    INNER JOIN customer c ON c.customer_id = i.customer_id
    WHERE i.invoiceId <> '__SETTINGS__'
    ORDER BY i.created_at DESC, i.invoice_id DESC
  `);
  return rows;
}

/**
 * Fetch all line items for a set of invoice IDs.
 *
 * @param {number[]} invoiceIds - Array of invoice primary keys.
 * @returns {Object[]} Array of invoice_item rows.
 */
async function findItemsByInvoiceIds(invoiceIds) {
  if (invoiceIds.length === 0) return [];
  const [rows] = await pool.query(
    `SELECT invoice_id, items_json FROM invoice WHERE invoice_id IN (?)`,
    [invoiceIds]
  );
  const items = [];
  for (const row of rows) {
    const parsed = typeof row.items_json === "string" ? JSON.parse(row.items_json) : (row.items_json || []);
    parsed.forEach((item, idx) => {
      items.push({
        item_id: idx + 1,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.amount,
        invoice_invoice_id: row.invoice_id
      });
    });
  }
  return items;
}

/**
 * Fetch the latest status audit log entries for a set of invoice IDs.
 *
 * @param {number[]} invoiceIds - Array of invoice primary keys.
 * @param {string} statusPrefix - The audit action prefix (e.g. "invoice_status:").
 * @returns {Object[]} Array of { entity_id, action } rows.
 */
async function findLatestStatusAudits(invoiceIds, statusPrefix) {
  if (invoiceIds.length === 0) return [];
  const [rows] = await pool.query(
    `SELECT al.entity_id, al.action
     FROM audit_log al
     INNER JOIN (
       SELECT entity_id, MAX(log_id) AS log_id
       FROM audit_log
       WHERE entity_type = 'invoice' AND action LIKE ? AND entity_id IN (?)
       GROUP BY entity_id
     ) latest ON latest.log_id = al.log_id`,
    [`${statusPrefix}%`, invoiceIds]
  );
  return rows;
}

/**
 * Get the most recent invoice number (INV-XXXX) for sequence generation.
 *
 * @param {Object} connection - MySQL connection (for transaction use).
 * @returns {string|null} The last invoiceId or null if no invoices exist.
 */
async function findLastInvoiceNumber(connection) {
  const [rows] = await connection.query(`
    SELECT invoiceId FROM invoice WHERE invoiceId LIKE 'INV-%'
    ORDER BY invoice_id DESC LIMIT 1 FOR UPDATE
  `);
  return rows[0]?.invoiceId || null;
}

/**
 * Insert a new invoice record.
 *
 * @param {Object} connection - MySQL connection.
 * @param {Object} data - { status, issue_date, due_date, invoiceId, total_amount, customer_id }
 * @returns {number} The insertId (invoice primary key).
 */
async function insertInvoice(connection, data) {
  const [result] = await connection.query(
    `INSERT INTO invoice (status, issue_date, due_date, invoiceId, total_amount, customer_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [data.status, data.issue_date, data.due_date, data.invoiceId, data.total_amount, data.customer_id]
  );
  return result.insertId;
}

/**
 * Batch-insert invoice line items.
 *
 * @param {Object} connection - MySQL connection.
 * @param {Array[]} itemValues - Array of [description, quantity, unit_price, amount, invoice_id] arrays.
 */
async function insertInvoiceItems(connection, itemValues) {
  const itemsByInvoice = {};
  for (const [description, quantity, unit_price, amount, invoiceId] of itemValues) {
    if (!itemsByInvoice[invoiceId]) itemsByInvoice[invoiceId] = [];
    itemsByInvoice[invoiceId].push({ description, quantity, unit_price, amount });
  }
  for (const [invoiceId, items] of Object.entries(itemsByInvoice)) {
    await connection.query(
      "UPDATE invoice SET items_json = ? WHERE invoice_id = ?",
      [JSON.stringify(items), invoiceId]
    );
  }
}

/**
 * Update invoice status and optionally clear scheduled_at.
 *
 * @param {Object} connection - MySQL connection.
 * @param {number} invoiceId - The invoice primary key.
 * @param {string} status - The new status value.
 * @param {boolean} clearSchedule - Whether to set scheduled_at to NULL.
 */
async function updateInvoiceStatus(connection, invoiceId, status, clearSchedule = false) {
  if (clearSchedule) {
    await connection.query(
      "UPDATE invoice SET status = ?, scheduled_at = NULL WHERE invoice_id = ?",
      [status, invoiceId]
    );
  } else {
    await connection.query(
      "UPDATE invoice SET status = ? WHERE invoice_id = ?",
      [status, invoiceId]
    );
  }
}

/**
 * Schedule multiple invoices by updating their status and scheduled_at.
 *
 * @param {Object} connection - MySQL connection.
 * @param {number[]} invoiceIds - Array of invoice primary keys.
 * @param {Date} scheduledAt - The scheduled send time.
 */
async function scheduleInvoices(connection, invoiceIds, scheduledAt) {
  await connection.query(
    "UPDATE invoice SET status = 'Scheduled', scheduled_at = ? WHERE invoice_id IN (?)",
    [scheduledAt, invoiceIds]
  );
}

/**
 * Find invoices by their IDs with row-level locking.
 *
 * @param {Object} connection - MySQL connection.
 * @param {number[]} invoiceIds - Array of invoice primary keys.
 * @returns {Object[]} Array of invoice rows.
 */
async function findInvoicesByIdsForUpdate(connection, invoiceIds) {
  const [rows] = await connection.query(
    "SELECT invoice_id, status FROM invoice WHERE invoice_id IN (?) FOR UPDATE",
    [invoiceIds]
  );
  return rows;
}

/**
 * Find a single invoice by ID with customer details, locked for update.
 *
 * @param {Object} connection - MySQL connection.
 * @param {number} invoiceId - The invoice primary key.
 * @returns {Object|null} Invoice row or null.
 */
async function findInvoiceByIdForUpdate(connection, invoiceId) {
  const [rows] = await connection.query(
    `SELECT i.invoice_id, i.invoiceId, i.status, i.total_amount,
            c.name AS customer_name, c.email AS customer_email
     FROM invoice i INNER JOIN customer c ON c.customer_id = i.customer_id
     WHERE i.invoice_id = ? LIMIT 1 FOR UPDATE`,
    [invoiceId]
  );
  return rows[0] || null;
}

module.exports = {
  findAllInvoices,
  findInvoiceByIdForUpdate,
  findInvoicesByIdsForUpdate,
  findItemsByInvoiceIds,
  findLastInvoiceNumber,
  findLatestStatusAudits,
  insertInvoice,
  insertInvoiceItems,
  scheduleInvoices,
  updateInvoiceStatus
};
