require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");

async function run() {
  const email = String(process.env.PLATFORM_OPERATOR_EMAIL || "").trim().toLowerCase();
  const password = String(process.env.PLATFORM_OPERATOR_PASSWORD || "");
  const name = String(process.env.PLATFORM_OPERATOR_NAME || "PayNivo Platform Operator").trim();
  if (!email || password.length < 12) throw new Error("Set PLATFORM_OPERATOR_EMAIL and a PLATFORM_OPERATOR_PASSWORD of at least 12 characters.");
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined });
  try {
    const hash = await bcrypt.hash(password, 12);
    await db.execute(`INSERT INTO user (email,name,password,status,must_change_password,role_name,company_id,created_at,updated_at)
      VALUES (?,?,?,1,0,'PlatformOperator',NULL,NOW(),NOW())
      ON DUPLICATE KEY UPDATE name=VALUES(name),password=VALUES(password),status=1,role_name='PlatformOperator',company_id=NULL,updated_at=NOW()`, [email, name, hash]);
    console.log("Platform Operator account is ready.");
  } finally { await db.end(); }
}
run().catch((error) => { console.error(error.message); process.exitCode = 1; });
