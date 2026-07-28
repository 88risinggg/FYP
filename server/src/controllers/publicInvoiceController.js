/**
 * Public Invoice Controller
 *
 * Handles customer-facing invoice viewing (no authentication required).
 * When a customer opens their invoice link, the status is updated to "Viewed"
 * if it was previously "Sent". Tracks view events in invoice_view_log and audit_logs.
 * Records IP address, device info, and timestamp for each view.
 * Auto-generates Stripe session + QR code on-the-fly if not already stored.
 */

const { pool } = require("../config/db");
const { notifyCustomerViewed } = require("../services/invoiceNotificationService");
const { generateQRCode } = require("../services/qrCodeService");
const { getInvoiceSettings } = require("../models/invoiceSettingsModel");

/**
 * Parse a user-agent string into a simple device description.
 */
function parseDeviceInfo(userAgent) {
  const ua = String(userAgent || "").toLowerCase();
  let device = "Unknown";
  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
    device = "Mobile";
  } else if (ua.includes("tablet") || ua.includes("ipad")) {
    device = "Tablet";
  } else if (ua.includes("windows") || ua.includes("macintosh") || ua.includes("linux")) {
    device = "Desktop";
  }

  let browser = "Unknown";
  if (ua.includes("chrome") && !ua.includes("edg")) browser = "Chrome";
  else if (ua.includes("safari") && !ua.includes("chrome")) browser = "Safari";
  else if (ua.includes("firefox")) browser = "Firefox";
  else if (ua.includes("edg")) browser = "Edge";

  return `${device} / ${browser}`;
}

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
          i.issue_date, i.due_date, i.subtotal_amount, i.tax_name, i.tax_rate, i.tax_amount, i.total_amount,
          i.company_id,
          i.payment_url, i.qr_code_url, i.stripe_session_id, i.payment_status, i.payment_date, i.created_at,
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
          i.issue_date, i.due_date, NULL AS subtotal_amount, NULL AS tax_name,
          NULL AS tax_rate, NULL AS tax_amount, i.total_amount, i.company_id,
          NULL AS payment_url, NULL AS qr_code_url, NULL AS stripe_session_id, NULL AS payment_status, NULL AS payment_date, i.created_at,
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

    // Draft and inactive audit records are not customer-facing invoices.
    if (["Draft", "Void", "Cancelled", "Refunded"].includes(invoice.status)) {
      return res.status(403).json({ message: "This invoice is not available for viewing." });
    }

    // Fetch line items — try invoice_item table first, fall back to items_json
    let items = [];
    try {
      const [itemRows] = await pool.query(
        "SELECT description, quantity, unit_price, amount FROM invoice_item WHERE invoice_invoice_id = ?",
        [invoice.invoice_id]
      );
      items = itemRows;
    } catch {
      // invoice_item table doesn't exist — fall through to items_json
    }

    if (items.length === 0) {
      try {
        const [jsonRows] = await pool.query(
          "SELECT items_json FROM invoice WHERE invoice_id = ?",
          [invoice.invoice_id]
        );
        if (jsonRows[0]?.items_json) {
          const parsed = typeof jsonRows[0].items_json === "string"
            ? JSON.parse(jsonRows[0].items_json)
            : jsonRows[0].items_json;
          items = Array.isArray(parsed) ? parsed : [];
        }
      } catch { /* non-critical */ }
    }

    invoice.items = items;

    if (invoice.payment_status === "paid" && invoice.status !== "Paid") {
      try {
        await pool.query("UPDATE invoice SET status = 'Paid' WHERE invoice_id = ?", [invoice.invoice_id]);
        invoice.status = "Paid";
      } catch { /* non-critical */ }
    }

    const isPayable = !["Paid", "Cancelled", "Refunded"].includes(invoice.status);

    async function isStripeSessionExpired() {
      if (!invoice.stripe_session_id || !process.env.STRIPE_SECRET_KEY) return false;
      const { retrieveSession } = require("../services/stripeService");
      const session = await retrieveSession(invoice.stripe_session_id);
      if (!session) return true;
      if (session.payment_status === "paid") return false;
      return session.expires_at ? Number(session.expires_at) * 1000 <= Date.now() : false;
    }

    // Only generate a new Stripe session if payment_url is missing, stale, or the stored Stripe session expired
    const isPlaceholderUrl = invoice.payment_url && (
      invoice.payment_url.includes("cs_test_sent_") ||
      invoice.payment_url.includes("cs_test_viewed_") ||
      invoice.payment_url.includes("cs_test_overdue_") ||
      invoice.payment_url.includes("cs_test_paid_")
    );

    // Has a real Stripe URL already — skip generation entirely unless the session expired
    const hasRealUrl = invoice.payment_url &&
      !isPlaceholderUrl &&
      invoice.payment_url.startsWith("https://checkout.stripe.com");

    const expiredStripeSession = await isStripeSessionExpired();

    if (isPayable && (!hasRealUrl || expiredStripeSession)) {
      try {
        const { createCheckoutSession } = require("../services/stripeService");
        const stripeResult = await createCheckoutSession({
          invoice_id: invoice.invoice_id,
          invoiceId: invoice.invoiceId,
          total_amount: invoice.total_amount,
          customer_email: invoice.customer_email
        });
        invoice.payment_url = stripeResult.paymentUrl;

        // Generate QR from new payment URL and persist both
        const newQr = await generateQRCode(invoice.payment_url).catch(() => null);
        try {
          await pool.query(
            "UPDATE invoice SET payment_url = ?, stripe_session_id = ?, qr_code_url = ? WHERE invoice_id = ?",
            [stripeResult.paymentUrl, stripeResult.sessionId, newQr, invoice.invoice_id]
          );
          invoice.qr_code_url = newQr;
        } catch { /* non-critical if columns missing */ }
      } catch (stripeErr) {
        console.error("[PUBLIC VIEW] Stripe session generation failed:", stripeErr.message);
      }
    }

    // Use stored QR code — only regenerate if missing (not on every view)
    let qrCodeDataUri = invoice.qr_code_url || null;
    if (isPayable && invoice.payment_url && !qrCodeDataUri) {
      qrCodeDataUri = await generateQRCode(invoice.payment_url).catch(() => null);
      // Persist for next time
      if (qrCodeDataUri) {
        pool.query("UPDATE invoice SET qr_code_url = ? WHERE invoice_id = ?",
          [qrCodeDataUri, invoice.invoice_id]).catch(() => {});
      }
    }

    // Capture view tracking data
    const userAgent = (req.headers["user-agent"] || "").substring(0, 512);
    const ipAddress = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
    const deviceInfo = parseDeviceInfo(userAgent);

    // Update status to "Viewed" on first access
    if (invoice.status === "Sent") {
      await pool.query(
        "UPDATE invoice SET status = 'Viewed' WHERE invoice_id = ? AND status = 'Sent'",
        [invoice.invoice_id]
      );
      invoice.status = "Viewed";

      try {
        await pool.query(
          `INSERT INTO audit_logs (user_id, module, activity_type, action_description, affected_record, status, created_at, ip_address, device_info)
           VALUES (NULL, 'Invoice', 'invoice', 'invoice_status:Viewed', ?, 'Success', NOW(), ?, ?)`,
          [String(invoice.invoice_id), ipAddress, deviceInfo]
        );
      } catch { /* non-critical */ }

      notifyCustomerViewed(invoice.invoiceId, invoice.customer_name).catch(() => {});
    }

    // Record the view event in audit_logs (with view-specific columns)
    try {
      await pool.query(
        `INSERT INTO audit_logs (user_id, module, activity_type, action_description, affected_record, status,
           created_at, ip_address, device_info, invoice_id, view_ip_address, view_user_agent)
         VALUES (NULL, 'Invoice', 'invoice_view', 'Invoice viewed', ?, 'Success', NOW(), ?, ?, ?, ?, ?)`,
        [String(invoice.invoice_id), ipAddress, deviceInfo, invoice.invoice_id, ipAddress, userAgent]
      );
    } catch { /* non-critical */ }

    // Load invoice display settings for client-side rendering
    let invoiceSettings = {};
    try {
      invoiceSettings = (await getInvoiceSettings(invoice.company_id)) || {};
    } catch { /* non-critical — template will use defaults */ }

    res.json({
      invoice: {
        invoiceId: invoice.invoiceId,
        status: invoice.status,
        issue_date: invoice.issue_date,
        due_date: invoice.due_date,
        subtotal_amount: invoice.subtotal_amount,
        tax_name: invoice.tax_name,
        tax_rate: invoice.tax_rate,
        tax_amount: invoice.tax_amount,
        total_amount: invoice.total_amount,
        customer_name: invoice.customer_name,
        customer_email: invoice.customer_email,
        customer_address: invoice.customer_address,
        items: invoice.items,
        payment_url: isPayable ? invoice.payment_url : null,
        qr_code: isPayable ? qrCodeDataUri : null,
        is_paid: invoice.status === "Paid" || invoice.payment_status === "paid",
        is_pending_review: invoice.status === "Pending Review",
        paid_date: invoice.status === "Paid" ? (invoice.payment_date || null) : null,
        view_date: new Date().toISOString(),
        view_ip: ipAddress,
        view_device: deviceInfo
      },
      settings: invoiceSettings
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
