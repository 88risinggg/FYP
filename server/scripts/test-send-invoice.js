/**
 * Test: Create and send an invoice to a specific customer email.
 * Usage: node scripts/test-send-invoice.js
 */

require("dotenv").config();
const { pool } = require("../src/config/db");

async function testSendInvoice() {
  const customerEmail = "arut1657@gmail.com";
  const customerName = "Arut (Test Customer)";

  console.log(`[TEST] Creating test invoice for ${customerName} <${customerEmail}>...\n`);

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Ensure customer exists
    let customerId;
    const [existing] = await connection.query(
      "SELECT customer_id FROM customer WHERE email = ? LIMIT 1",
      [customerEmail]
    );

    if (existing.length > 0) {
      customerId = existing[0].customer_id;
    } else {
      const [result] = await connection.query(
        "INSERT INTO customer (name, email, address, created_at) VALUES (?, ?, ?, NOW())",
        [customerName, customerEmail, "Singapore"]
      );
      customerId = result.insertId;
    }

    // Get next invoice number
    const [lastInv] = await connection.query(
      "SELECT invoiceId FROM invoice WHERE invoiceId LIKE 'INV-%' ORDER BY invoice_id DESC LIMIT 1 FOR UPDATE"
    );
    const lastNum = lastInv[0]?.invoiceId?.match(/INV-(\d+)/)?.[1] || "0";
    const nextNum = Number(lastNum) + 1;
    const invoiceId = `INV-${String(nextNum).padStart(6, "0")}`;

    // Create invoice
    const issueDate = new Date().toISOString().split("T")[0];
    const dueDate = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
    const totalAmount = 150.00;

    const [invoiceResult] = await connection.query(
      `INSERT INTO invoice (status, issue_date, due_date, invoiceId, total_amount, customer_id, created_at)
       VALUES ('Draft', ?, ?, ?, ?, ?, NOW())`,
      [issueDate, dueDate, invoiceId, totalAmount, customerId]
    );
    const invoicePk = invoiceResult.insertId;

    // Add line items
    await connection.query(
      "INSERT INTO invoice_item (description, quantity, unit_price, amount, invoice_invoice_id) VALUES ?",
      [[[
        "Stripe Integration Test Service", 1, 100.00, 100.00, invoicePk
      ], [
        "QR Code Payment Verification", 1, 50.00, 50.00, invoicePk
      ]]]
    );

    // Audit log
    await connection.query(
      "INSERT INTO audit_log (action, entity_type, entity_id, user_user_id) VALUES ('invoice_status:Draft', 'invoice', ?, NULL)",
      [invoicePk]
    );

    await connection.commit();
    console.log(`[TEST] ✓ Invoice created: ${invoiceId} (ID: ${invoicePk})`);
    console.log(`[TEST]   Amount: SGD ${totalAmount}`);
    console.log(`[TEST]   Due: ${dueDate}\n`);

    // Now send the invoice (creates Stripe session + email)
    console.log("[TEST] Sending invoice (Stripe session + email)...\n");

    const { createCheckoutSession } = require("../src/services/stripeService");
    const { generateQRCode } = require("../src/services/qrCodeService");
    const { sendInvoiceEmail } = require("../src/services/invoiceDeliveryService");
    const { generateInvoicePDF } = require("../src/services/pdfService");

    const invoice = {
      invoice_id: invoicePk,
      invoiceId: invoiceId,
      status: "Sent",
      total_amount: totalAmount,
      due_date: dueDate,
      issue_date: issueDate,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_address: "Singapore",
      items: [
        { description: "Stripe Integration Test Service", quantity: 1, unit_price: 100.00, amount: 100.00 },
        { description: "QR Code Payment Verification", quantity: 1, unit_price: 50.00, amount: 50.00 }
      ]
    };

    // Create Stripe Checkout Session
    const stripeResult = await createCheckoutSession(invoice);
    console.log(`[TEST] ✓ Stripe session: ${stripeResult.sessionId}`);
    console.log(`[TEST] ✓ Payment URL: ${stripeResult.paymentUrl}`);

    // Generate QR code
    const qrCodeDataUri = await generateQRCode(stripeResult.paymentUrl);
    console.log(`[TEST] ✓ QR code generated (${qrCodeDataUri ? qrCodeDataUri.length : 0} chars)`);

    // Store in DB
    await pool.query(
      "UPDATE invoice SET status = 'Sent', payment_url = ?, qr_code_url = ?, stripe_session_id = ? WHERE invoice_id = ?",
      [stripeResult.paymentUrl, qrCodeDataUri, stripeResult.sessionId, invoicePk]
    );

    // Generate PDF
    let pdfBuffer = null;
    try {
      pdfBuffer = await generateInvoicePDF(invoice, { paymentUrl: stripeResult.paymentUrl, qrCodeDataUri });
      console.log(`[TEST] ✓ PDF generated (${pdfBuffer.length} bytes)`);
    } catch (e) {
      console.log(`[TEST] ⚠ PDF generation skipped: ${e.message}`);
    }

    // Send email
    const emailResult = await sendInvoiceEmail(invoice, {
      pdfBuffer,
      paymentUrl: stripeResult.paymentUrl,
      qrCodeDataUri
    });
    console.log(`[TEST] ✓ Email sent via ${emailResult.provider}`);

    // Update audit log
    await pool.query(
      "INSERT INTO audit_log (action, entity_type, entity_id, user_user_id) VALUES ('invoice_status:Sent', 'invoice', ?, NULL)",
      [invoicePk]
    );

    console.log("\n═══════════════════════════════════════════════");
    console.log("  TEST INVOICE SENT SUCCESSFULLY!");
    console.log("═══════════════════════════════════════════════");
    console.log(`  Invoice:     ${invoiceId}`);
    console.log(`  Amount:      SGD ${totalAmount}`);
    console.log(`  Email:       ${customerEmail}`);
    console.log(`  Payment URL: ${stripeResult.paymentUrl}`);
    console.log(`  View URL:    http://localhost:5173/invoice/view/${invoiceId}`);
    console.log("═══════════════════════════════════════════════");
    console.log("\n  Use Stripe test card: 4242 4242 4242 4242");
    console.log("  Any future expiry, any CVC, any name.\n");

  } catch (error) {
    await connection.rollback();
    console.error("[TEST] ✗ Error:", error.message);
    if (error.stack) console.error(error.stack);
  } finally {
    connection.release();
    await pool.end();
  }
}

testSendInvoice();
