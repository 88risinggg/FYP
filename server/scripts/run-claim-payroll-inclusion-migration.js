require("dotenv").config();
const { pool } = require("../src/config/db");

const columns = [
  ["payroll_target_month", "TINYINT UNSIGNED NULL"],
  ["payroll_target_year", "SMALLINT UNSIGNED NULL"],
  ["payroll_inclusion_status", "VARCHAR(32) NULL"],
  ["included_payroll_id", "BIGINT NULL"],
  ["payroll_approved_at", "DATETIME NULL"],
  ["payroll_included_at", "DATETIME NULL"]
];

async function run() {
  for (const [name, definition] of columns) {
    const [existing] = await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'claims_and_loans' AND column_name = ?`,
      [name]
    );
    if (!existing.length) await pool.query(`ALTER TABLE claims_and_loans ADD COLUMN ${name} ${definition}`);
  }
  await pool.query(
    `UPDATE claims_and_loans SET payroll_inclusion_status = 'historical_external'
     WHERE type = 'expense_claim' AND status = 'released' AND payroll_inclusion_status IS NULL`
  );
  const [indexes] = await pool.query(
    `SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'claims_and_loans' AND index_name = 'idx_claim_payroll_queue'`
  );
  if (!indexes.length) {
    await pool.query(`CREATE INDEX idx_claim_payroll_queue ON claims_and_loans (type, payroll_inclusion_status, payroll_target_year, payroll_target_month, staff_employee_id)`);
  }
  console.log("Claim payroll inclusion migration completed.");
}

run().then(() => pool.end()).catch(async (error) => { console.error(error); await pool.end(); process.exitCode = 1; });
