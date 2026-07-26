/**
 * WhatsApp Integration Refactor — Database Migration
 *
 * Creates:
 *   1. whatsapp_config table — encrypted Twilio credentials (Admin-only)
 *   2. whatsapp_messages table — message tracking with full status lifecycle
 *   3. whatsapp_templates table — message templates with placeholders
 *   4. whatsapp_integration_logs table — audit log for config changes
 *
 * Preserves existing customer.whatsapp_number and customer.whatsapp_verified columns.
 * Safe to run multiple times (uses IF NOT EXISTS).
 *
 * Usage: node scripts/migrate-whatsapp-refactor.js
 */

const { pool, waitForDatabase } = require("../src/config/db");

async function migrate() {
  console.log("[MIGRATION] WhatsApp Integration Refactor — starting...");

  await waitForDatabase();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. whatsapp_config — stores encrypted Twilio credentials (Admin-only access)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        account_sid_encrypted TEXT NOT NULL,
        auth_token_encrypted TEXT NOT NULL,
        whatsapp_number VARCHAR(30) NOT NULL,
        webhook_url VARCHAR(500) DEFAULT NULL,
        is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        connection_status ENUM('connected', 'failed', 'untested') NOT NULL DEFAULT 'untested',
        last_tested_at TIMESTAMP NULL DEFAULT NULL,
        account_name VARCHAR(100) DEFAULT NULL,
        encryption_iv VARCHAR(32) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        updated_by INT DEFAULT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("[MIGRATION] ✓ whatsapp_config table ready");

    // 2. whatsapp_messages — full message lifecycle tracking
    await connection.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NOT NULL,
        invoice_id INT DEFAULT NULL,
        message_type ENUM(
          'invoice_sent', 'payment_reminder', 'overdue_notice',
          'payment_confirmation', 'custom'
        ) NOT NULL,
        recipient_phone VARCHAR(20) NOT NULL,
        recipient_name VARCHAR(100) DEFAULT NULL,
        message_body TEXT NOT NULL,
        template_id INT DEFAULT NULL,
        status ENUM('queued', 'sent', 'delivered', 'read', 'failed') NOT NULL DEFAULT 'queued',
        twilio_message_sid VARCHAR(100) DEFAULT NULL,
        error_message TEXT DEFAULT NULL,
        retry_count INT NOT NULL DEFAULT 0,
        sent_at TIMESTAMP NULL DEFAULT NULL,
        delivered_at TIMESTAMP NULL DEFAULT NULL,
        read_at TIMESTAMP NULL DEFAULT NULL,
        failed_at TIMESTAMP NULL DEFAULT NULL,
        sent_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_customer_id (customer_id),
        INDEX idx_invoice_id (invoice_id),
        INDEX idx_status (status),
        INDEX idx_message_type (message_type),
        INDEX idx_twilio_sid (twilio_message_sid),
        INDEX idx_sent_by (sent_by),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("[MIGRATION] ✓ whatsapp_messages table ready");

    // 3. whatsapp_templates — configurable message templates (Admin manages)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        template_name VARCHAR(100) NOT NULL,
        template_type ENUM(
          'invoice_sent', 'payment_reminder', 'overdue_notice',
          'payment_confirmation', 'custom'
        ) NOT NULL,
        message_body TEXT NOT NULL,
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_template_type (template_type),
        INDEX idx_is_active (is_active),
        INDEX idx_is_default (is_default)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("[MIGRATION] ✓ whatsapp_templates table ready");

    // 4. whatsapp_integration_logs — audit log for all config/integration changes
    await connection.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_integration_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        action VARCHAR(100) NOT NULL,
        details JSON DEFAULT NULL,
        performed_by INT DEFAULT NULL,
        ip_address VARCHAR(45) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_action (action),
        INDEX idx_performed_by (performed_by),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("[MIGRATION] ✓ whatsapp_integration_logs table ready");

    // 5. Insert default message templates
    const [existingTemplates] = await connection.query(
      "SELECT COUNT(*) AS cnt FROM whatsapp_templates"
    );
    if (existingTemplates[0].cnt === 0) {
      await connection.query(`
        INSERT INTO whatsapp_templates (template_name, template_type, message_body, is_default) VALUES
        ('Invoice Sent', 'invoice_sent',
         'Hello {{customer_name}},\\n\\nYour invoice *{{invoice_number}}* for {{currency}}{{invoice_amount}} is ready.\\n\\nDue Date: {{due_date}}\\n\\n{{payment_link}}\\n\\nThank you.\\n— {{company_name}}',
         TRUE),
        ('Payment Reminder', 'payment_reminder',
         'Payment Reminder\\n\\nHi {{customer_name}}, invoice *{{invoice_number}}* for {{currency}}{{invoice_amount}} is due on {{due_date}}.\\n\\n{{payment_link}}\\n\\nPlease complete payment before the due date.\\n— {{company_name}}',
         TRUE),
        ('Overdue Notice', 'overdue_notice',
         'OVERDUE NOTICE\\n\\nHi {{customer_name}}, invoice *{{invoice_number}}* for {{currency}}{{invoice_amount}} is overdue.\\n\\n{{payment_link}}\\n\\nPlease complete payment immediately to avoid further action.\\n— {{company_name}}',
         TRUE),
        ('Payment Confirmation', 'payment_confirmation',
         'Payment Confirmed\\n\\nHi {{customer_name}}, we have received your payment of {{currency}}{{invoice_amount}} for invoice *{{invoice_number}}*.\\n\\nThank you for your prompt payment.\\n— {{company_name}}',
         TRUE)
      `);
      console.log("[MIGRATION] ✓ Default WhatsApp templates inserted");
    }

    // 6. Notification rules table for default auto-send behaviour
    await connection.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_notification_rules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        rule_type ENUM(
          'invoice_sent', 'payment_reminder', 'overdue_notice',
          'payment_confirmation'
        ) NOT NULL,
        is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        reminder_days_before JSON DEFAULT NULL,
        overdue_reminder_days JSON DEFAULT NULL,
        send_pdf_attachment BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_rule_type (rule_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const [existingRules] = await connection.query(
      "SELECT COUNT(*) AS cnt FROM whatsapp_notification_rules"
    );
    if (existingRules[0].cnt === 0) {
      await connection.query(`
        INSERT INTO whatsapp_notification_rules (rule_type, is_enabled, reminder_days_before, overdue_reminder_days, send_pdf_attachment) VALUES
        ('invoice_sent', FALSE, NULL, NULL, FALSE),
        ('payment_reminder', FALSE, '[7, 3, 1]', NULL, FALSE),
        ('overdue_notice', FALSE, NULL, '[1, 3, 7]', FALSE),
        ('payment_confirmation', FALSE, NULL, NULL, FALSE)
      `);
      console.log("[MIGRATION] ✓ Default notification rules inserted");
    }
    console.log("[MIGRATION] ✓ whatsapp_notification_rules table ready");

    // Ensure customer table has whatsapp columns (idempotent)
    const [customerCols] = await connection.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer' AND COLUMN_NAME = 'whatsapp_number'
    `);
    if (customerCols.length === 0) {
      await connection.query(`
        ALTER TABLE customer
          ADD COLUMN whatsapp_number VARCHAR(20) NULL,
          ADD COLUMN whatsapp_verified BOOLEAN NOT NULL DEFAULT FALSE
      `);
      console.log("[MIGRATION] ✓ Added whatsapp columns to customer table");
    }

    await connection.commit();
    console.log("[MIGRATION] ✓ WhatsApp Integration Refactor migration complete!");
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
