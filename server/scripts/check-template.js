require("dotenv").config();
const { pool } = require("../src/config/db");

async function run() {
  const [rows] = await pool.query(
    "SELECT id, template_name, template_type, message_body FROM whatsapp_templates WHERE template_type = 'invoice_sent' AND is_active = 1 ORDER BY is_default DESC LIMIT 1"
  );
  console.log(JSON.stringify(rows[0], null, 2));
  process.exit(0);
}

run().catch((e) => { console.error(e.message); process.exit(1); });
