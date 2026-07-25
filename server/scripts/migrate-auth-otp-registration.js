/**
 * Adds password-plus-OTP login and first-organisation registration storage.
 * This migration is idempotent and does not alter invoice or payroll records.
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mysql = require("mysql2/promise");

async function tableExists(connection, tableName) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS tableCount
     FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`,
    [tableName]
  );
  return Number(rows[0]?.tableCount || 0) > 0;
}

async function columnExists(connection, tableName, columnName) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS columnCount
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [tableName, columnName]
  );
  return Number(rows[0]?.columnCount || 0) > 0;
}

async function addColumn(connection, tableName, columnName, definition) {
  if (!(await columnExists(connection, tableName, columnName))) {
    await connection.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
  }
}

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined
  });

  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS companies (
        company_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        company_name VARCHAR(255) NOT NULL,
        display_name VARCHAR(255) NULL,
        legal_company_name VARCHAR(255) NULL,
        business_type VARCHAR(80) NULL,
        country VARCHAR(100) NULL,
        base_currency CHAR(3) NULL,
        financial_year_end CHAR(5) NULL,
        time_zone VARCHAR(100) NULL,
        business_address TEXT NULL,
        postal_code VARCHAR(30) NULL,
        contact_email VARCHAR(255) NULL,
        registration_number VARCHAR(100) NULL,
        owner_user_id INT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    const companyColumns = {
      display_name: "VARCHAR(255) NULL",
      legal_company_name: "VARCHAR(255) NULL",
      business_type: "VARCHAR(80) NULL",
      country: "VARCHAR(100) NULL",
      base_currency: "CHAR(3) NULL",
      financial_year_end: "CHAR(5) NULL",
      time_zone: "VARCHAR(100) NULL",
      business_address: "TEXT NULL",
      postal_code: "VARCHAR(30) NULL",
      contact_email: "VARCHAR(255) NULL",
      registration_number: "VARCHAR(100) NULL"
    };
    for (const [column, definition] of Object.entries(companyColumns)) {
      await addColumn(connection, "companies", column, definition);
    }

    if (!(await tableExists(connection, "user"))) {
      throw new Error("The existing user table is required before running this migration.");
    }
    await addColumn(connection, "user", "company_id", "INT NULL");
    await addColumn(connection, "user", "job_title", "VARCHAR(150) NULL");
    await addColumn(connection, "user", "email_verified_at", "DATETIME NULL");
    await addColumn(connection, "user", "last_login_at", "DATETIME NULL");

    await connection.query(`
      CREATE TABLE IF NOT EXISTS pending_registrations (
        pending_registration_id CHAR(36) NOT NULL PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        work_email VARCHAR(255) NOT NULL,
        job_title VARCHAR(150) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        terms_accepted_at DATETIME NOT NULL,
        privacy_accepted_at DATETIME NOT NULL,
        email_verified_at DATETIME NULL,
        consumed_at DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_pending_registration_email (work_email)
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS auth_challenges (
        challenge_id CHAR(36) NOT NULL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        purpose VARCHAR(30) NOT NULL,
        otp_hash CHAR(64) NOT NULL,
        user_id INT NULL,
        pending_registration_id CHAR(36) NULL,
        expires_at DATETIME NOT NULL,
        resend_count INT NOT NULL DEFAULT 0,
        attempt_count INT NOT NULL DEFAULT 0,
        blocked_until DATETIME NULL,
        consumed_at DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_auth_challenge_email_purpose (email, purpose),
        INDEX idx_auth_challenge_expiry (expires_at)
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS company_settings (
        company_settings_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        tax_registration_status VARCHAR(40) NOT NULL,
        tax_number VARCHAR(100) NULL,
        default_tax_rate DECIMAL(7,2) NOT NULL DEFAULT 0,
        tax_calculation VARCHAR(20) NOT NULL DEFAULT 'exclusive',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_company_settings_company (company_id)
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_company (
        user_company_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        company_id INT NOT NULL,
        role_name VARCHAR(40) NOT NULL,
        is_primary TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_user_company (user_id, company_id)
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS legal_acceptances (
        legal_acceptance_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        company_id INT NOT NULL,
        document_type VARCHAR(30) NOT NULL,
        document_version VARCHAR(30) NOT NULL,
        accepted_at DATETIME NOT NULL,
        ip_address VARCHAR(45) NULL,
        UNIQUE KEY uq_legal_acceptance (user_id, document_type, document_version)
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS system_registration_state (
        state_id TINYINT NOT NULL PRIMARY KEY,
        registration_closed TINYINT(1) NOT NULL DEFAULT 0,
        company_id INT NULL,
        updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    await connection.query(`
      INSERT INTO system_registration_state (state_id, registration_closed, company_id)
      SELECT 1, IF(EXISTS(SELECT 1 FROM companies LIMIT 1), 1, 0),
             (SELECT company_id FROM companies ORDER BY company_id LIMIT 1)
      WHERE NOT EXISTS (SELECT 1 FROM system_registration_state WHERE state_id = 1)
    `);

    console.log("Authentication and first-organisation migration complete.");
  } finally {
    await connection.end();
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
