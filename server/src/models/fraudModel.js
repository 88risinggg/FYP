/**
 * Fraud Model
 *
 * Database queries for fraud detection and risk assessment.
 */

const { pool } = require("../config/db");

/**
 * Fetch fraud assessment summary with optional filters.
 *
 * @param {string} whereSql - SQL WHERE clause.
 * @param {Array} params - Query parameters for the WHERE clause.
 * @returns {Object} { assessed_count, flagged_count, high_count, medium_count, low_count, average_score }
 */
async function getFraudSummary(whereSql, params) {
  const [rows] = await pool.query(
    `SELECT
      COUNT(*) AS assessed_count,
      SUM(CASE WHEN ifa.risk_level = 'High' THEN 1 ELSE 0 END) AS high_count,
      SUM(CASE WHEN ifa.risk_level = 'Medium' THEN 1 ELSE 0 END) AS medium_count,
      SUM(CASE WHEN ifa.risk_level = 'Low' THEN 1 ELSE 0 END) AS low_count,
      SUM(CASE WHEN ifa.review_status = 'Open' AND ifa.risk_level <> 'Low' THEN 1 ELSE 0 END) AS flagged_count,
      COALESCE(AVG(ifa.risk_score), 0) AS average_score
    FROM invoice_fraud_assessment ifa
    INNER JOIN invoice i ON i.invoice_id = ifa.invoice_id
    INNER JOIN customer c ON c.customer_id = i.customer_id
    LEFT JOIN invoice_fraud_metadata ifm ON ifm.invoice_id = i.invoice_id
    WHERE ${whereSql}`,
    params
  );
  return rows[0] || {};
}

/**
 * Fetch risk level distribution.
 *
 * @param {string} whereSql - SQL WHERE clause.
 * @param {Array} params - Query parameters.
 * @returns {Object[]} Array of { risk_level, invoice_count }.
 */
async function getRiskDistribution(whereSql, params) {
  const [rows] = await pool.query(
    `SELECT ifa.risk_level, COUNT(*) AS invoice_count
     FROM invoice_fraud_assessment ifa
     INNER JOIN invoice i ON i.invoice_id = ifa.invoice_id
     INNER JOIN customer c ON c.customer_id = i.customer_id
     LEFT JOIN invoice_fraud_metadata ifm ON ifm.invoice_id = i.invoice_id
     WHERE ${whereSql} GROUP BY ifa.risk_level`,
    params
  );
  return rows;
}

/**
 * Fetch daily fraud assessment trends (last 30 days).
 *
 * @param {string} whereSql - SQL WHERE clause.
 * @param {Array} params - Query parameters.
 * @returns {Object[]} Array of { assessment_date, assessed_count, high_count, average_score }.
 */
async function getFraudTrends(whereSql, params) {
  const [rows] = await pool.query(
    `SELECT
      DATE_FORMAT(ifa.assessed_at, '%Y-%m-%d') AS assessment_date,
      COUNT(*) AS assessed_count,
      SUM(CASE WHEN ifa.risk_level = 'High' THEN 1 ELSE 0 END) AS high_count,
      AVG(ifa.risk_score) AS average_score
    FROM invoice_fraud_assessment ifa
    INNER JOIN invoice i ON i.invoice_id = ifa.invoice_id
    INNER JOIN customer c ON c.customer_id = i.customer_id
    LEFT JOIN invoice_fraud_metadata ifm ON ifm.invoice_id = i.invoice_id
    WHERE ${whereSql}
    GROUP BY DATE_FORMAT(ifa.assessed_at, '%Y-%m-%d')
    ORDER BY assessment_date DESC LIMIT 30`,
    params
  );
  return rows;
}

/**
 * Fetch flagged invoices with fraud details.
 *
 * @param {string} whereSql - SQL WHERE clause.
 * @param {Array} params - Query parameters.
 * @param {number} limit - Max rows to return.
 * @returns {Object[]} Array of invoice rows with fraud assessment data.
 */
async function getFlaggedInvoices(whereSql, params, limit = 100) {
  const [rows] = await pool.query(
    `SELECT
      i.invoice_id, i.invoiceId, i.issue_date, i.due_date, i.total_amount, i.status,
      c.name AS customer_name, ifm.vendor_name,
      ifa.assessment_id, ifa.risk_score, ifa.risk_level, ifa.review_status, ifa.assessed_at
    FROM invoice_fraud_assessment ifa
    INNER JOIN invoice i ON i.invoice_id = ifa.invoice_id
    INNER JOIN customer c ON c.customer_id = i.customer_id
    LEFT JOIN invoice_fraud_metadata ifm ON ifm.invoice_id = i.invoice_id
    WHERE ${whereSql}
    ORDER BY ifa.risk_score DESC, ifa.assessed_at DESC LIMIT ?`,
    [...params, limit]
  );
  return rows;
}

/**
 * Fetch fraud indicators for a set of assessment IDs.
 *
 * @param {number[]} assessmentIds - Array of assessment primary keys.
 * @returns {Object[]} Array of indicator rows.
 */
async function findIndicatorsByAssessmentIds(assessmentIds) {
  if (assessmentIds.length === 0) return [];
  const [rows] = await pool.query(
    `SELECT assessment_id, indicator_code, indicator_label, severity, details_json
     FROM invoice_fraud_indicator WHERE assessment_id IN (?)
     ORDER BY severity DESC, indicator_id ASC`,
    [assessmentIds]
  );
  return rows;
}

module.exports = {
  findIndicatorsByAssessmentIds,
  getFlaggedInvoices,
  getFraudSummary,
  getFraudTrends,
  getRiskDistribution
};
