const { pool } = require("../config/db");

async function ensureAdvanceTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS advance_request (
      request_id VARCHAR(32) PRIMARY KEY,
      staff_employee_id INT NOT NULL,
      requested_amount DECIMAL(10,2) NOT NULL,
      reason VARCHAR(1000) NOT NULL,
      status ENUM('pending','hr_approved','hr_rejected','finance_approved') DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INT NOT NULL,
      approved_by INT NULL,
      approved_at DATETIME NULL,
      hr_comments VARCHAR(1000) NULL,
      FOREIGN KEY (staff_employee_id) REFERENCES staff(employee_id),
      INDEX idx_advance_staff (staff_employee_id),
      INDEX idx_advance_status (status)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS finance_request (
      finance_request_id VARCHAR(32) PRIMARY KEY,
      advance_request_id VARCHAR(32) NOT NULL,
      staff_employee_id INT NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      status ENUM('queued','processed') DEFAULT 'queued',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INT NOT NULL,
      processed_by INT NULL,
      processed_at DATETIME NULL,
      payment_reference VARCHAR(100) NULL,
      FOREIGN KEY (advance_request_id) REFERENCES advance_request(request_id),
      INDEX idx_finance_request_status (status)
    )
  `);
  try {
    await pool.query("ALTER TABLE finance_request ADD COLUMN payment_reference VARCHAR(100) NULL AFTER processed_at");
  } catch (error) {
    if (error.code !== "ER_DUP_FIELDNAME") throw error;
  }
}

ensureAdvanceTables().catch((error) => {
  console.error("Failed to ensure advance tables:", error.message);
});

module.exports = { ensureAdvanceTables };
