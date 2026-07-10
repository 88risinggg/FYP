/**
 * Loan Model
 *
 * Database initialization and queries for the Employee Loan module.
 * Handles loan_request and loan_installment table creation and loan-related database operations.
 */

const { pool } = require("../config/db");

/**
 * Ensure the loan_request and loan_installment tables exist.
 * Called on module load to guarantee the tables are available before any queries.
 */
async function ensureLoanTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS loan_request (
      loan_id VARCHAR(20) PRIMARY KEY,
      staff_employee_id INT NOT NULL,
      requested_amount DECIMAL(10, 2) NOT NULL,
      repayment_months INT NOT NULL,
      reason TEXT,
      status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
      monthly_installment DECIMAL(10, 2) NULL,
      total_paid DECIMAL(10, 2) DEFAULT 0.00,
      outstanding_balance DECIMAL(10, 2) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INT NOT NULL,
      approved_by INT NULL,
      approved_at DATETIME NULL,
      hr_comments TEXT NULL,
      FOREIGN KEY (staff_employee_id) REFERENCES staff(employee_id),
      FOREIGN KEY (created_by) REFERENCES \`user\`(user_id),
      FOREIGN KEY (approved_by) REFERENCES \`user\`(user_id),
      INDEX idx_loan_staff_employee_id (staff_employee_id),
      INDEX idx_loan_status (status)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS loan_installment (
      installment_id VARCHAR(20) PRIMARY KEY,
      loan_id VARCHAR(20) NOT NULL,
      installment_number INT NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      due_date DATE NOT NULL,
      status ENUM('unpaid', 'paid') DEFAULT 'unpaid',
      paid_at DATETIME NULL,
      paid_by INT NULL,
      FOREIGN KEY (loan_id) REFERENCES loan_request(loan_id),
      FOREIGN KEY (paid_by) REFERENCES \`user\`(user_id),
      INDEX idx_installment_loan_id (loan_id)
    )
  `);
}

// Run table creation on module load
ensureLoanTables().catch((err) => {
  console.error("Failed to ensure loan tables:", err.message);
});

module.exports = {
  ensureLoanTables,
};
