/**
 * Run Vaniday Import & Template Enhancement Migrations
 *
 * Adds:
 * 1. Enhanced invoice_settings columns (template config)
 * 2. Vaniday-specific columns on invoice table
 * 3. Customer enhancements (phone, vaniday_customer_id)
 * 4. Audit log enhancements (previous_value, new_value, ip_address)
 * 5. Updated invoice status ENUM
 *
 * Safe to run multiple times — skips columns that already exist.
 *
 * Usage: node scripts/run-vaniday-migration.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mysql = require("mysql2/promise");

async function runMigration() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined
  });

  const connection = await pool.getConnection();
  let successCount = 0;
  let skipCount = 0;

  async function run(name, sql) {
    try {
      await connection.query(sql);
      console.log(`  ✓ ${name}`);
      successCount++;
    } catch (err) {
      if (err.code === "ER_DUP_FIELDNAME" || err.code === "ER_TABLE_EXISTS_ERROR"
        || err.code === "ER_DUP_KEYNAME" || err.message.includes("Duplicate")) {
        console.log(`  · (exists) ${name}`);
        skipCount++;
      } else {
        console.log(`  ✗ ${name}: ${err.message}`);
      }
    }
  }

  try {
    console.log("\n═══ Invoice Settings — Template Attributes ═══");
    await run("template_name", "ALTER TABLE invoice_settings ADD COLUMN template_name VARCHAR(100) NOT NULL DEFAULT 'Default Template'");
    await run("template_description", "ALTER TABLE invoice_settings ADD COLUMN template_description TEXT NULL");
    await run("uen_number", "ALTER TABLE invoice_settings ADD COLUMN uen_number VARCHAR(50) NOT NULL DEFAULT ''");
    await run("gst_registration_number", "ALTER TABLE invoice_settings ADD COLUMN gst_registration_number VARCHAR(50) NOT NULL DEFAULT ''");
    await run("company_phone", "ALTER TABLE invoice_settings ADD COLUMN company_phone VARCHAR(50) NOT NULL DEFAULT ''");
    await run("company_email", "ALTER TABLE invoice_settings ADD COLUMN company_email VARCHAR(255) NOT NULL DEFAULT ''");
    await run("company_website", "ALTER TABLE invoice_settings ADD COLUMN company_website VARCHAR(255) NOT NULL DEFAULT ''");

    console.log("\n═══ Invoice Settings — Theme & Styling ═══");
    await run("primary_color", "ALTER TABLE invoice_settings ADD COLUMN primary_color VARCHAR(20) NOT NULL DEFAULT '#061e4b'");
    await run("secondary_color", "ALTER TABLE invoice_settings ADD COLUMN secondary_color VARCHAR(20) NOT NULL DEFAULT '#ff5a52'");
    await run("font_family", "ALTER TABLE invoice_settings ADD COLUMN font_family VARCHAR(100) NOT NULL DEFAULT 'Arial, Helvetica, sans-serif'");
    await run("font_size_base", "ALTER TABLE invoice_settings ADD COLUMN font_size_base INT NOT NULL DEFAULT 12");
    await run("invoice_border_style", "ALTER TABLE invoice_settings ADD COLUMN invoice_border_style VARCHAR(30) NOT NULL DEFAULT 'modern'");
    await run("header_style", "ALTER TABLE invoice_settings ADD COLUMN header_style VARCHAR(30) NOT NULL DEFAULT 'default'");
    await run("footer_style", "ALTER TABLE invoice_settings ADD COLUMN footer_style VARCHAR(30) NOT NULL DEFAULT 'default'");
    await run("item_table_style", "ALTER TABLE invoice_settings ADD COLUMN item_table_style VARCHAR(30) NOT NULL DEFAULT 'striped'");

    console.log("\n═══ Invoice Settings — Currency & Formatting ═══");
    await run("currency_symbol", "ALTER TABLE invoice_settings ADD COLUMN currency_symbol VARCHAR(10) NOT NULL DEFAULT 'S$'");
    await run("currency_format", "ALTER TABLE invoice_settings ADD COLUMN currency_format VARCHAR(30) NOT NULL DEFAULT 'symbol_before'");
    await run("display_date_format", "ALTER TABLE invoice_settings ADD COLUMN display_date_format VARCHAR(30) NOT NULL DEFAULT 'DD MMM YYYY'");
    await run("display_time_format", "ALTER TABLE invoice_settings ADD COLUMN display_time_format VARCHAR(20) NOT NULL DEFAULT 'HH:mm'");
    await run("decimal_precision", "ALTER TABLE invoice_settings ADD COLUMN decimal_precision INT NOT NULL DEFAULT 2");

    console.log("\n═══ Invoice Settings — Number Config ═══");
    await run("running_number", "ALTER TABLE invoice_settings ADD COLUMN running_number INT NOT NULL DEFAULT 1");
    await run("reset_number_yearly", "ALTER TABLE invoice_settings ADD COLUMN reset_number_yearly TINYINT(1) NOT NULL DEFAULT 1");
    await run("invoice_date_source", "ALTER TABLE invoice_settings ADD COLUMN invoice_date_source VARCHAR(30) NOT NULL DEFAULT 'issue_date'");

    console.log("\n═══ Invoice Settings — Tax ═══");
    await run("tax_enabled", "ALTER TABLE invoice_settings ADD COLUMN tax_enabled TINYINT(1) NOT NULL DEFAULT 1");
    await run("tax_name", "ALTER TABLE invoice_settings ADD COLUMN tax_name VARCHAR(30) NOT NULL DEFAULT 'GST'");
    await run("tax_percentage", "ALTER TABLE invoice_settings ADD COLUMN tax_percentage DECIMAL(8,2) NOT NULL DEFAULT 9.00");
    await run("tax_inclusive", "ALTER TABLE invoice_settings ADD COLUMN tax_inclusive TINYINT(1) NOT NULL DEFAULT 0");

    console.log("\n═══ Invoice Settings — Defaults ═══");
    await run("default_discount", "ALTER TABLE invoice_settings ADD COLUMN default_discount DECIMAL(8,2) NOT NULL DEFAULT 0.00");
    await run("default_notes", "ALTER TABLE invoice_settings ADD COLUMN default_notes TEXT NULL");
    await run("terms_and_conditions", "ALTER TABLE invoice_settings ADD COLUMN terms_and_conditions TEXT NULL");

    console.log("\n═══ Invoice Settings — Display Toggles ═══");
    await run("qr_code_display", "ALTER TABLE invoice_settings ADD COLUMN qr_code_display TINYINT(1) NOT NULL DEFAULT 1");
    await run("bank_details_display", "ALTER TABLE invoice_settings ADD COLUMN bank_details_display TINYINT(1) NOT NULL DEFAULT 1");
    await run("paynow_display", "ALTER TABLE invoice_settings ADD COLUMN paynow_display TINYINT(1) NOT NULL DEFAULT 1");
    await run("signature_display", "ALTER TABLE invoice_settings ADD COLUMN signature_display TINYINT(1) NOT NULL DEFAULT 0");
    await run("watermark_enabled", "ALTER TABLE invoice_settings ADD COLUMN watermark_enabled TINYINT(1) NOT NULL DEFAULT 1");
    await run("status_badge_style", "ALTER TABLE invoice_settings ADD COLUMN status_badge_style VARCHAR(30) NOT NULL DEFAULT 'ribbon'");
    await run("company_stamp_url", "ALTER TABLE invoice_settings ADD COLUMN company_stamp_url VARCHAR(500) NULL");
    await run("signature_url", "ALTER TABLE invoice_settings ADD COLUMN signature_url VARCHAR(500) NULL");

    console.log("\n═══ Invoice Settings — PDF & Vaniday ═══");
    await run("pdf_orientation", "ALTER TABLE invoice_settings ADD COLUMN pdf_orientation VARCHAR(12) NOT NULL DEFAULT 'portrait'");
    await run("vaniday_field_mapping", "ALTER TABLE invoice_settings ADD COLUMN vaniday_field_mapping JSON NULL");

    console.log("\n═══ Invoice Table — Vaniday Columns ═══");
    await run("vaniday_order_id", "ALTER TABLE invoice ADD COLUMN vaniday_order_id VARCHAR(100) NULL");
    await run("shop_title", "ALTER TABLE invoice ADD COLUMN shop_title VARCHAR(255) NULL");
    await run("seller_id", "ALTER TABLE invoice ADD COLUMN seller_id VARCHAR(100) NULL");
    await run("service_provider", "ALTER TABLE invoice ADD COLUMN service_provider VARCHAR(255) NULL");
    await run("vaniday_share", "ALTER TABLE invoice ADD COLUMN vaniday_share DECIMAL(10,2) NULL");
    await run("salon_share", "ALTER TABLE invoice ADD COLUMN salon_share DECIMAL(10,2) NULL");
    await run("vaniday_commission", "ALTER TABLE invoice ADD COLUMN vaniday_commission DECIMAL(8,2) NULL");
    await run("items_json", "ALTER TABLE invoice ADD COLUMN items_json JSON NULL");
    await run("idx_vaniday_order", "CREATE INDEX idx_invoice_vaniday_order ON invoice (vaniday_order_id)");

    console.log("\n═══ Customer Table — Enhancements ═══");
    await run("phone", "ALTER TABLE customer ADD COLUMN phone VARCHAR(50) NULL");
    await run("vaniday_customer_id", "ALTER TABLE customer ADD COLUMN vaniday_customer_id VARCHAR(100) NULL");
    await run("data_source", "ALTER TABLE customer ADD COLUMN data_source VARCHAR(50) NULL DEFAULT 'manual'");
    await run("idx_customer_email", "CREATE INDEX idx_customer_email ON customer (email)");

    console.log("\n═══ Audit Logs — Enhanced Tracking ═══");
    await run("previous_value", "ALTER TABLE audit_logs ADD COLUMN previous_value TEXT NULL");
    await run("new_value", "ALTER TABLE audit_logs ADD COLUMN new_value TEXT NULL");
    await run("ip_address", "ALTER TABLE audit_logs ADD COLUMN ip_address VARCHAR(45) NULL");
    await run("device_info", "ALTER TABLE audit_logs ADD COLUMN device_info VARCHAR(512) NULL");

    console.log("\n═══ Invoice Status ENUM Update ═══");
    try {
      await connection.query(`
        ALTER TABLE invoice MODIFY COLUMN status
        ENUM('Draft', 'Generated', 'Scheduled', 'Sent', 'Viewed', 'Unpaid', 'Partially_Paid', 'Paid', 'Overdue', 'Cancelled', 'Void', 'Refunded', 'Failed_Payment')
        DEFAULT 'Draft'
      `);
      console.log("  ✓ Invoice status ENUM updated");
      successCount++;
    } catch (err) {
      console.log(`  · Status ENUM: ${err.message}`);
    }

    console.log(`\n══════════════════════════════════════`);
    console.log(`  Migration complete: ${successCount} applied, ${skipCount} skipped`);
    console.log(`══════════════════════════════════════\n`);
  } finally {
    connection.release();
    await pool.end();
  }
}

runMigration().catch(err => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
