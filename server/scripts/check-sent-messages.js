require("dotenv").config();
const { pool } = require("../src/config/db");

async function run() {
  const [rows] = await pool.query(
    "SELECT id, invoice_id, message_type, status, message_body, created_at FROM whatsapp_messages ORDER BY created_at DESC LIMIT 5"
  );
  rows.forEach((r) => {
    console.log(`ID:${r.id} Invoice:${r.invoice_id} Type:${r.message_type} Status:${r.status} Created:${r.created_at}`);
    console.log("Body:", r.message_body.substring(0, 200));
    console.log("---");
  });
  process.exit(0);
}

run().catch((e) => { console.error(e.message); process.exit(1); });
