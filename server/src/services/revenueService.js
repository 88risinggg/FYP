/**
 * Revenue Service
 *
 * Shared revenue calculation logic.
 * Revenue is defined as the sum of total_amount from PAID invoices only.
 * This ensures consistent revenue figures across Dashboard, Reports, and Exports.
 */

const { pool } = require("../config/db");

/**
 * Get total revenue (Paid invoices only).
 *
 * @returns {Promise<number>} Total revenue from paid invoices.
 */
async function getTotalRevenue() {
  const [rows] = await pool.query(`
    SELECT COALESCE(SUM(total_amount), 0) AS total_revenue
    FROM invoice
    WHERE status = 'Paid' AND invoiceId <> '__SETTINGS__'
  `);
  return Number(rows[0]?.total_revenue || 0);
}

/**
 * Get revenue summary with commission breakdown (Paid invoices only for revenue).
 *
 * @returns {Promise<Object>} { total_revenue, outstanding_revenue, invoice_count,
 *   total_commission, total_salon_payout, collected_commission, collected_salon_payout, avg_commission_rate }
 */
async function getRevenueSummary() {
  const [rows] = await pool.query(`
    SELECT
      COALESCE(SUM(CASE WHEN status = 'Paid' THEN total_amount ELSE 0 END), 0) AS total_revenue,
      COALESCE(SUM(CASE WHEN status <> 'Paid' THEN total_amount ELSE 0 END), 0) AS outstanding_revenue,
      COALESCE(SUM(vaniday_share), 0) AS total_commission,
      COALESCE(SUM(salon_share), 0) AS total_salon_payout,
      COALESCE(SUM(CASE WHEN status = 'Paid' THEN vaniday_share ELSE 0 END), 0) AS collected_commission,
      COALESCE(SUM(CASE WHEN status = 'Paid' THEN salon_share ELSE 0 END), 0) AS collected_salon_payout,
      COALESCE(AVG(commission_rate), 0) AS avg_commission_rate,
      COUNT(*) AS invoice_count
    FROM invoice
    WHERE invoiceId <> '__SETTINGS__'
  `);
  return rows[0] || {};
}

/**
 * Get monthly revenue breakdown (revenue = Paid invoices only per month).
 *
 * @returns {Promise<Object[]>} Array of { month, revenue, collected, commission, salon_payout, invoice_count }
 */
async function getMonthlyRevenue() {
  const [rows] = await pool.query(`
    SELECT
      DATE_FORMAT(issue_date, '%Y-%m') AS month,
      COALESCE(SUM(CASE WHEN status = 'Paid' THEN total_amount ELSE 0 END), 0) AS revenue,
      COALESCE(SUM(CASE WHEN status = 'Paid' THEN total_amount ELSE 0 END), 0) AS collected,
      COALESCE(SUM(CASE WHEN status = 'Paid' THEN vaniday_share ELSE 0 END), 0) AS commission,
      COALESCE(SUM(CASE WHEN status = 'Paid' THEN salon_share ELSE 0 END), 0) AS salon_payout,
      COUNT(*) AS invoice_count
    FROM invoice
    WHERE invoiceId <> '__SETTINGS__'
    GROUP BY DATE_FORMAT(issue_date, '%Y-%m')
    ORDER BY month ASC
  `);
  return rows;
}

/**
 * Get current month revenue (Paid invoices only).
 *
 * @returns {Promise<number>} Revenue for the current month.
 */
async function getCurrentMonthRevenue() {
  const [rows] = await pool.query(`
    SELECT COALESCE(SUM(total_amount), 0) AS revenue,
           COALESCE(SUM(vaniday_share), 0) AS commission
    FROM invoice
    WHERE status = 'Paid'
      AND DATE_FORMAT(issue_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')
      AND invoiceId <> '__SETTINGS__'
  `);
  return rows[0] || { revenue: 0, commission: 0 };
}

/**
 * Get previous month revenue (Paid invoices only).
 *
 * @returns {Promise<number>} Revenue for last month.
 */
async function getLastMonthRevenue() {
  const [rows] = await pool.query(`
    SELECT COALESCE(SUM(total_amount), 0) AS revenue,
           COALESCE(SUM(vaniday_share), 0) AS commission
    FROM invoice
    WHERE status = 'Paid'
      AND DATE_FORMAT(issue_date, '%Y-%m') = DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m')
      AND invoiceId <> '__SETTINGS__'
  `);
  return rows[0] || { revenue: 0, commission: 0 };
}

module.exports = {
  getTotalRevenue,
  getRevenueSummary,
  getMonthlyRevenue,
  getCurrentMonthRevenue,
  getLastMonthRevenue
};
