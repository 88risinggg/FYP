require("dotenv").config();
const { pool } = require("../src/config/db");

async function main() {
  const [rows] = await pool.query(
    "SELECT invoiceId, status, LEFT(COALESCE(payment_url,'NULL'),60) AS url, CASE WHEN qr_code_url IS NOT NULL THEN 'YES' ELSE 'NULL' END AS has_qr FROM invoice WHERE invoiceId NOT LIKE ? ORDER BY invoice_id",
    ["__SETTINGS__"]
  );
  rows.forEach(r => console.log(`${r.invoiceId} | ${r.status} | url: ${r.url} | qr: ${r.has_qr}`));
  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
