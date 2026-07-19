const fs = require("fs/promises");
const path = require("path");
const puppeteer = require("puppeteer-core");

const { pool } = require("../config/db");
const { defaultSettings, getInvoiceSettings } = require("../models/invoiceSettingsModel");
const { generateQRCode } = require("./qrCodeService");

function getExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  if (process.platform === "win32") return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  if (process.platform === "darwin") return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  return "/usr/bin/google-chrome";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeUrl(value) {
  const url = String(value || "").trim();
  return /^(https?:|data:image\/(?:png|jpe?g);base64,)/i.test(url) ? url : "";
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-SG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Singapore"
  }).format(date);
}

function formatMoney(value, currency = "SGD") {
  return new Intl.NumberFormat("en-SG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function iconSvg(name) {
  const paths = {
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    document: '<path d="M6 2h9l4 4v16H6z"/><path d="M14 2v5h5M9 12h7M9 16h7"/>',
    building: '<path d="M4 22V6l8-4 8 4v16M8 8h2M14 8h2M8 12h2M14 12h2M8 16h2M14 16h2M9 22v-3h6v3"/>',
    bank: '<path d="M3 10h18M5 10v8M9 10v8M15 10v8M19 10v8M3 19h18M2 7l10-5 10 5z"/>',
    paynow: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M9 6h6M8 10h8M8 14h5M10 18h4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
    pin: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="2.5"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.info}</svg>`;
}

async function resolveLogoDataUri(logoUrl) {
  const directUrl = safeUrl(logoUrl);
  if (directUrl) return directUrl;
  if (!String(logoUrl || "").startsWith("/uploads/invoice-logos/")) return "";

  try {
    const fileName = path.basename(logoUrl);
    const filePath = path.join(__dirname, "..", "..", "uploads", "invoice-logos", fileName);
    const content = await fs.readFile(filePath);
    const mimeType = path.extname(fileName).toLowerCase() === ".png" ? "image/png" : "image/jpeg";
    return `data:${mimeType};base64,${content.toString("base64")}`;
  } catch {
    return "";
  }
}

async function hydrateInvoice(invoice) {
  if (!invoice?.invoice_id) return { ...invoice, items: invoice?.items || [], amount_paid: 0 };

  const [headerRows] = await pool.query(
    `SELECT i.*, c.name AS customer_name, c.email AS customer_email, c.address AS customer_address
     FROM invoice i
     LEFT JOIN customer c ON c.customer_id = i.customer_id
     WHERE i.invoice_id = ? LIMIT 1`,
    [invoice.invoice_id]
  );
  const hydrated = { ...headerRows[0], ...invoice };

  if (!Array.isArray(hydrated.items) || hydrated.items.length === 0) {
    try {
      const [items] = await pool.query(
        "SELECT description, quantity, unit_price, amount FROM invoice_item WHERE invoice_invoice_id = ? ORDER BY item_id",
        [invoice.invoice_id]
      );
      hydrated.items = items;
    } catch {
      const parsed = typeof hydrated.items_json === "string"
        ? JSON.parse(hydrated.items_json || "[]")
        : hydrated.items_json;
      hydrated.items = Array.isArray(parsed) ? parsed : [];
    }
  }

  try {
    const [paidRows] = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS amount_paid
       FROM payment
       WHERE invoice_invoice_id = ? AND LOWER(status) IN ('completed', 'paid', 'successful', 'success')`,
      [invoice.invoice_id]
    );
    hydrated.amount_paid = Number(paidRows[0]?.amount_paid || 0);
  } catch {
    hydrated.amount_paid = hydrated.status === "Paid" ? Number(hydrated.total_amount || 0) : 0;
  }

  return hydrated;
}

async function generateInvoicePDF(invoice, options = {}) {
  const hydratedInvoice = await hydrateInvoice(invoice);
  const settings = {
    ...defaultSettings,
    ...(options.settings || (await getInvoiceSettings()) || {})
  };
  const logoDataUri = await resolveLogoDataUri(settings.branding?.companyLogoUrl);
  let qrCodeDataUri = options.qrCodeDataUri || hydratedInvoice.qr_code_url || null;
  const paymentUrl = options.paymentUrl || hydratedInvoice.payment_url || null;

  if (paymentUrl && !["Paid", "Cancelled", "Refunded"].includes(hydratedInvoice.status) && !qrCodeDataUri) {
    qrCodeDataUri = await generateQRCode(paymentUrl);
  }

  const html = buildInvoiceHtml(hydratedInvoice, settings, {
    paymentUrl,
    qrCodeDataUri,
    logoDataUri
  });
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: getExecutablePath(),
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      printBackground: true,
      preferCSSPageSize: true
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

function buildInvoiceHtml(invoice, settings = defaultSettings, options = {}) {
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const currency = settings.defaultCurrency || settings.general?.defaultCurrency || "SGD";
  const subtotal = items.length
    ? items.reduce((sum, item) => sum + Number(item.amount ?? Number(item.quantity || 0) * Number(item.unit_price || 0)), 0)
    : Number(invoice.total_amount || 0);
  const total = Number(invoice.total_amount || subtotal);
  const amountPaid = Math.min(total, Math.max(0, Number(invoice.amount_paid || 0)));
  const amountDue = Math.max(0, total - amountPaid);
  const companyName = settings.companyName || "";
  const brandName = settings.branding?.brandName || settings.brandName || companyName.trim().split(/\s+/)[0] || "COMPANY";
  const logo = safeUrl(options.logoDataUri)
    ? `<img class="logo-image" src="${escapeHtml(options.logoDataUri)}" alt="Company logo">`
    : `<div class="wordmark">${escapeHtml(brandName)}<span class="wordmark-dot">.</span></div>`;
  const qrCode = safeUrl(options.qrCodeDataUri);

  const itemRows = items.map((item, index) => `
    <tr>
      <td class="description-cell">
        <span class="item-number">${String(index + 1).padStart(2, "0")}</span>
        <span>${escapeHtml(item.description)}</span>
      </td>
      <td class="number-cell">${escapeHtml(Number(item.quantity || 0).toFixed(2))}</td>
      <td class="number-cell">${escapeHtml(formatMoney(item.unit_price, currency))}</td>
      <td class="number-cell">${escapeHtml(formatMoney(item.amount ?? Number(item.quantity || 0) * Number(item.unit_price || 0), currency))}</td>
    </tr>`).join("");

  const paymentTermDays = Number(settings.dueDays || 0);
  const paymentTerms = settings.paymentTerms || settings.general?.paymentTerms || (paymentTermDays ? `Net ${paymentTermDays}` : "-");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; color: #071b43; font-family: Arial, Helvetica, sans-serif; background: #fff; }
    body { width: 210mm; min-height: 297mm; }
    .page { width: 210mm; min-height: 297mm; padding: 8mm 7.5mm 6mm; display: flex; flex-direction: column; overflow: hidden; }
    .logo-row { height: 20mm; display: flex; align-items: flex-start; border-bottom: .35mm solid #7f8ba2; padding-bottom: 3mm; }
    .logo-row::before { content: ""; width: 2.1mm; height: 16.5mm; margin-right: 7mm; background: #ff5a52; }
    .logo-image { max-width: 62mm; max-height: 16.5mm; object-fit: contain; object-position: left top; }
    .wordmark { max-width: 130mm; color: #07132f; font-family: Georgia, "Times New Roman", serif; font-size: 25pt; line-height: 1; font-weight: 700; letter-spacing: .8px; white-space: nowrap; }
    .wordmark-dot { color: #ff5a52; }
    .hero { display: grid; grid-template-columns: 44.5% 26% 29.5%; height: 49mm; border-bottom: .3mm solid #c7ced8; }
    .invoice-title { padding: 10.5mm 5mm 5mm 0; }
    .invoice-title h1 { margin: 0; font-size: 27pt; line-height: 1; letter-spacing: 1.2px; color: #071b43; }
    .coral-rule { width: 12mm; height: 1.1mm; margin: 3.8mm 0 5mm; background: #ff5a52; }
    .invoice-title p { margin: 0; font-size: 8pt; line-height: 1.4; font-weight: 700; color: #263653; overflow-wrap: anywhere; }
    .meta { border-left: 1px solid #d8dce3; display: grid; grid-template-rows: 1fr 1fr; }
    .meta-row { display: grid; grid-template-columns: 13mm 1fr; align-items: center; padding: 3.5mm 3mm; border-bottom: .3mm solid #d8dce3; min-width: 0; }
    .meta-row:last-child { border-bottom: 0; }
    .icon { color: #ff5a4f; text-align: center; }
    .icon svg { width: 6mm; height: 6mm; }
    .meta-label { margin: 0 0 1.4mm; font-size: 6pt; font-weight: 800; text-transform: uppercase; }
    .meta-value { margin: 0; font-size: 7.5pt; line-height: 1.35; font-weight: 600; overflow-wrap: anywhere; }
    .company-card { padding: 5mm 5.5mm; background: #061e4b; color: white; min-width: 0; }
    .company-card .building { margin-bottom: 2mm; }
    .company-card .building svg { width: 9mm; height: 9mm; }
    .company-card strong { display: block; margin-bottom: 1.2mm; font-size: 7.5pt; line-height: 1.3; overflow-wrap: anywhere; }
    .company-card p { margin: .55mm 0; font-size: 6.8pt; line-height: 1.35; overflow-wrap: anywhere; }
    .items { width: 100%; margin-top: 5.5mm; border-collapse: collapse; table-layout: fixed; }
    .items thead { display: table-header-group; }
    .items tr { break-inside: avoid; page-break-inside: avoid; }
    .items th { height: 9mm; padding: 2.5mm 3.5mm; background: #061e4b; color: white; border-right: .3mm solid #486084; font-size: 6.7pt; text-align: left; text-transform: uppercase; }
    .items th:nth-child(n+2) { text-align: center; }
    .items th:first-child { width: 58%; }
    .items th:nth-child(2) { width: 14%; }
    .items th:nth-child(3), .items th:nth-child(4) { width: 14%; }
    .items td { height: 21mm; padding: 4.2mm 3.5mm; border: .3mm solid #d7dbe2; border-top: 0; font-size: 7.2pt; line-height: 1.42; vertical-align: top; overflow-wrap: anywhere; }
    .description-cell { display: flex; gap: 3.5mm; }
    .item-number { display: inline-flex; width: 8mm; height: 8mm; flex: 0 0 8mm; align-items: center; justify-content: center; background: #ff5a4f; color: white; font-size: 7pt; font-weight: 800; }
    .number-cell { text-align: right; white-space: nowrap; }
    .summary { display: grid; grid-template-columns: 56% 44%; break-inside: avoid; border-bottom: .35mm solid #071b43; }
    .due-panel { display: grid; grid-template-columns: 13mm 1fr; align-items: center; align-self: end; min-height: 18mm; padding-bottom: 2mm; }
    .due-panel p { margin: .65mm 0; font-size: 7.4pt; }
    .due-panel strong { font-weight: 800; text-transform: uppercase; }
    .totals { width: 100%; border-collapse: collapse; }
    .totals td { height: 10mm; padding: 2.6mm 3.5mm; border: .3mm solid #e0e3e8; font-size: 7.3pt; }
    .totals td:first-child { font-weight: 800; text-transform: uppercase; }
    .totals td:last-child { text-align: right; }
    .totals .due td { background: #ff5a52; color: white; font-weight: 800; border-color: #ff5a52; }
    .payment-area { break-inside: avoid; }
    .circle-icon { width: 10mm; height: 10mm; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: #061e4b; color: white; font-size: 11pt; }
    .circle-icon svg { width: 5mm; height: 5mm; }
    .payment-grid { display: grid; grid-template-columns: 58% 42%; border-bottom: .3mm solid #d8dce3; }
    .payment-box { height: 31mm; padding: 5mm 3mm 4mm 0; display: grid; grid-template-columns: 13mm 1fr; }
    .payment-box + .payment-box { padding-left: 5mm; border-left: 1px solid #d8dce3; }
    .payment-box .circle-icon { background: #ff5a52; }
    .payment-box p { margin: .6mm 0; font-size: 7pt; line-height: 1.35; overflow-wrap: anywhere; }
    .payment-box strong { display: block; margin-bottom: 1mm; }
    .paynow-content { display: grid; grid-template-columns: 1fr auto; gap: 2mm; align-items: center; }
    .qr { width: 18mm; height: 18mm; object-fit: contain; }
    .instruction { display: grid; grid-template-columns: 12mm 1fr; align-items: center; height: 12mm; border-bottom: .3mm solid #d8dce3; }
    .instruction .circle-icon { width: 8mm; height: 8mm; font-size: 8pt; }
    .instruction p { margin: 0; font-size: 7pt; line-height: 1.35; overflow-wrap: anywhere; }
    .footer { margin-top: auto; display: grid; grid-template-columns: 12mm 1fr; align-items: center; min-height: 14mm; border-top: .35mm solid #071b43; }
    .footer .location { width: 9mm; height: 9mm; display: flex; align-items: center; justify-content: center; background: #061e4b; color: white; }
    .footer .location svg { width: 5mm; height: 5mm; }
    .footer p { margin: 0; font-size: 6.5pt; line-height: 1.35; overflow-wrap: anywhere; }
  </style>
</head>
<body>
  <main class="page">
    <header class="logo-row">${logo}</header>
    <section class="hero">
      <div class="invoice-title">
        <h1>INVOICE</h1><div class="coral-rule"></div>
        <p>${escapeHtml(invoice.customer_name || "")}</p>
      </div>
      <div class="meta">
        <div class="meta-row"><div class="icon">${iconSvg("calendar")}</div><div><p class="meta-label">Invoice Date</p><p class="meta-value">${escapeHtml(formatDate(invoice.issue_date))}</p></div></div>
        <div class="meta-row"><div class="icon">${iconSvg("document")}</div><div><p class="meta-label">Invoice Number</p><p class="meta-value">${escapeHtml(invoice.invoiceId)}</p></div></div>
      </div>
      <div class="company-card">
        <div class="building">${iconSvg("building")}</div>
        <strong>${escapeHtml(companyName)}</strong>
        <p>${settings.companyRegistrationNumber ? `Reg No. ${escapeHtml(settings.companyRegistrationNumber)}` : ""}</p>
        <p>${escapeHtml(settings.companyAddress)}</p>
      </div>
    </section>

    <table class="items">
      <thead><tr><th>Description</th><th>Quantity</th><th>Unit Price</th><th>Amount ${escapeHtml(currency)}</th></tr></thead>
      <tbody>${itemRows || `<tr><td colspan="4">No invoice items</td></tr>`}</tbody>
    </table>
    <section class="summary">
      <div class="due-panel"><div class="circle-icon">${iconSvg("calendar")}</div><div><p><strong>Due Date: ${escapeHtml(formatDate(invoice.due_date))}</strong></p><p>Payment Term: ${escapeHtml(paymentTerms)}</p></div></div>
      <table class="totals">
        <tr><td>Subtotal</td><td>${escapeHtml(formatMoney(subtotal, currency))}</td></tr>
        <tr><td>Total ${escapeHtml(currency)}</td><td><strong>${escapeHtml(formatMoney(total, currency))}</strong></td></tr>
        <tr><td>Less Amount Paid</td><td>${escapeHtml(formatMoney(amountPaid, currency))}</td></tr>
        <tr class="due"><td>Amount Due ${escapeHtml(currency)}</td><td>${escapeHtml(formatMoney(amountDue, currency))}</td></tr>
      </table>
    </section>

    <section class="payment-area">
      <div class="payment-grid">
        <div class="payment-box"><div class="circle-icon">${iconSvg("bank")}</div><div>
          <p><strong>We accept payment via bank transfer to the following:</strong></p>
          <p>${escapeHtml(settings.bankAccountHolderName)}</p><p>Bank: ${escapeHtml(settings.bankName)}</p>
          <p>BIC/SWIFT: ${escapeHtml(settings.bicSwift)}</p><p>Account Number: ${escapeHtml(settings.bankAccountNumber)}</p>
        </div></div>
        <div class="payment-box"><div class="circle-icon">${iconSvg("paynow")}</div><div class="paynow-content"><p>Payment via PayNow to ${escapeHtml(settings.paynowIdentifier)}</p>${qrCode ? `<img class="qr" src="${escapeHtml(qrCode)}" alt="Payment QR code">` : ""}</div></div>
      </div>
      <div class="instruction"><div class="circle-icon">${iconSvg("info")}</div><p>${escapeHtml(settings.paymentReferenceInstruction)}</p></div>
      <div class="instruction"><div class="circle-icon">${iconSvg("clock")}</div><p>${escapeHtml(settings.payoutStatement)}</p></div>
      <div class="instruction"><div class="circle-icon">${iconSvg("document")}</div><p>${escapeHtml(settings.computerGeneratedStatement)}</p></div>
    </section>

    <footer class="footer"><div class="location">${iconSvg("pin")}</div><p>Registered Office: ${settings.financeEmail ? `Attention: ${escapeHtml(settings.financeEmail)}, ` : ""}${escapeHtml(settings.registeredOfficeAddress || settings.companyAddress)}</p></footer>
  </main>
</body>
</html>`;
}

module.exports = {
  buildInvoiceHtml,
  escapeHtml,
  generateInvoicePDF,
  hydrateInvoice
};
