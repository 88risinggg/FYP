/**
 * Customer Model
 *
 * Database queries for customer operations.
 */

const { pool } = require("../config/db");

/**
 * Fetch all customers with invoice statistics.
 * Includes invoice count and total invoiced amount per customer.
 *
 * @returns {Object[]} Array of customer rows with aggregated data.
 */
async function findAllCustomersWithStats() {
  const [rows] = await pool.query(`
    SELECT
      c.customer_id,
      c.name,
      c.email,
      c.address,
      c.created_at,
      COUNT(i.invoice_id) AS invoice_count,
      COALESCE(SUM(i.total_amount), 0) AS total_invoiced
    FROM customer c
    LEFT JOIN invoice i ON i.customer_id = c.customer_id
    GROUP BY c.customer_id, c.name, c.email, c.address, c.created_at
    ORDER BY c.created_at DESC, c.customer_id DESC
  `);
  return rows;
}

/**
 * Fetch all customers (basic list for dropdowns).
 *
 * @returns {Object[]} Array of { customer_id, name, email, address }.
 */
async function findAllCustomers() {
  const [rows] = await pool.query(`
    SELECT customer_id, name, email, address
    FROM customer
    ORDER BY name ASC
  `);
  return rows;
}

/**
 * Find a customer by ID.
 *
 * @param {number} customerId - The customer primary key.
 * @returns {Object|null} Customer row or null.
 */
async function findCustomerById(customerId) {
  const [rows] = await pool.query(
    "SELECT customer_id, name, email, address, created_at FROM customer WHERE customer_id = ?",
    [customerId]
  );
  return rows[0] || null;
}

/**
 * Find customers by name (for bulk upload validation).
 *
 * @param {string[]} names - Array of customer names to look up.
 * @returns {Object[]} Array of { customer_id, name }.
 */
async function findCustomersByNames(names) {
  if (names.length === 0) return [];
  const [rows] = await pool.query(
    "SELECT customer_id, name FROM customer WHERE name IN (?)",
    [names]
  );
  return rows;
}

/**
 * Find customers by IDs (for bulk upload validation).
 *
 * @param {number[]} ids - Array of customer IDs.
 * @returns {Object[]} Array of { customer_id }.
 */
async function findCustomersByIds(ids) {
  if (ids.length === 0) return [];
  const [rows] = await pool.query(
    "SELECT customer_id FROM customer WHERE customer_id IN (?)",
    [ids]
  );
  return rows;
}

module.exports = {
  findAllCustomers,
  findAllCustomersWithStats,
  findCustomerById,
  findCustomersByIds,
  findCustomersByNames
};
