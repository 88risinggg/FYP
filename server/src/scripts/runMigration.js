/**
 * Run Subscriptions Migration
 * Usage: node src/scripts/runMigration.js
 */
require("dotenv").config();
const { pool } = require("../config/db");

async function run() {
  const connection = await pool.getConnection();
  try {
    console.log("Creating subscriptions table...");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        subscription_id   INT           NOT NULL AUTO_INCREMENT,
        customer_id       INT           NOT NULL,
        company_id        INT           NULL,
        plan_name         VARCHAR(120)  NOT NULL,
        description       TEXT          NULL,
        amount            DECIMAL(12,2) NOT NULL,
        billing_frequency ENUM('Weekly','Monthly','Quarterly','Yearly') NOT NULL DEFAULT 'Monthly',
        start_date        DATE          NOT NULL,
        next_billing_date DATE          NOT NULL,
        end_date          DATE          NULL,
        auto_renew        TINYINT(1)    NOT NULL DEFAULT 1,
        auto_send         TINYINT(1)    NOT NULL DEFAULT 0,
        status            ENUM('Active','Paused','Cancelled','Expired') NOT NULL DEFAULT 'Active',
        cancelled_at      DATETIME      NULL,
        paused_at         DATETIME      NULL,
        created_by        INT           NULL,
        created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (subscription_id),
        INDEX idx_sub_customer   (customer_id),
        INDEX idx_sub_company    (company_id),
        INDEX idx_sub_status     (status),
        INDEX idx_sub_next_bill  (next_billing_date),
        INDEX idx_sub_created_by (created_by)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("✓ subscriptions table created.");

    // Add subscription_id column to invoice table if not exists
    console.log("Adding subscription_id to invoice table...");
    const [cols] = await connection.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoice' AND COLUMN_NAME = 'subscription_id'`
    );
    if (cols.length === 0) {
      await connection.query(`ALTER TABLE invoice ADD COLUMN subscription_id INT NULL, ADD INDEX idx_inv_subscription (subscription_id)`);
      console.log("✓ subscription_id column added to invoice.");
    } else {
      console.log("✓ subscription_id column already exists — skipped.");
    }

    console.log("\nMigration complete!");
  } catch (error) {
    console.error("Migration failed:", error.message);
  } finally {
    connection.release();
    process.exit(0);
  }
}

run();
