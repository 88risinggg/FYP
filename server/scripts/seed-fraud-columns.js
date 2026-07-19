/**
 * Seed fraud risk data into invoice columns (no extra tables).
 * Distribution: 20 Low, 6 Medium, 4 High
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { pool } = require("../src/config/db");

function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomElement(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const INDICATORS = [
  { code: "DUPLICATE_INVOICE_NUMBER", label: "Duplicate invoice number detected.", severity: 35 },
  { code: "CUSTOMER_AMOUNT_OUTLIER", label: "Amount is unusually high for this customer.", severity: 25 },
  { code: "OUTSIDE_BUSINESS_HOURS", label: "Invoice submitted outside business hours.", severity: 10 },
  { code: "UNKNOWN_VENDOR", label: "Unknown or unregistered vendor.", severity: 25 },
  { code: "BANK_ACCOUNT_MISMATCH", label: "Bank account differs from verified record.", severity: 35 },
  { code: "VENDOR_SUBMISSION_SPIKE", label: "Sudden spike in vendor submissions.", severity: 20 },
  { code: "RAPID_APPROVAL_PATTERN", label: "Unusually rapid approval pattern.", severity: 20 }
];

const vendors = ["TechSupply Co", "DigitalWorks Agency", "CloudHosting Pte Ltd", "SecureIT Services"];

async function seed() {
  const [invoices] = await pool.query("SELECT invoice_id FROM invoice ORDER BY invoice_id");
  console.log(`Updating ${invoices.length} invoices with fraud data...`);

  const highRisk = new Set([3, 9, 15, 27]);
  const medRisk = new Set([5, 11, 17, 20, 23, 29]);

  for (let i = 0; i < invoices.length; i++) {
    const inv = invoices[i];
    let score, level, reviewStatus, indicators, vendor;

    if (highRisk.has(i)) {
      score = randomInt(71, 95); level = "High";
      reviewStatus = i === 3 ? "Approved" : i === 15 ? "Rejected" : "Open";
      indicators = [...INDICATORS].sort(() => Math.random() - 0.5).slice(0, randomInt(2, 4));
      vendor = randomElement(["Unknown Vendor XYZ", "Suspicious Corp"]);
    } else if (medRisk.has(i)) {
      score = randomInt(35, 65); level = "Medium";
      reviewStatus = i === 5 ? "Approved" : "Open";
      indicators = [...INDICATORS].sort(() => Math.random() - 0.5).slice(0, randomInt(1, 2));
      vendor = randomElement(vendors);
    } else {
      score = randomInt(0, 25); level = "Low"; reviewStatus = "Open";
      indicators = score > 10 ? [...INDICATORS].sort(() => Math.random() - 0.5).slice(0, 1) : [];
      vendor = randomElement(vendors);
    }

    await pool.query(
      `UPDATE invoice SET risk_score = ?, risk_level = ?, review_status = ?,
       fraud_indicators_json = ?, vendor_name = ?, assessed_at = NOW()
       WHERE invoice_id = ?`,
      [score, level, reviewStatus, JSON.stringify(indicators), vendor, inv.invoice_id]
    );
  }

  // Verify
  const [summary] = await pool.query(
    "SELECT risk_level, COUNT(*) AS cnt, AVG(risk_score) AS avg FROM invoice GROUP BY risk_level"
  );
  console.log("\nFraud distribution:");
  summary.forEach(r => console.log(`  ${r.risk_level}: ${r.cnt} invoices (avg score: ${Math.round(r.avg)})`));

  await pool.end();
  console.log("\nDone — no extra tables, just invoice columns.");
}

seed();
