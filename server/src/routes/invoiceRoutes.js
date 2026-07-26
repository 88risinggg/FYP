const express = require("express");
const {
  createInvoice,
  getCustomers,
  getInvoices,
  getNextInvoiceNumber,
  scheduleInvoices,
  sendInvoice,
  voidInvoice
} = require("../controllers/invoiceController");
const { exportInvoicesExcel } = require("../controllers/exportController");
const { authenticateToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/rolesMiddleware");
const { generateInvoicePDF } = require("../services/pdfService");
const whatsappService = require("../services/whatsappService");
const { sendManualReminder } = require("../services/invoiceReminderService");
const { pool } = require("../config/db");
const { getCompanyId } = require("../utils/companyScope");
const { calculateInvoiceLateFee, getInvoiceSettings } = require("../models/invoiceSettingsModel");

const router = express.Router();

router.use(authenticateToken);

router.get("/", getInvoices);
router.get("/customers", getCustomers);
router.get("/settings", async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const settings = await getInvoiceSettings(companyId);

    // Enhanced payload: include GST rates and reminder rules for Finance read-only view
    let gstRates = [];
    let reminderRules = [];

    try {
      const { listGstRates } = require("../models/invoiceGstRateModel");
      const rates = await listGstRates(companyId);
      gstRates = rates || [];
    } catch { /* GST table may not exist */ }

    try {
      const { listReminderSettings } = require("../models/reminderModel");
      const reminders = await listReminderSettings();
      reminderRules = reminders || [];
    } catch { /* Reminder table may not exist */ }

    res.json({
      settings,
      gstRates,
      reminderRules
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch invoice settings.", detail: error.message });
  }
});
router.get("/next-number", getNextInvoiceNumber);
router.get("/export/excel", exportInvoicesExcel);
router.post("/", createInvoice);
router.post("/schedule", scheduleInvoices);
router.post("/:id/send", sendInvoice);
router.patch("/:id/void", allowRoles("Finance"), voidInvoice);

/**
 * GET /api/invoices/:id/pdf
 * Download invoice as PDF with payment URL and QR code.
 * Generates a real Stripe Checkout URL if the stored one is a placeholder.
 */
router.get("/:id/pdf", async (req, res) => {
  try {
    const invoiceId = Number(req.params.id);
    const companyId = getCompanyId(req);
    const [rows] = await pool.query(
      `SELECT i.invoice_id, i.invoiceId, i.status, i.issue_date, i.due_date, i.total_amount,
              i.payment_url, i.qr_code_url,
              c.name AS customer_name, c.email AS customer_email, c.address AS customer_address
       FROM invoice i INNER JOIN customer c ON c.customer_id = i.customer_id
       WHERE i.invoice_id = ? ${companyId ? "AND i.company_id = ?" : ""} LIMIT 1`,
      companyId ? [invoiceId, companyId] : [invoiceId]
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
    const settings = await getInvoiceSettings(companyId);
    const lateFee = calculateInvoiceLateFee(invoice, settings);

    if (isPayable) {
      const isPlaceholder = !paymentUrl || /cs_test_(sent|viewed|overdue|paid)_/.test(paymentUrl) || lateFee.lateFeeAmount > 0;
      if (isPlaceholder) {
        try {
          const { createCheckoutSession } = require("../services/stripeService");
          const result = await createCheckoutSession({
            invoice_id: invoice.invoice_id,
            invoiceId: invoice.invoiceId,
            total_amount: lateFee.amountDue,
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
    const companyId = getCompanyId(req);
    const [rows] = await pool.query(
      `SELECT i.invoice_id, i.invoiceId, i.status, i.issue_date, i.due_date, i.total_amount,
              i.payment_url, i.qr_code_url, i.shop_title, i.service_provider,
              c.name AS customer_name, c.email AS customer_email, c.address AS customer_address
       FROM invoice i INNER JOIN customer c ON c.customer_id = i.customer_id
       WHERE i.invoice_id = ? ${companyId ? "AND i.company_id = ?" : ""} LIMIT 1`,
      companyId ? [invoiceId, companyId] : [invoiceId]
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

    const settings = { ...defaultSettings, ...((await getInvoiceSettings(companyId)) || {}) };

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
    const companyId = getCompanyId(req);
    const [rows] = await pool.query(
      `SELECT i.invoice_id, i.invoiceId, i.total_amount, i.due_date, i.payment_url, i.customer_id,
              c.name AS customer_name, c.email AS customer_email, c.whatsapp_number
       FROM invoice i INNER JOIN customer c ON c.customer_id = i.customer_id
       WHERE i.invoice_id = ? ${companyId ? "AND i.company_id = ?" : ""} LIMIT 1`,
      companyId ? [invoiceId, companyId] : [invoiceId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Invoice not found." });
    }

    const invoice = rows[0];
    const phone = req.body.phone || invoice.whatsapp_number;
    if (!phone) {
      return res.status(400).json({ message: "Customer does not have a WhatsApp number. Provide phone in request body." });
    }

    const result = await whatsappService.sendInvoice({
      customerId: invoice.customer_id,
      customerName: invoice.customer_name,
      phone,
      invoiceId: invoice.invoice_id,
      invoiceNumber: invoice.invoiceId,
      amount: invoice.total_amount,
      dueDate: invoice.due_date,
      paymentLink: invoice.payment_url || null,
      sentBy: req.user?.userId
    });

    if (result.success) {
      res.json({ message: "WhatsApp notification sent.", result });
    } else {
      res.status(422).json({ message: "Failed to send WhatsApp.", error: result.error });
    }
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
 * Get reminder history from audit_logs (invoice_reminder_log was merged into audit_logs).
 */
router.get("/:id/reminders", async (req, res) => {
  try {
    const invoiceId = Number(req.params.id);
    const companyId = getCompanyId(req);
    const [logs] = await pool.query(
      `SELECT
         audit_log_id AS log_id,
         reminder_type,
         delivery_status,
         customer_email,
         created_at AS sent_at,
         action_description AS error_message
       FROM audit_logs
       WHERE activity_type = 'invoice_reminder'
         AND invoice_id = ?
         ${companyId ? "AND company_id = ?" : ""}
       ORDER BY created_at DESC
       LIMIT 50`,
      companyId ? [invoiceId, companyId] : [invoiceId]
    );
    res.json({ reminders: logs });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch reminder history.", detail: error.message });
  }
});

/**
 * GET /api/invoices/:id/views
 * Get view tracking history from audit_logs (invoice_view_log was merged into audit_logs).
 */
router.get("/:id/views", async (req, res) => {
  try {
    const invoiceId = Number(req.params.id);
    const companyId = getCompanyId(req);
    const [views] = await pool.query(
      `SELECT
         audit_log_id AS view_id,
         created_at AS view_date,
         view_ip_address AS ip_address,
         view_user_agent AS user_agent,
         device_info
       FROM audit_logs
       WHERE activity_type = 'invoice_view'
         AND invoice_id = ?
         ${companyId ? "AND company_id = ?" : ""}
       ORDER BY created_at DESC
       LIMIT 50`,
      companyId ? [invoiceId, companyId] : [invoiceId]
    );
    res.json({ views });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch view history.", detail: error.message });
  }
});

module.exports = router;
