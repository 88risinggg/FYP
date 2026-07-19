require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { pool } = require("../src/config/db");

async function setup() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS invoice_fraud_assessment (
      assessment_id INT AUTO_INCREMENT PRIMARY KEY,
      invoice_id INT NULL,
      risk_score INT DEFAULT 0,
      risk_level ENUM('Low','Medium','High') DEFAULT 'Low',
      review_status VARCHAR(50) DEFAULT 'Open',
      model_version VARCHAR(50) DEFAULT 'rules-v1',
      assessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_invoice_id (invoice_id),
      INDEX idx_risk_level (risk_level),
      INDEX idx_review_status (review_status)
    )`,
    `CREATE TABLE IF NOT EXISTS invoice_fraud_indicator (
      indicator_id INT AUTO_INCREMENT PRIMARY KEY,
      assessment_id INT NOT NULL,
      indicator_code VARCHAR(100) NOT NULL,
      indicator_label VARCHAR(500) NULL,
      severity INT DEFAULT 0,
      details_json TEXT NULL,
      INDEX idx_assessment_id (assessment_id)
    )`,
    `CREATE TABLE IF NOT EXISTS fraud_alert (
      alert_id INT AUTO_INCREMENT PRIMARY KEY,
      assessment_id INT NULL,
      invoice_id INT NULL,
      alert_type VARCHAR(100) NOT NULL,
      message TEXT NULL,
      status VARCHAR(50) DEFAULT 'Open',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_invoice_id (invoice_id)
    )`,
    `CREATE TABLE IF NOT EXISTS invoice_fraud_metadata (
      metadata_id INT AUTO_INCREMENT PRIMARY KEY,
      invoice_id INT NOT NULL,
      vendor_name VARCHAR(255) NULL,
      bank_account_hash VARCHAR(255) NULL,
      source VARCHAR(100) NULL,
      UNIQUE INDEX idx_invoice_id (invoice_id)
    )`
  ];

  for (const sql of tables) {
    try {
      await pool.query(sql);
      const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)[1];
      console.log(`+ ${tableName}`);
    } catch (e) {
      console.log(`! ${e.message}`);
    }
  }

  await pool.end();
  console.log("\nFraud tables ready.");
}

setup();
