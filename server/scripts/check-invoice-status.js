require("dotenv").config();
const { pool } = require("../src/config/db");

async function check() {
  const [rows] = await pool.query(
    `SELECT i.invoice_id, i.invoiceId, i.status, i.payment_status, i.payment_method,
            i.payment_date, i.transaction_id, i.stripe_session_id
     FROM invoice i WHERE i.invoiceId = 'INV-000031' LIMIT 1`
  );

  if (rows.length === 0) {
    console.log("Invoice INV-000031 not found.");
  } else {
    console.log("Invoice INV-000031 status:");
    console.log(JSON.stringify(rows[0], null, 2));
  }

  // Check payments table
  const [payments] = await pool.query(
    `SELECT p.* FROM payment p
     INNER JOIN invoice i ON i.invoice_id = p.invoice_invoice_id
     WHERE i.invoiceId = 'INV-000031'`
  );
  console.log("\nPayment records:", payments.length);
  if (payments.length > 0) console.log(JSON.stringify(payments, null, 2));

  await pool.end();
}

check().catch(e => { console.error(e.message); process.exit(1); });
