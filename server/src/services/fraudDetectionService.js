const crypto = require("crypto");

const HIGH_RISK_THRESHOLD = 71;
const MEDIUM_RISK_THRESHOLD = 31;
const BUSINESS_HOUR_START = 8;
const BUSINESS_HOUR_END = 18;
const DEFAULT_APPROVAL_LIMIT = 5000;

function toCurrencyNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Number(numberValue.toFixed(2)) : 0;
}

function getRiskLevel(score) {
  if (score >= HIGH_RISK_THRESHOLD) {
    return "High";
  }

  if (score >= MEDIUM_RISK_THRESHOLD) {
    return "Medium";
  }

  return "Low";
}

function hashBankAccount(value) {
  const normalizedValue = String(value || "").trim().toLowerCase();
  if (!normalizedValue) {
    return "";
  }

  return crypto.createHash("sha256").update(normalizedValue).digest("hex");
}

async function loadInvoice(connection, invoiceId) {
  const [rows] = await connection.query(
    `
      SELECT
        i.invoice_id,
        i.invoiceId,
        i.status,
        i.issue_date,
        i.due_date,
        i.total_amount,
        i.customer_id,
        i.created_at,
        c.name AS customer_name,
        c.email AS customer_email
      FROM invoice i
      INNER JOIN customer c ON c.customer_id = i.customer_id
      WHERE i.invoice_id = ?
      LIMIT 1
    `,
    [invoiceId]
  );

  return rows[0] || null;
}

function addIndicator(indicators, code, label, severity, details = {}) {
  indicators.push({ code, label, severity, details });
}

function calculateScore(indicators) {
  const score = indicators.reduce((sum, indicator) => sum + Number(indicator.severity || 0), 0);
  return Math.max(0, Math.min(100, score));
}

async function loadMetadata(connection, invoiceId) {
  const [rows] = await connection.query(
    "SELECT * FROM invoice_fraud_metadata WHERE invoice_id = ? LIMIT 1",
    [invoiceId]
  );

  return rows[0] || {};
}

async function upsertInvoiceMetadata(connection, invoiceId, metadata = {}) {
  const vendorName = String(metadata.vendor_name || metadata.vendorName || "").trim();
  const bankAccountHash = hashBankAccount(metadata.bank_account || metadata.bankAccount);

  if (!vendorName && !bankAccountHash) {
    return;
  }

  await connection.query(
    `
      INSERT INTO invoice_fraud_metadata (invoice_id, vendor_name, bank_account_hash, source)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        vendor_name = VALUES(vendor_name),
        bank_account_hash = VALUES(bank_account_hash),
        source = VALUES(source),
        updated_at = NOW()
    `,
    [invoiceId, vendorName || null, bankAccountHash || null, metadata.source || "invoice"]
  );
}

async function getCustomerAmountBaseline(connection, invoice) {
  const [rows] = await connection.query(
    `
      SELECT
        COUNT(*) AS invoice_count,
        COALESCE(AVG(total_amount), 0) AS average_amount,
        COALESCE(STDDEV_POP(total_amount), 0) AS amount_stddev
      FROM invoice
      WHERE customer_id = ?
        AND invoice_id <> ?
    `,
    [invoice.customer_id, invoice.invoice_id]
  );

  return rows[0] || {};
}

async function getVendorAmountBaseline(connection, vendorName, invoiceId) {
  if (!vendorName) {
    return {};
  }

  const [rows] = await connection.query(
    `
      SELECT
        COUNT(*) AS invoice_count,
        COALESCE(AVG(i.total_amount), 0) AS average_amount,
        COALESCE(STDDEV_POP(i.total_amount), 0) AS amount_stddev
      FROM invoice i
      INNER JOIN invoice_fraud_metadata ifm ON ifm.invoice_id = i.invoice_id
      WHERE ifm.vendor_name = ?
        AND i.invoice_id <> ?
    `,
    [vendorName, invoiceId]
  );

  return rows[0] || {};
}

async function getVendorSubmissionSpike(connection, vendorName) {
  if (!vendorName) {
    return null;
  }

  const [rows] = await connection.query(
    `
      SELECT
        SUM(CASE WHEN i.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS recent_count,
        COUNT(*) AS total_count,
        GREATEST(TIMESTAMPDIFF(DAY, MIN(i.created_at), NOW()), 1) AS active_days
      FROM invoice i
      INNER JOIN invoice_fraud_metadata ifm ON ifm.invoice_id = i.invoice_id
      WHERE ifm.vendor_name = ?
    `,
    [vendorName]
  );

  const stats = rows[0] || {};
  const recentCount = Number(stats.recent_count || 0);
  const activeDays = Number(stats.active_days || 1);
  const totalCount = Number(stats.total_count || 0);
  const expectedWeeklyCount = Math.max((totalCount / activeDays) * 7, 1);

  return {
    recentCount,
    expectedWeeklyCount,
    isSpike: recentCount >= 5 && recentCount > expectedWeeklyCount * 2
  };
}

async function getVendorRecord(connection, vendorName) {
  if (!vendorName) {
    return null;
  }

  const [rows] = await connection.query(
    "SELECT * FROM fraud_vendor_profile WHERE vendor_name = ? LIMIT 1",
    [vendorName]
  );

  return rows[0] || null;
}

async function detectInvoiceIndicators(connection, invoice, metadata = {}) {
  const indicators = [];

  // Deterministic rules are stored as model-ready indicators for future ML training.
  const [duplicateNumberRows] = await connection.query(
    "SELECT COUNT(*) AS duplicate_count FROM invoice WHERE invoiceId = ? AND invoice_id <> ?",
    [invoice.invoiceId, invoice.invoice_id]
  );
  if (Number(duplicateNumberRows[0]?.duplicate_count || 0) > 0) {
    addIndicator(indicators, "DUPLICATE_INVOICE_NUMBER", "Duplicate invoice number detected.", 35);
  }

  const [duplicateCombinationRows] = await connection.query(
    `
      SELECT COUNT(*) AS duplicate_count
      FROM invoice
      WHERE customer_id = ?
        AND total_amount = ?
        AND issue_date = ?
        AND invoice_id <> ?
    `,
    [invoice.customer_id, invoice.total_amount, invoice.issue_date, invoice.invoice_id]
  );
  if (Number(duplicateCombinationRows[0]?.duplicate_count || 0) > 0) {
    addIndicator(indicators, "DUPLICATE_CUSTOMER_AMOUNT_DATE", "Same customer, amount, and invoice date already exists.", 25);
  }

  const customerBaseline = await getCustomerAmountBaseline(connection, invoice);
  const customerAverage = Number(customerBaseline.average_amount || 0);
  const customerStddev = Number(customerBaseline.amount_stddev || 0);
  if (
    Number(customerBaseline.invoice_count || 0) >= 3 &&
    Number(invoice.total_amount) > Math.max(customerAverage * 3, customerAverage + customerStddev * 2)
  ) {
    addIndicator(indicators, "CUSTOMER_AMOUNT_OUTLIER", "Amount is unusually high for this customer.", 25, {
      averageAmount: customerAverage,
      amountStddev: customerStddev
    });
  }

  const createdAt = invoice.created_at ? new Date(invoice.created_at) : new Date();
  const createdHour = createdAt.getHours();
  const isWeekend = createdAt.getDay() === 0 || createdAt.getDay() === 6;
  if (isWeekend || createdHour < BUSINESS_HOUR_START || createdHour >= BUSINESS_HOUR_END) {
    addIndicator(indicators, "OUTSIDE_BUSINESS_HOURS", "Invoice was submitted outside normal business hours.", 10, {
      submittedAt: createdAt.toISOString()
    });
  }

  if (!invoice.invoiceId || !invoice.customer_id || !invoice.issue_date || !invoice.due_date || Number(invoice.total_amount) <= 0) {
    addIndicator(indicators, "MISSING_OR_SUSPICIOUS_FIELDS", "Invoice contains missing or suspicious core fields.", 20);
  }

  const vendorName = String(metadata.vendor_name || "").trim();
  const vendorRecord = await getVendorRecord(connection, vendorName);
  if (vendorName && !vendorRecord) {
    addIndicator(indicators, "UNKNOWN_VENDOR", "Invoice references an unknown or unregistered vendor.", 25, { vendorName });
  }

  if (vendorName) {
    const vendorBaseline = await getVendorAmountBaseline(connection, vendorName, invoice.invoice_id);
    const vendorAverage = Number(vendorBaseline.average_amount || 0);
    const vendorStddev = Number(vendorBaseline.amount_stddev || 0);
    if (
      Number(vendorBaseline.invoice_count || 0) >= 3 &&
      Number(invoice.total_amount) > Math.max(vendorAverage * 3, vendorAverage + vendorStddev * 2)
    ) {
      addIndicator(indicators, "VENDOR_AMOUNT_OUTLIER", "Amount is unusually high for this vendor.", 25, {
        averageAmount: vendorAverage,
        amountStddev: vendorStddev
      });
    }

    const submissionSpike = await getVendorSubmissionSpike(connection, vendorName);
    if (submissionSpike?.isSpike) {
      addIndicator(indicators, "VENDOR_SUBMISSION_SPIKE", "Vendor has a sudden spike in invoice submissions.", 20, submissionSpike);
    }
  }

  if (
    vendorRecord?.verified_bank_account_hash &&
    metadata.bank_account_hash &&
    vendorRecord.verified_bank_account_hash !== metadata.bank_account_hash
  ) {
    addIndicator(indicators, "BANK_ACCOUNT_MISMATCH", "Bank account differs from the vendor's verified record.", 35);
  }

  return indicators;
}

async function persistAssessment(connection, invoice, indicators, status = "Open") {
  const score = calculateScore(indicators);
  const riskLevel = getRiskLevel(score);

  const [assessmentResult] = await connection.query(
    `
      INSERT INTO invoice_fraud_assessment
        (invoice_id, risk_score, risk_level, review_status, model_version, assessed_at)
      VALUES (?, ?, ?, ?, 'rules-v1', NOW())
      ON DUPLICATE KEY UPDATE
        risk_score = VALUES(risk_score),
        risk_level = VALUES(risk_level),
        review_status = CASE
          WHEN review_status = 'Approved' THEN review_status
          WHEN review_status = 'Rejected' THEN review_status
          ELSE VALUES(review_status)
        END,
        model_version = VALUES(model_version),
        assessed_at = NOW()
    `,
    [invoice.invoice_id, score, riskLevel, status]
  );

  const [assessmentRows] = await connection.query(
    "SELECT assessment_id FROM invoice_fraud_assessment WHERE invoice_id = ? LIMIT 1",
    [invoice.invoice_id]
  );
  const assessmentId = assessmentRows[0]?.assessment_id || assessmentResult.insertId;

  await connection.query("DELETE FROM invoice_fraud_indicator WHERE assessment_id = ?", [assessmentId]);

  if (indicators.length > 0) {
    await connection.query(
      `
        INSERT INTO invoice_fraud_indicator
          (assessment_id, indicator_code, indicator_label, severity, details_json)
        VALUES ?
      `,
      [indicators.map((indicator) => [
        assessmentId,
        indicator.code,
        indicator.label,
        indicator.severity,
        JSON.stringify(indicator.details || {})
      ])]
    );
  }

  if (score >= HIGH_RISK_THRESHOLD) {
    await connection.query(
      `
        INSERT INTO fraud_alert (assessment_id, invoice_id, alert_type, message, status, created_at)
        VALUES (?, ?, 'High Risk Invoice', ?, 'Open', NOW())
      `,
      [assessmentId, invoice.invoice_id, `High-risk invoice ${invoice.invoiceId} requires finance review.`]
    );
  }

  return { assessmentId, riskScore: score, riskLevel, indicators };
}

async function assessInvoiceRisk(connection, invoiceId, metadata = {}) {
  await upsertInvoiceMetadata(connection, invoiceId, metadata);

  const invoice = await loadInvoice(connection, invoiceId);
  if (!invoice) {
    return null;
  }

  const storedMetadata = await loadMetadata(connection, invoiceId);
  const indicators = await detectInvoiceIndicators(connection, invoice, storedMetadata);
  return persistAssessment(connection, invoice, indicators);
}

async function recordApprovalActivity(connection, invoiceId, userId, decision, notes = "") {
  const invoice = await loadInvoice(connection, invoiceId);
  if (!invoice) {
    return { error: "Invoice not found." };
  }

  const [limitRows] = await connection.query(
    "SELECT approval_limit FROM employee_authorization_limit WHERE user_user_id = ? LIMIT 1",
    [userId || null]
  );
  const approvalLimit = toCurrencyNumber(limitRows[0]?.approval_limit || DEFAULT_APPROVAL_LIMIT);

  const metadata = await loadMetadata(connection, invoiceId);
  const indicators = await detectInvoiceIndicators(connection, invoice, metadata);

  if (decision === "Approved" && Number(invoice.total_amount) > approvalLimit) {
    addIndicator(indicators, "APPROVAL_LIMIT_EXCEEDED", "Employee approved an invoice above their authorization limit.", 35, {
      approvalLimit
    });
  }

  const vendorName = String(metadata.vendor_name || "").trim();
  if (vendorName && userId) {
    const [repeatRows] = await connection.query(
      `
        SELECT COUNT(*) AS approval_count
        FROM invoice_approval ia
        INNER JOIN invoice_fraud_metadata ifm ON ifm.invoice_id = ia.invoice_id
        WHERE ia.user_user_id = ?
          AND ifm.vendor_name = ?
          AND ia.decision = 'Approved'
          AND ia.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      `,
      [userId, vendorName]
    );

    if (Number(repeatRows[0]?.approval_count || 0) >= 3) {
      addIndicator(indicators, "REPEATED_VENDOR_APPROVAL", "Same employee repeatedly approved invoices for this vendor.", 20);
    }
  }

  if (userId) {
    const [rapidRows] = await connection.query(
      `
        SELECT COUNT(*) AS rapid_count
        FROM invoice_approval
        WHERE user_user_id = ?
          AND created_at >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)
      `,
      [userId]
    );

    if (Number(rapidRows[0]?.rapid_count || 0) >= 5) {
      addIndicator(indicators, "RAPID_APPROVAL_PATTERN", "Employee approval pattern is unusually rapid.", 20);
    }
  }

  const assessment = await persistAssessment(connection, invoice, indicators, decision === "Rejected" ? "Rejected" : "Open");

  await connection.query(
    `
      INSERT INTO invoice_approval
        (invoice_id, user_user_id, decision, notes, risk_score_at_decision, created_at)
      VALUES (?, ?, ?, ?, ?, NOW())
    `,
    [invoiceId, userId || null, decision, notes, assessment.riskScore]
  );

  await connection.query(
    "UPDATE invoice_fraud_assessment SET review_status = ? WHERE invoice_id = ?",
    [decision, invoiceId]
  );

  return { assessment };
}

module.exports = {
  assessInvoiceRisk,
  getRiskLevel,
  hashBankAccount,
  recordApprovalActivity,
  toCurrencyNumber,
  recordApprovalActivity
};
