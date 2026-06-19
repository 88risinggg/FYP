const { pool } = require("../config/db");
const { writeAuditLog } = require("./invoiceController");
const {
  assessInvoiceRisk,
  recordApprovalActivity
} = require("../services/fraudDetectionService");

function parseDate(value) {
  if (!value || Number.isNaN(Date.parse(value))) {
    return null;
  }

  return String(value).slice(0, 10);
}

function parseScore(value, fallback) {
  const score = Number(value);
  return Number.isFinite(score) ? score : fallback;
}

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

function parseIndicatorDetails(indicator) {
  return {
    ...indicator,
    details: indicator.details_json ? JSON.parse(indicator.details_json) : {}
  };
}

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

module.exports = {
  getFraudDashboard,
  reassessInvoice,
  reviewInvoice
};
