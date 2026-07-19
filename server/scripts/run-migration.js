/**
 * Run the invoice payment columns migration.
 * Safe to run multiple times — uses ALTER TABLE which will fail silently if column exists.
 *
 * Usage: node scripts/run-migration.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mysql = require("mysql2/promise");

async function runMigration() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined,
    multipleStatements: true
  });

  const steps = [
    {
      name: "Add payment_url column",
      sql: "ALTER TABLE invoice ADD COLUMN payment_url TEXT NULL"
    },
    {
      name: "Add qr_code_url column",
      sql: "ALTER TABLE invoice ADD COLUMN qr_code_url MEDIUMTEXT NULL"
    },
    {
      name: "Add stripe_session_id column",
      sql: "ALTER TABLE invoice ADD COLUMN stripe_session_id VARCHAR(255) NULL"
    },
    {
      name: "Add payment_intent_id column",
      sql: "ALTER TABLE invoice ADD COLUMN payment_intent_id VARCHAR(255) NULL"
    },
    {
      name: "Add payment_date column",
      sql: "ALTER TABLE invoice ADD COLUMN payment_date DATETIME NULL"
    }
  ];

  const connection = await pool.getConnection();

  try {
    for (const step of steps) {
      try {
        await connection.query(step.sql);
        console.log(`✓ ${step.name}`);
      } catch (err) {
        if (err.code === "ER_DUP_FIELDNAME" || err.code === "ER_TABLE_EXISTS_ERROR") {
          console.log(`  (already exists) ${step.name}`);
        } else {
          console.error(`✗ ${step.name}: ${err.message}`);
        }
      }
    }
    console.log("\nMigration complete.");
  } finally {
    connection.release();
    await pool.end();
  }
}

runMigration().catch(console.error);
