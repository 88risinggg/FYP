/**
 * Quick script to add/update test customers for invoice email & WhatsApp testing.
 * Run: node scripts/add-test-customer.js
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { pool } = require("../src/config/db");

async function main() {
  const customers = [
    { name: "Test Customer", email: "aroot16257@gmail.com", phone: "+6598951296", address: "1 Test Avenue, Singapore 123456" },
    { name: "Arut", email: "arut1657@gmail.com", phone: "+6598951296", address: "1 Test Avenue, Singapore 123456" },
  ];

  try {
    for (const { name, email, phone, address } of customers) {
      const [existing] = await pool.query(
        "SELECT customer_id FROM customer WHERE email = ? LIMIT 1",
        [email]
      );

      if (existing.length > 0) {
        // Update phone and whatsapp_number if not already set
        await pool.query(
          "UPDATE customer SET phone = COALESCE(NULLIF(phone, ''), ?), whatsapp_number = COALESCE(NULLIF(whatsapp_number, ''), ?), whatsapp_verified = 1 WHERE customer_id = ?",
          [phone, phone, existing[0].customer_id]
        );
        console.log(`✓ Customer already exists (ID: ${existing[0].customer_id}) — email: ${email}, phone updated to ${phone}`);
      } else {
        const [result] = await pool.query(
          "INSERT INTO customer (name, email, address, phone, whatsapp_number, whatsapp_verified, company_id, created_at) VALUES (?, ?, ?, ?, ?, 1, 1, NOW())",
          [name, email, address, phone, phone]
        );
        console.log(`✓ Customer created (ID: ${result.insertId}) — name: "${name}", email: ${email}, phone: ${phone}`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error("✗ Failed to add test customer:", error.message);
    process.exit(1);
  }
}

main();
