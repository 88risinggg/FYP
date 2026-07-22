const mysql = require("mysql2/promise");
require("dotenv").config();

async function run() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: true }
  });

  await pool.query("SET FOREIGN_KEY_CHECKS = 0");

  const tablesToDrop = [
    "advance_request",
    "emergency_contact",
    "expense_claim",
    "finance_request",
    "finance_payroll_run",
    "leave_application",
    "leave_balance",
    "leave_type",
    "payroll_run",
    "payslip",
    "payslip_layout",
    "payroll_setting",
    "role",
    "role_permission_config",
    "department",
    "payment_method",
    "invoice_item",
    "invoice_settings",
    "invoice_numbering_activity",
    "invoice_fraud_indicator",
    "invoice_fraud_metadata",
    "invoice_view_log",
    "invoice_reminder_log",
    "reminder_settings",
    "reminder_logs",
    "loan_request",
    "loan_installment",
    "audit_log",
    "settings_audit_log",
    "notification_settings",
    "user_profile",
    "login_session",
    "security_settings",
    "connected_account",
    "appearance_settings",
    "api_settings",
    "company_settings",
    "payroll_settings",
    "backup",
    "fraud_alert",
    "fraud_vendor_profile",
    "invoice_approval",
    "staff_profile_audit_log"
  ];

  for (const table of tablesToDrop) {
    await pool.query(`DROP TABLE IF EXISTS \`${table}\``);
    console.log(`Dropped ${table}`);
  }

  await pool.query("SET FOREIGN_KEY_CHECKS = 1");

  const [tables] = await pool.query("SHOW TABLES");
  console.log(`\nFinal: ${tables.length} tables`);
  tables.forEach((r, i) => console.log(`  ${i + 1}. ${Object.values(r)[0]}`));

  await pool.end();
}

run().catch(e => { console.error(e.message); process.exit(1); });
