/**
 * Adds Phase 1/2 company ownership support without touching payroll tables.
 *
 * Safe to run multiple times:
 * - creates companies/email_otps if missing
 * - adds nullable company/email verification columns if missing
 * - backfills existing single-SME data into one default company
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mysql = require("mysql2/promise");

async function tableExists(connection, tableName) {
  const [rows] = await connection.query(
    "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
    [tableName]
  );
  return rows.length > 0;
}

async function columnExists(connection, tableName, columnName) {
  const [rows] = await connection.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return rows.length > 0;
}

async function addColumnIfMissing(connection, tableName, columnName, definition) {
  if (!(await tableExists(connection, tableName))) {
    console.log(`skip ${tableName}.${columnName}: table missing`);
    return;
  }

  if (await columnExists(connection, tableName, columnName)) {
    console.log(`exists ${tableName}.${columnName}`);
    return;
  }

  await connection.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  console.log(`added ${tableName}.${columnName}`);
}

async function getOrCreateDefaultCompany(connection) {
  const [companies] = await connection.query("SELECT company_id FROM companies ORDER BY company_id ASC LIMIT 1");
  if (companies.length > 0) return companies[0].company_id;

  const [users] = await connection.query(
    "SELECT user_id, name FROM user ORDER BY CASE WHEN role_name = 'Admin' THEN 0 ELSE 1 END, user_id ASC LIMIT 1"
  );
  const ownerUserId = users[0]?.user_id || null;
  const companyName = process.env.DEFAULT_COMPANY_NAME || "Demo SME";

  const [result] = await connection.query(
    "INSERT INTO companies (company_name, owner_user_id, status, created_at) VALUES (?, ?, 'active', NOW())",
    [companyName, ownerUserId]
  );
  console.log(`created default company ${companyName}`);
  return result.insertId;
}

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    multipleStatements: true
  });

  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS companies (
        company_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        company_name VARCHAR(255) NOT NULL,
        owner_user_id INT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_companies_status (status)
      )
    `);
    console.log("ensured companies");

    await connection.query(`
      CREATE TABLE IF NOT EXISTS email_otps (
        otp_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        otp_hash CHAR(64) NOT NULL,
        purpose VARCHAR(40) NOT NULL,
        expires_at DATETIME NOT NULL,
        attempts INT NOT NULL DEFAULT 0,
        consumed_at DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email_otps_lookup (email, purpose, created_at),
        INDEX idx_email_otps_expiry (expires_at)
      )
    `);
    console.log("ensured email_otps");

    await addColumnIfMissing(connection, "user", "company_id", "INT NULL");
    await addColumnIfMissing(connection, "user", "email_verified_at", "DATETIME NULL");
    await addColumnIfMissing(connection, "user", "last_login_at", "DATETIME NULL");

    const invoicingTables = [
      "customer",
      "invoice",
      "invoice_item",
      "payment",
      "audit_logs",
      "reminder_settings",
      "invoice_upload_history",
      "invoice_upload_validation_errors"
    ];

    for (const table of invoicingTables) {
      await addColumnIfMissing(connection, table, "company_id", "INT NULL");
    }

    const companyId = await getOrCreateDefaultCompany(connection);
    await connection.query("UPDATE user SET company_id = ? WHERE company_id IS NULL", [companyId]);
    await connection.query("UPDATE user SET email_verified_at = COALESCE(email_verified_at, NOW()) WHERE company_id = ?", [companyId]);

    for (const table of invoicingTables) {
      if (await tableExists(connection, table)) {
        await connection.query(`UPDATE ${table} SET company_id = ? WHERE company_id IS NULL`, [companyId]);
      }
    }

    console.log("company owner setup migration complete");
  } finally {
    await connection.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
