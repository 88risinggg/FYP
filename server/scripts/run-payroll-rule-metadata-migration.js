const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

require("dotenv").config({ path: path.join(__dirname, "../.env") });

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined,
    multipleStatements: true
  });
  try {
    const sql = fs.readFileSync(path.join(__dirname, "../src/migrations/20260724_payroll_rule_metadata_and_audit.sql"), "utf8");
    await connection.query(sql);
    console.log("Payroll rule metadata and audit migration completed.");
  } finally {
    await connection.end();
  }
}

run().catch((error) => {
  console.error("Payroll rule metadata and audit migration failed:", error.message);
  process.exitCode = 1;
});
