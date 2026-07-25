require("dotenv").config();
const { pool } = require("../src/config/db");

const columns = [
  ["effective_claim_cutoff_at", "DATETIME NULL"],
  ["scheduled_release_at", "DATETIME NULL"],
  ["release_schedule_status", "VARCHAR(32) NULL"],
  ["release_confirmed_by", "INT NULL"],
  ["release_confirmed_at", "DATETIME NULL"],
  ["payment_attempted_at", "DATETIME NULL"],
  ["release_failure_reason", "VARCHAR(1000) NULL"]
];

async function run() {
  for (const [name, definition] of columns) {
    const [existing] = await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'payroll_run' AND column_name = ?`,
      [name]
    );
    if (!existing.length) await pool.query(`ALTER TABLE payroll_run ADD COLUMN ${name} ${definition}`);
  }
  const [indexes] = await pool.query(
    `SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'payroll_run' AND index_name = 'idx_payroll_run_scheduled_release'`
  );
  if (!indexes.length) await pool.query(`CREATE INDEX idx_payroll_run_scheduled_release ON payroll_run (release_schedule_status, scheduled_release_at)`);
  const settings = [
    ["enabled", "false", "Enables Finance-controlled payroll release scheduling"],
    ["salary_release_day", "", "Configured monthly salary release day"],
    ["salary_release_time", "09:00", "Salary release time in Asia/Singapore"],
    ["claim_cutoff_day", "", "Configured monthly claim cutoff day"],
    ["claim_cutoff_time", "23:59", "Claim cutoff time in Asia/Singapore"],
    ["timezone", "Asia/Singapore", "Payroll schedule timezone"]
  ];
  for (const setting of settings) {
    await pool.query(
      `INSERT INTO payroll_configuration (configuration_type, configuration_key, configuration_value, description, updated_by)
       VALUES ('finance_schedule', ?, ?, ?, NULL)
       ON DUPLICATE KEY UPDATE configuration_id = LAST_INSERT_ID(configuration_id)`,
      setting
    );
  }
  console.log("Finance payroll schedule migration completed.");
}

run().then(() => pool.end()).catch(async (error) => { console.error(error); await pool.end(); process.exitCode = 1; });
