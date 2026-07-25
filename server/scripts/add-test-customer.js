/**
 * Quick script to add a test customer for invoice email testing.
 * Run: node scripts/add-test-customer.js
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { pool } = require("../src/config/db");

async function main() {
  const name = "Test Customer";
  const email = "aroot16257@gmail.com";
  const address = "1 Test Avenue, Singapore 123456";

  try {
    // Check if customer already exists
    const [existing] = await pool.query(
      "SELECT customer_id FROM customer WHERE email = ? LIMIT 1",
      [email]
    );

    if (existing.length > 0) {
      console.log(`✓ Customer already exists (ID: ${existing[0].customer_id}) — email: ${email}`);
    } else {
      const [result] = await pool.query(
        "INSERT INTO customer (name, email, address, company_id, created_at) VALUES (?, ?, ?, 1, NOW())",
        [name, email, address]
      );
      console.log(`✓ Customer created (ID: ${result.insertId}) — name: "${name}", email: ${email}`);
    }

    process.exit(0);
  } catch (error) {
    console.error("✗ Failed to add test customer:", error.message);
    process.exit(1);
  }
}

main();
