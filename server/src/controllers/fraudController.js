/**
 * Fraud Detection Controller
 *
 * Uses invoice table columns (risk_score, risk_level, review_status,
 * fraud_indicators_json, vendor_name, assessed_at) instead of separate tables.
 */

const { pool } = require("../config/db");

function parseDate(value) {
  if (!value || Number.isNaN(Date.parse(value))) return null;
  return String(value).slice(0, 10);
}

function parseScore(value, fallback) {
  const score = Number(value);
  return Number.isFinite(score) ? score : fallback;
}

function buildFilteredWhere(query) {
  const clauses = ["1 = 1"];
  const params = [];

  if (parseDate(query.from)) { clauses.push("i.issue_date >= ?"); params.push(parseDate(query.from)); }
  if (parseDate(query.to)) { clauses.push("i.issue_date <= ?"); params.push(parseDate(query.to)); }
  if (query.vendor) { clauses.push("i.vendor_name LIKE ?"); params.push(`%${query.vendor}%`); }
  if (query.customer) { clauses.push("c.name LIKE ?"); params.push(`%${query.customer}%`); }
  if (query.riskLevel) { clauses.push("i.risk_level = ?"); params.push(query.riskLevel); }
  if (parseScore(query.minScore, null) !== null) { clauses.push("i.risk_score >= ?"); params.push(parseScore(query.minScore, 0)); }
  if (parseScore(query.maxScore, null) !== null) { clauses.push("i.risk_score <= ?"); params.push(parseScore(query.maxScore, 100)); }

  return { whereSql: clauses.join(" AND "), params };
}

/**
 * GET /api/fraud/dashboard
 */
async function getFraudDashboard(req, res) {
  const { whereSql, params } = buildFilteredWhere(req.query);

  try {
    const [summaryRows] = await pool.query(`
      SELECT
        COUNT(*) AS assessed_count,
        SUM(CASE WHEN i.risk_level = 'High' THEN 1 ELSE 0 END) AS high_count,
        SUM(CASE WHEN i.risk_level = 'Medium' THEN 1 ELSE 0 END) AS medium_count,
        SUM(CASE WHEN i.risk_level = 'Low' THEN 1 ELSE 0 END) AS low_count,
        SUM(CASE WHEN i.review_status = 'Open' AND i.risk_level != 'Low' THEN 1 ELSE 0 END) AS flagged_count,
        COALESCE(AVG(i.risk_score), 0) AS average_score
      FROM invoice i
      INNER JOIN customer c ON c.customer_id = i.customer_id
      WHERE ${whereSql}
    `, params);

    const [riskRows] = await pool.query(`
      SELECT i.risk_level, COUNT(*) AS invoice_count
      FROM invoice i
      INNER JOIN customer c ON c.customer_id = i.customer_id
      WHERE ${whereSql}
      GROUP BY i.risk_level
    `, params);

    const [trendRows] = await pool.query(`
      SELECT
        DATE_FORMAT(i.assessed_at, '%Y-%m-%d') AS assessment_date,
        COUNT(*) AS assessed_count,
        SUM(CASE WHEN i.risk_level = 'High' THEN 1 ELSE 0 END) AS high_count,
        AVG(i.risk_score) AS average_score
      FROM invoice i
      INNER JOIN customer c ON c.customer_id = i.customer_id
      WHERE ${whereSql} AND i.assessed_at IS NOT NULL
      GROUP BY DATE_FORMAT(i.assessed_at, '%Y-%m-%d')
      ORDER BY assessment_date DESC LIMIT 30
    `, params);

    const [invoiceRows] = await pool.query(`
      SELECT
        i.invoice_id, i.invoiceId, i.issue_date, i.due_date, i.total_amount,
        i.status, i.risk_score, i.risk_level, i.review_status, i.assessed_at,
        i.fraud_indicators_json, i.vendor_name,
        c.name AS customer_name
      FROM invoice i
      INNER JOIN customer c ON c.customer_id = i.customer_id
      WHERE ${whereSql}
      ORDER BY i.risk_score DESC, i.assessed_at DESC
      LIMIT 100
    `, params);

    res.json({
      summary: {
        assessedCount: Number(summaryRows[0]?.assessed_count || 0),
        flaggedCount: Number(summaryRows[0]?.flagged_count || 0),
        highCount: Number(summaryRows[0]?.high_count || 0),
        mediumCount: Number(summaryRows[0]?.medium_count || 0),
        lowCount: Number(summaryRows[0]?.low_count || 0),
        averageScore: Number(Number(summaryRows[0]?.average_score || 0).toFixed(1))
      },
      riskDistribution: riskRows,
      trends: trendRows,
      invoices: invoiceRows.map((invoice) => {
        let indicators = [];
        if (invoice.fraud_indicators_json) {
          try {
            indicators = typeof invoice.fraud_indicators_json === "string"
              ? JSON.parse(invoice.fraud_indicators_json)
              : invoice.fraud_indicators_json;
          } catch { indicators = []; }
        }
        return {
          ...invoice,
          total_amount: Number(invoice.total_amount || 0),
          indicators
        };
      })
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load fraud dashboard.", detail: error.message });
  }
}

/**
 * POST /api/fraud/invoices/:id/reassess
 */
async function reassessInvoice(req, res) {
  const invoiceId = Number(req.params.id);
  if (!invoiceId) return res.status(400).json({ message: "Invalid invoice id." });

  try {
    const [rows] = await pool.query(
      "SELECT invoice_id, total_amount, vendor_name FROM invoice WHERE invoice_id = ? LIMIT 1",
      [invoiceId]
    );
    if (rows.length === 0) return res.status(404).json({ message: "Invoice not found." });

    // Simple rule-based reassessment
    const invoice = rows[0];
    const indicators = [];
    let score = 0;
    const amount = Number(invoice.total_amount || 0);

    if (amount > 15000) { indicators.push({ code: "AMOUNT_OUTLIER", label: "Amount is unusually high.", severity: 25 }); score += 25; }
    if (invoice.vendor_name && invoice.vendor_name.toLowerCase().includes("unknown")) {
      indicators.push({ code: "UNKNOWN_VENDOR", label: "Unknown or unregistered vendor.", severity: 25 }); score += 25;
    }

    const level = score >= 71 ? "High" : score >= 31 ? "Medium" : "Low";

    await pool.query(
      `UPDATE invoice SET risk_score = ?, risk_level = ?, fraud_indicators_json = ?, assessed_at = NOW() WHERE invoice_id = ?`,
      [score, level, JSON.stringify(indicators), invoiceId]
    );

    res.json({ message: "Invoice fraud risk reassessed.", assessment: { risk_score: score, risk_level: level, indicators } });
  } catch (error) {
    res.status(500).json({ message: "Failed to reassess invoice.", detail: error.message });
  }
}

/**
 * POST /api/fraud/invoices/:id/review
 */
async function reviewInvoice(req, res) {
  const invoiceId = Number(req.params.id);
  const decision = req.body.decision;

  if (!invoiceId) return res.status(400).json({ message: "Invalid invoice id." });
  if (!["Approved", "Rejected"].includes(decision)) return res.status(400).json({ message: "Decision must be Approved or Rejected." });

  try {
    await pool.query("UPDATE invoice SET review_status = ? WHERE invoice_id = ?", [decision, invoiceId]);
    res.json({ message: `Invoice ${decision.toLowerCase()} for fraud review.` });
  } catch (error) {
    res.status(500).json({ message: "Failed to review invoice.", detail: error.message });
  }
}

module.exports = {
  buildFilteredWhere,
  getFraudDashboard,
  reassessInvoice,
  reviewInvoice
};
