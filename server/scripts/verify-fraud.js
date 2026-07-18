require("dotenv").config();
const { pool } = require("../src/config/db");

async function verify() {
  console.log("\n=== Fraud Detection Verification ===\n");

  // Risk distribution
  const [summary] = await pool.query(
    "SELECT risk_level, COUNT(*) AS cnt, ROUND(AVG(risk_score)) AS avg_score FROM invoice_fraud_assessment GROUP BY risk_level ORDER BY FIELD(risk_level, 'Low','Medium','High')"
  );
  console.log("Risk Level Distribution:");
  summary.forEach((r) => console.log(`  ${r.risk_level}: ${r.cnt} invoices (avg score: ${r.avg_score})`));

  // Review statuses
  const [reviews] = await pool.query(
    "SELECT review_status, COUNT(*) AS cnt FROM invoice_fraud_assessment GROUP BY review_status"
  );
  console.log("\nReview Status:");
  reviews.forEach((r) => console.log(`  ${r.review_status}: ${r.cnt}`));

  // High risk details
  const [highRisk] = await pool.query(`
    SELECT ifa.invoice_id, i.invoiceId, ifa.risk_score, ifa.review_status,
           GROUP_CONCAT(ifi.indicator_code SEPARATOR ', ') AS indicators
    FROM invoice_fraud_assessment ifa
    INNER JOIN invoice i ON i.invoice_id = ifa.invoice_id
    LEFT JOIN invoice_fraud_indicator ifi ON ifi.assessment_id = ifa.assessment_id
    WHERE ifa.risk_level = 'High'
    GROUP BY ifa.assessment_id
    ORDER BY ifa.risk_score DESC
  `);
  console.log("\nHigh Risk Invoices:");
  highRisk.forEach((r) => {
    console.log(`  ${r.invoiceId} | Score: ${r.risk_score} | Status: ${r.review_status}`);
    console.log(`    Indicators: ${r.indicators}`);
  });

  // Medium risk details
  const [medRisk] = await pool.query(`
    SELECT ifa.invoice_id, i.invoiceId, ifa.risk_score, ifa.review_status,
           GROUP_CONCAT(ifi.indicator_code SEPARATOR ', ') AS indicators
    FROM invoice_fraud_assessment ifa
    INNER JOIN invoice i ON i.invoice_id = ifa.invoice_id
    LEFT JOIN invoice_fraud_indicator ifi ON ifi.assessment_id = ifa.assessment_id
    WHERE ifa.risk_level = 'Medium'
    GROUP BY ifa.assessment_id
    ORDER BY ifa.risk_score DESC
  `);
  console.log("\nMedium Risk Invoices:");
  medRisk.forEach((r) => {
    console.log(`  ${r.invoiceId} | Score: ${r.risk_score} | Status: ${r.review_status}`);
    console.log(`    Indicators: ${r.indicators}`);
  });

  // Total indicators
  const [indCount] = await pool.query("SELECT COUNT(*) AS cnt FROM invoice_fraud_indicator");
  console.log(`\nTotal risk indicators: ${indCount[0].cnt}`);

  // Alerts
  try {
    const [alerts] = await pool.query("SELECT alert_type, status, COUNT(*) AS cnt FROM fraud_alert GROUP BY alert_type, status");
    console.log("\nFraud Alerts:");
    alerts.forEach((r) => console.log(`  ${r.alert_type} [${r.status}]: ${r.cnt}`));
  } catch { console.log("\n(fraud_alert table not available)"); }

  await pool.end();
}

verify().catch((e) => { console.error(e.message); process.exit(1); });
