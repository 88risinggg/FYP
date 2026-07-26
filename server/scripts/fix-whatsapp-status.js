require("dotenv").config();
const { pool } = require("../src/config/db");

async function fix() {
  await pool.query(
    "UPDATE whatsapp_config SET connection_status = 'connected', last_tested_at = NOW() WHERE id = 1"
  );
  console.log("Updated connection_status to 'connected'.");
  process.exit(0);
}

fix().catch((e) => { console.error(e.message); process.exit(1); });
