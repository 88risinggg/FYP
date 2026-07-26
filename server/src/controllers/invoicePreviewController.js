/**
 * Invoice Preview Controller
 *
 * Provides a live preview endpoint that renders invoice HTML
 * using provided settings WITHOUT saving them to the database.
 * Used by the Admin invoice template configuration page.
 */

const { buildInvoiceHtml, formatDate, formatMoney } = require("../services/pdfService");
const { defaultSettings, getInvoiceSettings } = require("../models/invoiceSettingsModel");
const { getCompanyId } = require("../utils/companyScope");

// Sample invoice data used for preview rendering
const PREVIEW_INVOICE = {
  invoice_id: 0,
  invoiceId: "IN-15730-2023-SG",
  status: "Sent",
  issue_date: new Date().toISOString().slice(0, 10),
  due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  total_amount: 53.85,
  customer_name: "sultans of Shave - Jewel",
  customer_email: "bookings@sultansofshave.sg",
  customer_address: "",
  service_provider: "sultans of Shave - Jewel",
  shop_title: "sultans of Shave - Jewel",
  amount_paid: 53.85,
  notes: "",
  items: [
    { description: "$99 The Deluxe Experience|$64.35 Salon's Share @65%|$34.65 Platform Share @35%|Appointment:2023-04-17 12:00 pm|Ref 000536437", quantity: 1, unit_price: 34.65, amount: 34.65 },
    { description: "$38 Beard Trim|$24.7 Salon's Share @65%|$13.3 Platform Share @35%|Appointment:2023-04-19 04:15 pm|Ref 000536448", quantity: 1, unit_price: 13.30, amount: 13.30 },
    { description: "$59 Deluxe Haircut|$53.1 Salon's Share @90%|$5.9 Platform Share @10%|Appointment:2023-04-21 05:45 pm|Ref 000536463", quantity: 1, unit_price: 5.90, amount: 5.90 }
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
    // If real invoice data is passed without custom settings, load saved settings from DB
    let baseSettings = defaultSettings;
    if (req.body.invoice && !req.body.settings) {
      try {
        const saved = await getInvoiceSettings(getCompanyId(req));
        if (saved) baseSettings = { ...defaultSettings, ...saved };
      } catch { /* use defaults */ }
    }

    const previewSettings = {
      ...baseSettings,
      ...(req.body.settings || {})
    };

    // Use sample data or provided invoice data
    const invoice = req.body.invoice || { ...PREVIEW_INVOICE };

    // Update preview invoice number format to match settings
    if (previewSettings.invoicePrefix && !req.body.invoice) {
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
