require("dotenv").config();
const { pool } = require("../src/config/db");

async function main() {
  try {
    const [rows] = await pool.query(
      `SELECT risk_level, COUNT(*) AS count, ROUND(AVG(risk_score), 1) AS average_score
         FROM invoice WHERE invoiceId LIKE 'FDT-%' GROUP BY risk_level ORDER BY FIELD(risk_level, 'Low', 'Medium', 'High')`
    );
    const summary = Object.fromEntries(rows.map((row) => [row.risk_level, Number(row.count)]));
    console.table(rows);
    if ((summary.Low || 0) < 20 || (summary.Medium || 0) < 15 || (summary.High || 0) < 15) {
      throw new Error(`Expected at least 20 Low, 15 Medium, and 15 High invoices; received ${JSON.stringify(summary)}`);
    }
    const [reasons] = await pool.query(
      `SELECT invoiceId, risk_score, risk_level, fraud_indicators_json
         FROM invoice WHERE invoiceId LIKE 'FDT-HIGH-%' ORDER BY invoiceId LIMIT 3`
    );
    console.log("High-risk detection samples:");
    reasons.forEach((row) => {
      const indicators = typeof row.fraud_indicators_json === "string"
        ? JSON.parse(row.fraud_indicators_json)
        : row.fraud_indicators_json;
      const codes = Array.isArray(indicators) ? indicators.map((indicator) => indicator.code).join(", ") : "";
      console.log(`${row.invoiceId}: ${row.risk_score} ${row.risk_level} — ${codes}`);
    });
  } finally {
    await pool.end();
  }
}

main().catch((error) => { console.error("Fraud dataset verification failed:", error.message); process.exitCode = 1; });
