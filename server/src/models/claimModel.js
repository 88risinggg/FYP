const { pool } = require("../config/db");

async function ensureClaimTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS expense_claim (
      claim_id VARCHAR(32) PRIMARY KEY,
      staff_employee_id INT NOT NULL,
      claim_type ENUM('Medical','Transport','Meal','Internet','Office Purchase','Business Travel','Other') NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      expense_date DATE NOT NULL,
      description VARCHAR(1000) NOT NULL,
      proof_path VARCHAR(500) NOT NULL,
      proof_original_name VARCHAR(255) NOT NULL,
      proof_mime_type VARCHAR(100) NOT NULL,
      status ENUM('pending_hr','hr_approved','hr_rejected','released','finance_rejected') DEFAULT 'pending_hr',
      submitted_by INT NOT NULL,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      hr_reviewed_by INT NULL,
      hr_reviewed_at DATETIME NULL,
      hr_comments VARCHAR(1000) NULL,
      finance_processed_by INT NULL,
      finance_processed_at DATETIME NULL,
      finance_comments VARCHAR(1000) NULL,
      payment_reference VARCHAR(100) NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (staff_employee_id) REFERENCES staff(employee_id),
      FOREIGN KEY (submitted_by) REFERENCES \`user\`(user_id),
      INDEX idx_claim_staff (staff_employee_id),
      INDEX idx_claim_status (status),
      INDEX idx_claim_submitted (submitted_at)
    )
  `);
}

ensureClaimTables().catch((error) => {
  console.error("Failed to ensure claim tables:", error.message);
});

module.exports = { ensureClaimTables };
