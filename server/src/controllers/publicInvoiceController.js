/**
 * Public Invoice Controller
 *
 * Handles customer-facing invoice viewing (no authentication required).
 * When a customer opens their invoice link, the status is updated to "Viewed"
 * if it was previously "Sent". Tracks view events in the activity log.
 * Auto-generates Stripe session + QR code on-the-fly if not already stored.
 */

const { pool } = require("../config/db");
const { notifyCustomerViewed } = require("../services/invoiceNotificationService");
const { generateQRCode } = require("../services/qrCodeService");

/**
 * GET /api/public/invoice/:invoiceId
 */
async function viewInvoice(req, res) {
  const { invoiceId } = req.params;

  if (!invoiceId) {
    return res.status(400).json({ message: "Invoice ID is required." });
  }

  try {
    // Safely select columns — fall back if payment columns don't exist
    let rows;
    try {
      [rows] = await pool.query(
        `SELECT
          i.invoice_id, i.invoiceId, i.status,
          i.issue_date, i.due_date, i.total_amount,
          i.payment_url, i.qr_code_url, i.created_at,
          c.name AS customer_name, c.email AS customer_email, c.address AS customer_address
        FROM invoice i
        INNER JOIN customer c ON c.customer_id = i.customer_id
        WHERE i.invoiceId = ? LIMIT 1`,
        [invoiceId]
      );
    } catch (colErr) {
      // Columns may not exist yet — retry without them
      [rows] = await pool.query(
        `SELECT
          i.invoice_id, i.invoiceId, i.status,
          i.issue_date, i.due_date, i.total_amount,
          NULL AS payment_url, NULL AS qr_code_url, i.created_at,
          c.name AS customer_name, c.email AS customer_email, c.address AS customer_address
        FROM invoice i
        INNER JOIN customer c ON c.customer_id = i.customer_id
        WHERE i.invoiceId = ? LIMIT 1`,
        [invoiceId]
      );
    }

    if (rows.length === 0) {
      return res.status(404).json({ message: "Invoice not found." });
    }

    const invoice = rows[0];

    // Block access to Draft or Cancelled invoices
    if (invoice.status === "Draft" || invoice.status === "Cancelled") {
      return res.status(403).json({ message: "This invoice is not available for viewing." });
    }

    // Fetch line items
    const [items] = await pool.query(
      "SELECT description, quantity, unit_price, amount FROM invoice_item WHERE invoice_invoice_id = ?",
      [invoice.invoice_id]
    );
    invoice.items = items;

    const isPayable = !["Paid", "Cancelled", "Refunded"].includes(invoice.status);

    // Generate a real Stripe Checkout URL if:
    // - Invoice is payable AND
    // - No payment_url stored, OR stored URL is a placeholder/expired
    const isPlaceholderUrl = invoice.payment_url && (
      invoice.payment_url.includes("cs_test_sent_") ||
      invoice.payment_url.includes("cs_test_viewed_") ||
      invoice.payment_url.includes("cs_test_overdue_") ||
      invoice.payment_url.includes("cs_test_paid_")
    );

    if (isPayable && (!invoice.payment_url || isPlaceholderUrl)) {
      try {
        const { createCheckoutSession } = require("../services/stripeService");
        const stripeResult = await createCheckoutSession({
          invoice_id: invoice.invoice_id,
          invoiceId: invoice.invoiceId,
          total_amount: invoice.total_amount,
          customer_email: invoice.customer_email
        });
        invoice.payment_url = stripeResult.paymentUrl;

        // Persist it so subsequent views don't regenerate
        try {
          await pool.query(
            "UPDATE invoice SET payment_url = ?, stripe_session_id = ? WHERE invoice_id = ?",
            [stripeResult.paymentUrl, stripeResult.sessionId, invoice.invoice_id]
          );
        } catch { /* non-critical if columns missing */ }
      } catch (stripeErr) {
        console.error("[PUBLIC VIEW] Stripe session generation failed:", stripeErr.message);
      }
    }

    // Generate Stripe QR code from payment_url
    let qrCodeDataUri = null;
    if (isPayable && invoice.payment_url) {
      try {
        qrCodeDataUri = await generateQRCode(invoice.payment_url);
      } catch (qrErr) {
        console.error("[PUBLIC VIEW] QR code generation failed:", qrErr.message);
      }
    }

    // Capture view tracking data
    const userAgent = (req.headers["user-agent"] || "").substring(0, 512);
    const ipAddress = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";

    // Update status to "Viewed" on first access
    if (invoice.status === "Sent") {
      await pool.query(
        "UPDATE invoice SET status = 'Viewed' WHERE invoice_id = ? AND status = 'Sent'",
        [invoice.invoice_id]
      );
      invoice.status = "Viewed";

      try {
        await pool.query(
          "INSERT INTO audit_log (action, entity_type, entity_id, user_user_id) VALUES (?, 'invoice', ?, NULL)",
          ["invoice_status:Viewed", invoice.invoice_id]
        );
      } catch { /* non-critical */ }

      notifyCustomerViewed(invoice.invoiceId, invoice.customer_name).catch(() => {});
    }

    // Always record the view event
    try {
      await pool.query(
        "INSERT INTO audit_log (action, entity_type, entity_id, user_user_id) VALUES (?, 'invoice', ?, NULL)",
        [`customer_viewed|ip:${ipAddress}|ua:${userAgent.substring(0, 100)}`, invoice.invoice_id]
      );
    } catch { /* non-critical */ }

    res.json({
      invoice: {
        invoiceId: invoice.invoiceId,
        status: invoice.status,
        issue_date: invoice.issue_date,
        due_date: invoice.due_date,
        total_amount: invoice.total_amount,
        customer_name: invoice.customer_name,
        customer_email: invoice.customer_email,
        customer_address: invoice.customer_address,
        items: invoice.items,
        payment_url: isPayable ? invoice.payment_url : null,
        qr_code: isPayable ? qrCodeDataUri : null,
        is_paid: invoice.status === "Paid",
        paid_date: invoice.status === "Paid" ? (invoice.payment_date || null) : null
      }
    });
  } catch (error) {
    console.error("[PUBLIC VIEW]", error.message);
    res.status(500).json({
      message: "Unable to load invoice.",
      detail: error.message
    });
  }
}

module.exports = { viewInvoice };
