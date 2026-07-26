require("dotenv").config();
const { pool } = require("../src/config/db");

async function run() {
  // First revert all customers that were updated earlier
  await pool.query("UPDATE customer SET whatsapp_number = NULL WHERE whatsapp_number = '6598951296'");

  // Now set it only for Test Customer
  const [result] = await pool.query(
    "UPDATE customer SET whatsapp_number = '6598951296' WHERE name LIKE '%Test%'"
  );
  console.log("Updated", result.affectedRows, "Test Customer(s) with WhatsApp number 6598951296");
  process.exit(0);
}

run().catch((e) => { console.error(e.message); process.exit(1); });
