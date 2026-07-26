/**
 * Migration Runner: WhatsApp Templates & Enhancements
 *
 * Adds message_templates table, enhances customer/notification_settings/logs tables.
 * Run: node scripts/migrate-whatsapp-templates.js
 */

const fs = require("fs");
const path = require("path");
const { pool } = require("../src/config/db");

async function runMigration() {
  console.log("[MIGRATION] Starting WhatsApp templates & enhancements migration...");

  const sqlPath = path.join(__dirname, "../src/migrations/20260726_whatsapp_templates_and_enhancements.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");

  // Split by semicolons followed by a newline (handles multi-line statements)
  const statements = sql
    .split(/;\s*(?:\r?\n)/)
    .map((s) => s.trim())
    .filter((s) => {
      if (!s) return false;
      // Remove lines that are only comments
      const nonComment = s.split(/\r?\n/).filter((line) => !line.trim().startsWith("--")).join("\n").trim();
      return nonComment.length > 0;
    });

  let success = 0;
  let skipped = 0;

  for (const statement of statements) {
    try {
      await pool.query(statement);
      success++;
      const preview = statement.replace(/[\r\n]/g, " ").substring(0, 60);
      console.log(`  [OK] ${preview}...`);
    } catch (err) {
      if (err.code === "ER_DUP_COLUMN" || err.code === "ER_TABLE_EXISTS_ERROR" || err.code === "ER_DUP_ENTRY" || err.code === "ER_DUP_KEYNAME") {
        skipped++;
        console.log(`  [SKIP] Already exists: ${err.message.substring(0, 80)}`);
      } else {
        console.error(`  [ERROR] ${err.message.substring(0, 120)}`);
        console.error(`  Statement: ${statement.substring(0, 100)}...`);
      }
    }
  }

  // Run individual ALTER TABLE statements that don't support IF NOT EXISTS
  const alterStatements = [
    "ALTER TABLE customer ADD COLUMN country_code VARCHAR(5) DEFAULT '+65'",
    "ALTER TABLE customer ADD COLUMN preferred_contact_method ENUM('email', 'whatsapp', 'both') DEFAULT 'email'",
    "ALTER TABLE notification_settings ADD COLUMN default_country_code VARCHAR(5) DEFAULT '+65'",
    "ALTER TABLE notification_settings ADD COLUMN send_pdf_attachments BOOLEAN DEFAULT FALSE",
    "ALTER TABLE notification_settings ADD COLUMN auto_send_invoice BOOLEAN DEFAULT FALSE",
    "ALTER TABLE notification_settings ADD COLUMN auto_send_receipt BOOLEAN DEFAULT FALSE",
    "ALTER TABLE notification_settings ADD COLUMN auto_send_subscription BOOLEAN DEFAULT FALSE",
    "ALTER TABLE notification_settings ADD COLUMN overdue_reminder_days JSON DEFAULT NULL",
    "ALTER TABLE whatsapp_notification_logs ADD COLUMN delivery_status ENUM('queued', 'sent', 'delivered', 'read', 'failed', 'undelivered') DEFAULT NULL",
    "ALTER TABLE whatsapp_notification_logs ADD COLUMN delivered_at TIMESTAMP NULL DEFAULT NULL",
    "ALTER TABLE whatsapp_notification_logs ADD COLUMN read_at TIMESTAMP NULL DEFAULT NULL"
  ];

  console.log("\n  Running ALTER TABLE statements...");
  for (const stmt of alterStatements) {
    try {
      await pool.query(stmt);
      success++;
      console.log(`  [OK] ${stmt.substring(0, 70)}...`);
    } catch (err) {
      if (err.code === "ER_DUP_COLUMN" || err.code === "ER_DUP_FIELDNAME") {
        skipped++;
        console.log(`  [SKIP] Column exists`);
      } else {
        console.error(`  [WARN] ${err.message.substring(0, 100)}`);
      }
    }
  }

  // Add indexes (ignore if they already exist)
  const indexStatements = [
    "CREATE INDEX idx_message_id ON whatsapp_notification_logs (message_id)",
    "CREATE INDEX idx_wn_invoice_id ON whatsapp_notification_logs (invoice_id)",
    "CREATE INDEX idx_wn_customer_id ON whatsapp_notification_logs (customer_id)"
  ];

  for (const stmt of indexStatements) {
    try {
      await pool.query(stmt);
      success++;
      console.log(`  [OK] ${stmt.substring(0, 70)}...`);
    } catch (err) {
      if (err.code === "ER_DUP_KEYNAME" || err.message.includes("Duplicate key name")) {
        skipped++;
      } else {
        console.error(`  [WARN] Index: ${err.message.substring(0, 80)}`);
      }
    }
  }

  console.log(`\n[MIGRATION] Complete: ${success} executed, ${skipped} skipped`);
  process.exit(0);
}

runMigration().catch((err) => {
  console.error("[MIGRATION] Fatal error:", err.message);
  process.exit(1);
});
