/**
 * Payment Controller
 *
 * Uses payment_method_name column (no separate payment_method table).
 * Fraud checks use invoice.risk_level and invoice.review_status columns.
 */

const { pool } = require("../config/db");
const { settleInvoiceFromConfirmedPayments } = require("../services/invoicePaymentSettlementService");
const { calculateInvoiceLateFee, getInvoiceSettings } = require("../models/invoiceSettingsModel");

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
      "SELECT invoice_id, total_amount FROM invoice WHERE invoice_id = ? LIMIT 1 FOR UPDATE",
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
    await connection.query(
      "UPDATE invoice SET payment_date = NOW(), transaction_id = ? WHERE invoice_id = ?",
      [transactionId, invoiceId]
    );
    await connection.commit();

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
      `SELECT i.invoice_id, i.invoiceId, i.total_amount, i.status, i.payment_url, c.email
       FROM invoice i INNER JOIN customer c ON c.customer_id = i.customer_id
       WHERE i.invoice_id = ? LIMIT 1`,
      [invoiceId]
    );
    if (rows.length === 0) return res.status(404).json({ message: "Invoice not found." });

    const invoice = rows[0];
    const paymentCheck = await ensureInvoiceCanBePaid(pool, invoiceId);
    if (!paymentCheck.allowed) return res.status(400).json({ message: paymentCheck.message });
    const settings = await getInvoiceSettings();
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

    const { createCheckoutSession } = require("../services/stripeService");
    const result = await createCheckoutSession({
      invoice_id: invoice.invoice_id,
      invoiceId: invoice.invoiceId,
      total_amount: payableAmount,
      customer_email: invoice.email
    });

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

      // WhatsApp notification: Payment Received (non-blocking)
      (async () => {
        try {
          const whatsappModel = require("../models/whatsappNotificationModel");
          const settings = await whatsappModel.getSettings();
          if (settings?.whatsapp_enabled && settings?.send_payment_received) {
            const [custRows] = await pool.query(
              `SELECT c.customer_id, c.whatsapp_number FROM customer c
               INNER JOIN invoice i ON i.customer_id = c.customer_id
               WHERE i.invoice_id = ? LIMIT 1`,
              [invoice.invoice_id]
            );
            const cust = custRows[0];
            if (cust?.whatsapp_number) {
              const { sendPaymentReceived } = require("../services/whatsappService");
              await sendPaymentReceived({
                phone: cust.whatsapp_number,
                invoiceNumber: invoiceId,
                amount: payAmount,
                customerId: cust.customer_id,
                invoiceId: invoice.invoice_id
              });
            }
          }
        } catch (whatsappErr) {
          console.error("[WHATSAPP] Payment received notification failed:", whatsappErr.message);
        }
      })();

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
 */
async function stripeWebhook(req, res) {
  const { verifyWebhookEvent } = require("../services/stripeService");

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

  try {
    if (eventType === "checkout.session.completed") {
      const session = event.data?.object || event;
      const invoiceId = Number(session.metadata?.invoice_id);
      const amount = session.amount_total ? session.amount_total / 100 : 0;
      const transactionId = session.payment_intent || session.id || `STRIPE-${Date.now()}`;

      if (!invoiceId) return res.status(400).json({ message: "Missing invoice_id in metadata." });

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [invRows] = await connection.query("SELECT invoice_id, status, total_amount FROM invoice WHERE invoice_id = ? LIMIT 1", [invoiceId]);
        if (invRows.length === 0) { await connection.rollback(); return res.status(404).json({ message: "Invoice not found." }); }
        if (invRows[0].status === "Paid") { await connection.rollback(); return res.json({ received: true, message: "Already paid." }); }

        const payAmount = amount || Number(invRows[0].total_amount);
        await connection.query(
          `INSERT INTO payment (payment_date, amount, status, transaction_id, invoice_invoice_id, payment_method_name)
           VALUES (NOW(), ?, 'Completed', ?, ?, 'Stripe')`,
          [String(payAmount), transactionId, invoiceId]
        );
        await connection.query(
          "UPDATE invoice SET status = 'Paid', payment_status = 'paid', payment_method = 'card', payment_date = NOW(), transaction_id = ? WHERE invoice_id = ?",
          [transactionId, invoiceId]
        );
        await connection.commit();

        // Notify Finance about Stripe payment (non-blocking)
        try {
          const [invInfo] = await pool.query(
            `SELECT i.invoiceId, c.name AS customer_name FROM invoice i INNER JOIN customer c ON c.customer_id = i.customer_id WHERE i.invoice_id = ?`,
            [invoiceId]
          );
          if (invInfo.length > 0) {
            const { notifyPaymentSuccess } = require("../services/invoiceNotificationService");
            notifyPaymentSuccess(invInfo[0].invoiceId, invInfo[0].customer_name, payAmount).catch(() => {});
          }
        } catch { /* non-blocking */ }

        // WhatsApp notification: Payment Received via webhook (non-blocking)
        (async () => {
          try {
            const whatsappModel = require("../models/whatsappNotificationModel");
            const settings = await whatsappModel.getSettings();
            if (settings?.whatsapp_enabled && settings?.send_payment_received) {
              const [custRows] = await pool.query(
                `SELECT c.customer_id, c.whatsapp_number, i.invoiceId AS invoice_number
                 FROM customer c INNER JOIN invoice i ON i.customer_id = c.customer_id
                 WHERE i.invoice_id = ? LIMIT 1`,
                [invoiceId]
              );
              const cust = custRows[0];
              if (cust?.whatsapp_number) {
                const { sendPaymentReceived } = require("../services/whatsappService");
                await sendPaymentReceived({
                  phone: cust.whatsapp_number,
                  invoiceNumber: cust.invoice_number,
                  amount: payAmount,
                  customerId: cust.customer_id,
                  invoiceId: invoiceId
                });
              }
            }
          } catch (whatsappErr) {
            console.error("[WHATSAPP] Webhook payment notification failed:", whatsappErr.message);
          }
        })();
      } catch (dbErr) { await connection.rollback(); throw dbErr; }
      finally { connection.release(); }
    }

    res.json({ received: true });
  } catch (error) {
    res.status(500).json({ message: "Webhook processing failed.", detail: error.message });
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
