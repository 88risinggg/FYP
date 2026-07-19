require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { pool } = require("../src/config/db");

async function run() {
  const checks = ["invoice_item", "audit_log", "audit_logs"];
  for (const t of checks) {
    const [rows] = await pool.query("SHOW TABLES LIKE ?", [t]);
    console.log(`${t}: ${rows.length > 0 ? "EXISTS" : "MISSING"}`);
  }
  // Check invoice columns
  const [cols] = await pool.query("DESCRIBE invoice");
  const colNames = cols.map(c => c.Field);
  console.log("\ninvoice has items_json:", colNames.includes("items_json"));
  await pool.end();
}
run();
