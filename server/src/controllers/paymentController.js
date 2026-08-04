/**
 * EVALUATION HEADER
 * FEATURE: INVOICE - SHARED
 * PURPOSE: Handles payment Controller API requests, validation, status codes, and responses.
 * LAYER: Backend controller - validates HTTP input and returns the API response.
 * FIND RELATED CODE: Follow service/model calls to find business rules and database work.
 */
/**
 * Payment Controller
 *
 * Uses payment_method_name column (no separate payment_method table).
 * Fraud checks use invoice.risk_level and invoice.review_status columns.
 */

const { pool } = require("../config/db");
const { settleInvoiceFromConfirmedPayments } = require("../services/invoicePaymentSettlementService");
const { calculateInvoiceLateFee, getInvoiceSettings } = require("../models/invoiceSettingsModel");
const { writeAuditLog, STATUS_AUDIT_PREFIX } = require("./invoiceController");

function toCurrencyNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Check if invoice can be paid (fraud gate).
 */
async function ensureInvoiceCanBePaid(connection, invoiceId) {
  const [rows] = await connection.query(
    "SELECT risk_level, review_status, status FROM invoice WHERE invoice_id = ? LIMIT 1",
    [invoiceId]
  );
  const invoice = rows[0];
  if (!invoice || ["Paid", "Void", "Cancelled", "Refunded"].includes(invoice.status)) {
    return { allowed: false, message: "This invoice is not available for payment." };
  }
  if (invoice?.risk_level === "High" && invoice.review_status !== "Approved") {
    return { allowed: false, message: "High-risk invoices require manual fraud review before payment processing." };
  }
  return { allowed: true };
}

/**
 * GET /api/payments
 */
async function getPaymentsWorkspace(req, res) {
  try {
    const settings = await getInvoiceSettings();
    const [outstandingInvoices] = await pool.query(`
      SELECT i.invoice_id, i.invoiceId, i.issue_date, i.due_date, i.total_amount,
             i.status AS database_status, c.name AS customer_name, c.email AS customer_email
      FROM invoice i
      INNER JOIN customer c ON c.customer_id = i.customer_id
      WHERE i.status NOT IN ('Paid', 'Void', 'Cancelled', 'Refunded')
      ORDER BY i.due_date ASC, i.invoice_id DESC
    `);

    const [payments] = await pool.query(`
      SELECT p.payment_id, p.payment_date, p.amount, p.status, p.transaction_id,
             p.invoice_invoice_id, p.payment_method_name AS payment_method,
             i.invoiceId, c.name AS customer_name
      FROM payment p
      LEFT JOIN invoice i ON i.invoice_id = p.invoice_invoice_id
      LEFT JOIN customer c ON c.customer_id = i.customer_id
      ORDER BY p.payment_date DESC, p.payment_id DESC
      LIMIT 25
    `);

    res.json({
      outstandingInvoices: outstandingInvoices.map((inv) => {
        const lateFee = calculateInvoiceLateFee({ ...inv, status: inv.database_status }, settings);
        return {
          ...inv,
          total_amount: toCurrencyNumber(inv.total_amount),
          late_fee_rate: lateFee.lateFeeRate,
          late_fee_amount: lateFee.lateFeeAmount,
          amount_due: lateFee.amountDue
        };
      }),
      payments
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load payment workspace.", detail: error.message });
  }
}

/**
 * POST /api/payments/manual
 */
async function recordManualPayment(req, res) {
  const invoiceId = Number(req.body.invoice_id);
  const amount = toCurrencyNumber(req.body.amount);
  const transactionId = String(req.body.transaction_id || "").trim() || `MANUAL-${Date.now()}`;

  if (!invoiceId || amount <= 0) {
    return res.status(400).json({ message: "Invoice and positive payment amount are required." });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [invoiceRows] = await connection.query(
      "SELECT invoice_id, total_amount, status FROM invoice WHERE invoice_id = ? LIMIT 1 FOR UPDATE",
      [invoiceId]
    );
    if (invoiceRows.length === 0) { await connection.rollback(); return res.status(404).json({ message: "Invoice not found." }); }

    const paymentCheck = await ensureInvoiceCanBePaid(connection, invoiceId);
    if (!paymentCheck.allowed) { await connection.rollback(); return res.status(400).json({ message: paymentCheck.message }); }

    await connection.query(
      `INSERT INTO payment (payment_date, amount, status, transaction_id, invoice_invoice_id, payment_method_name)
       VALUES (NOW(), ?, 'Completed', ?, ?, 'Bank Transfer')`,
      [String(amount), transactionId, invoiceId]
    );

    const settlement = await settleInvoiceFromConfirmedPayments(connection, invoiceId, "Sent");
    if (settlement?.status && settlement.status !== invoiceRows[0].status) {
      await writeAuditLog(connection, `${STATUS_AUDIT_PREFIX}${settlement.status}`, "invoice", invoiceId, req.user?.userId, {
        previousValue: invoiceRows[0].status,
        newValue: settlement.status
      });
    }
    await connection.query(
      "UPDATE invoice SET payment_date = NOW(), transaction_id = ? WHERE invoice_id = ?",
      [transactionId, invoiceId]
    );
    await connection.commit();

    // WhatsApp auto-trigger: Payment Received (non-blocking)
    if (settlement.status === "Paid") {
      const { onPaymentReceived } = require("../services/whatsappAutoTrigger");
      onPaymentReceived({ invoice_id: invoiceId, invoiceId: req.body.invoiceId || "", amount, customer_id: req.body.customer_id || null }).catch(() => {});
    }

    res.status(201).json({
      message: settlement.status === "Paid" ? "Manual payment recorded. Invoice paid in full." : "Partial payment recorded.",
      invoice_status: settlement.status,
      amount_paid: settlement.confirmedPaid,
      outstanding_amount: settlement.outstandingAmount
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ message: "Failed to record manual payment.", detail: error.message });
  } finally {
    connection.release();
  }
}

/**
 * POST /api/payments/stripe-link
 */
async function createStripePaymentLink(req, res) {
  const invoiceId = Number(req.body.invoice_id);
  if (!invoiceId) return res.status(400).json({ message: "Invoice is required." });

  try {
    const [rows] = await pool.query(
      `SELECT i.invoice_id, i.invoiceId, i.company_id, i.total_amount, i.status, i.payment_url, c.email
       FROM invoice i INNER JOIN customer c ON c.customer_id = i.customer_id
       WHERE i.invoice_id = ? LIMIT 1`,
      [invoiceId]
    );
    if (rows.length === 0) return res.status(404).json({ message: "Invoice not found." });

    const invoice = rows[0];
    const paymentCheck = await ensureInvoiceCanBePaid(pool, invoiceId);
    if (!paymentCheck.allowed) return res.status(400).json({ message: paymentCheck.message });
    const settings = await getInvoiceSettings(invoice.company_id || null);
    const lateFee = calculateInvoiceLateFee(invoice, settings);
    const payableAmount = lateFee.amountDue;

    // Reuse existing real Stripe URL — avoid creating a new session unnecessarily
    const existingUrl = invoice.payment_url;
    const isRealUrl = existingUrl && existingUrl.startsWith("https://checkout.stripe.com/c/pay/");
    if (isRealUrl && lateFee.lateFeeAmount <= 0) {
      return res.json({
        message: "Existing Stripe payment link returned.",
        invoice_id: invoice.invoice_id,
        invoiceId: invoice.invoiceId,
        paymentUrl: existingUrl,
        provider: "stripe"
      });
    }

    // Get customer details for Stripe Customer creation
    const [custRows] = await pool.query(
      "SELECT customer_id, name, email, stripe_customer_id FROM customer WHERE customer_id = (SELECT customer_id FROM invoice WHERE invoice_id = ? LIMIT 1)",
      [invoiceId]
    );
    const customer = custRows[0] || {};

    const { createCheckoutSession } = require("../services/stripeService");
    const result = await createCheckoutSession(
      {
        invoice_id: invoice.invoice_id,
        invoiceId: invoice.invoiceId,
        total_amount: payableAmount,
        customer_email: customer.email || invoice.email,
        currency: "sgd"
      },
      {
        customer_id: customer.customer_id,
        customer_name: customer.name,
        stripe_customer_id: customer.stripe_customer_id
      }
    );

    // Save stripe session to invoice
    await pool.query(
      "UPDATE invoice SET stripe_session_id = ?, payment_url = ? WHERE invoice_id = ?",
      [result.sessionId, result.paymentUrl, invoiceId]
    );

    res.json({
      message: "Stripe payment link generated.",
      invoice_id: invoice.invoice_id,
      invoiceId: invoice.invoiceId,
      paymentUrl: result.paymentUrl,
      sessionId: result.sessionId,
      provider: result.provider
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to create payment link.", detail: error.message });
  }
}

/**
 * POST /api/payments/stripe/confirm
 *
 * Called by the client success page to confirm a Stripe checkout session
 * and mark the invoice as Paid. This is a fallback for when the webhook
 * hasn't fired yet (e.g. local dev, demo mode, or webhook delay).
 *
 * Body: { invoiceId (string like "INV-000001"), session_id }
 */
async function confirmStripePayment(req, res) {
  const { invoiceId, session_id: sessionId } = req.body || {};

  if (!invoiceId) {
    return res.status(400).json({ message: "invoiceId is required." });
  }

  try {
    // Look up the invoice by string invoiceId
    const [rows] = await pool.query(
      `SELECT i.invoice_id, i.status, i.total_amount, i.stripe_session_id
       FROM invoice i WHERE i.invoiceId = ? LIMIT 1`,
      [invoiceId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Invoice not found." });
    }

    const invoice = rows[0];

    // Already paid — nothing to do
    if (invoice.status === "Paid") {
      return res.json({ status: "Paid", message: "Invoice is already marked as paid." });
    }

    // Try to verify with Stripe if we have a real key
    const { retrieveSession } = require("../services/stripeService");
    const sid = sessionId || invoice.stripe_session_id;
    let confirmedByStripe = false;
    let transactionId = `STRIPE-CONFIRM-${Date.now()}`;
    let payAmount = Number(invoice.total_amount);

    if (sid && process.env.STRIPE_SECRET_KEY) {
      try {
        const session = await retrieveSession(sid);
        if (session && session.payment_status === "paid") {
          confirmedByStripe = true;
          transactionId = session.payment_intent || sid;
          payAmount = session.amount_total ? session.amount_total / 100 : payAmount;
        } else if (session && session.payment_status !== "paid") {
          // Stripe says not paid
          return res.json({ status: invoice.status, message: "Payment not yet confirmed by Stripe." });
        }
      } catch (stripeErr) {
        console.error("[CONFIRM] Stripe session retrieval failed:", stripeErr.message);
        // Fall through — mark paid anyway based on success page redirect
      }
    } else {
      // No Stripe key (demo mode) or no session ID — trust the success redirect
      confirmedByStripe = true;
    }

    if (!confirmedByStripe) {
      return res.json({ status: invoice.status, message: "Unable to confirm payment." });
    }

    // Mark invoice as Paid
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Prevent double-processing
      const [lockRows] = await connection.query(
        "SELECT status FROM invoice WHERE invoice_id = ? FOR UPDATE",
        [invoice.invoice_id]
      );
      if (lockRows[0]?.status === "Paid") {
        await connection.rollback();
        return res.json({ status: "Paid", message: "Invoice already paid." });
      }

      // Insert payment record
      await connection.query(
        `INSERT INTO payment (payment_date, amount, status, transaction_id, invoice_invoice_id, payment_method_name)
         VALUES (NOW(), ?, 'Completed', ?, ?, 'Stripe')`,
        [String(payAmount), transactionId, invoice.invoice_id]
      );

      // Update invoice status
      await connection.query(
        `UPDATE invoice
         SET status = 'Paid', payment_status = 'paid', payment_method = 'card',
             payment_date = NOW(), transaction_id = ?
         WHERE invoice_id = ?`,
        [transactionId, invoice.invoice_id]
      );

      await connection.commit();

      // Notify Finance (non-blocking)
      try {
        const { notifyPaymentSuccess } = require("../services/invoiceNotificationService");
        notifyPaymentSuccess(invoiceId, null, payAmount).catch(() => {});
      } catch { /* non-blocking */ }

      // WhatsApp auto-trigger: Payment Received (non-blocking)
      const { onPaymentReceived } = require("../services/whatsappAutoTrigger");
      onPaymentReceived({ invoice_id: invoice.invoice_id, invoiceId, amount: payAmount, customer_id: null }).catch(() => {});

      res.json({ status: "Paid", message: "Invoice marked as paid.", amount: payAmount });
    } catch (dbErr) {
      await connection.rollback();
      throw dbErr;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("[CONFIRM PAYMENT]", error.message);
    res.status(500).json({ message: "Failed to confirm payment.", detail: error.message });
  }
}

/**
 * POST /api/payments/stripe/webhook
 *
 * Handles Stripe webhook events with:
 *   - Signature verification
 *   - Event idempotency (prevents duplicate processing)
 *   - checkout.session.completed → marks invoice Paid
 *   - checkout.session.expired → logs expiry
 *   - payment_intent.payment_failed → logs failure
 *   - charge.refunded → processes refund
 *   - Sends payment confirmation email and WhatsApp after successful payment
 */
async function stripeWebhook(req, res) {
  const {
    verifyWebhookEvent,
    findProcessedWebhookEvent,
    recordWebhookEvent,
    updateWebhookEventStatus
  } = require("../services/stripeService");

  // ─── 1. Verify webhook signature ─────────────────────────────────────────
  let event;
  try {
    const signature = req.headers["stripe-signature"] || "";
    const rawBody = req.rawBody || JSON.stringify(req.body);
    event = verifyWebhookEvent(rawBody, signature);
    if (!event) return res.status(400).json({ message: "Webhook verification failed." });
  } catch (error) {
    return res.status(400).json({ message: "Webhook signature verification failed." });
  }

  const eventType = event.type || "unknown";
  const eventId = event.id || `evt_unknown_${Date.now()}`;

  // ─── 2. Idempotency check ────────────────────────────────────────────────
  const existing = await findProcessedWebhookEvent(eventId);
  if (existing && existing.processing_status === "processed") {
    return res.json({ received: true, message: "Event already processed." });
  }
  await recordWebhookEvent(event);

  // ─── 3. Route event to handler ───────────────────────────────────────────
  try {
    if (eventType === "checkout.session.completed") {
      await handleCheckoutCompleted(event, eventId);
    } else if (eventType === "checkout.session.expired") {
      await handleCheckoutExpired(event, eventId);
    } else if (eventType === "payment_intent.payment_failed") {
      await handlePaymentFailed(event, eventId);
    } else if (eventType === "charge.refunded") {
      await handleChargeRefunded(event, eventId);
    } else {
      await updateWebhookEventStatus(eventId, "skipped");
    }

    res.json({ received: true });
  } catch (error) {
    await updateWebhookEventStatus(eventId, "failed", { errorMessage: error.message });
    res.status(500).json({ message: "Webhook processing failed." });
  }
}

/**
 * Handle checkout.session.completed — mark invoice as Paid atomically.
 */
async function handleCheckoutCompleted(event, eventId) {
  const { updateWebhookEventStatus } = require("../services/stripeService");
  const session = event.data?.object || {};
  const invoiceId = Number(session.metadata?.invoice_id);
  const amount = session.amount_total ? session.amount_total / 100 : 0;
  const transactionId = session.payment_intent || session.id || `STRIPE-${Date.now()}`;

  if (!invoiceId) {
    await updateWebhookEventStatus(eventId, "failed", { errorMessage: "Missing invoice_id in metadata" });
    return;
  }

  const connection = await pool.getConnection();
  let invoiceNumber = "";
  let customerId = null;
  let customerName = "";
  let payAmount = 0;

  try {
    await connection.beginTransaction();

    const [invRows] = await connection.query(
      "SELECT invoice_id, invoiceId, status, total_amount, customer_id FROM invoice WHERE invoice_id = ? LIMIT 1 FOR UPDATE",
      [invoiceId]
    );
    if (invRows.length === 0) {
      await connection.rollback();
      await updateWebhookEventStatus(eventId, "failed", { errorMessage: "Invoice not found", relatedInvoiceId: invoiceId });
      return;
    }

    const invoice = invRows[0];
    invoiceNumber = invoice.invoiceId;
    customerId = invoice.customer_id;

    if (invoice.status === "Paid") {
      await connection.rollback();
      await updateWebhookEventStatus(eventId, "skipped", { relatedInvoiceId: invoiceId });
      return;
    }

    payAmount = amount || Number(invoice.total_amount);

    // Insert payment record
    await connection.query(
      `INSERT INTO payment (payment_date, amount, status, transaction_id, invoice_invoice_id, payment_method_name)
       VALUES (NOW(), ?, 'Completed', ?, ?, 'Stripe')`,
      [String(payAmount), transactionId, invoiceId]
    );

    // Settle invoice using the proper settlement service
    const settlement = await settleInvoiceFromConfirmedPayments(connection, invoiceId, "Sent");

    // Also store transaction reference on invoice for quick lookup
    await connection.query(
      "UPDATE invoice SET payment_date = NOW(), transaction_id = ?, payment_method = 'card' WHERE invoice_id = ?",
      [transactionId, invoiceId]
    );

    await connection.commit();

    // Record webhook as processed
    await updateWebhookEventStatus(eventId, "processed", { relatedInvoiceId: invoiceId });

    // ─── Post-payment actions (non-blocking, must NOT reverse payment) ────
    // Get customer info for notifications
    try {
      const [custRows] = await pool.query(
        "SELECT name, email, whatsapp_number FROM customer WHERE customer_id = ?",
        [customerId]
      );
      if (custRows.length > 0) {
        customerName = custRows[0].name;

        // Send payment confirmation email (non-blocking)
        try {
          const { sendPaymentReceiptEmail } = require("../services/invoiceDeliveryService");
          sendPaymentReceiptEmail(
            { invoiceId: invoiceNumber, total_amount: payAmount, customer_email: custRows[0].email, customer_name: customerName, company_id: null },
            transactionId
          ).catch((err) => console.error("[WEBHOOK] Payment receipt email failed:", err.message));
        } catch { /* non-blocking */ }

        // Notify Finance in-app (non-blocking)
        try {
          const { notifyPaymentSuccess } = require("../services/invoiceNotificationService");
          notifyPaymentSuccess(invoiceNumber, customerName, payAmount).catch(() => {});
        } catch { /* non-blocking */ }

        // WhatsApp auto-trigger: Payment Received (non-blocking)
        try {
          const { onPaymentReceived } = require("../services/whatsappAutoTrigger");
          onPaymentReceived({
            invoice_id: invoiceId,
            invoiceId: invoiceNumber,
            amount: payAmount,
            customer_id: customerId
          }).catch(() => {});
        } catch { /* non-blocking */ }
      }
    } catch { /* non-blocking — payment is already committed */ }

  } catch (dbErr) {
    await connection.rollback();
    await updateWebhookEventStatus(eventId, "failed", { errorMessage: dbErr.message, relatedInvoiceId: invoiceId });
    throw dbErr;
  } finally {
    connection.release();
  }
}

/**
 * Handle checkout.session.expired — log the expiry, keep invoice unpaid.
 */
async function handleCheckoutExpired(event, eventId) {
  const { updateWebhookEventStatus } = require("../services/stripeService");
  const session = event.data?.object || {};
  const invoiceId = Number(session.metadata?.invoice_id);

  if (invoiceId) {
    // Clear the stored payment_url since the session expired
    try {
      await pool.query(
        "UPDATE invoice SET payment_url = NULL, stripe_session_id = NULL WHERE invoice_id = ? AND status != 'Paid'",
        [invoiceId]
      );
    } catch { /* non-critical */ }
  }

  await updateWebhookEventStatus(eventId, "processed", { relatedInvoiceId: invoiceId || null });
}

/**
 * Handle payment_intent.payment_failed — log failure, keep invoice unpaid.
 */
async function handlePaymentFailed(event, eventId) {
  const { updateWebhookEventStatus } = require("../services/stripeService");
  const paymentIntent = event.data?.object || {};
  const invoiceId = Number(paymentIntent.metadata?.invoice_id);
  const failureMessage = paymentIntent.last_payment_error?.message || "Payment failed";
  const failureCode = paymentIntent.last_payment_error?.code || "unknown";

  if (invoiceId) {
    // Record a failed payment attempt
    try {
      await pool.query(
        `INSERT INTO payment (payment_date, amount, status, transaction_id, invoice_invoice_id, payment_method_name)
         VALUES (NOW(), ?, 'Failed', ?, ?, 'Stripe')`,
        [String((paymentIntent.amount || 0) / 100), paymentIntent.id || `PI-FAILED-${Date.now()}`, invoiceId]
      );
    } catch { /* non-critical */ }

    // Notify Finance about the failure (non-blocking)
    try {
      const [invInfo] = await pool.query(
        "SELECT i.invoiceId, c.name AS customer_name FROM invoice i INNER JOIN customer c ON c.customer_id = i.customer_id WHERE i.invoice_id = ?",
        [invoiceId]
      );
      if (invInfo.length > 0) {
        const { notifyPaymentFailed } = require("../services/invoiceNotificationService");
        notifyPaymentFailed(invInfo[0].invoiceId, invInfo[0].customer_name).catch(() => {});
      }
    } catch { /* non-blocking */ }
  }

  await updateWebhookEventStatus(eventId, "processed", {
    relatedInvoiceId: invoiceId || null,
    errorMessage: `${failureCode}: ${failureMessage}`
  });
}

/**
 * Handle charge.refunded — update payment records and recalculate invoice status.
 */
async function handleChargeRefunded(event, eventId) {
  const { updateWebhookEventStatus } = require("../services/stripeService");
  const charge = event.data?.object || {};
  const paymentIntentId = charge.payment_intent;
  const refundAmount = (charge.amount_refunded || 0) / 100;

  if (!paymentIntentId) {
    await updateWebhookEventStatus(eventId, "skipped", { errorMessage: "No payment_intent on charge" });
    return;
  }

  // Find the original payment by transaction_id (which stores the payment_intent ID)
  const [paymentRows] = await pool.query(
    "SELECT payment_id, invoice_invoice_id, amount FROM payment WHERE transaction_id = ? AND status = 'Completed' LIMIT 1",
    [paymentIntentId]
  );

  if (paymentRows.length === 0) {
    await updateWebhookEventStatus(eventId, "skipped", { errorMessage: "Original payment not found" });
    return;
  }

  const originalPayment = paymentRows[0];
  const invoiceId = originalPayment.invoice_invoice_id;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Insert refund record
    await connection.query(
      `INSERT INTO payment (payment_date, amount, status, transaction_id, invoice_invoice_id, payment_method_name)
       VALUES (NOW(), ?, 'Refunded', ?, ?, 'Stripe')`,
      [String(refundAmount), `REFUND-${charge.id || Date.now()}`, invoiceId]
    );

    // Recalculate invoice status using settlement service
    await settleInvoiceFromConfirmedPayments(connection, invoiceId, "Sent");

    await connection.commit();

    // Notify Finance about refund (non-blocking)
    try {
      const [invInfo] = await pool.query(
        "SELECT i.invoiceId, c.name AS customer_name FROM invoice i INNER JOIN customer c ON c.customer_id = i.customer_id WHERE i.invoice_id = ?",
        [invoiceId]
      );
      if (invInfo.length > 0) {
        const { notifyPaymentRefunded } = require("../services/invoiceNotificationService");
        notifyPaymentRefunded(invInfo[0].invoiceId, invInfo[0].customer_name).catch(() => {});
      }
    } catch { /* non-blocking */ }

    await updateWebhookEventStatus(eventId, "processed", { relatedInvoiceId: invoiceId });
  } catch (dbErr) {
    await connection.rollback();
    await updateWebhookEventStatus(eventId, "failed", { errorMessage: dbErr.message, relatedInvoiceId: invoiceId });
    throw dbErr;
  } finally {
    connection.release();
  }
}

/**
 * GET /api/payments/history/:invoiceId
 */
async function getPaymentHistory(req, res) {
  const invoiceId = Number(req.params.invoiceId);
  if (!invoiceId) return res.status(400).json({ message: "Invoice ID is required." });

  try {
    const [payments] = await pool.query(`
      SELECT payment_id, payment_date, amount, status, transaction_id, payment_method_name AS payment_method
      FROM payment WHERE invoice_invoice_id = ?
      ORDER BY payment_date DESC
    `, [invoiceId]);

    res.json({ payments });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch payment history.", detail: error.message });
  }
}

/**
 * POST /api/payments/paynow-qr
 *
 * Generate a PayNow QR code for a specific invoice.
 * Uses the configured UEN from invoice_settings or environment variables.
 *
 * Body: { invoice_id }
 * Returns: { qrCodeDataUri, paynowReference, proxyValue, amount }
 */
async function generatePayNowQR(req, res) {
  const invoiceId = Number(req.body.invoice_id);
  if (!invoiceId) return res.status(400).json({ message: "Invoice ID is required." });

  try {
    const [rows] = await pool.query(
      `SELECT i.invoice_id, i.invoiceId, i.total_amount, i.status, c.name AS customer_name
       FROM invoice i INNER JOIN customer c ON c.customer_id = i.customer_id
       WHERE i.invoice_id = ? LIMIT 1`,
      [invoiceId]
    );
    if (rows.length === 0) return res.status(404).json({ message: "Invoice not found." });

    const invoice = rows[0];
    if (["Paid", "Cancelled", "Refunded", "Void"].includes(invoice.status)) {
      return res.status(400).json({ message: "This invoice is not available for payment." });
    }

    const { generatePayNowQRCode } = require("../services/qrCodeService");
    const qrCodeDataUri = await generatePayNowQRCode(invoice);

    if (!qrCodeDataUri) {
      return res.status(400).json({ message: "PayNow UEN not configured. Set PAYNOW_UEN in server environment." });
    }

    // Store the QR code on the invoice for future reference
    await pool.query(
      "UPDATE invoice SET paynow_qr_data = ?, paynow_reference = ? WHERE invoice_id = ?",
      [qrCodeDataUri, invoice.invoiceId, invoiceId]
    );

    res.json({
      message: "PayNow QR code generated.",
      invoice_id: invoice.invoice_id,
      invoiceId: invoice.invoiceId,
      qrCodeDataUri,
      paynowReference: invoice.invoiceId,
      proxyValue: process.env.PAYNOW_UEN || "",
      amount: Number(invoice.total_amount),
      provider: "paynow"
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to generate PayNow QR code.", detail: error.message });
  }
}

/**
 * POST /api/payments/paynow-confirm
 *
 * Manually confirm a PayNow payment received for an invoice.
 * Used by Finance staff to mark a PayNow transfer as received after
 * verifying the transaction in the bank statement.
 *
 * Body: { invoice_id, transaction_id (optional), amount (optional), notes (optional) }
 */
async function confirmPayNowPayment(req, res) {
  const invoiceId = Number(req.body.invoice_id);
  const transactionId = String(req.body.transaction_id || "").trim() || `PAYNOW-${Date.now()}`;
  const notes = req.body.notes || "";

  if (!invoiceId) {
    return res.status(400).json({ message: "Invoice ID is required." });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [invoiceRows] = await connection.query(
      "SELECT invoice_id, total_amount, status FROM invoice WHERE invoice_id = ? LIMIT 1 FOR UPDATE",
      [invoiceId]
    );
    if (invoiceRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Invoice not found." });
    }

    const invoice = invoiceRows[0];
    if (["Paid", "Cancelled", "Refunded", "Void"].includes(invoice.status)) {
      await connection.rollback();
      return res.status(400).json({ message: "This invoice is not available for payment." });
    }

    const paymentCheck = await ensureInvoiceCanBePaid(connection, invoiceId);
    if (!paymentCheck.allowed) {
      await connection.rollback();
      return res.status(400).json({ message: paymentCheck.message });
    }

    const amount = req.body.amount ? Number(req.body.amount) : Number(invoice.total_amount);

    await connection.query(
      `INSERT INTO payment (payment_date, amount, status, transaction_id, invoice_invoice_id, payment_method_name)
       VALUES (NOW(), ?, 'Completed', ?, ?, 'PayNow')`,
      [String(amount), transactionId, invoiceId]
    );

    const { settleInvoiceFromConfirmedPayments } = require("../services/invoicePaymentSettlementService");
    const settlement = await settleInvoiceFromConfirmedPayments(connection, invoiceId, invoice.status);
    if (settlement?.status && settlement.status !== invoice.status) {
      await writeAuditLog(connection, `${STATUS_AUDIT_PREFIX}${settlement.status}`, "invoice", invoiceId, req.user?.userId, {
        previousValue: invoice.status,
        newValue: settlement.status
      });
    }

    await connection.query(
      "UPDATE invoice SET payment_date = NOW(), transaction_id = ?, payment_method = 'PayNow' WHERE invoice_id = ?",
      [transactionId, invoiceId]
    );

    await connection.commit();

    res.status(201).json({
      message: settlement.status === "Paid" ? "PayNow payment confirmed. Invoice marked as paid." : "PayNow partial payment recorded.",
      invoice_status: settlement.status,
      amount_paid: settlement.confirmedPaid,
      outstanding_amount: settlement.outstandingAmount,
      transaction_id: transactionId,
      provider: "paynow"
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ message: "Failed to confirm PayNow payment.", detail: error.message });
  } finally {
    connection.release();
  }
}

module.exports = {
  confirmPayNowPayment,
  confirmStripePayment,
  createStripePaymentLink,
  generatePayNowQR,
  getPaymentHistory,
  getPaymentsWorkspace,
  recordManualPayment,
  stripeWebhook
};
