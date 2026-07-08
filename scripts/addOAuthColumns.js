/**
 * Migration: Add Google and Telegram OAuth columns to the user table.
 *
 * Run once: node scripts/addOAuthColumns.js
 */

const path = require("path");
require(path.join(__dirname, "../server/node_modules/dotenv")).config({
  path: path.join(__dirname, "../server/.env")
});
const mysql = require(path.join(__dirname, "../server/node_modules/mysql2/promise"));

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined
  });

  console.log("Connected to database. Adding OAuth columns...");

  // Add google_sub column if not exists
  try {
    await connection.execute(
      `ALTER TABLE user ADD COLUMN google_sub VARCHAR(255) NULL UNIQUE`
    );
    console.log("✓ Added google_sub column");
  } catch (err) {
    if (err.code === "ER_DUP_FIELDNAME") {
      console.log("→ google_sub column already exists, skipping.");
    } else {
      throw err;
    }
  }

  // Add telegram_id column if not exists
  try {
    await connection.execute(
      `ALTER TABLE user ADD COLUMN telegram_id VARCHAR(255) NULL UNIQUE`
    );
    console.log("✓ Added telegram_id column");
  } catch (err) {
    if (err.code === "ER_DUP_FIELDNAME") {
      console.log("→ telegram_id column already exists, skipping.");
    } else {
      throw err;
    }
  }

  console.log("Migration complete.");
  await connection.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
