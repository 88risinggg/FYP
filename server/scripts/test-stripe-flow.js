/**
 * Test Stripe integration end-to-end.
 * Creates a checkout session for the first unpaid invoice.
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { pool } = require("../src/config/db");
const { createCheckoutSession } = require("../src/services/stripeService");

async function test() {
  try {
    // Find an unpaid invoice
    const [invoices] = await pool.query(`
      SELECT i.invoice_id, i.invoiceId, i.total_amount, i.status,
             c.name AS customer_name, c.email AS customer_email
      FROM invoice i
      INNER JOIN customer c ON c.customer_id = i.customer_id
      WHERE i.status != 'Paid'
      ORDER BY i.invoice_id
      LIMIT 1
    `);

    if (invoices.length === 0) {
      console.log("No unpaid invoices found.");
      await pool.end();
      return;
    }

    const invoice = invoices[0];
    console.log("Invoice:", invoice.invoiceId);
    console.log("Customer:", invoice.customer_name, `<${invoice.customer_email}>`);
    console.log("Amount: SGD", Number(invoice.total_amount).toFixed(2));
    console.log("Status:", invoice.status);
    console.log("");

    // Create Stripe Checkout session
    const result = await createCheckoutSession({
      invoice_id: invoice.invoice_id,
      invoiceId: invoice.invoiceId,
      total_amount: invoice.total_amount,
      customer_email: invoice.customer_email
    });

    console.log("--- Stripe Checkout Session ---");
    console.log("Provider:", result.provider);
    console.log("Session ID:", result.sessionId);
    console.log("Payment URL:", result.paymentUrl);
    console.log("");

    // Update invoice with stripe session
    await pool.query(
      "UPDATE invoice SET stripe_session_id = ?, payment_url = ? WHERE invoice_id = ?",
      [result.sessionId, result.paymentUrl, invoice.invoice_id]
    );
    console.log("Invoice updated with Stripe session data.");
    console.log("\nStripe integration is working correctly!");
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    await pool.end();
  }
}

test();
