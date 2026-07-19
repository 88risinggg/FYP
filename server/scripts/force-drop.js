const mysql = require("mysql2/promise");
require("dotenv").config();

(async () => {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: true }
  });

  await pool.query("SET FOREIGN_KEY_CHECKS = 0");

  // Get all tables
  const [allTables] = await pool.query("SHOW TABLES");
  const tableNames = allTables.map(r => Object.values(r)[0]);

  // These are the 11 we KEEP
  const keep = new Set([
    "audit_logs",
    "claims_and_loans",
    "customer",
    "invoice",
    "invoice_fraud_assessment",
    "notification",
    "payment",
    "payroll",
    "public_holidays",
    "staff",
    "user"
  ]);

  // Drop everything else
  for (const table of tableNames) {
    if (!keep.has(table)) {
      await pool.query(`DROP TABLE IF EXISTS \`${table}\``);
      console.log("Dropped:", table);
    }
  }

  await pool.query("SET FOREIGN_KEY_CHECKS = 1");

  const [final] = await pool.query("SHOW TABLES");
  console.log("\nFinal:", final.length, "tables");
  final.forEach((r, i) => console.log(`  ${i + 1}. ${Object.values(r)[0]}`));

  await pool.end();
  process.exit(0);
})();
