require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mysql = require("mysql2/promise");

async function run() {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined });
  try {
    const checks = [];
    const tables = ["user","staff","payroll_run","payroll","claims_and_loans","payroll_configuration","account_action_requests","notification","audit_logs","customer","invoice","payment","subscriptions"];
    for (const table of tables) {
      const [exists] = await db.execute("SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name='company_id'", [table]);
      if (!exists.length) { checks.push({ check: `${table}.company_id`, status: "missing" }); continue; }
      const where = table === "user" ? "company_id IS NULL AND role_name <> 'PlatformOperator'" : "company_id IS NULL";
      const [[count]] = await db.query(`SELECT COUNT(*) total FROM \`${table}\` WHERE ${where}`);
      checks.push({ check: `${table}.unassigned`, status: Number(count.total) ? "failed" : "passed", count: Number(count.total) });
    }
    const crossQueries = [
      ["payroll_staff", "SELECT COUNT(*) total FROM payroll p JOIN staff s ON s.employee_id=p.staff_employee_id WHERE p.company_id<>s.company_id"],
      ["payroll_run", "SELECT COUNT(*) total FROM payroll p JOIN payroll_run r ON r.payroll_run_id=p.payroll_run_id WHERE p.company_id<>r.company_id"],
      ["claims_staff", "SELECT COUNT(*) total FROM claims_and_loans c JOIN staff s ON s.employee_id=c.staff_employee_id WHERE c.company_id<>s.company_id"],
      ["staff_user", "SELECT COUNT(*) total FROM staff s JOIN user u ON u.user_id=s.user_user_id WHERE s.company_id<>u.company_id"],
      ["notification_user", "SELECT COUNT(*) total FROM notification n JOIN user u ON u.user_id=n.user_id WHERE n.company_id<>u.company_id"],
      ["notification_actor", "SELECT COUNT(*) total FROM notification n JOIN user u ON u.user_id=n.actor_user_id WHERE n.company_id<>u.company_id"]
    ];
    for (const [name, sql] of crossQueries) { const [[row]] = await db.query(sql); checks.push({ check: `cross_company.${name}`, status: Number(row.total) ? "failed" : "passed", count: Number(row.total) }); }
    const [[staffEncryption]] = await db.query("SELECT COUNT(*) total FROM staff WHERE sensitive_payload IS NULL");
    const [[payrollEncryption]] = await db.query("SELECT COUNT(*) total FROM payroll WHERE financial_payload IS NULL");
    checks.push({ check: "encryption.staff", status: Number(staffEncryption.total) ? "pending" : "passed", count: Number(staffEncryption.total) });
    checks.push({ check: "encryption.payroll", status: Number(payrollEncryption.total) ? "pending" : "passed", count: Number(payrollEncryption.total) });
    console.table(checks);
    if (checks.some((item) => item.status === "failed" || item.status === "missing")) process.exitCode = 2;
  } finally { await db.end(); }
}
run().catch((error) => { console.error(error.message); process.exitCode = 1; });
