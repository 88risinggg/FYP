/**
 * Migration Script: Complete Invoice Workflow
 * 
 * Adds attributes for the fully automated invoice workflow.
 * The project uses the agreed fixed table set; workflow state is stored on
 * existing invoice, customer, payment and audit tables rather than creating
 * auxiliary tables.
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
    // 1. Update invoice status ENUM
    console.log("[1/4] Updating invoice status ENUM...");
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

    // 2. Add invoice columns for Vaniday and fraud
    console.log("[2/4] Adding invoice columns...");
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
    // A unique source-order key makes duplicate prevention durable across
    // concurrent imports.  Existing installations with historical duplicates
    // retain the non-unique lookup index and report the migration issue.
    try {
      await connection.query("ALTER TABLE invoice ADD UNIQUE INDEX uq_invoice_vaniday_order (vaniday_order_id)");
      console.log("  ✓ Added unique source-order protection");
    } catch (e) {
      if (e.code === "ER_DUP_KEYNAME") console.log("  · Unique source-order protection already exists");
      else if (e.code === "ER_DUP_ENTRY") console.log("  · Could not add unique source-order protection: historical duplicate OrderIDs exist");
      else console.log(`  ✕ Unique source-order protection: ${e.message}`);
    }
    await addIndexSafe(connection, "invoice", "idx_invoice_vaniday_order", "vaniday_order_id");
    console.log("");

    // 3. Add audit_logs columns
    console.log("[3/4] Adding audit_logs columns...");
    await addColumnSafe(connection, "audit_logs", "previous_value", "TEXT NULL");
    await addColumnSafe(connection, "audit_logs", "new_value", "TEXT NULL");
    await addColumnSafe(connection, "audit_logs", "ip_address", "VARCHAR(100) NULL");
    await addColumnSafe(connection, "audit_logs", "device_info", "VARCHAR(255) NULL");
    console.log("");

    // 4. Add customer phone column
    console.log("[4/4] Adding customer phone column...");
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
