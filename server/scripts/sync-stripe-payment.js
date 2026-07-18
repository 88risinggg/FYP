/**
 * Check Stripe session status and sync payment to database.
 * Use this when webhooks can't reach localhost.
 */
require("dotenv").config();
const { pool } = require("../src/config/db");

async function syncPayment() {
  const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

  // Get the invoice
  const [rows] = await pool.query(
    "SELECT invoice_id, invoiceId, status, stripe_session_id, total_amount FROM invoice WHERE invoiceId = 'INV-000031' LIMIT 1"
  );

  if (rows.length === 0) {
    console.log("Invoice not found.");
    await pool.end();
    return;
  }

  const invoice = rows[0];
  console.log(`[SYNC] Checking Stripe session: ${invoice.stripe_session_id}\n`);

  // Retrieve session from Stripe
  const session = await stripe.checkout.sessions.retrieve(invoice.stripe_session_id, {
    expand: ["payment_intent"]
  });

  console.log(`[SYNC] Session status: ${session.status}`);
  console.log(`[SYNC] Payment status: ${session.payment_status}`);

  if (session.payment_status === "paid") {
    const transactionId = session.payment_intent?.id || session.id;
    const paymentMethod = session.payment_method_types?.[0] || "card";

    console.log(`[SYNC] ✓ Payment confirmed!`);
    console.log(`[SYNC]   Transaction: ${transactionId}`);
    console.log(`[SYNC]   Method: ${paymentMethod}`);
    console.log(`[SYNC]   Amount: ${session.amount_total / 100} ${session.currency?.toUpperCase()}`);

    // Update invoice
    await pool.query(
      `UPDATE invoice SET
        status = 'Paid',
        payment_status = 'paid',
        payment_method = ?,
        payment_date = NOW(),
        transaction_id = ?,
        payment_intent_id = ?
      WHERE invoice_id = ?`,
      [paymentMethod, transactionId, transactionId, invoice.invoice_id]
    );

    // Create payment record
    const [methodRows] = await pool.query(
      "SELECT payment_method_id FROM payment_method WHERE name = 'Stripe' LIMIT 1"
    );
    let methodId = methodRows[0]?.payment_method_id;
    if (!methodId) {
      const [r] = await pool.query("INSERT INTO payment_method (name, description, is_active) VALUES ('Stripe', 'Stripe payments', 1)");
      methodId = r.insertId;
    }

    await pool.query(
      `INSERT INTO payment (payment_date, amount, status, transaction_id, invoice_invoice_id, payment_method_id)
       VALUES (NOW(), ?, 'Completed', ?, ?, ?)`,
      [String(invoice.total_amount), transactionId, invoice.invoice_id, methodId]
    );

    // Audit log
    await pool.query(
      "INSERT INTO audit_log (action, entity_type, entity_id, user_user_id) VALUES ('invoice_status:Paid', 'invoice', ?, NULL)",
      [invoice.invoice_id]
    );

    console.log(`\n[SYNC] ✓ Invoice INV-000031 updated to PAID!`);
  } else if (session.status === "expired") {
    console.log("[SYNC] Session expired — customer didn't complete payment.");
  } else {
    console.log(`[SYNC] Session not yet paid. Status: ${session.status}, Payment: ${session.payment_status}`);
  }

  await pool.end();
}

syncPayment().catch(e => { console.error("Error:", e.message); process.exit(1); });
