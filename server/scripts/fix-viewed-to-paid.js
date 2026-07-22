/**
 * One-time script: mark all Stripe-paid "Viewed" invoices as "Paid".
 * Runs a confirm check against the stored stripe_session_id.
 * If no Stripe key is configured, marks all Viewed invoices with a payment record as Paid.
 */
require("dotenv").config();
const { pool } = require("../src/config/db");

async function main() {
  // Find all invoices stuck in Viewed status that have a completed payment record
  const [invoices] = await pool.query(`
    SELECT i.invoice_id, i.invoiceId, i.status, i.stripe_session_id,
           i.total_amount, p.transaction_id, p.amount AS paid_amount
    FROM invoice i
    LEFT JOIN payment p ON p.invoice_invoice_id = i.invoice_id AND p.status = 'Completed'
    WHERE i.status = 'Viewed'
    ORDER BY i.invoice_id
  `);

  console.log(`Found ${invoices.length} invoice(s) with status 'Viewed'`);

  for (const inv of invoices) {
    if (inv.paid_amount) {
      // Has a completed payment — mark as Paid
      await pool.query(
        `UPDATE invoice SET status = 'Paid', payment_status = 'paid', payment_date = COALESCE(payment_date, NOW())
         WHERE invoice_id = ? AND status = 'Viewed'`,
        [inv.invoice_id]
      );
      console.log(`✅ ${inv.invoiceId} → Paid (had completed payment of ${inv.paid_amount})`);
    } else if (inv.stripe_session_id && process.env.STRIPE_SECRET_KEY) {
      // Check Stripe session
      try {
        const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
        const session = await stripe.checkout.sessions.retrieve(inv.stripe_session_id);
        if (session.payment_status === "paid") {
          const txId = session.payment_intent || inv.stripe_session_id;
          const amount = session.amount_total ? session.amount_total / 100 : Number(inv.total_amount);

          const conn = await pool.getConnection();
          await conn.beginTransaction();
          await conn.query(
            `INSERT INTO payment (payment_date, amount, status, transaction_id, invoice_invoice_id, payment_method_name)
             VALUES (NOW(), ?, 'Completed', ?, ?, 'Stripe')`,
            [String(amount), txId, inv.invoice_id]
          );
          await conn.query(
            `UPDATE invoice SET status = 'Paid', payment_status = 'paid', payment_method = 'card',
             payment_date = NOW(), transaction_id = ? WHERE invoice_id = ?`,
            [txId, inv.invoice_id]
          );
          await conn.commit();
          conn.release();
          console.log(`✅ ${inv.invoiceId} → Paid (confirmed via Stripe)`);
        } else {
          console.log(`⏭  ${inv.invoiceId} — Stripe session not paid (${session.payment_status}), skipping`);
        }
      } catch (err) {
        console.log(`⚠️  ${inv.invoiceId} — Stripe check failed: ${err.message}`);
      }
    } else {
      console.log(`⏭  ${inv.invoiceId} — no payment record and no Stripe key, skipping`);
    }
  }

  await pool.end();
  console.log("Done.");
}

main().catch((err) => { console.error(err); process.exit(1); });
