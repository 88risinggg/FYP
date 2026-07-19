const fs = require("fs");
const path = require("path");

const { pool } = require("../src/config/db");

async function run() {
  const migrationPath = path.join(__dirname, "../src/migrations/add_canonical_invoice_settings.sql");
  const statements = fs.readFileSync(migrationPath, "utf8")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

  try {
    for (const statement of statements) {
      await pool.query(statement);
    }

    const [[duplicate]] = await pool.query(`
      SELECT COUNT(*) AS duplicateCount
      FROM (
        SELECT invoiceId
        FROM invoice
        WHERE invoiceId IS NOT NULL AND invoiceId <> ''
        GROUP BY invoiceId
        HAVING COUNT(*) > 1
      ) duplicates
    `);
    const [indexes] = await pool.query("SHOW INDEX FROM invoice WHERE Key_name = 'uq_invoice_invoiceId'");

    if (Number(duplicate.duplicateCount) === 0 && indexes.length === 0) {
      await pool.query("ALTER TABLE invoice ADD UNIQUE KEY uq_invoice_invoiceId (invoiceId)");
    }

    if (Number(duplicate.duplicateCount) > 0) {
      console.warn("Invoice settings tables are ready, but the invoice-number unique index was skipped because duplicates exist.");
    } else {
      console.log("Canonical invoice settings tables and invoice-number uniqueness are ready.");
    }
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error("Unable to create canonical invoice settings:", error.message);
  process.exitCode = 1;
});
