   /**
 * PDF Service - Fully Dynamic Template-Driven Invoice PDF Generation
 *
 * All visual attributes (colors, fonts, layout, display toggles) are loaded
 * from the invoice_settings database table at runtime.
 * No hardcoded styling values - everything is configurable by Admin.
 */

const fs = require("fs/promises");
const path = require("path");
const puppeteer = require("puppeteer-core");

const { pool } = require("../config/db");
const { defaultSettings, getInvoiceSettings } = require("../models/invoiceSettingsModel");
const { generateQRCode } = require("./qrCodeService");

// =====================================================
// Utility Functions
// =====================================================

function getExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  if (process.platform === "win32") {
    const fs = require("fs");
    const paths = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
      `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
    ];
    for (const p of paths) {
      if (p && fs.existsSync(p)) return p;
    }
    return paths[0]; // fallback to default
  }
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
  return /^(https?:|data:image\/(?:png|jpe?g|svg\+xml);base64,)/i.test(url) ? url : "";
}

function formatDate(value, format = "DD MMM YYYY") {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const day = String(date.getDate()).padStart(2, "0");
  const monthShort = new Intl.DateTimeFormat("en-SG", { month: "short" }).format(date);
  const monthLong = new Intl.DateTimeFormat("en-SG", { month: "long" }).format(date);
  const year = String(date.getFullYear());
  const yearShort = year.slice(-2);

  return format
    .replace("DD", day)
    .replace("MMM", monthShort)
    .replace("MM", String(date.getMonth() + 1).padStart(2, "0"))
    .replace("YYYY", year)
    .replace("YY", yearShort);
}

function formatMoney(value, settings = {}) {
  const precision = settings.decimalPrecision ?? 2;
  const symbol = settings.currencySymbol || "S$";
  const format = settings.currencyFormat || "symbol_before";
  const formatted = new Intl.NumberFormat("en-SG", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision
  }).format(Number(value || 0));

  if (format === "symbol_after") return `${formatted} ${symbol}`;
  return `${symbol}${formatted}`;
}

async function resolveLogoDataUri(logoUrl) {
  const directUrl = safeUrl(logoUrl);
  if (directUrl) return directUrl;
  if (!String(logoUrl || "").startsWith("/uploads/invoice-logos/")) return "";
  try {
    const fileName = path.basename(logoUrl);
    const filePath = path.join(__dirname, "..", "..", "uploads", "invoice-logos", fileName);
    const content = await fs.readFile(filePath);
    const ext = path.extname(fileName).toLowerCase();
    const mimeType = ext === ".png" ? "image/png" : ext === ".svg" ? "image/svg+xml" : "image/jpeg";
    return `data:${mimeType};base64,${content.toString("base64")}`;
  } catch { return ""; }
}

async function resolveImageDataUri(imageUrl) {
  const directUrl = safeUrl(imageUrl);
  if (directUrl) return directUrl;
  if (!imageUrl) return "";
  try {
    const fileName = path.basename(imageUrl);
    const filePath = path.join(__dirname, "..", "..", "uploads", fileName);
    const content = await fs.readFile(filePath);
    const ext = path.extname(fileName).toLowerCase();
    const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
    return `data:${mimeType};base64,${content.toString("base64")}`;
  } catch { return ""; }
}

// =====================================================
// Invoice Data Hydration
// =====================================================

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
      if (items.length > 0) {
        hydrated.items = items;
      }
    } catch {
      // invoice_item table may not exist — continue to items_json fallback
    }

    // Fall back to items_json if no items found from invoice_item
    if (!Array.isArray(hydrated.items) || hydrated.items.length === 0) {
      try {
        const jsonSource = hydrated.items_json;
        const parsed = typeof jsonSource === "string"
          ? JSON.parse(jsonSource || "[]")
          : jsonSource;
        hydrated.items = Array.isArray(parsed) ? parsed : [];
      } catch {
        hydrated.items = [];
      }
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

// =====================================================
// Dynamic CSS Generation (from settings)
// =====================================================

function buildDynamicStyles(settings) {
  const primary = settings.primaryColor || "#061e4b";
  const secondary = settings.secondaryColor || "#ff5a52";
  const fontFamily = settings.fontFamily || "Arial, Helvetica, sans-serif";
  const fontSize = settings.fontSizeBase || 12;
  const borderStyle = settings.invoiceBorderStyle || "modern";
  const tableStyle = settings.itemTableStyle || "striped";

  const borderCss = borderStyle === "classic"
    ? "border: 1px solid #333;"
    : borderStyle === "minimal"
      ? "border: none;"
      : ""; // modern = default styling

  const tableRowCss = tableStyle === "striped"
    ? `.items tbody tr:nth-child(even) { background: #f8f9fa; }`
    : tableStyle === "bordered"
      ? `.items td { border: 1px solid #dee2e6; }`
      : "";

  return `
    :root {
      --primary: ${primary};
      --secondary: ${secondary};
      --font-family: ${fontFamily};
      --font-size-base: ${fontSize}pt;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; color: ${primary}; font-family: var(--font-family); background: #fff; font-size: var(--font-size-base); }
    body { width: 210mm; min-height: 297mm; }
    .page { width: 210mm; min-height: 297mm; padding: 8mm 7.5mm 6mm; display: flex; flex-direction: column; overflow: hidden; ${borderCss} position: relative; }
    ${tableRowCss}
  `;
}

// =====================================================
// Watermark Generation
// =====================================================

function buildWatermark(invoice, settings) {
  if (!settings.watermarkEnabled) return "";
  const status = invoice.status || "Draft";
  const watermarkMap = { Paid: "PAID", Draft: "DRAFT", Overdue: "OVERDUE", Cancelled: "VOID", Void: "VOID" };
  const text = watermarkMap[status];
  if (!text) return "";
  const color = status === "Paid" ? "#22c55e" : status === "Overdue" ? "#ef4444" : "#94a3b8";
  return `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:72pt;font-weight:900;color:${color};opacity:0.08;pointer-events:none;z-index:0;white-space:nowrap;">${text}</div>`;
}

// =====================================================
// Header Section
// =====================================================

function buildHeader(invoice, settings, options) {
  const primary = settings.primaryColor || "#061e4b";
  const secondary = settings.secondaryColor || "#ff5a52";
  const brandName = settings.companyName || "COMPANY";
  const logo = safeUrl(options.logoDataUri)
    ? `<img class="logo-image" src="${escapeHtml(options.logoDataUri)}" alt="Company logo">`
    : `<div class="wordmark">${escapeHtml(brandName)}<span style="color:${secondary}">.</span></div>`;

  return `<header style="display:flex;align-items:flex-start;height:20mm;border-bottom:.35mm solid #7f8ba2;padding-bottom:3mm;">
    <div style="width:2.1mm;height:16.5mm;margin-right:7mm;background:${secondary};flex-shrink:0;"></div>
    ${logo}
  </header>`;
}

// =====================================================
// Hero / Meta Section
// =====================================================

function buildHeroSection(invoice, settings) {
  const primary = settings.primaryColor || "#061e4b";
  const secondary = settings.secondaryColor || "#ff5a52";
  const dateStr = formatDate(invoice.issue_date, settings.displayDateFormat);

  const companyCard = `<div style="padding:5mm 5.5mm;background:${primary};color:white;min-width:0;">
    <strong style="display:block;margin-bottom:1.2mm;font-size:7.5pt;">${escapeHtml(settings.companyName)}</strong>
    ${settings.companyRegistrationNumber ? `<p style="margin:.55mm 0;font-size:6.8pt;">Reg. No. ${escapeHtml(settings.companyRegistrationNumber)}</p>` : ""}
    ${settings.uenNumber ? `<p style="margin:.55mm 0;font-size:6.8pt;">UEN: ${escapeHtml(settings.uenNumber)}</p>` : ""}
    ${settings.gstRegistrationNumber ? `<p style="margin:.55mm 0;font-size:6.8pt;">GST Reg: ${escapeHtml(settings.gstRegistrationNumber)}</p>` : ""}
    <p style="margin:.55mm 0;font-size:6.8pt;">${escapeHtml(settings.companyAddress)}</p>
    ${settings.companyPhone ? `<p style="margin:.55mm 0;font-size:6.8pt;">Tel: ${escapeHtml(settings.companyPhone)}</p>` : ""}
    ${settings.companyEmail ? `<p style="margin:.55mm 0;font-size:6.8pt;">${escapeHtml(settings.companyEmail)}</p>` : ""}
  </div>`;

  return `<section style="display:grid;grid-template-columns:44.5% 26% 29.5%;min-height:49mm;border-bottom:.3mm solid #c7ced8;">
    <div style="padding:10.5mm 5mm 5mm 0;">
      <h1 style="margin:0;font-size:27pt;line-height:1;letter-spacing:1.2px;color:${primary};">INVOICE</h1>
      <div style="width:12mm;height:1.1mm;margin:3.8mm 0 5mm;background:${secondary};"></div>
      <p style="margin:0;font-size:8pt;line-height:1.4;font-weight:700;color:#263653;">${escapeHtml(invoice.customer_name || "")}</p>
      ${invoice.service_provider || invoice.shop_title ? `<p style="margin:1mm 0 0;font-size:7pt;color:#555;">Service Provider: ${escapeHtml(invoice.service_provider || invoice.shop_title || "")}</p>` : ""}
      ${invoice.customer_email ? `<p style="margin:2mm 0 0;font-size:7pt;color:#555;">${escapeHtml(invoice.customer_email)}</p>` : ""}
      ${invoice.customer_address ? `<p style="margin:1mm 0 0;font-size:7pt;color:#555;">${escapeHtml(invoice.customer_address)}</p>` : ""}
    </div>
    <div style="border-left:1px solid #d8dce3;display:grid;grid-template-rows:1fr 1fr;">
      <div style="display:grid;grid-template-columns:13mm 1fr;align-items:center;padding:3.5mm 3mm;border-bottom:.3mm solid #d8dce3;">
        <div style="color:${secondary};text-align:center;"><svg viewBox="0 0 24 24" width="6mm" height="6mm" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg></div>
        <div><p style="margin:0 0 1.4mm;font-size:6pt;font-weight:800;text-transform:uppercase;">Invoice Date</p><p style="margin:0;font-size:7.5pt;font-weight:600;">${escapeHtml(dateStr)}</p></div>
      </div>
      <div style="display:grid;grid-template-columns:13mm 1fr;align-items:center;padding:3.5mm 3mm;">
        <div style="color:${secondary};text-align:center;"><svg viewBox="0 0 24 24" width="6mm" height="6mm" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 2h9l4 4v16H6z"/><path d="M14 2v5h5M9 12h7M9 16h7"/></svg></div>
        <div><p style="margin:0 0 1.4mm;font-size:6pt;font-weight:800;text-transform:uppercase;">Invoice Number</p><p style="margin:0;font-size:7.5pt;font-weight:600;">${escapeHtml(invoice.invoiceId)}</p></div>
      </div>
    </div>
    ${companyCard}
  </section>`;
}

// =====================================================
// Line Items Table
// =====================================================

function buildItemsTable(invoice, settings) {
  const primary = settings.primaryColor || "#061e4b";
  const secondary = settings.secondaryColor || "#ff5a52";
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const currency = settings.defaultCurrency || "SGD";

  const itemRows = items.map((item, index) => {
    const amount = Number(item.amount ?? Number(item.quantity || 0) * Number(item.unit_price || 0));
    return `<tr>
      <td style="display:flex;gap:3.5mm;height:auto;min-height:12mm;padding:4.2mm 3.5mm;border:.3mm solid #d7dbe2;border-top:0;font-size:7.2pt;vertical-align:top;">
        <span style="display:inline-flex;width:8mm;height:8mm;flex:0 0 8mm;align-items:center;justify-content:center;background:${secondary};color:white;font-size:7pt;font-weight:800;">${String(index + 1).padStart(2, "0")}</span>
        <span>${escapeHtml(item.description)}</span>
      </td>
      <td style="text-align:right;padding:4.2mm 3.5mm;border:.3mm solid #d7dbe2;border-top:0;font-size:7.2pt;vertical-align:top;">${Number(item.quantity || 0).toFixed(2)}</td>
      <td style="text-align:right;padding:4.2mm 3.5mm;border:.3mm solid #d7dbe2;border-top:0;font-size:7.2pt;vertical-align:top;">${formatMoney(item.unit_price, settings)}</td>
      <td style="text-align:right;padding:4.2mm 3.5mm;border:.3mm solid #d7dbe2;border-top:0;font-size:7.2pt;vertical-align:top;">${formatMoney(amount, settings)}</td>
    </tr>`;
  }).join("");

  return `<table class="items" style="width:100%;margin-top:5.5mm;border-collapse:collapse;table-layout:fixed;">
    <thead><tr>
      <th style="width:58%;height:9mm;padding:2.5mm 3.5mm;background:${primary};color:white;border-right:.3mm solid rgba(255,255,255,0.2);font-size:6.7pt;text-align:left;text-transform:uppercase;">Description</th>
      <th style="width:14%;height:9mm;padding:2.5mm 3.5mm;background:${primary};color:white;border-right:.3mm solid rgba(255,255,255,0.2);font-size:6.7pt;text-align:center;text-transform:uppercase;">Qty</th>
      <th style="width:14%;height:9mm;padding:2.5mm 3.5mm;background:${primary};color:white;border-right:.3mm solid rgba(255,255,255,0.2);font-size:6.7pt;text-align:center;text-transform:uppercase;">Unit Price</th>
      <th style="width:14%;height:9mm;padding:2.5mm 3.5mm;background:${primary};color:white;font-size:6.7pt;text-align:center;text-transform:uppercase;">Amount ${escapeHtml(currency)}</th>
    </tr></thead>
    <tbody>${itemRows || `<tr><td colspan="4" style="padding:8mm;text-align:center;color:#999;">No invoice items</td></tr>`}</tbody>
  </table>`;
}

// =====================================================
// Summary / Totals Section
// =====================================================

function buildSummarySection(invoice, settings) {
  const primary = settings.primaryColor || "#061e4b";
  const secondary = settings.secondaryColor || "#ff5a52";
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const currency = settings.defaultCurrency || "SGD";

  const subtotal = items.length
    ? items.reduce((sum, item) => sum + Number(item.amount ?? Number(item.quantity || 0) * Number(item.unit_price || 0)), 0)
    : Number(invoice.total_amount || 0);

  // Tax calculation
  let taxAmount = 0;
  if (settings.taxEnabled && settings.taxPercentage > 0) {
    if (settings.taxInclusive) {
      taxAmount = subtotal - (subtotal / (1 + settings.taxPercentage / 100));
    } else {
      taxAmount = subtotal * (settings.taxPercentage / 100);
    }
  }

  const total = settings.taxInclusive ? subtotal : subtotal + taxAmount;
  const displayTotal = Number(invoice.total_amount || total);
  const amountPaid = Math.min(displayTotal, Math.max(0, Number(invoice.amount_paid || 0)));
  const amountDue = Math.max(0, displayTotal - amountPaid);
  const dueDate = formatDate(invoice.due_date, settings.displayDateFormat);
  const paymentTerms = settings.paymentTerms || "Net 30";

  let taxRow = "";
  if (settings.taxEnabled && settings.taxPercentage > 0) {
    taxRow = `<tr><td style="height:10mm;padding:2.6mm 3.5mm;border:.3mm solid #e0e3e8;font-size:7.3pt;font-weight:800;text-transform:uppercase;">${escapeHtml(settings.taxName)} (${settings.taxPercentage}%)</td><td style="height:10mm;padding:2.6mm 3.5mm;border:.3mm solid #e0e3e8;font-size:7.3pt;text-align:right;">${formatMoney(taxAmount, settings)}</td></tr>`;
  }

  return `<section style="display:grid;grid-template-columns:56% 44%;break-inside:avoid;border-bottom:.35mm solid ${primary};">
    <div style="display:grid;grid-template-columns:13mm 1fr;align-items:center;align-self:end;min-height:18mm;padding-bottom:2mm;">
      <div style="width:10mm;height:10mm;display:flex;align-items:center;justify-content:center;border-radius:50%;background:${primary};color:white;">
        <svg viewBox="0 0 24 24" width="5mm" height="5mm" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>
      </div>
      <div><p style="margin:.65mm 0;font-size:7.4pt;"><strong style="font-weight:800;text-transform:uppercase;">Due Date: ${escapeHtml(dueDate)}</strong></p><p style="margin:.65mm 0;font-size:7.4pt;">Payment Term: ${escapeHtml(paymentTerms)}</p></div>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="height:10mm;padding:2.6mm 3.5mm;border:.3mm solid #e0e3e8;font-size:7.3pt;font-weight:800;text-transform:uppercase;">Subtotal</td><td style="height:10mm;padding:2.6mm 3.5mm;border:.3mm solid #e0e3e8;font-size:7.3pt;text-align:right;">${formatMoney(subtotal, settings)}</td></tr>
      ${taxRow}
      <tr><td style="height:10mm;padding:2.6mm 3.5mm;border:.3mm solid #e0e3e8;font-size:7.3pt;font-weight:800;text-transform:uppercase;">Total ${escapeHtml(currency)}</td><td style="height:10mm;padding:2.6mm 3.5mm;border:.3mm solid #e0e3e8;font-size:7.3pt;text-align:right;"><strong>${formatMoney(displayTotal, settings)}</strong></td></tr>
      <tr><td style="height:10mm;padding:2.6mm 3.5mm;border:.3mm solid #e0e3e8;font-size:7.3pt;font-weight:800;text-transform:uppercase;">Less Amount Paid</td><td style="height:10mm;padding:2.6mm 3.5mm;border:.3mm solid #e0e3e8;font-size:7.3pt;text-align:right;">${formatMoney(amountPaid, settings)}</td></tr>
      <tr><td style="height:10mm;padding:2.6mm 3.5mm;background:${secondary};color:white;font-weight:800;font-size:7.3pt;text-transform:uppercase;">Amount Due ${escapeHtml(currency)}</td><td style="height:10mm;padding:2.6mm 3.5mm;background:${secondary};color:white;font-weight:800;font-size:7.3pt;text-align:right;">${formatMoney(amountDue, settings)}</td></tr>
    </table>
  </section>`;
}

// =====================================================
// Payment Section (Bank, PayNow, QR)
// =====================================================

function buildPaymentSection(invoice, settings, options) {
  const primary = settings.primaryColor || "#061e4b";
  const secondary = settings.secondaryColor || "#ff5a52";
  const qrCode = safeUrl(options.qrCodeDataUri);
  const showBank = settings.bankDetailsDisplay;
  const showPaynow = settings.paynowDisplay;
  const showQr = settings.qrCodeDisplay && qrCode;

  if (!showBank && !showPaynow) return "";

  const bankBox = showBank ? `<div style="padding:4mm 3mm 4mm 0;display:grid;grid-template-columns:13mm 1fr;">
    <div style="width:10mm;height:10mm;display:flex;align-items:center;justify-content:center;border-radius:50%;background:${secondary};color:white;">
      <svg viewBox="0 0 24 24" width="5mm" height="5mm" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 10h18M5 10v8M9 10v8M15 10v8M19 10v8M3 19h18M2 7l10-5 10 5z"/></svg>
    </div>
    <div>
      <p style="margin:0 0 1.5mm;font-size:7pt;font-weight:700;">We accept payment via bank transfer to the following:</p>
      <p style="margin:.6mm 0;font-size:7pt;">${escapeHtml(settings.bankAccountHolderName)}</p>
      <p style="margin:.6mm 0;font-size:7pt;">Bank: ${escapeHtml(settings.bankName)}</p>
      <p style="margin:.6mm 0;font-size:7pt;">BIC/SWIFT: ${escapeHtml(settings.bicSwift)}</p>
      <p style="margin:.6mm 0;font-size:7pt;">Account Number: ${escapeHtml(settings.bankAccountNumber)}</p>
    </div>
  </div>` : "";

  const paynowBox = showPaynow ? `<div style="padding:4mm 3mm 4mm 5mm;${showBank ? "border-left:1px solid #d8dce3;" : ""}display:grid;grid-template-columns:13mm 1fr;align-items:center;">
    <div style="width:10mm;height:10mm;display:flex;align-items:center;justify-content:center;border-radius:50%;background:${secondary};color:white;">
      <svg viewBox="0 0 24 24" width="5mm" height="5mm" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M9 6h6M8 10h8M8 14h5M10 18h4"/></svg>
    </div>
    <div style="display:flex;align-items:center;gap:3mm;">
      <p style="margin:0;font-size:7pt;">Payment via PayNow to <strong>${escapeHtml(settings.paynowIdentifier)}</strong></p>
      ${showQr ? `<img src="${escapeHtml(qrCode)}" alt="QR" style="width:18mm;height:18mm;object-fit:contain;">` : ""}
    </div>
  </div>` : "";

  return `<section style="break-inside:avoid;border-bottom:.3mm solid #d8dce3;">
    <div style="display:grid;grid-template-columns:${showBank && showPaynow ? "58% 42%" : "1fr"};">
      ${bankBox}${paynowBox}
    </div>
  </section>`;
}

// =====================================================
// Signature & Stamp Section
// =====================================================

function buildSignatureSection(settings, options) {
  if (!settings.signatureDisplay) return "";
  const signatureImg = safeUrl(options.signatureDataUri || settings.signatureUrl);
  const stampImg = safeUrl(options.stampDataUri || settings.companyStampUrl);

  return `<section style="display:flex;justify-content:flex-end;align-items:flex-end;gap:12mm;padding:6mm 5mm 4mm;break-inside:avoid;">
    ${stampImg ? `<div style="text-align:center;"><img src="${escapeHtml(stampImg)}" alt="Company Stamp" style="max-width:30mm;max-height:30mm;object-fit:contain;"><p style="margin:2mm 0 0;font-size:6pt;color:#666;">Company Stamp</p></div>` : ""}
    ${signatureImg ? `<div style="text-align:center;"><img src="${escapeHtml(signatureImg)}" alt="Signature" style="max-width:35mm;max-height:20mm;object-fit:contain;"><div style="width:35mm;border-top:0.3mm solid #333;margin-top:2mm;"></div><p style="margin:2mm 0 0;font-size:6pt;color:#666;">Authorized Signature</p></div>` : ""}
  </section>`;
}

// =====================================================
// Footer Section
// =====================================================

function buildFooterSection(invoice, settings) {
  const primary = settings.primaryColor || "#061e4b";
  const secondary = settings.secondaryColor || "#ff5a52";
  const footerNote = settings.footerNote || "";
  const computerStatement = settings.computerGeneratedStatement || "";
  const payoutStatement = settings.payoutStatement || "";

  let paymentRefHtml = "";
  if (settings.paymentReferenceInstruction) {
    paymentRefHtml = `<div style="display:grid;grid-template-columns:12mm 1fr;align-items:start;min-height:10mm;border-bottom:.3mm solid #d8dce3;padding:2.5mm 0;">
      <div style="width:8mm;height:8mm;display:flex;align-items:center;justify-content:center;border-radius:50%;background:${primary};color:white;"><svg viewBox="0 0 24 24" width="4mm" height="4mm" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></svg></div>
      <p style="margin:0;font-size:7pt;color:#333;padding-top:1.5mm;">${escapeHtml(settings.paymentReferenceInstruction)}</p>
    </div>`;
  }

  let payoutHtml = "";
  if (payoutStatement) {
    payoutHtml = `<div style="display:grid;grid-template-columns:12mm 1fr;align-items:start;min-height:10mm;border-bottom:.3mm solid #d8dce3;padding:2.5mm 0;">
      <div style="width:8mm;height:8mm;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#e8e8e8;color:#666;"><svg viewBox="0 0 24 24" width="4mm" height="4mm" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
      <p style="margin:0;font-size:7pt;color:#555;padding-top:1.5mm;">${escapeHtml(payoutStatement)}</p>
    </div>`;
  }

  let computerHtml = "";
  if (computerStatement) {
    computerHtml = `<div style="display:grid;grid-template-columns:12mm 1fr;align-items:start;min-height:10mm;border-bottom:.3mm solid #d8dce3;padding:2.5mm 0;">
      <div style="width:8mm;height:8mm;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#e8e8e8;color:#666;"><svg viewBox="0 0 24 24" width="4mm" height="4mm" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
      <p style="margin:0;font-size:7pt;color:#555;padding-top:1.5mm;">${escapeHtml(computerStatement)}</p>
    </div>`;
  }

  let registeredOfficeHtml = "";
  if (settings.registeredOfficeAddress || settings.financeEmail) {
    const officeLine = [
      settings.financeEmail ? `Attention: ${settings.financeEmail}` : "",
      settings.registeredOfficeAddress || settings.companyAddress
    ].filter(Boolean).join(", ");
    registeredOfficeHtml = `<div style="display:grid;grid-template-columns:12mm 1fr;align-items:start;margin-top:3mm;padding-top:3mm;border-top:.3mm solid ${primary};">
      <div style="width:8mm;height:8mm;display:flex;align-items:center;justify-content:center;border-radius:50%;background:${secondary};color:white;"><svg viewBox="0 0 24 24" width="4mm" height="4mm" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div>
      <p style="margin:0;font-size:6.5pt;color:#555;padding-top:1.5mm;"><strong>Registered Office:</strong> ${escapeHtml(officeLine)}</p>
    </div>`;
  }

  return `<footer style="margin-top:auto;padding-top:4mm;">
    ${paymentRefHtml}
    ${payoutHtml}
    ${computerHtml}
    ${registeredOfficeHtml}
  </footer>`;
}

// =====================================================
// Main HTML Builder
// =====================================================

function buildInvoiceHtml(invoice, settings = defaultSettings, options = {}) {
  const dynamicStyles = buildDynamicStyles(settings);
  const watermark = buildWatermark(invoice, settings);
  const header = buildHeader(invoice, settings, options);
  const hero = buildHeroSection(invoice, settings);
  const itemsTable = buildItemsTable(invoice, settings);
  const summary = buildSummarySection(invoice, settings);
  const payment = buildPaymentSection(invoice, settings, options);
  const signature = buildSignatureSection(settings, options);
  const footer = buildFooterSection(invoice, settings);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    @page { size: ${settings.pdfPageSize || "A4"} ${settings.pdfOrientation || "portrait"}; margin: 0; }
    ${dynamicStyles}
    .logo-image { max-width: 62mm; max-height: 16.5mm; object-fit: contain; object-position: left top; }
    .wordmark { color: ${settings.primaryColor || "#07132f"}; font-family: Georgia, "Times New Roman", serif; font-size: 25pt; line-height: 1; font-weight: 700; letter-spacing: .8px; white-space: nowrap; }
  </style>
</head>
<body>
  <main class="page">
    ${watermark}
    ${header}
    ${hero}
    ${itemsTable}
    ${summary}
    ${payment}
    ${signature}
    ${footer}
  </main>
</body>
</html>`;
}

// =====================================================
// PDF Generation (Puppeteer)
// =====================================================

async function generateInvoicePDF(invoice, options = {}) {
  const hydratedInvoice = await hydrateInvoice(invoice);
  const settings = {
    ...defaultSettings,
    ...(options.settings || (await getInvoiceSettings()) || {})
  };
  const logoDataUri = await resolveLogoDataUri(settings.branding?.companyLogoUrl || settings.companyLogoUrl);
  const signatureDataUri = await resolveImageDataUri(settings.signatureUrl);
  const stampDataUri = await resolveImageDataUri(settings.companyStampUrl);

  let qrCodeDataUri = options.qrCodeDataUri || hydratedInvoice.qr_code_url || null;
  const paymentUrl = options.paymentUrl || hydratedInvoice.payment_url || null;

  if (paymentUrl && !["Paid", "Cancelled", "Refunded"].includes(hydratedInvoice.status) && !qrCodeDataUri && settings.qrCodeDisplay) {
    qrCodeDataUri = await generateQRCode(paymentUrl);
  }

  const html = buildInvoiceHtml(hydratedInvoice, settings, {
    paymentUrl,
    qrCodeDataUri,
    logoDataUri,
    signatureDataUri,
    stampDataUri
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
      format: settings.pdfPageSize || "A4",
      landscape: settings.pdfOrientation === "landscape",
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      printBackground: true,
      preferCSSPageSize: true
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

module.exports = {
  buildInvoiceHtml,
  escapeHtml,
  formatDate,
  formatMoney,
  generateInvoicePDF,
  hydrateInvoice
};
