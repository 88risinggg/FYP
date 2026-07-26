require("dotenv").config();
const { pool } = require("../src/config/db");

async function run() {
  const [result] = await pool.query(
    "DELETE FROM whatsapp_messages WHERE DATE(created_at) = CURDATE()"
  );
  console.log("Cleared", result.affectedRows, "message(s) sent today.");
  process.exit(0);
}

run().catch((e) => { console.error(e.message); process.exit(1); });
