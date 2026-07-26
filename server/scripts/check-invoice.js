require("dotenv").config();
const { pool } = require("../src/config/db");

async function run() {
  const [rows] = await pool.query(
    "SELECT invoice_id, invoiceId, payment_url, status, customer_id FROM invoice WHERE invoiceId = 'INV-2026-0042' LIMIT 1"
  );
  console.log(JSON.stringify(rows[0], null, 2));
  process.exit(0);
}

run().catch((e) => { console.error(e.message); process.exit(1); });
