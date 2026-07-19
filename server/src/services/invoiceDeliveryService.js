const nodemailer = require("nodemailer");

const { defaultSettings, getInvoiceSettings } = require("../models/invoiceSettingsModel");
const { escapeHtml, generateInvoicePDF, hydrateInvoice } = require("./pdfService");

function createTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

function templateValues(invoice, settings, options = {}) {
  const viewUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/invoice/view/${invoice.invoiceId}`;
  const currency = settings.defaultCurrency || settings.general?.defaultCurrency || "SGD";
  return {
    invoice_number: invoice.invoiceId || "",
    customer_name: invoice.customer_name || "Customer",
    amount_due: `${currency} ${Number(invoice.total_amount || 0).toFixed(2)}`,
    due_date: invoice.due_date || "N/A",
    company_name: settings.companyName || "",
    online_view_url: viewUrl,
    payment_url: options.paymentUrl || viewUrl
  };
}

function renderTemplate(template, values) {
  return String(template || "").replace(/\{\{([a-z_]+)\}\}/g, (match, key) => (
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key] ?? "") : match
  ));
}

function buildInvoiceEmailHtml(invoice, settings, options = {}) {
  const values = templateValues(invoice, settings, options);
  const body = renderTemplate(settings.emailBodyTemplate || defaultSettings.emailBodyTemplate, values);
  const link = /^https?:\/\//i.test(String(options.paymentUrl || ""))
    ? options.paymentUrl
    : values.online_view_url;
  return `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:32px;color:#251E1F">
    <h1 style="margin:0 0 24px;color:#061e4b">${escapeHtml(values.company_name)}</h1>
    <div style="white-space:pre-line;line-height:1.65">${escapeHtml(body)}</div>
    <div style="margin:28px 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:#061e4b;color:#fff;padding:13px 28px;text-decoration:none;font-weight:bold">View &amp; Pay Invoice</a></div>
    <p style="font-size:12px;color:#7b6660">${escapeHtml(settings.supportEmail || settings.financeEmail || "")}</p>
  </div>`;
}

async function sendInvoiceEmail(invoice, options = {}) {
  const settings = { ...defaultSettings, ...((await getInvoiceSettings()) || {}) };
  const hydratedInvoice = await hydrateInvoice(invoice);
  const transporter = createTransporter();
  let pdfBuffer = options.pdfBuffer || null;

  if (settings.attachPdfInvoice !== false && !pdfBuffer) {
    pdfBuffer = await generateInvoicePDF(hydratedInvoice, options);
  }

  if (!transporter) {
    console.log(`[EMAIL] Invoice ${hydratedInvoice.invoiceId} -> ${hydratedInvoice.customer_email} (${hydratedInvoice.customer_name})`);
    if (pdfBuffer) console.log(`[EMAIL] PDF attached (${pdfBuffer.length} bytes)`);
    return {
      provider: "console",
      deliveredAt: new Date().toISOString(),
      message: "SMTP not configured. Email logged to console."
    };
  }

  const attachments = [];
  if (pdfBuffer && settings.attachPdfInvoice !== false) {
    attachments.push({
      filename: `${hydratedInvoice.invoiceId}.pdf`,
      content: pdfBuffer,
      contentType: "application/pdf"
    });
  }

  if (options.qrCodeDataUri) {
    const base64Data = String(options.qrCodeDataUri).split(",")[1];
    if (base64Data) {
      attachments.push({
        filename: "qrcode.png",
        content: Buffer.from(base64Data, "base64"),
        contentType: "image/png",
        cid: "qrcode@invoice"
      });
    }
  }

  const values = templateValues(hydratedInvoice, settings, options);
  const smtpFrom = process.env.SMTP_FROM || process.env.SMTP_USER;
  const info = await transporter.sendMail({
    from: settings.senderName
      ? `"${String(settings.senderName).replaceAll('"', "")}" <${smtpFrom}>`
      : smtpFrom,
    replyTo: settings.replyToEmail || settings.financeEmail || undefined,
    to: hydratedInvoice.customer_email,
    subject: renderTemplate(settings.emailSubjectTemplate, values),
    html: buildInvoiceEmailHtml(hydratedInvoice, settings, options),
    attachments
  });

  return { provider: "smtp", messageId: info.messageId, deliveredAt: new Date().toISOString() };
}

async function sendInvoiceSettingsTestEmail(recipient) {
  const issueDate = new Date();
  const dueDate = new Date(issueDate);
  dueDate.setDate(dueDate.getDate() + 30);
  return sendInvoiceEmail({
    invoiceId: "TEST-INVOICE",
    status: "Draft",
    issue_date: issueDate.toISOString().slice(0, 10),
    due_date: dueDate.toISOString().slice(0, 10),
    total_amount: 100,
    customer_name: "Test Recipient",
    customer_email: recipient,
    customer_address: "",
    items: [{ description: "Invoice email configuration test", quantity: 1, unit_price: 100, amount: 100 }]
  });
}

async function sendPaymentReceiptEmail(invoice, transactionId) {
  const transporter = createTransporter();
  const settings = { ...defaultSettings, ...((await getInvoiceSettings()) || {}) };
  const amount = Number(invoice.total_amount || 0).toFixed(2);
  const currency = settings.defaultCurrency || "SGD";
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px">
    <h1>${escapeHtml(settings.companyName || "Payment Receipt")}</h1>
    <h2>Payment received</h2>
    <p>Invoice: <strong>${escapeHtml(invoice.invoiceId)}</strong></p>
    <p>Amount paid: <strong>${escapeHtml(currency)} ${escapeHtml(amount)}</strong></p>
    <p>Transaction ID: <strong>${escapeHtml(transactionId)}</strong></p>
  </div>`;

  if (!transporter) return { provider: "console", deliveredAt: new Date().toISOString() };
  const smtpFrom = process.env.SMTP_FROM || process.env.SMTP_USER;
  const info = await transporter.sendMail({
    from: settings.senderName ? `"${String(settings.senderName).replaceAll('"', "")}" <${smtpFrom}>` : smtpFrom,
    replyTo: settings.replyToEmail || settings.financeEmail || undefined,
    to: invoice.customer_email,
    subject: `Payment Receipt - Invoice ${invoice.invoiceId}`,
    html
  });
  return { provider: "smtp", messageId: info.messageId, deliveredAt: new Date().toISOString() };
}

module.exports = {
  buildInvoiceEmailHtml,
  renderTemplate,
  sendInvoiceEmail,
  sendInvoiceSettingsTestEmail,
  sendPaymentReceiptEmail
};
