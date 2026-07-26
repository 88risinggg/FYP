/**
 * Create finance_reminders table and generate initial reminders.
 * Usage: node scripts/create-finance-reminders-table.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { pool } = require("../src/config/db");
const { generateInvoiceReminders } = require("../src/models/financeReminderModel");

async function run() {
  const createSQL = `
    CREATE TABLE IF NOT EXISTS finance_reminders (
      reminder_id       INT              NOT NULL AUTO_INCREMENT,
      reminder_type     ENUM(
        'invoice_due_7_days',
        'invoice_due_today',
        'invoice_overdue',
        'payment_failed',
        'payment_succeeded',
        'subscription_renewal_due',
        'invoice_generation_failed',
        'bulk_upload_validation_error'
      ) NOT NULL,
      priority          ENUM('Low','Medium','High') NOT NULL DEFAULT 'Medium',
      title             VARCHAR(255)     NOT NULL,
      message           TEXT             NOT NULL,
      invoice_id        INT              NULL,
      subscription_id   INT              NULL,
      customer_id       INT              NULL,
      company_id        INT              NULL,
      customer_name     VARCHAR(200)     NULL,
      invoice_number    VARCHAR(100)     NULL,
      amount            DECIMAL(12,2)    NULL,
      due_date          DATE             NULL,
      status            ENUM('Active','Completed','Dismissed') NOT NULL DEFAULT 'Active',
      resolved_at       DATETIME         NULL,
      resolved_by       INT              NULL,
      notes             TEXT             NULL,
      created_at        DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at        DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (reminder_id),
      INDEX idx_finrem_type       (reminder_type),
      INDEX idx_finrem_priority   (priority),
      INDEX idx_finrem_status     (status),
      INDEX idx_finrem_invoice    (invoice_id),
      INDEX idx_finrem_sub        (subscription_id),
      INDEX idx_finrem_customer   (customer_id),
      INDEX idx_finrem_company    (company_id),
      INDEX idx_finrem_created    (created_at),
      INDEX idx_finrem_due_date   (due_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;

  await pool.query(createSQL);
  console.log("✓ finance_reminders table created (or already exists).");

  // Generate reminders from existing invoices
  const result = await generateInvoiceReminders(null);
  console.log(`✓ Generated ${result.created} reminder(s) from existing invoices.`);

  await pool.end();
}

run().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
