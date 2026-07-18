/**
 * Create fraud detection tables in the database.
 * Usage: node scripts/createFraudTables.js
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "server", ".env") });
const mysql = require("mysql2/promise");

async function run() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined
  });

  const tables = [
    {
      name: "invoice_fraud_metadata",
      sql: `CREATE TABLE IF NOT EXISTS invoice_fraud_metadata (
        id INT AUTO_INCREMENT PRIMARY KEY,
        invoice_id INT NOT NULL UNIQUE,
        vendor_name VARCHAR(255),
        bank_account_hash VARCHAR(64),
        source VARCHAR(50) DEFAULT 'invoice',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (invoice_id) REFERENCES invoice(invoice_id) ON DELETE CASCADE
      )`
    },
    {
      name: "invoice_fraud_assessment",
      sql: `CREATE TABLE IF NOT EXISTS invoice_fraud_assessment (
        assessment_id INT AUTO_INCREMENT PRIMARY KEY,
        invoice_id INT NOT NULL UNIQUE,
        risk_score INT DEFAULT 0,
        risk_level ENUM('High','Medium','Low') DEFAULT 'Low',
        review_status ENUM('Open','Approved','Rejected') DEFAULT 'Open',
        model_version VARCHAR(50) DEFAULT 'rules-v1',
        assessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (invoice_id) REFERENCES invoice(invoice_id) ON DELETE CASCADE
      )`
    },
    {
      name: "invoice_fraud_indicator",
      sql: `CREATE TABLE IF NOT EXISTS invoice_fraud_indicator (
        indicator_id INT AUTO_INCREMENT PRIMARY KEY,
        assessment_id INT NOT NULL,
        indicator_code VARCHAR(100) NOT NULL,
        indicator_label VARCHAR(255),
        severity INT DEFAULT 0,
        details_json JSON,
        FOREIGN KEY (assessment_id) REFERENCES invoice_fraud_assessment(assessment_id) ON DELETE CASCADE
      )`
    },
    {
      name: "fraud_vendor_profile",
      sql: `CREATE TABLE IF NOT EXISTS fraud_vendor_profile (
        id INT AUTO_INCREMENT PRIMARY KEY,
        vendor_name VARCHAR(255) NOT NULL UNIQUE,
        verified_bank_account_hash VARCHAR(64),
        is_approved TINYINT(1) DEFAULT 1,
        is_blacklisted TINYINT(1) DEFAULT 0,
        country VARCHAR(100) DEFAULT 'Singapore',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    },
    {
      name: "fraud_alert",
      sql: `CREATE TABLE IF NOT EXISTS fraud_alert (
        id INT AUTO_INCREMENT PRIMARY KEY,
        assessment_id INT,
        invoice_id INT NOT NULL,
        alert_type VARCHAR(100),
        message TEXT,
        status ENUM('Open','Acknowledged','Resolved') DEFAULT 'Open',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (invoice_id) REFERENCES invoice(invoice_id) ON DELETE CASCADE
      )`
    },
    {
      name: "invoice_approval",
      sql: `CREATE TABLE IF NOT EXISTS invoice_approval (
        id INT AUTO_INCREMENT PRIMARY KEY,
        invoice_id INT NOT NULL,
        user_user_id INT,
        decision ENUM('Approved','Rejected') NOT NULL,
        notes TEXT,
        risk_score_at_decision INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (invoice_id) REFERENCES invoice(invoice_id) ON DELETE CASCADE
      )`
    },
    {
      name: "employee_authorization_limit",
      sql: `CREATE TABLE IF NOT EXISTS employee_authorization_limit (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_user_id INT NOT NULL UNIQUE,
        approval_limit DECIMAL(12,2) DEFAULT 5000.00
      )`
    }
  ];

  console.log("Creating fraud detection tables...\n");

  for (const table of tables) {
    try {
      await pool.query(table.sql);
      console.log("  ✓ " + table.name);
    } catch (err) {
      console.error("  ✗ " + table.name + ": " + err.message);
    }
  }

  // Now run fraud assessment on all existing invoices
  console.log("\nRunning fraud assessment on existing invoices...");
  const [invoices] = await pool.query("SELECT invoice_id FROM invoice");
  console.log("  Found " + invoices.length + " invoices");

  let assessed = 0;
  for (const inv of invoices) {
    try {
      const { assessInvoiceRisk } = require("../server/src/services/fraudDetectionService");
      const conn = await pool.getConnection();
      await conn.beginTransaction();
      await assessInvoiceRisk(conn, inv.invoice_id, {});
      await conn.commit();
      conn.release();
      assessed++;
    } catch (err) {
      // Skip errors for individual invoices
    }
  }

  console.log("  Assessed: " + assessed + "/" + invoices.length + " invoices");
  console.log("\n✅ Done!");
  await pool.end();
}

run().catch(err => { console.error("Error:", err.message); process.exit(1); });
