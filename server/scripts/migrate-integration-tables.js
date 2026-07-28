/**
 * Migration: Integration Tables
 *
 * Creates:
 *   - email_delivery_logs — tracks all outbound email delivery attempts
 *   - webhook_events — idempotency log for Stripe (and future provider) webhooks
 *   - Adds stripe_customer_id column to customer table (if not exists)
 *
 * Run: node scripts/migrate-integration-tables.js
 * Rollback: node scripts/migrate-integration-tables.js --rollback
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { pool } = require("../src/config/db");

const isRollback = process.argv.includes("--rollback");

async function up() {
  const connection = await pool.getConnection();
  try {
    // ─── email_delivery_logs ────────────────────────────────────────────────────
    await connection.query(`
      CREATE TABLE IF NOT EXISTS email_delivery_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NULL,
        invoice_id INT NULL,
        payment_id INT NULL,
        email_type VARCHAR(50) NOT NULL COMMENT 'invoice_email, payment_link, payment_confirmation, payment_failure, reminder, overdue_reminder, test_email',
        recipient VARCHAR(255) NOT NULL,
        subject VARCHAR(500) NULL,
        smtp_message_id VARCHAR(255) NULL,
        status ENUM('pending', 'sent', 'failed') NOT NULL DEFAULT 'pending',
        attempt_count INT NOT NULL DEFAULT 1,
        deduplication_key VARCHAR(255) NULL COMMENT 'Unique key to prevent duplicate sends',
        sent_at DATETIME NULL,
        last_attempted_at DATETIME NULL,
        failure_code VARCHAR(50) NULL,
        failure_message VARCHAR(500) NULL,
        triggered_by VARCHAR(50) NULL COMMENT 'system, user, scheduler, webhook',
        triggered_by_user_id INT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        INDEX idx_edl_customer (customer_id),
        INDEX idx_edl_invoice (invoice_id),
        INDEX idx_edl_payment (payment_id),
        INDEX idx_edl_status (status),
        INDEX idx_edl_email_type (email_type),
        INDEX idx_edl_created (created_at),
        UNIQUE INDEX idx_edl_dedup (deduplication_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("✓ Created table: email_delivery_logs");

    // ─── webhook_events ─────────────────────────────────────────────────────────
    await connection.query(`
      CREATE TABLE IF NOT EXISTS webhook_events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        provider VARCHAR(30) NOT NULL COMMENT 'stripe, whatsapp, etc.',
        external_event_id VARCHAR(255) NOT NULL COMMENT 'Stripe event ID or provider event ID',
        event_type VARCHAR(100) NOT NULL COMMENT 'checkout.session.completed, payment_intent.succeeded, etc.',
        processing_status ENUM('received', 'processed', 'failed', 'skipped') NOT NULL DEFAULT 'received',
        related_payment_id INT NULL,
        related_invoice_id INT NULL,
        payload_summary TEXT NULL COMMENT 'Safe subset of event data (no secrets)',
        error_message VARCHAR(500) NULL,
        received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        processed_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

        UNIQUE INDEX idx_we_provider_event (provider, external_event_id),
        INDEX idx_we_event_type (event_type),
        INDEX idx_we_status (processing_status),
        INDEX idx_we_invoice (related_invoice_id),
        INDEX idx_we_received (received_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("✓ Created table: webhook_events");

    // ─── Add stripe_customer_id to customer table ───────────────────────────────
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer' AND COLUMN_NAME = 'stripe_customer_id'
    `);
    if (columns.length === 0) {
      await connection.query(`
        ALTER TABLE customer ADD COLUMN stripe_customer_id VARCHAR(255) NULL AFTER email,
        ADD INDEX idx_customer_stripe (stripe_customer_id)
      `);
      console.log("✓ Added column: customer.stripe_customer_id");
    } else {
      console.log("· Column customer.stripe_customer_id already exists — skipped");
    }

    // ─── Add currency column to invoice table if missing ────────────────────────
    const [currCols] = await connection.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoice' AND COLUMN_NAME = 'currency'
    `);
    if (currCols.length === 0) {
      await connection.query(`
        ALTER TABLE customer ADD COLUMN preferred_currency VARCHAR(10) NULL DEFAULT 'SGD' AFTER stripe_customer_id
      `);
      console.log("✓ Added column: customer.preferred_currency");
    } else {
      console.log("· Column customer.preferred_currency already exists — skipped");
    }

    console.log("\n✅ Migration complete.");
  } catch (error) {
    console.error("✗ Migration failed:", error.message);
    process.exit(1);
  } finally {
    connection.release();
  }
}

async function down() {
  const connection = await pool.getConnection();
  try {
    await connection.query("DROP TABLE IF EXISTS email_delivery_logs");
    console.log("✓ Dropped table: email_delivery_logs");

    await connection.query("DROP TABLE IF EXISTS webhook_events");
    console.log("✓ Dropped table: webhook_events");

    // Do not drop stripe_customer_id in rollback — may contain production data
    console.log("· Column customer.stripe_customer_id preserved (manual removal if needed)");

    console.log("\n✅ Rollback complete.");
  } catch (error) {
    console.error("✗ Rollback failed:", error.message);
    process.exit(1);
  } finally {
    connection.release();
  }
}

(async () => {
  if (isRollback) {
    await down();
  } else {
    await up();
  }
  process.exit(0);
})();
