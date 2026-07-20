/**
 * Migration Script: Complete Invoice Workflow
 * 
 * Adds missing tables/columns for the fully automated invoice workflow:
 * - invoice_view_log (customer view tracking)
 * - manual_payment_submission (customer payment proof upload)
 * - invoice_reminder_log (reminder deduplication)
 * - Additional invoice columns (vaniday, fraud, items_json)
 * - Enhanced audit_logs columns
 *
 * Usage: node scripts/migrate-complete-workflow.js
 */

require("dotenv").config();
const { pool } = require("../src/config/db");

async function addColumnSafe(connection, table, column, definition) {
  try {
    await connection.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`  ✓ Added ${table}.${column}`);
  } catch (e) {
    if (e.code === "ER_DUP_FIELDNAME") {
      console.log(`  · ${table}.${column} already exists`);
    } else {
      console.log(`  ✗ ${table}.${column}: ${e.message}`);
    }
  }
}

async function addIndexSafe(connection, table, indexName, columns) {
  try {
    await connection.query(`ALTER TABLE ${table} ADD INDEX ${indexName} (${columns})`);
    console.log(`  ✓ Added index ${indexName} on ${table}`);
  } catch (e) {
    if (e.code === "ER_DUP_KEYNAME") {
      console.log(`  · Index ${indexName} already exists`);
    } else {
      console.log(`  ✗ Index ${indexName}: ${e.message}`);
    }
  }
}

async function run() {
  const connection = await pool.getConnection();
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║  Complete Invoice Workflow Migration         ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  try {
    // 1. Invoice View Tracking Table
    console.log("[1/7] Creating invoice_view_log table...");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS invoice_view_log (
        view_id INT AUTO_INCREMENT PRIMARY KEY,
        invoice_id INT NOT NULL,
        view_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(100) NULL,
        user_agent TEXT NULL,
        device_info VARCHAR(255) NULL,
        INDEX idx_invoice_view_invoice (invoice_id),
        INDEX idx_invoice_view_date (view_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log("  ✓ invoice_view_log created\n");

    // 2. Manual Payment Submissions Table
    console.log("[2/7] Creating manual_payment_submission table...");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS manual_payment_submission (
        submission_id INT AUTO_INCREMENT PRIMARY KEY,
        invoice_id INT NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        payment_date DATE NOT NULL,
        reference_number VARCHAR(255) NULL,
        payment_method VARCHAR(100) NOT NULL DEFAULT 'Bank Transfer',
        proof_file_url VARCHAR(500) NULL,
        proof_file_name VARCHAR(255) NULL,
        customer_notes TEXT NULL,
        status ENUM('Pending Review', 'Approved', 'Rejected') NOT NULL DEFAULT 'Pending Review',
        reviewed_by INT NULL,
        reviewed_at DATETIME NULL,
        review_notes TEXT NULL,
        submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_mps_invoice (invoice_id),
        INDEX idx_mps_status (status),
        INDEX idx_mps_submitted (submitted_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log("  ✓ manual_payment_submission created\n");

    // 3. Invoice Reminder Log
    console.log("[3/7] Creating invoice_reminder_log table...");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS invoice_reminder_log (
        log_id INT AUTO_INCREMENT PRIMARY KEY,
        invoice_id INT NOT NULL,
        reminder_type VARCHAR(50) NOT NULL,
        delivery_status VARCHAR(20) NOT NULL DEFAULT 'Sent',
        customer_email VARCHAR(255) NULL,
        sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        error_message TEXT NULL,
        INDEX idx_irl_invoice (invoice_id),
        INDEX idx_irl_type (reminder_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log("  ✓ invoice_reminder_log created\n");

    // 4. Update invoice status ENUM
    console.log("[4/7] Updating invoice status ENUM...");
    try {
      await connection.query(`
        ALTER TABLE invoice MODIFY COLUMN status
        ENUM('Draft', 'Scheduled', 'Sent', 'Viewed', 'Paid', 'Overdue', 'Cancelled', 'Refunded', 'Failed_Payment', 'Pending Review')
        DEFAULT 'Draft'
      `);
      console.log("  ✓ Status ENUM updated with 'Pending Review'\n");
    } catch (e) {
      console.log(`  · Status ENUM: ${e.message}\n`);
    }

    // 5. Add invoice columns for Vaniday and fraud
    console.log("[5/7] Adding invoice columns...");
    await addColumnSafe(connection, "invoice", "vaniday_order_id", "VARCHAR(100) NULL");
    await addColumnSafe(connection, "invoice", "shop_title", "VARCHAR(255) NULL");
    await addColumnSafe(connection, "invoice", "seller_id", "VARCHAR(100) NULL");
    await addColumnSafe(connection, "invoice", "service_provider", "VARCHAR(255) NULL");
    await addColumnSafe(connection, "invoice", "vaniday_share", "DECIMAL(12,2) NULL");
    await addColumnSafe(connection, "invoice", "salon_share", "DECIMAL(12,2) NULL");
    await addColumnSafe(connection, "invoice", "vaniday_commission", "DECIMAL(12,2) NULL");
    await addColumnSafe(connection, "invoice", "items_json", "JSON NULL");
    await addColumnSafe(connection, "invoice", "risk_score", "INT NULL DEFAULT NULL");
    await addColumnSafe(connection, "invoice", "risk_level", "VARCHAR(20) NULL DEFAULT NULL");
    await addColumnSafe(connection, "invoice", "review_status", "VARCHAR(30) NULL DEFAULT NULL");
    await addColumnSafe(connection, "invoice", "fraud_indicators_json", "JSON NULL");
    await addColumnSafe(connection, "invoice", "vendor_name", "VARCHAR(255) NULL");
    await addColumnSafe(connection, "invoice", "assessed_at", "DATETIME NULL");
    await addIndexSafe(connection, "invoice", "idx_invoice_vaniday_order", "vaniday_order_id");
    console.log("");

    // 6. Add audit_logs columns
    console.log("[6/7] Adding audit_logs columns...");
    await addColumnSafe(connection, "audit_logs", "previous_value", "TEXT NULL");
    await addColumnSafe(connection, "audit_logs", "new_value", "TEXT NULL");
    await addColumnSafe(connection, "audit_logs", "ip_address", "VARCHAR(100) NULL");
    await addColumnSafe(connection, "audit_logs", "device_info", "VARCHAR(255) NULL");
    console.log("");

    // 7. Add customer phone column
    console.log("[7/7] Adding customer phone column...");
    await addColumnSafe(connection, "customer", "phone", "VARCHAR(50) NULL");
    console.log("");

    console.log("╔══════════════════════════════════════════════╗");
    console.log("║  ✓ Migration Complete!                       ║");
    console.log("╚══════════════════════════════════════════════╝");
  } catch (error) {
    console.error("\n[ERROR]", error.message);
    process.exit(1);
  } finally {
    connection.release();
    await pool.end();
  }
}

run();
