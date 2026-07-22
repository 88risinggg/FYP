/**
 * Merge invoice_settings (singleton) into a special row in invoice table.
 * We'll store settings as a JSON blob in a reserved invoice row (invoiceId = '__SETTINGS__').
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
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined
  });

  console.log("Merging invoice_settings into invoice table...\n");

  // Read the current settings
  const [settingsRows] = await pool.query("SELECT * FROM invoice_settings LIMIT 1");
  const settings = settingsRows[0] || {};
  const settingsJson = JSON.stringify(settings);

  // Insert a special settings row in invoice table
  // We'll use invoiceId = '__SETTINGS__' as a sentinel that the app code recognizes
  const [existing] = await pool.query("SELECT invoice_id FROM invoice WHERE invoiceId = '__SETTINGS__'");
  if (existing.length > 0) {
    await pool.query("UPDATE invoice SET items_json = ? WHERE invoiceId = '__SETTINGS__'", [settingsJson]);
    console.log("Updated existing settings row in invoice table.");
  } else {
    await pool.query(
      "INSERT INTO invoice (invoiceId, status, issue_date, due_date, total_amount, customer_id, items_json, created_at) VALUES ('__SETTINGS__', 'Draft', '1970-01-01', '1970-01-01', 0, NULL, ?, NOW())",
      [settingsJson]
    );
    console.log("Inserted settings row into invoice table.");
  }

  // Drop invoice_settings table
  await pool.query("SET FOREIGN_KEY_CHECKS = 0");
  await pool.query("DROP TABLE IF EXISTS invoice_settings");
  await pool.query("SET FOREIGN_KEY_CHECKS = 1");
  console.log("Dropped: invoice_settings");

  const [tables] = await pool.query("SHOW TABLES");
  console.log(`\nFinal: ${tables.length} tables`);
  tables.forEach((r, i) => console.log(`  ${i + 1}. ${Object.values(r)[0]}`));

  await pool.end();
})();
