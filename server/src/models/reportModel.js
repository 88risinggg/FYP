/**
 * Report Model
 *
 * Database queries for financial reporting and analytics.
 */

const { pool } = require("../config/db");

/**
 * Fetch overall revenue summary (total, paid, outstanding, count).
 *
 * @returns {Object} { total_revenue, paid_revenue, outstanding_revenue, invoice_count }
 */
async function getRevenueSummary() {
  const [rows] = await pool.query(`
    SELECT
      COALESCE(SUM(total_amount), 0) AS total_revenue,
      COALESCE(SUM(CASE WHEN status = 'Paid' THEN total_amount ELSE 0 END), 0) AS paid_revenue,
      COALESCE(SUM(CASE WHEN status <> 'Paid' THEN total_amount ELSE 0 END), 0) AS outstanding_revenue,
      COUNT(*) AS invoice_count
    FROM invoice
  `);
  return rows[0] || {};
}

/**
 * Fetch monthly revenue breakdown.
 *
 * @returns {Object[]} Array of { month, revenue, collected, invoice_count }.
 */
async function getMonthlyRevenue() {
  const [rows] = await pool.query(`
    SELECT
      DATE_FORMAT(issue_date, '%Y-%m') AS month,
      COALESCE(SUM(total_amount), 0) AS revenue,
      COALESCE(SUM(CASE WHEN status = 'Paid' THEN total_amount ELSE 0 END), 0) AS collected,
      COUNT(*) AS invoice_count
    FROM invoice
    GROUP BY DATE_FORMAT(issue_date, '%Y-%m')
    ORDER BY month ASC
  `);
  return rows;
}

/**
 * Fetch invoice status distribution (count and total per status).
 *
 * @returns {Object[]} Array of { status, count, total }.
 */
async function getStatusDistribution() {
  const [rows] = await pool.query(`
    SELECT status, COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS total
    FROM invoice GROUP BY status
  `);
  return rows;
}

/**
 * Fetch aging receivables breakdown by overdue bucket.
 *
 * @returns {Object[]} Array of { bucket, count, total }.
 */
async function getAgingReceivables() {
  const [rows] = await pool.query(`
    SELECT
      CASE
        WHEN DATEDIFF(CURDATE(), due_date) <= 0 THEN 'Current'
        WHEN DATEDIFF(CURDATE(), due_date) BETWEEN 1 AND 30 THEN '1-30 Days'
        WHEN DATEDIFF(CURDATE(), due_date) BETWEEN 31 AND 60 THEN '31-60 Days'
        ELSE '60+ Days'
      END AS bucket,
      COUNT(*) AS count,
      COALESCE(SUM(total_amount), 0) AS total
    FROM invoice WHERE status <> 'Paid'
    GROUP BY bucket
    ORDER BY FIELD(bucket, 'Current', '1-30 Days', '31-60 Days', '60+ Days')
  `);
  return rows;
}

/**
 * Fetch top customers by revenue.
 *
 * @param {number} limit - Max customers to return.
 * @returns {Object[]} Array of { customer_id, name, invoice_count, total }.
 */
async function getTopCustomers(limit = 8) {
  const [rows] = await pool.query(`
    SELECT c.customer_id, c.name, COUNT(i.invoice_id) AS invoice_count,
           COALESCE(SUM(i.total_amount), 0) AS total
    FROM customer c LEFT JOIN invoice i ON i.customer_id = c.customer_id
    GROUP BY c.customer_id, c.name ORDER BY total DESC LIMIT ?
  `, [limit]);
  return rows;
}

/**
 * Fetch paid invoice aggregates for financial statement.
 *
 * @returns {Object} { paid_count, total_collected, avg_invoice_value }
 */
async function getPaidInvoiceStats() {
  const [rows] = await pool.query(`
    SELECT COUNT(*) AS paid_count, COALESCE(SUM(total_amount), 0) AS total_collected,
           COALESCE(AVG(total_amount), 0) AS avg_invoice_value
    FROM invoice WHERE status = 'Paid'
  `);
  return rows[0] || {};
}

/**
 * Fetch overdue invoice aggregates.
 *
 * @returns {Object} { overdue_count, overdue_total }
 */
async function getOverdueStats() {
  const [rows] = await pool.query(`
    SELECT COUNT(*) AS overdue_count, COALESCE(SUM(total_amount), 0) AS overdue_total
    FROM invoice WHERE status = 'Overdue'
  `);
  return rows[0] || {};
}

/**
 * Fetch current month revenue.
 *
 * @returns {number} Revenue for the current month.
 */
async function getCurrentMonthRevenue() {
  const [rows] = await pool.query(`
    SELECT COALESCE(SUM(total_amount), 0) AS revenue FROM invoice
    WHERE DATE_FORMAT(issue_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')
  `);
  return Number(rows[0]?.revenue || 0);
}

/**
 * Fetch previous month revenue.
 *
 * @returns {number} Revenue for last month.
 */
async function getLastMonthRevenue() {
  const [rows] = await pool.query(`
    SELECT COALESCE(SUM(total_amount), 0) AS revenue FROM invoice
    WHERE DATE_FORMAT(issue_date, '%Y-%m') = DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m')
  `);
  return Number(rows[0]?.revenue || 0);
}

/**
 * Get total customer count.
 *
 * @returns {number} Number of customers.
 */
async function getCustomerCount() {
  const [rows] = await pool.query("SELECT COUNT(*) AS count FROM customer");
  return Number(rows[0]?.count || 0);
}

module.exports = {
  getAgingReceivables,
  getCurrentMonthRevenue,
  getCustomerCount,
  getLastMonthRevenue,
  getMonthlyRevenue,
  getOverdueStats,
  getPaidInvoiceStats,
  getRevenueSummary,
  getStatusDistribution,
  getTopCustomers
};
