/**
 * EVALUATION HEADER
 * FEATURE: INVOICE - SHARED
 * PURPOSE: Reads and writes fraud Model data in the database.
 * LAYER: Backend model - contains database queries and persistence operations.
 * FIND RELATED CODE: Use Find All References to locate the controller/service that requests this data.
 */
/**
 * Fraud Model
 *
 * Database queries for fraud detection and risk assessment.
 * Fraud data is now stored inline on the invoice table (risk_score, risk_level,
 * review_status, fraud_indicators_json, vendor_name, assessed_at).
 */

const { pool } = require("../config/db");

/**
 * Fetch fraud assessment summary with optional filters.
 */
async function getFraudSummary(whereSql, params) {
  const [rows] = await pool.query(
    `SELECT
      COUNT(*) AS assessed_count,
      SUM(CASE WHEN i.risk_level = 'High' THEN 1 ELSE 0 END) AS high_count,
      SUM(CASE WHEN i.risk_level = 'Medium' THEN 1 ELSE 0 END) AS medium_count,
      SUM(CASE WHEN i.risk_level = 'Low' THEN 1 ELSE 0 END) AS low_count,
      SUM(CASE WHEN i.review_status = 'Open' AND i.risk_level <> 'Low' THEN 1 ELSE 0 END) AS flagged_count,
      COALESCE(AVG(i.risk_score), 0) AS average_score
    FROM invoice i
    INNER JOIN customer c ON c.customer_id = i.customer_id
    WHERE i.risk_score IS NOT NULL AND i.invoiceId <> '__SETTINGS__' AND ${whereSql}`,
    params
  );
  return rows[0] || {};
}

/**
 * Fetch risk level distribution.
 */
async function getRiskDistribution(whereSql, params) {
  const [rows] = await pool.query(
    `SELECT i.risk_level, COUNT(*) AS invoice_count
     FROM invoice i
     INNER JOIN customer c ON c.customer_id = i.customer_id
     WHERE i.risk_score IS NOT NULL AND i.invoiceId <> '__SETTINGS__' AND ${whereSql}
     GROUP BY i.risk_level`,
    params
  );
  return rows;
}

/**
 * Fetch daily fraud assessment trends (last 30 days).
 */
async function getFraudTrends(whereSql, params) {
  const [rows] = await pool.query(
    `SELECT
      DATE_FORMAT(i.assessed_at, '%Y-%m-%d') AS assessment_date,
      COUNT(*) AS assessed_count,
      SUM(CASE WHEN i.risk_level = 'High' THEN 1 ELSE 0 END) AS high_count,
      AVG(i.risk_score) AS average_score
    FROM invoice i
    INNER JOIN customer c ON c.customer_id = i.customer_id
    WHERE i.risk_score IS NOT NULL AND i.invoiceId <> '__SETTINGS__' AND ${whereSql}
    GROUP BY DATE_FORMAT(i.assessed_at, '%Y-%m-%d')
    ORDER BY assessment_date DESC LIMIT 30`,
    params
  );
  return rows;
}

/**
 * Fetch flagged invoices with fraud details.
 */
async function getFlaggedInvoices(whereSql, params, limit = 100) {
  const [rows] = await pool.query(
    `SELECT
      i.invoice_id, i.invoiceId, i.issue_date, i.due_date, i.total_amount, i.status,
      c.name AS customer_name, i.vendor_name,
      i.invoice_id AS assessment_id, i.risk_score, i.risk_level, i.review_status, i.assessed_at
    FROM invoice i
    INNER JOIN customer c ON c.customer_id = i.customer_id
    WHERE i.risk_score IS NOT NULL AND i.invoiceId <> '__SETTINGS__' AND ${whereSql}
    ORDER BY i.risk_score DESC, i.assessed_at DESC LIMIT ?`,
    [...params, limit]
  );
  return rows;
}

/**
 * Fetch fraud indicators for a set of invoice IDs (from inline JSON).
 */
async function findIndicatorsByAssessmentIds(assessmentIds) {
  if (assessmentIds.length === 0) return [];
  const [rows] = await pool.query(
    "SELECT invoice_id AS assessment_id, fraud_indicators_json FROM invoice WHERE invoice_id IN (?)",
    [assessmentIds]
  );

  const indicators = [];
  for (const row of rows) {
    let parsed = row.fraud_indicators_json;
    if (typeof parsed === "string") {
      try { parsed = JSON.parse(parsed); } catch { parsed = []; }
    }
    if (Array.isArray(parsed)) {
      for (const ind of parsed) {
        indicators.push({
          assessment_id: row.assessment_id,
          indicator_code: ind.indicator_code || ind.code,
          indicator_label: ind.indicator_label || ind.label,
          severity: ind.severity,
          details_json: ind.details_json || ind.details || null
        });
      }
    }
  }
  return indicators;
}

module.exports = {
  findIndicatorsByAssessmentIds,
  getFlaggedInvoices,
  getFraudSummary,
  getFraudTrends,
  getRiskDistribution
};
