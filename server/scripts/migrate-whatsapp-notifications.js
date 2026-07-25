/**
 * WhatsApp Notification Module — Database Migration
 *
 * Creates:
 *   1. notification_settings table — global WhatsApp notification configuration
 *   2. whatsapp_notification_logs table — log of all sent WhatsApp messages
 *   3. Adds whatsapp_number and whatsapp_verified columns to customer table
 *
 * Safe to run multiple times (uses IF NOT EXISTS / IF NOT EXISTS column checks).
 *
 * Usage: node scripts/migrate-whatsapp-notifications.js
 */

const { pool, waitForDatabase } = require("../src/config/db");

async function migrate() {
  console.log("[MIGRATION] WhatsApp Notification Module — starting...");

  await waitForDatabase();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Create notification_settings table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS notification_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        whatsapp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        send_invoice_created BOOLEAN NOT NULL DEFAULT TRUE,
        send_payment_received BOOLEAN NOT NULL DEFAULT TRUE,
        send_payment_reminder BOOLEAN NOT NULL DEFAULT TRUE,
        send_overdue_notice BOOLEAN NOT NULL DEFAULT TRUE,
        send_subscription_invoice BOOLEAN NOT NULL DEFAULT TRUE,
        reminder_days_before JSON DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("[MIGRATION] ✓ notification_settings table ready");

    // Insert default row if empty
    const [settingsRows] = await connection.query("SELECT COUNT(*) AS cnt FROM notification_settings");
    if (settingsRows[0].cnt === 0) {
      await connection.query(`
        INSERT INTO notification_settings
          (whatsapp_enabled, send_invoice_created, send_payment_received, send_payment_reminder, send_overdue_notice, send_subscription_invoice, reminder_days_before)
        VALUES (FALSE, TRUE, TRUE, TRUE, TRUE, TRUE, '[7, 3, 1]')
      `);
      console.log("[MIGRATION] ✓ Default notification settings inserted");
    }

    // 2. Create whatsapp_notification_logs table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_notification_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NULL,
        invoice_id INT NULL,
        notification_type ENUM('invoice_created', 'payment_received', 'payment_reminder', 'overdue_notice', 'subscription_invoice') NOT NULL,
        message TEXT NOT NULL,
        status ENUM('sent', 'failed', 'pending', 'retry') NOT NULL DEFAULT 'pending',
        provider VARCHAR(50) DEFAULT 'meta',
        phone_number VARCHAR(20) NULL,
        message_id VARCHAR(100) NULL,
        sent_at TIMESTAMP NULL,
        error_message TEXT NULL,
        retry_count INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_customer_id (customer_id),
        INDEX idx_invoice_id (invoice_id),
        INDEX idx_notification_type (notification_type),
        INDEX idx_status (status),
        INDEX idx_sent_at (sent_at),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("[MIGRATION] ✓ whatsapp_notification_logs table ready");

    // 3. Add whatsapp_number and whatsapp_verified columns to customer table
    const [customerCols] = await connection.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer' AND COLUMN_NAME = 'whatsapp_number'
    `);

    if (customerCols.length === 0) {
      await connection.query(`
        ALTER TABLE customer
          ADD COLUMN whatsapp_number VARCHAR(20) NULL AFTER address,
          ADD COLUMN whatsapp_verified BOOLEAN NOT NULL DEFAULT FALSE AFTER whatsapp_number
      `);
      console.log("[MIGRATION] ✓ Added whatsapp_number and whatsapp_verified to customer table");
    } else {
      console.log("[MIGRATION] ✓ customer table already has whatsapp columns");
    }

    await connection.commit();
    console.log("[MIGRATION] ✓ WhatsApp Notification Module migration complete!");
  } catch (error) {
    await connection.rollback();
    console.error("[MIGRATION] ✗ Migration failed:", error.message);
    throw error;
  } finally {
    connection.release();
  }

  process.exit(0);
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
