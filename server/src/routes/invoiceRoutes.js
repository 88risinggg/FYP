const express = require("express");
const {
  createInvoice,
  getCustomers,
  getInvoices,
  getNextInvoiceNumber,
  scheduleInvoices,
  sendInvoice
} = require("../controllers/invoiceController");
const { exportInvoicesExcel } = require("../controllers/exportController");
const { authenticateToken } = require("../middleware/authMiddleware");
const { generateInvoicePDF } = require("../services/pdfService");
const { sendWhatsAppReminder } = require("../services/whatsappService");
const { sendManualReminder } = require("../services/invoiceReminderService");
const { pool } = require("../config/db");

const router = express.Router();

router.use(authenticateToken);

router.get("/", getInvoices);
router.get("/customers", getCustomers);
router.get("/next-number", getNextInvoiceNumber);
router.get("/export/excel", exportInvoicesExcel);
router.post("/", createInvoice);
router.post("/schedule", scheduleInvoices);
router.post("/:id/send", sendInvoice);

/**
 * GET /api/invoices/:id/pdf
 * Download invoice as PDF with payment URL and QR code.
 * Generates a real Stripe Checkout URL if the stored one is a placeholder.
 */
router.get("/:id/pdf", async (req, res) => {
  try {
    const invoiceId = Number(req.params.id);
    const [rows] = await pool.query(
      `SELECT i.invoice_id, i.invoiceId, i.status, i.issue_date, i.due_date, i.total_amount,
              i.payment_url, i.qr_code_url,
              c.name AS customer_name, c.email AS customer_email, c.address AS customer_address
       FROM invoice i INNER JOIN customer c ON c.customer_id = i.customer_id
       WHERE i.invoice_id = ? LIMIT 1`,
      [invoiceId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Invoice not found." });
    }

    const invoice = rows[0];

    // Load line items: try invoice_item table first, fall back to items_json column
    let items = [];
    try {
      const [itemRows] = await pool.query(
        "SELECT description, quantity, unit_price, amount FROM invoice_item WHERE invoice_invoice_id = ?",
        [invoiceId]
      );
      items = itemRows;
    } catch {
      // invoice_item table may not exist — fall back to items_json
    }
    if (items.length === 0) {
      try {
        const [jsonRows] = await pool.query(
          "SELECT items_json FROM invoice WHERE invoice_id = ? AND items_json IS NOT NULL",
          [invoiceId]
        );
        if (jsonRows.length > 0 && jsonRows[0].items_json) {
          const parsed = typeof jsonRows[0].items_json === "string"
            ? JSON.parse(jsonRows[0].items_json)
            : jsonRows[0].items_json;
          items = Array.isArray(parsed) ? parsed : [];
        }
      } catch { /* no items available */ }
    }
    invoice.items = items;

    // Generate real Stripe URL if placeholder or missing (for unpaid invoices)
    const isPayable = !["Paid", "Cancelled", "Refunded"].includes(invoice.status);
    let paymentUrl = invoice.payment_url;
    let qrCodeDataUri = invoice.qr_code_url;

    if (isPayable) {
      const isPlaceholder = !paymentUrl || /cs_test_(sent|viewed|overdue|paid)_/.test(paymentUrl);
      if (isPlaceholder) {
        try {
          const { createCheckoutSession } = require("../services/stripeService");
          const result = await createCheckoutSession({
            invoice_id: invoice.invoice_id,
            invoiceId: invoice.invoiceId,
            total_amount: invoice.total_amount,
            customer_email: invoice.customer_email
          });
          paymentUrl = result.paymentUrl;

          // Persist the real URL
          await pool.query(
            "UPDATE invoice SET payment_url = ?, stripe_session_id = ? WHERE invoice_id = ?",
            [paymentUrl, result.sessionId, invoiceId]
          ).catch(() => {});
        } catch (err) {
          console.error("[PDF] Stripe session creation failed:", err.message);
        }
      }

      // Generate QR code from the payment URL
      if (paymentUrl && !qrCodeDataUri) {
        try {
          const { generateQRCode } = require("../services/qrCodeService");
          qrCodeDataUri = await generateQRCode(paymentUrl);
        } catch { /* non-critical */ }
      }
    }

    const pdfBuffer = await generateInvoicePDF(invoice, {
      paymentUrl: isPayable ? paymentUrl : null,
      qrCodeDataUri: isPayable ? qrCodeDataUri : null
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${invoice.invoiceId}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ message: "Failed to generate PDF.", detail: error.message });
  }
});

/**
 * GET /api/invoices/:id/html
 * Returns the invoice rendered as HTML (same template as PDF) for browser printing.
 * Does NOT require Puppeteer — returns raw HTML that can be displayed in a print window.
 */
router.get("/:id/html", async (req, res) => {
  try {
    const invoiceId = Number(req.params.id);
    const [rows] = await pool.query(
      `SELECT i.invoice_id, i.invoiceId, i.status, i.issue_date, i.due_date, i.total_amount,
              i.payment_url, i.qr_code_url, i.shop_title, i.service_provider,
              c.name AS customer_name, c.email AS customer_email, c.address AS customer_address
       FROM invoice i INNER JOIN customer c ON c.customer_id = i.customer_id
       WHERE i.invoice_id = ? LIMIT 1`,
      [invoiceId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Invoice not found." });
    }

    const invoice = rows[0];

    // Load line items: try invoice_item table first, fall back to items_json column
    let items = [];
    try {
      const [itemRows] = await pool.query(
        "SELECT description, quantity, unit_price, amount FROM invoice_item WHERE invoice_invoice_id = ?",
        [invoiceId]
      );
      items = itemRows;
    } catch {
      // invoice_item table may not exist — fall back to items_json
    }
    if (items.length === 0) {
      try {
        const [jsonRows] = await pool.query(
          "SELECT items_json FROM invoice WHERE invoice_id = ? AND items_json IS NOT NULL",
          [invoiceId]
        );
        if (jsonRows.length > 0 && jsonRows[0].items_json) {
          const parsed = typeof jsonRows[0].items_json === "string"
            ? JSON.parse(jsonRows[0].items_json)
            : jsonRows[0].items_json;
          items = Array.isArray(parsed) ? parsed : [];
        }
      } catch { /* no items available */ }
    }
    invoice.items = items;

    // Determine amount paid
    try {
      const [paidRows] = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS amount_paid FROM payment
         WHERE invoice_invoice_id = ? AND LOWER(status) IN ('completed', 'paid', 'successful', 'success')`,
        [invoiceId]
      );
      invoice.amount_paid = Number(paidRows[0]?.amount_paid || 0);
    } catch {
      invoice.amount_paid = invoice.status === "Paid" ? Number(invoice.total_amount || 0) : 0;
    }

    const { buildInvoiceHtml } = require("../services/pdfService");
    const { getInvoiceSettings, defaultSettings } = require("../models/invoiceSettingsModel");

    const settings = { ...defaultSettings, ...((await getInvoiceSettings()) || {}) };

    // Resolve logo
    let logoDataUri = "";
    const logoUrl = settings.branding?.companyLogoUrl || settings.companyLogoUrl;
    if (logoUrl) {
      try {
        const fs = require("fs/promises");
        const path = require("path");
        if (logoUrl.startsWith("/uploads/invoice-logos/")) {
          const fileName = path.basename(logoUrl);
          const filePath = path.join(__dirname, "..", "..", "uploads", "invoice-logos", fileName);
          const content = await fs.readFile(filePath);
          const ext = path.extname(fileName).toLowerCase();
          const mimeType = ext === ".png" ? "image/png" : ext === ".svg" ? "image/svg+xml" : "image/jpeg";
          logoDataUri = `data:${mimeType};base64,${content.toString("base64")}`;
        }
      } catch { /* non-critical */ }
    }

    // Generate QR code if payable
    const isPayable = !["Paid", "Cancelled", "Refunded"].includes(invoice.status);
    let qrCodeDataUri = null;
    if (isPayable && invoice.payment_url && settings.qrCodeDisplay) {
      try {
        const { generateQRCode } = require("../services/qrCodeService");
        qrCodeDataUri = await generateQRCode(invoice.payment_url);
      } catch { /* non-critical */ }
    }

    const html = buildInvoiceHtml(invoice, settings, {
      paymentUrl: isPayable ? invoice.payment_url : null,
      qrCodeDataUri,
      logoDataUri
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (error) {
    res.status(500).json({ message: "Failed to generate invoice HTML.", detail: error.message });
  }
});

/**
 * POST /api/invoices/:id/whatsapp
 * Send WhatsApp reminder for an invoice.
 */
router.post("/:id/whatsapp", async (req, res) => {
  try {
    const invoiceId = Number(req.params.id);
    const [rows] = await pool.query(
      `SELECT i.invoiceId, i.total_amount, i.due_date, c.name AS customer_name, c.email AS customer_email
       FROM invoice i INNER JOIN customer c ON c.customer_id = i.customer_id
       WHERE i.invoice_id = ? LIMIT 1`,
      [invoiceId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Invoice not found." });
    }

    const invoice = rows[0];
    const phone = req.body.phone || "+6500000000"; // Customer phone from request or default

    const result = await sendWhatsAppReminder({
      to: phone,
      invoiceId: invoice.invoiceId,
      customerName: invoice.customer_name,
      amount: invoice.total_amount,
      dueDate: invoice.due_date
    });

    res.json({ message: "WhatsApp notification sent.", result });
  } catch (error) {
    res.status(500).json({ message: "Failed to send WhatsApp.", detail: error.message });
  }
});

/**
 * POST /api/invoices/:id/reminder
 * Manually send a payment reminder for an invoice.
 */
router.post("/:id/reminder", async (req, res) => {
  try {
    const invoiceId = Number(req.params.id);
    if (!invoiceId) {
      return res.status(400).json({ message: "Invalid invoice ID." });
    }

    const result = await sendManualReminder(invoiceId, req.user?.userId);
    if (!result.success) {
      return res.status(400).json({ message: result.message });
    }

    res.json({ message: result.message });
  } catch (error) {
    res.status(500).json({ message: "Failed to send reminder.", detail: error.message });
  }
});

/**
 * GET /api/invoices/:id/reminders
 * Get reminder history for a specific invoice.
 */
router.get("/:id/reminders", async (req, res) => {
  try {
    const invoiceId = Number(req.params.id);
    const [logs] = await pool.query(
      `SELECT reminder_type, delivery_status, customer_email, sent_at, error_message
       FROM invoice_reminder_log
       WHERE invoice_id = ?
       ORDER BY sent_at DESC
       LIMIT 50`,
      [invoiceId]
    );
    res.json({ reminders: logs });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      return res.json({ reminders: [] });
    }
    res.status(500).json({ message: "Failed to fetch reminder history.", detail: error.message });
  }
});

/**
 * GET /api/invoices/:id/views
 * Get view tracking history for a specific invoice.
 */
router.get("/:id/views", async (req, res) => {
  try {
    const invoiceId = Number(req.params.id);
    const [views] = await pool.query(
      `SELECT view_id, view_date, ip_address, user_agent, device_info
       FROM invoice_view_log
       WHERE invoice_id = ?
       ORDER BY view_date DESC
       LIMIT 50`,
      [invoiceId]
    );
    res.json({ views });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      return res.json({ views: [] });
    }
    res.status(500).json({ message: "Failed to fetch view history.", detail: error.message });
  }
});

module.exports = router;
