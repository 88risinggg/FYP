/**
 * Invoice Preview Controller
 *
 * Provides a live preview endpoint that renders invoice HTML
 * using provided settings WITHOUT saving them to the database.
 * Used by the Admin invoice template configuration page.
 */

const { buildInvoiceHtml, formatDate, formatMoney } = require("../services/pdfService");
const { defaultSettings } = require("../models/invoiceSettingsModel");

// Sample invoice data used for preview rendering
const PREVIEW_INVOICE = {
  invoice_id: 0,
  invoiceId: "INV-2026-0001",
  status: "Sent",
  issue_date: new Date().toISOString().slice(0, 10),
  due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  total_amount: 650.00,
  customer_name: "Customer A",
  customer_email: "customer.a@example.com",
  customer_address: "123 Orchard Road, #05-01, Singapore 238858",
  amount_paid: 0,
  notes: "",
  items: [
    { description: "Oriental Body Massage — Palace Therapy — 9 Jan 2026, 7:15 PM [60 min]", quantity: 1, unit_price: 65.00, amount: 65.00 },
    { description: "Hot Stone Therapy — Palace Therapy — 9 Jan 2026, 8:30 PM [90 min]", quantity: 1, unit_price: 120.00, amount: 120.00 },
    { description: "Aromatherapy Add-on", quantity: 2, unit_price: 45.00, amount: 90.00 },
    { description: "Scalp Treatment & Analysis", quantity: 1, unit_price: 375.00, amount: 375.00 }
  ]
};

/**
 * POST /api/admin/invoicing/template-preview
 *
 * Renders the invoice HTML template using the provided settings
 * without persisting them. Returns raw HTML for iframe display.
 *
 * Request body: { settings: { ... all template config attributes } }
 * Response: HTML string
 */
async function getTemplatePreview(req, res) {
  try {
    const previewSettings = {
      ...defaultSettings,
      ...(req.body.settings || req.body || {})
    };

    // Use sample data or provided invoice data
    const invoice = req.body.invoice || { ...PREVIEW_INVOICE };

    // Update preview invoice number format to match settings
    if (previewSettings.invoicePrefix) {
      invoice.invoiceId = `${previewSettings.invoicePrefix}-2026-0001`;
    }

    // Apply watermark based on preview status
    if (req.body.previewStatus) {
      invoice.status = req.body.previewStatus;
    }

    // Apply paid state for preview
    if (invoice.status === "Paid") {
      invoice.amount_paid = invoice.total_amount;
    }

    const html = buildInvoiceHtml(invoice, previewSettings, {
      paymentUrl: "https://checkout.stripe.com/demo/preview",
      qrCodeDataUri: previewSettings.qrCodeDisplay
        ? "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        : null,
      logoDataUri: previewSettings.branding?.companyLogoUrl || previewSettings.companyLogoUrl || ""
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (error) {
    res.status(500).json({
      message: "Failed to generate preview.",
      detail: error.message
    });
  }
}

module.exports = { getTemplatePreview, PREVIEW_INVOICE };
