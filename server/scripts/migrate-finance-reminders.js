/**
 * Migration Script: Finance Reminders Table
 *
 * Creates the unified finance_reminders table and adds PayNow columns.
 *
 * Usage: node scripts/migrate-finance-reminders.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const fs = require("fs");
const path = require("path");
const { pool } = require("../src/config/db");

async function run() {
  const sqlPath = path.join(__dirname, "../src/migrations/20260726_create_finance_reminders.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");

  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  const connection = await pool.getConnection();

  try {
    for (const statement of statements) {
      try {
        await connection.query(statement);
        console.log(`  ✓ Executed: ${statement.substring(0, 60)}...`);
      } catch (err) {
        if (err.code === "ER_DUP_FIELDNAME" || err.code === "ER_DUP_KEYNAME") {
          console.log(`  - Skipped (already exists): ${statement.substring(0, 60)}...`);
        } else {
          console.error(`  ✗ Failed: ${err.message}`);
        }
      }
    }

    console.log("\n✓ Finance reminders migration complete.");
  } finally {
    connection.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
