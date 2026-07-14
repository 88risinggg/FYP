/**
 * Fraud Detection Controller
 *
 * Provides fraud risk monitoring and review workflow.
 * Features:
 * - Dashboard with risk score distribution, trends, and flagged invoices
 * - Reassess individual invoices for updated risk scores
 * - Review workflow (Approve/Reject) for high-risk invoices
 *
 * Integrates with the fraudDetectionService for risk scoring
 * and the invoiceController for audit logging.
 */

const { pool } = require("../config/db");
const { writeAuditLog } = require("./invoiceController");
const {
  assessInvoiceRisk,
  recordApprovalActivity
} = require("../services/fraudDetectionService");

/**
 * Parse a date string, returning null if invalid.
 *
 * @param {*} value - Date string to parse.
 * @returns {string|null} Date string (YYYY-MM-DD) or null.
 */
function parseDate(value) {
  if (!value || Number.isNaN(Date.parse(value))) {
    return null;
  }

  return String(value).slice(0, 10);
}

/**
 * Parse a numeric score value with a fallback default.
 *
 * @param {*} value - Score value to parse.
 * @param {number|null} fallback - Default if value is not finite.
 * @returns {number|null}
 */
function parseScore(value, fallback) {
  const score = Number(value);
  return Number.isFinite(score) ? score : fallback;
}

/**
 * Build SQL WHERE clause and parameters from query string filters.
 * Supports filtering by: date range, vendor, customer, risk level, score range.
 *
 * @param {Object} query - Express req.query object.
 * @returns {Object} { whereSql: string, params: array }
 */
function buildFilteredWhere(query) {
  const clauses = ["1 = 1"];
  const params = [];
  const fromDate = parseDate(query.from);
  const toDate = parseDate(query.to);
  const minScore = parseScore(query.minScore, null);
  const maxScore = parseScore(query.maxScore, null);

  if (fromDate) {
    clauses.push("i.issue_date >= ?");
    params.push(fromDate);
  }

  if (toDate) {
    clauses.push("i.issue_date <= ?");
    params.push(toDate);
  }

  if (query.vendor) {
    clauses.push("ifm.vendor_name LIKE ?");
    params.push(`%${query.vendor}%`);
  }

  if (query.customer) {
    clauses.push("c.name LIKE ?");
    params.push(`%${query.customer}%`);
  }

  if (query.riskLevel) {
    clauses.push("ifa.risk_level = ?");
    params.push(query.riskLevel);
  }

  if (minScore !== null) {
    clauses.push("ifa.risk_score >= ?");
    params.push(minScore);
  }

  if (maxScore !== null) {
    clauses.push("ifa.risk_score <= ?");
    params.push(maxScore);
  }

  return {
    whereSql: clauses.join(" AND "),
    params
  };
}

/**
 * Parse the JSON details stored in a fraud indicator record.
 *
 * @param {Object} indicator - Raw indicator row from database.
 * @returns {Object} Indicator with parsed details object.
 */
function parseIndicatorDetails(indicator) {
  let details = {};
  if (indicator.details_json) {
    details = typeof indicator.details_json === "string"
      ? JSON.parse(indicator.details_json)
      : indicator.details_json;
  }
  return {
    ...indicator,
    details
  };
}

/**
 * GET /api/fraud/dashboard
 *
 * Returns the fraud detection dashboard data:
 * - Summary counts (assessed, flagged, high/medium/low risk, average score)
 * - Risk distribution breakdown
 * - Daily assessment trends (last 30 days)
 * - Flagged invoices with their fraud indicators
 *
 * Supports query string filters: from, to, vendor, customer, riskLevel, minScore, maxScore.
 */
async function getFraudDashboard(req, res) {
  const { whereSql, params } = buildFilteredWhere(req.query);

  try {
    const [summaryRows] = await pool.query(
      `
        SELECT
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
        WHERE ${whereSql}
      `,
      params
    );

    const [riskRows] = await pool.query(
      `
        SELECT ifa.risk_level, COUNT(*) AS invoice_count
        FROM invoice_fraud_assessment ifa
        INNER JOIN invoice i ON i.invoice_id = ifa.invoice_id
        INNER JOIN customer c ON c.customer_id = i.customer_id
        LEFT JOIN invoice_fraud_metadata ifm ON ifm.invoice_id = i.invoice_id
        WHERE ${whereSql}
        GROUP BY ifa.risk_level
      `,
      params
    );

    const [trendRows] = await pool.query(
      `
        SELECT
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
        ORDER BY assessment_date DESC
        LIMIT 30
      `,
      params
    );

    const [invoiceRows] = await pool.query(
      `
        SELECT
          i.invoice_id,
          i.invoiceId,
          i.issue_date,
          i.due_date,
          i.total_amount,
          i.status,
          c.name AS customer_name,
          ifm.vendor_name,
          ifa.assessment_id,
          ifa.risk_score,
          ifa.risk_level,
          ifa.review_status,
          ifa.assessed_at
        FROM invoice_fraud_assessment ifa
        INNER JOIN invoice i ON i.invoice_id = ifa.invoice_id
        INNER JOIN customer c ON c.customer_id = i.customer_id
        LEFT JOIN invoice_fraud_metadata ifm ON ifm.invoice_id = i.invoice_id
        WHERE ${whereSql}
        ORDER BY ifa.risk_score DESC, ifa.assessed_at DESC
        LIMIT 100
      `,
      params
    );

    const assessmentIds = invoiceRows.map((row) => row.assessment_id);
    let indicatorsByAssessmentId = {};

    if (assessmentIds.length > 0) {
      const [indicatorRows] = await pool.query(
        `
          SELECT assessment_id, indicator_code, indicator_label, severity, details_json
          FROM invoice_fraud_indicator
          WHERE assessment_id IN (?)
          ORDER BY severity DESC, indicator_id ASC
        `,
        [assessmentIds]
      );

      indicatorsByAssessmentId = indicatorRows.reduce((acc, indicator) => {
        acc[indicator.assessment_id] = acc[indicator.assessment_id] || [];
        acc[indicator.assessment_id].push(parseIndicatorDetails(indicator));
        return acc;
      }, {});
    }

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
      invoices: invoiceRows.map((invoice) => ({
        ...invoice,
        total_amount: Number(invoice.total_amount || 0),
        indicators: indicatorsByAssessmentId[invoice.assessment_id] || []
      }))
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to load fraud dashboard.",
      detail: error.message
    });
  }
}

/**
 * POST /api/fraud/:id/reassess
 *
 * Triggers a fresh fraud risk assessment for a specific invoice.
 * Recalculates the risk score based on current rules and metadata.
 * Writes an audit log entry for the reassessment.
 *
 * URL param: id (invoice primary key)
 * Request body: { metadata?: Object } - Optional additional metadata for assessment.
 */
async function reassessInvoice(req, res) {
  const invoiceId = Number(req.params.id);

  if (!invoiceId) {
    return res.status(400).json({ message: "Invalid invoice id." });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const assessment = await assessInvoiceRisk(connection, invoiceId, req.body.metadata || {});
    await writeAuditLog(connection, "fraud_invoice_reassessed", "invoice", invoiceId, req.user?.userId);
    await connection.commit();

    res.json({
      message: "Invoice fraud risk reassessed.",
      assessment
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({
      message: "Failed to reassess invoice.",
      detail: error.message
    });
  } finally {
    connection.release();
  }
}

/**
 * POST /api/fraud/:id/review
 *
 * Records a fraud review decision (Approved or Rejected) for a flagged invoice.
 * Only invoices with fraud assessments can be reviewed.
 * Writes audit log with the decision and optional notes.
 *
 * URL param: id (invoice primary key)
 * Request body: { decision: "Approved"|"Rejected", notes?: string }
 */
async function reviewInvoice(req, res) {
  const invoiceId = Number(req.params.id);
  const decision = req.body.decision;
  const notes = String(req.body.notes || "").trim();

  if (!invoiceId) {
    return res.status(400).json({ message: "Invalid invoice id." });
  }

  if (!["Approved", "Rejected"].includes(decision)) {
    return res.status(400).json({ message: "Decision must be Approved or Rejected." });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const review = await recordApprovalActivity(connection, invoiceId, req.user?.userId, decision, notes);

    if (review.error) {
      await connection.rollback();
      return res.status(400).json({
        message: review.error,
        assessment: review.assessment
      });
    }

    await writeAuditLog(
      connection,
      `fraud_review:${decision}`,
      "invoice",
      invoiceId,
      req.user?.userId
    );

    await connection.commit();

    res.json({
      message: `Invoice ${decision.toLowerCase()} for fraud review.`,
      assessment: review.assessment
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({
      message: "Failed to review invoice.",
      detail: error.message
    });
  } finally {
    connection.release();
  }
}

/**
 * POST /api/fraud/report-notification
 *
 * Generates a fraud compliance report notification and sends it to all Finance users.
 * Triggered from the Fraud Compliance Checklist panel when exporting a report.
 *
 * Request body: { failed_checks: Array, summary: Object }
 */
async function sendFraudReportNotification(req, res) {
  const { failed_checks = [], summary = {} } = req.body;

  try {
    const { createNotificationInternal } = require("./notificationController");

    // Get all Finance and Admin users to notify
    const [financeUsers] = await pool.query(
      `SELECT u.user_id, u.name FROM user u
       INNER JOIN role r ON r.role_id = u.role_id
       WHERE r.role_name IN ('Finance', 'Admin') AND u.status = 'Active'`
    );

    if (financeUsers.length === 0) {
      return res.json({ message: "No finance users to notify", notified: 0 });
    }

    const failCount = failed_checks.length;
    const criticalFails = failed_checks.filter((c) => c.severity === "Critical").length;
    const title = criticalFails > 0
      ? `⚠️ Fraud Alert: ${criticalFails} critical compliance failure(s)`
      : `📋 Fraud Report: ${failCount} check(s) require attention`;

    const message = [
      `Fraud compliance report generated on ${new Date().toLocaleString()}.`,
      `Summary: ${summary.assessedCount || 0} invoices assessed, ${summary.highCount || 0} high-risk, ${summary.flaggedCount || 0} flagged.`,
      failCount > 0 ? `Failed checks: ${failed_checks.map((c) => c.label).join(", ")}` : "All checks passed.",
      "Please review the exported Excel report for full details."
    ].join(" ");

    // Send notification to each Finance/Admin user
    for (const user of financeUsers) {
      await createNotificationInternal(user.user_id, "system", title, message);
    }

    // Log audit entry
    await writeAuditLog(pool, "fraud_report_generated", "system", null, req.user?.userId);

    res.json({
      message: "Fraud report notification sent to finance team",
      notified: financeUsers.length,
      recipients: financeUsers.map((u) => u.name)
    });
  } catch (error) {
    console.error("Failed to send fraud report notification:", error);
    res.status(500).json({ message: "Failed to send notification", detail: error.message });
  }
}

/**
 * POST /api/fraud/flag-invalid-rows
 *
 * Flags invalid bulk upload rows as potential fraud indicators.
 * Creates fraud assessment records for rows that failed validation.
 * Request body: { rows: Array, source_file: string }
 */
async function flagInvalidRows(req, res) {
  const connection = await pool.getConnection();
  try {
    const { rows = [], source_file = "bulk_upload" } = req.body;

    if (rows.length === 0) {
      return res.json({ message: "No rows to flag.", flagged: 0 });
    }

    let flaggedCount = 0;

    for (const row of rows) {
      const invoiceNumber = row["Invoice Number"] || row.invoice_number || `INVALID-${Date.now()}`;
      const customerName = row["Customer Name"] || row.customer_name || "Unknown";
      const amount = Number(row["Amount"] || row.amount) || 0;
      const errors = row.validation_errors || [];

      // Insert a record into invoice_fraud_assessment for tracking
      await connection.query(
        `INSERT INTO invoice_fraud_assessment
          (invoice_id, risk_score, risk_level, assessed_at, review_status)
         VALUES (NULL, ?, 'High', NOW(), 'Pending')`,
        [85]
      );
      const [[{ lastId }]] = await connection.query("SELECT LAST_INSERT_ID() as lastId");

      // Insert fraud indicators for each validation error
      for (const error of errors) {
        await connection.query(
          `INSERT INTO invoice_fraud_indicator
            (assessment_id, indicator_type, description, weight, details_json)
           VALUES (?, ?, ?, ?, ?)`,
          [
            lastId,
            "INVALID_BULK_UPLOAD",
            `Invalid row from bulk upload: ${error}`,
            30,
            JSON.stringify({
              invoice_number: invoiceNumber,
              customer_name: customerName,
              amount,
              source_file,
              validation_error: error
            })
          ]
        );
      }

      // If no specific errors, add a generic indicator
      if (errors.length === 0) {
        await connection.query(
          `INSERT INTO invoice_fraud_indicator
            (assessment_id, indicator_type, description, weight, details_json)
           VALUES (?, ?, ?, ?, ?)`,
          [
            lastId,
            "INVALID_BULK_UPLOAD",
            `Row failed validation during bulk upload from ${source_file}`,
            30,
            JSON.stringify({ invoice_number: invoiceNumber, customer_name: customerName, amount, source_file })
          ]
        );
      }

      flaggedCount++;
    }

    await writeAuditLog(pool, `fraud_flagged_invalid_rows:${flaggedCount}`, "bulk_upload", null, req.user?.userId);

    res.json({
      message: `${flaggedCount} invalid rows flagged for fraud review.`,
      flagged: flaggedCount
    });
  } catch (error) {
    console.error("[Fraud] Flag invalid rows error:", error);
    res.status(500).json({ message: "Failed to flag invalid rows.", detail: error.message });
  } finally {
    connection.release();
  }
}

module.exports = {
  buildFilteredWhere,
  flagInvalidRows,
  getFraudDashboard,
  parseIndicatorDetails,
  reassessInvoice,
  reviewInvoice,
  sendFraudReportNotification
};
