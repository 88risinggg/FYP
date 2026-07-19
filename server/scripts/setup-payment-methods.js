require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { pool } = require("../src/config/db");

async function setup() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payment_method (
        payment_method_id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description VARCHAR(255) NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("payment_method table created.");

    const methods = [
      ["Cash", "Cash payments"],
      ["Credit Card", "Credit/Debit card payments"],
      ["Bank Transfer", "Bank transfer payments"],
      ["PayNow", "Singapore PayNow QR payments"],
      ["Stripe", "Stripe online payments"],
      ["GrabPay", "GrabPay mobile payments"],
      ["Apple Pay", "Apple Pay contactless"],
      ["Google Pay", "Google Pay contactless"]
    ];

    for (const [name, desc] of methods) {
      try {
        await pool.query(
          "INSERT INTO payment_method (name, description, is_active) VALUES (?, ?, 1)",
          [name, desc]
        );
        console.log(`  + ${name}`);
      } catch (e) {
        if (e.code === "ER_DUP_ENTRY") {
          console.log(`  (exists) ${name}`);
        } else {
          console.log(`  ! ${name}: ${e.message}`);
        }
      }
    }

    const [rows] = await pool.query("SELECT * FROM payment_method ORDER BY payment_method_id");
    console.log(`\nPayment methods (${rows.length}):`);
    rows.forEach(r => console.log(`  ${r.payment_method_id}. ${r.name}`));
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    await pool.end();
  }
}

setup();
