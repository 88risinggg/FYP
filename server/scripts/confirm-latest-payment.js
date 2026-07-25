/**
 * Manually confirm the latest Stripe payment that didn't update due to proxy issue.
 * Run: node scripts/confirm-latest-payment.js
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { pool } = require("../src/config/db");
const { retrieveSession } = require("../src/services/stripeService");

async function main() {
  // Get invoices that have stripe_session_id but are still "Sent"
  const [invoices] = await pool.query(
    `SELECT invoice_id, invoiceId, stripe_session_id, total_amount
     FROM invoice
     WHERE stripe_session_id IS NOT NULL AND status = 'Sent'
     ORDER BY invoice_id DESC`
  );

  if (invoices.length === 0) {
    console.log("No pending Stripe payments to confirm.");
    process.exit(0);
  }

  for (const inv of invoices) {
    try {
      const session = await retrieveSession(inv.stripe_session_id);
      if (session && session.payment_status === "paid") {
        const transactionId = session.payment_intent || inv.stripe_session_id;
        const payAmount = session.amount_total ? session.amount_total / 100 : Number(inv.total_amount);

        await pool.query(
          `INSERT INTO payment (payment_date, amount, status, transaction_id, invoice_invoice_id, payment_method_name)
           VALUES (NOW(), ?, 'Completed', ?, ?, 'Stripe')`,
          [String(payAmount), transactionId, inv.invoice_id]
        );

        await pool.query(
          `UPDATE invoice
           SET status = 'Paid', payment_status = 'paid', payment_method = 'card',
               payment_date = NOW(), transaction_id = ?
           WHERE invoice_id = ?`,
          [transactionId, inv.invoice_id]
        );

        console.log(`✓ ${inv.invoiceId} marked as Paid (amount: $${payAmount})`);
      } else {
        console.log(`  ${inv.invoiceId} — Stripe says not paid yet (status: ${session?.payment_status || "unknown"})`);
      }
    } catch (err) {
      console.error(`✗ ${inv.invoiceId} — Error: ${err.message}`);
    }
  }

  process.exit(0);
}

main();
