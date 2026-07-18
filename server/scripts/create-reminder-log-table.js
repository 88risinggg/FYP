require("dotenv").config();
const { pool } = require("../src/config/db");

async function createTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoice_reminder_log (
      reminder_log_id INT AUTO_INCREMENT PRIMARY KEY,
      invoice_id INT NOT NULL,
      reminder_type VARCHAR(50) NOT NULL,
      delivery_status ENUM('Sent', 'Failed') NOT NULL DEFAULT 'Sent',
      customer_email VARCHAR(255) NULL,
      sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      error_message TEXT NULL,
      INDEX idx_invoice_id (invoice_id),
      INDEX idx_reminder_type (reminder_type),
      INDEX idx_sent_at (sent_at),
      INDEX idx_dedup (invoice_id, reminder_type, delivery_status, sent_at)
    )
  `);
  console.log("invoice_reminder_log table created/verified.");
  await pool.end();
}

createTable().catch((e) => { console.error(e.message); process.exit(1); });
