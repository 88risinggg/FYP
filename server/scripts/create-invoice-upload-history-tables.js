const fs = require("fs");
const path = require("path");

const { pool } = require("../src/config/db");

async function run() {
  const migrationPath = path.join(
    __dirname,
    "../src/migrations/add_invoice_upload_history.sql"
  );
  const statements = fs.readFileSync(migrationPath, "utf8")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

  try {
    for (const statement of statements) {
      await pool.query(statement);
    }
    console.log("Invoice upload history tables are ready.");
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error("Unable to create invoice upload history tables:", error.message);
  process.exitCode = 1;
});
