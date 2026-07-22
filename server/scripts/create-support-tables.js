/**
 * Create support tables that are one-to-many (not merged).
 * These were previously dropped and need to be restored.
 */
const mysql = require("mysql2/promise");
require("dotenv").config();

(async () => {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined,
    multipleStatements: true
  });

  console.log("Creating support tables (one-to-many relationships)...\n");

  // Connected Accounts (user can have multiple providers)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS connected_account (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      provider VARCHAR(30) NOT NULL,
      account_email VARCHAR(255),
      status VARCHAR(20) DEFAULT 'connected',
      connected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_sync DATETIME,
      UNIQUE KEY unique_user_provider (user_id, provider)
    )
  `);
  console.log("Created: connected_account");

  // Login Sessions (user can have multiple sessions)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS login_session (
      session_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      device VARCHAR(100),
      browser VARCHAR(100),
      os VARCHAR(100),
      ip_address VARCHAR(45),
      location VARCHAR(200),
      login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_current TINYINT(1) DEFAULT 0
    )
  `);
  console.log("Created: login_session");

  // Settings Audit Log (one-to-many log entries per user)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings_audit_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      action VARCHAR(255) NOT NULL,
      module VARCHAR(50),
      ip_address VARCHAR(45),
      device VARCHAR(200),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("Created: settings_audit_log");

  // Payment method table (referenced by payment table)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payment_method (
      payment_method_id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description VARCHAR(255),
      is_active TINYINT(1) DEFAULT 1
    )
  `);
  console.log("Created: payment_method");

  // Seed default payment methods
  try {
    await pool.query(`
      INSERT IGNORE INTO payment_method (name, description, is_active) VALUES
        ('Bank Transfer', 'Direct bank transfer', 1),
        ('Stripe', 'Online card payment via Stripe', 1),
        ('PayNow', 'PayNow QR payment', 1),
        ('Cash', 'Cash payment', 1)
    `);
    console.log("Seeded: payment_method defaults");
  } catch (e) { /* */ }

  const [tables] = await pool.query("SHOW TABLES");
  console.log(`\nTotal tables: ${tables.length}`);
  tables.forEach((r, i) => console.log(`  ${i + 1}. ${Object.values(r)[0]}`));

  await pool.end();
  console.log("\nDone!");
})();
