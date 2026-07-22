require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

async function run() {
  const pool = await mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  // Create payroll_run table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payroll_run (
      payroll_run_id INT AUTO_INCREMENT PRIMARY KEY,
      payroll_month INT NOT NULL,
      payroll_year INT NOT NULL,
      status VARCHAR(100) DEFAULT 'Draft',
      configuration_json JSON,
      approved_by INT,
      approved_at DATETIME,
      payment_reference VARCHAR(255),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_period (payroll_year, payroll_month)
    )
  `);
  console.log('payroll_run table created');

  // Add payroll_run_id column to payroll if missing
  const [cols] = await pool.query(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payroll' AND COLUMN_NAME = 'payroll_run_id'"
  );
  if (cols.length === 0) {
    await pool.query('ALTER TABLE payroll ADD COLUMN payroll_run_id INT DEFAULT NULL');
    console.log('Added payroll_run_id to payroll table');
  } else {
    console.log('payroll_run_id already exists in payroll');
  }

  // Add payslip columns if missing
  const addCol = async (col, def) => {
    const [c] = await pool.query(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payroll' AND COLUMN_NAME = ?",
      [col]
    );
    if (c.length === 0) {
      await pool.query(`ALTER TABLE payroll ADD COLUMN ${col} ${def}`);
      console.log('Added ' + col);
    }
  };
  await addCol('payslip_status', "VARCHAR(50) DEFAULT 'Draft'");
  await addCol('payslip_file_path', 'VARCHAR(500)');
  await addCol('payslip_generated_at', 'DATETIME');
  await addCol('payslip_sent_at', 'DATETIME');
  await addCol('payslip_is_read', 'TINYINT DEFAULT 0');
  await addCol('payslip_read_at', 'DATETIME');

  await pool.end();
  console.log('Done - all migrations applied');
}
run().catch(e => { console.error(e.message); process.exit(1); });
