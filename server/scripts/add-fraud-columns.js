/**
 * Add fraud detection and payment method columns to existing tables.
 * No new tables — just attributes on invoice and payment.
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { pool } = require("../src/config/db");

async function run() {
  const invoiceColumns = [
    { name: "risk_score", def: "INT DEFAULT 0" },
    { name: "risk_level", def: "VARCHAR(20) DEFAULT 'Low'" },
    { name: "review_status", def: "VARCHAR(50) DEFAULT 'Open'" },
    { name: "fraud_indicators_json", def: "JSON NULL" },
    { name: "vendor_name", def: "VARCHAR(255) NULL" },
    { name: "assessed_at", def: "DATETIME NULL" }
  ];

  console.log("Adding fraud columns to invoice table...");
  for (const col of invoiceColumns) {
    try {
      await pool.query(`ALTER TABLE invoice ADD COLUMN ${col.name} ${col.def}`);
      console.log(`  + ${col.name}`);
    } catch (e) {
      if (e.code === "ER_DUP_FIELDNAME") {
        console.log(`  (exists) ${col.name}`);
      } else {
        console.log(`  ! ${col.name}: ${e.message}`);
      }
    }
  }

  // Verify
  const [cols] = await pool.query("DESCRIBE invoice");
  console.log(`\nInvoice table now has ${cols.length} columns.`);

  const [tables] = await pool.query("SHOW TABLES");
  console.log(`Total tables: ${tables.length}`);
  tables.forEach((row, i) => console.log(`  ${i + 1}. ${Object.values(row)[0]}`));

  await pool.end();
}

run();
