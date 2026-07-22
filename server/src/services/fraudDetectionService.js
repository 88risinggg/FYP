/**
 * Rule based fraud assessment stored on the invoice itself.
 *
 * Keeping assessments inline makes the import workflow deployable with the
 * canonical invoice schema; no optional fraud tables are required.
 */
const crypto = require("crypto");

const HIGH_RISK_THRESHOLD = 71;
const MEDIUM_RISK_THRESHOLD = 31;

function toCurrencyNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : 0;
}

function getRiskLevel(score) {
  return score >= HIGH_RISK_THRESHOLD ? "High" : score >= MEDIUM_RISK_THRESHOLD ? "Medium" : "Low";
}

function hashBankAccount(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized ? crypto.createHash("sha256").update(normalized).digest("hex") : "";
}

function add(indicators, code, label, severity, details = {}) {
  indicators.push({ code, label, severity, details });
}

async function loadInvoice(connection, invoiceId) {
  const [rows] = await connection.query(
    `SELECT i.invoice_id, i.invoiceId, i.status, i.issue_date, i.due_date,
            i.total_amount, i.customer_id, i.created_at, i.items_json,
            i.vendor_name, i.shop_title, c.name AS customer_name,
            c.email AS customer_email, c.phone AS customer_phone
       FROM invoice i JOIN customer c ON c.customer_id = i.customer_id
      WHERE i.invoice_id = ? LIMIT 1`,
    [invoiceId]
  );
  return rows[0] || null;
}

function invoiceDescriptions(itemsJson) {
  try {
    const items = typeof itemsJson === "string" ? JSON.parse(itemsJson) : itemsJson;
    return Array.isArray(items) ? items.map((item) => item.description || "").join(" ") : "";
  } catch { return ""; }
}

async function detectInvoiceIndicators(connection, invoice) {
  const indicators = [];
  const [duplicateNumber] = await connection.query(
    "SELECT COUNT(*) AS count FROM invoice WHERE invoiceId = ? AND invoice_id <> ?",
    [invoice.invoiceId, invoice.invoice_id]
  );
  if (Number(duplicateNumber[0]?.count || 0)) add(indicators, "DUPLICATE_INVOICE_NUMBER", "Duplicate invoice number detected.", 35);

  const [duplicateInvoice] = await connection.query(
    `SELECT COUNT(*) AS count FROM invoice
      WHERE customer_id = ? AND total_amount = ? AND issue_date = ? AND invoice_id <> ?`,
    [invoice.customer_id, invoice.total_amount, invoice.issue_date, invoice.invoice_id]
  );
  if (Number(duplicateInvoice[0]?.count || 0)) add(indicators, "DUPLICATE_CUSTOMER_AMOUNT_DATE", "Same customer, amount, and invoice date already exists.", 25);

  const [baseline] = await connection.query(
    `SELECT COUNT(*) AS count, COALESCE(AVG(total_amount), 0) AS average_amount
       FROM invoice WHERE customer_id = ? AND invoice_id <> ?`,
    [invoice.customer_id, invoice.invoice_id]
  );
  if (Number(baseline[0]?.count || 0) >= 3 && Number(invoice.total_amount) > Number(baseline[0].average_amount) * 3) {
    add(indicators, "CUSTOMER_AMOUNT_OUTLIER", "Amount is unusually high for this customer.", 25, { averageAmount: Number(baseline[0].average_amount) });
  }

  const [rapid] = await connection.query(
    `SELECT COUNT(*) AS count FROM invoice WHERE customer_id = ? AND invoice_id <> ?
       AND created_at BETWEEN DATE_SUB(?, INTERVAL 10 MINUTE) AND DATE_ADD(?, INTERVAL 10 MINUTE)`,
    [invoice.customer_id, invoice.invoice_id, invoice.created_at, invoice.created_at]
  );
  if (Number(rapid[0]?.count || 0) >= 3) add(indicators, "RAPID_INVOICE_GENERATION", "Several invoices were created for this customer within minutes.", 25);

  const issue = new Date(invoice.issue_date);
  const due = new Date(invoice.due_date);
  const paymentDays = Number.isNaN(issue.getTime()) || Number.isNaN(due.getTime()) ? null : Math.round((due - issue) / 86400000);
  if (paymentDays === null || paymentDays < 0 || paymentDays > 60) add(indicators, "UNUSUAL_PAYMENT_TERMS", "Invoice has unusual payment terms.", 20, { paymentDays });

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(invoice.customer_email || ""))) {
    add(indicators, "INVALID_CUSTOMER_DATA", "Customer email is invalid or missing.", 20);
  } else if (/(mailinator|tempmail|example-invalid|fake)/i.test(invoice.customer_email)) {
    add(indicators, "SUSPICIOUS_EMAIL_DOMAIN", "Customer email uses a suspicious or disposable domain.", 15);
  }
  if (invoice.customer_phone && !/^[\d\s+()\-]{6,20}$/.test(String(invoice.customer_phone))) {
    add(indicators, "INVALID_CUSTOMER_DATA", "Customer phone number is invalid.", 15);
  }

  if (/urgent|confidential|refund adjustment|cash payout|crypto|gift card/i.test(invoiceDescriptions(invoice.items_json))) {
    add(indicators, "SUSPICIOUS_DESCRIPTION", "Invoice description contains suspicious wording.", 20);
  }

  if (/unknown|suspicious|unregistered/i.test(String(invoice.vendor_name || invoice.shop_title || ""))) {
    add(indicators, "UNKNOWN_VENDOR", "Invoice references an unknown or unregistered vendor.", 25);
  }

  const [sameRoundedAmount] = await connection.query(
    `SELECT COUNT(*) AS count FROM invoice WHERE total_amount = ? AND MOD(total_amount, 100) = 0 AND invoice_id <> ?`,
    [invoice.total_amount, invoice.invoice_id]
  );
  if (Number(sameRoundedAmount[0]?.count || 0) >= 3) add(indicators, "REPEATED_ROUNDED_AMOUNT", "Repeated identical rounded totals detected.", 15);

  return indicators;
}

async function assessInvoiceRisk(connection, invoiceId, metadata = {}) {
  if (metadata.vendor_name || metadata.vendorName) {
    await connection.query("UPDATE invoice SET vendor_name = COALESCE(?, vendor_name) WHERE invoice_id = ?", [metadata.vendor_name || metadata.vendorName, invoiceId]);
  }
  const invoice = await loadInvoice(connection, invoiceId);
  if (!invoice) return null;
  const indicators = await detectInvoiceIndicators(connection, invoice);
  const riskScore = Math.min(100, indicators.reduce((sum, item) => sum + item.severity, 0));
  const riskLevel = getRiskLevel(riskScore);
  await connection.query(
    `UPDATE invoice SET risk_score = ?, risk_level = ?, review_status = COALESCE(review_status, 'Open'),
       fraud_indicators_json = ?, assessed_at = NOW() WHERE invoice_id = ?`,
    [riskScore, riskLevel, JSON.stringify(indicators), invoiceId]
  );
  return { riskScore, riskLevel, indicators };
}

async function recordApprovalActivity(connection, invoiceId, userId, decision) {
  const assessment = await assessInvoiceRisk(connection, invoiceId);
  if (!assessment) return { error: "Invoice not found." };
  await connection.query("UPDATE invoice SET review_status = ? WHERE invoice_id = ?", [decision, invoiceId]);
  return { assessment };
}

module.exports = { assessInvoiceRisk, getRiskLevel, hashBankAccount, recordApprovalActivity, toCurrencyNumber };
