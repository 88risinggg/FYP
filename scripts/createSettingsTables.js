/**
 * Create Settings Module Tables
 *
 * Run this script to create all tables needed for the Settings module.
 * Usage: node scripts/createSettingsTables.js
 */

const mysql = require("mysql2/promise");
require("dotenv").config({ path: "./server/.env" });

async function createTables() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true
  });

  console.log("Connected to database. Creating settings tables...\n");

  const sql = `
    -- Add password_changed_at to user table if not exists
    ALTER TABLE user ADD COLUMN IF NOT EXISTS password_changed_at DATETIME DEFAULT NULL;

    -- User Profile
    CREATE TABLE IF NOT EXISTS user_profile (
      profile_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
      display_name VARCHAR(100),
      mobile VARCHAR(20),
      job_title VARCHAR(100),
      department VARCHAR(100),
      preferred_language VARCHAR(10) DEFAULT 'en',
      timezone VARCHAR(50) DEFAULT 'Asia/Singapore',
      date_format VARCHAR(20) DEFAULT 'DD/MM/YYYY',
      currency VARCHAR(10) DEFAULT 'SGD',
      profile_picture TEXT,
      employee_id VARCHAR(50),
      company_name VARCHAR(200),
      phone_verified TINYINT(1) DEFAULT 0,
      email_verified TINYINT(1) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE
    );

    -- Security Settings (2FA)
    CREATE TABLE IF NOT EXISTS security_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
      two_fa_enabled TINYINT(1) DEFAULT 0,
      two_fa_method VARCHAR(30),
      recovery_codes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE
    );

    -- Connected Accounts
    CREATE TABLE IF NOT EXISTS connected_account (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      provider VARCHAR(30) NOT NULL,
      account_email VARCHAR(255),
      status VARCHAR(20) DEFAULT 'connected',
      connected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_sync DATETIME,
      UNIQUE KEY unique_user_provider (user_id, provider),
      FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE
    );

    -- Notification Settings
    CREATE TABLE IF NOT EXISTS notification_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
      preferences JSON,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE
    );

    -- Invoice Settings
    CREATE TABLE IF NOT EXISTS invoice_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
      invoice_prefix VARCHAR(20) DEFAULT 'INV',
      next_invoice_number INT DEFAULT 1,
      default_due_days INT DEFAULT 30,
      default_currency VARCHAR(10) DEFAULT 'SGD',
      tax_rate DECIMAL(5,2) DEFAULT 9.00,
      payment_terms TEXT,
      auto_generate_pdf TINYINT(1) DEFAULT 1,
      auto_email_invoice TINYINT(1) DEFAULT 0,
      late_payment_reminder TINYINT(1) DEFAULT 1,
      invoice_footer TEXT,
      invoice_notes TEXT,
      company_logo TEXT,
      invoice_template VARCHAR(50) DEFAULT 'standard',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE
    );

    -- Company Settings
    CREATE TABLE IF NOT EXISTS company_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
      company_logo TEXT,
      company_name VARCHAR(200),
      registration_number VARCHAR(50),
      gst_number VARCHAR(50),
      address TEXT,
      phone VARCHAR(20),
      email VARCHAR(255),
      website VARCHAR(255),
      default_currency VARCHAR(10) DEFAULT 'SGD',
      financial_year VARCHAR(20),
      fiscal_start_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE
    );

    -- Login Sessions
    CREATE TABLE IF NOT EXISTS login_session (
      session_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      device VARCHAR(100),
      browser VARCHAR(100),
      os VARCHAR(100),
      ip_address VARCHAR(45),
      location VARCHAR(200),
      login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_current TINYINT(1) DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE
    );

    -- Settings Audit Log
    CREATE TABLE IF NOT EXISTS settings_audit_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      action VARCHAR(255) NOT NULL,
      module VARCHAR(50),
      ip_address VARCHAR(45),
      device VARCHAR(200),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE
    );

    -- Appearance Settings
    CREATE TABLE IF NOT EXISTS appearance_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
      theme VARCHAR(20) DEFAULT 'system',
      accent_color VARCHAR(20) DEFAULT '#7B2FF7',
      compact_mode TINYINT(1) DEFAULT 0,
      font_size VARCHAR(20) DEFAULT 'medium',
      language VARCHAR(10) DEFAULT 'en',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE
    );

    -- API Settings
    CREATE TABLE IF NOT EXISTS api_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
      api_key VARCHAR(255),
      webhook_url VARCHAR(500),
      webhook_secret VARCHAR(255),
      webhooks_enabled TINYINT(1) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE
    );
  `;

  try {
    await connection.query(sql);
    console.log("All settings tables created successfully!");
  } catch (error) {
    console.error("Error creating tables:", error.message);
  } finally {
    await connection.end();
  }
}

createTables();
