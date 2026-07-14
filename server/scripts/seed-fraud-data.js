/**
 * Seed Fraud Detection Data
 *
 * Adds realistic fraud assessment records to the 30 sample invoices.
 * Distribution:
 *   - 20 invoices: Low risk (score 0-30)
 *   - 6 invoices: Medium risk (score 31-70)
 *   - 4 invoices: High risk (score 71-100)
 *
 * High-risk invoices include indicators like:
 *   - Duplicate invoice number
 *   - Unknown vendor
 *   - Amount outlier
 *   - Bank account mismatch
 *   - Outside business hours
 *   - Vendor submission spike
 *
 * Some high-risk invoices are marked as "Approved" (reviewed & cleared),
 * some remain "Open" (pending review).
 *
 * Usage: node scripts/seed-fraud-data.js
 */

require("dotenv").config();
const { pool } = require("../src/config/db");

const INDICATOR_LIBRARY = [
  { code: "DUPLICATE_INVOICE_NUMBER", label: "Duplicate invoice number detected.", severity: 35 },
  { code: "DUPLICATE_CUSTOMER_AMOUNT_DATE", label: "Same customer, amount, and invoice date already exists.", severity: 25 },
  { code: "CUSTOMER_AMOUNT_OUTLIER", label: "Amount is unusually high for this customer.", severity: 25 },
  { code: "OUTSIDE_BUSINESS_HOURS", label: "Invoice was submitted outside normal business hours.", severity: 10 },
  { code: "MISSING_OR_SUSPICIOUS_FIELDS", label: "Invoice contains missing or suspicious core fields.", severity: 20 },
  { code: "UNKNOWN_VENDOR", label: "Invoice references an unknown or unregistered vendor.", severity: 25 },
  { code: "VENDOR_AMOUNT_OUTLIER", label: "Amount is unusually high for this vendor.", severity: 25 },
  { code: "VENDOR_SUBMISSION_SPIKE", label: "Vendor has a sudden spike in invoice submissions.", severity: 20 },
  { code: "BANK_ACCOUNT_MISMATCH", label: "Bank account differs from the vendor's verified record.", severity: 35 },
  { code: "RAPID_APPROVAL_PATTERN", label: "Employee approval pattern is unusually rapid.", severity: 20 },
  { code: "APPROVAL_LIMIT_EXCEEDED", label: "Employee approved an invoice above their authorization limit.", severity: 35 }
];

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickIndicators(targetScore, count) {
  const picked = [];
  let remaining = targetScore;

  // Pick random indicators that sum approximately to the target
  const shuffled = [...INDICATOR_LIBRARY].sort(() => Math.random() - 0.5);

  for (let i = 0; i < Math.min(count, shuffled.length); i++) {
    if (remaining <= 0) break;
    const ind = shuffled[i];
    if (ind.severity <= remaining + 10) {
      picked.push(ind);
      remaining -= ind.severity;
    }
  }

  return picked;
}

async function seed() {
  console.log("[FRAUD SEED] Generating fraud assessment data for 30 invoices...\n");

  const connection = await pool.getConnection();

  try {
    // Get all invoice IDs
    const [invoices] = await connection.query(
      "SELECT invoice_id, invoiceId, total_amount, status FROM invoice ORDER BY invoice_id"
    );

    if (invoices.length !== 30) {
      console.error(`[FRAUD SEED] Expected 30 invoices, found ${invoices.length}. Run setup-invoice-system.js first.`);
      process.exit(1);
    }

    // Clear existing fraud data
    await connection.query("DELETE FROM invoice_fraud_indicator");
    await connection.query("DELETE FROM invoice_fraud_assessment");
    try { await connection.query("DELETE FROM fraud_alert"); } catch {}
    try { await connection.query("DELETE FROM invoice_fraud_metadata"); } catch {}

    await connection.beginTransaction();

    // Define risk distribution (indices into invoices array)
    // High risk: 4 invoices (indices 3, 9, 15, 27)
    // Medium risk: 6 invoices (indices 5, 11, 17, 20, 23, 29)
    // Low risk: remaining 20
    const highRiskIndices = new Set([3, 9, 15, 27]);
    const mediumRiskIndices = new Set([5, 11, 17, 20, 23, 29]);

    let lowCount = 0, medCount = 0, highCount = 0;

    for (let i = 0; i < invoices.length; i++) {
      const invoice = invoices[i];
      let riskScore, riskLevel, reviewStatus, indicators;

      if (highRiskIndices.has(i)) {
        // High risk: score 71-95
        riskScore = randomInt(71, 95);
        riskLevel = "High";
        // Some approved (reviewed), some still open
        reviewStatus = i === 3 ? "Approved" : i === 15 ? "Rejected" : "Open";
        indicators = pickIndicators(riskScore, randomInt(2, 4));
        highCount++;
      } else if (mediumRiskIndices.has(i)) {
        // Medium risk: score 31-70
        riskScore = randomInt(31, 65);
        riskLevel = "Medium";
        reviewStatus = i === 5 ? "Approved" : "Open";
        indicators = pickIndicators(riskScore, randomInt(1, 3));
        medCount++;
      } else {
        // Low risk: score 0-30
        riskScore = randomInt(0, 25);
        riskLevel = "Low";
        reviewStatus = "Open";
        indicators = riskScore > 5 ? pickIndicators(riskScore, randomInt(0, 2)) : [];
        lowCount++;
      }

      // Recalculate actual score from indicators
      const actualScore = indicators.reduce((sum, ind) => sum + ind.severity, 0);
      const finalScore = Math.min(100, Math.max(actualScore, riskScore > 70 ? 71 : riskScore > 30 ? 31 : 0));
      const finalLevel = finalScore >= 71 ? "High" : finalScore >= 31 ? "Medium" : "Low";

      // Insert assessment
      const [assessResult] = await connection.query(
        `INSERT INTO invoice_fraud_assessment
          (invoice_id, risk_score, risk_level, review_status, model_version, assessed_at)
         VALUES (?, ?, ?, ?, 'rules-v1', NOW())`,
        [invoice.invoice_id, finalScore, finalLevel, reviewStatus]
      );
      const assessmentId = assessResult.insertId;

      // Insert indicators
      if (indicators.length > 0) {
        const indicatorValues = indicators.map((ind) => [
          assessmentId,
          ind.code,
          ind.label,
          ind.severity,
          JSON.stringify(ind.details || {})
        ]);
        await connection.query(
          `INSERT INTO invoice_fraud_indicator
            (assessment_id, indicator_code, indicator_label, severity, details_json)
           VALUES ?`,
          [indicatorValues]
        );
      }

      // Insert fraud alert for high-risk invoices
      if (finalLevel === "High") {
        try {
          await connection.query(
            `INSERT INTO fraud_alert (assessment_id, invoice_id, alert_type, message, status, created_at)
             VALUES (?, ?, 'High Risk Invoice', ?, ?, NOW())`,
            [
              assessmentId,
              invoice.invoice_id,
              `High-risk invoice ${invoice.invoiceId} (score: ${finalScore}) requires finance review.`,
              reviewStatus === "Approved" ? "Resolved" : reviewStatus === "Rejected" ? "Resolved" : "Open"
            ]
          );
        } catch { /* fraud_alert table may not exist */ }
      }

      // Insert metadata for some invoices (vendor info)
      const vendors = [
        "TechSupply Co", "DigitalWorks Agency", "CloudHosting Pte Ltd",
        "DataCorp Solutions", "SecureIT Services", "Unknown Vendor XYZ"
      ];
      if (finalLevel !== "Low" || Math.random() < 0.4) {
        try {
          const vendorName = finalLevel === "High" ? randomElement(["Unknown Vendor XYZ", "Suspicious Corp"]) : randomElement(vendors);
          await connection.query(
            `INSERT INTO invoice_fraud_metadata (invoice_id, vendor_name, bank_account_hash, source)
             VALUES (?, ?, ?, 'sample_seed')
             ON DUPLICATE KEY UPDATE vendor_name = VALUES(vendor_name)`,
            [
              invoice.invoice_id,
              vendorName,
              finalLevel === "High" ? "a1b2c3d4e5f6_mismatch_hash" : null
            ]
          );
        } catch { /* table may not exist */ }
      }
    }

    await connection.commit();

    console.log("[FRAUD SEED] ✓ Fraud assessments created:");
    console.log(`  Low risk:    ${lowCount} invoices (score 0-30)`);
    console.log(`  Medium risk: ${medCount} invoices (score 31-70)`);
    console.log(`  High risk:   ${highCount} invoices (score 71-100)`);

    // Verify
    const [summary] = await pool.query(
      "SELECT risk_level, COUNT(*) AS cnt, AVG(risk_score) AS avg_score FROM invoice_fraud_assessment GROUP BY risk_level ORDER BY FIELD(risk_level, 'Low','Medium','High')"
    );
    console.log("\n[FRAUD SEED] Database verification:");
    summary.forEach((row) => {
      console.log(`  ${row.risk_level}: ${row.cnt} invoices (avg score: ${Math.round(row.avg_score)})`);
    });

    const [alertCount] = await pool.query("SELECT COUNT(*) AS cnt FROM fraud_alert").catch(() => [[{ cnt: 0 }]]);
    console.log(`  Fraud alerts: ${alertCount[0]?.cnt || 0}`);

    const [indicatorCount] = await pool.query("SELECT COUNT(*) AS cnt FROM invoice_fraud_indicator");
    console.log(`  Risk indicators: ${indicatorCount[0].cnt}`);

    console.log("\n[FRAUD SEED] ✓ Done.");
  } catch (error) {
    await connection.rollback();
    console.error("[FRAUD SEED] Error:", error.message);
    process.exit(1);
  } finally {
    connection.release();
    await pool.end();
  }
}

seed();
