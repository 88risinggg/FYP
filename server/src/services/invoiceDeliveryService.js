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

  const stripeUrl = /^https?:\/\//i.test(String(options.paymentUrl || ""))
    ? options.paymentUrl
    : null;
  const viewUrl = values.online_view_url;
  const primaryCta = stripeUrl || viewUrl;

  const secondary = "#ff5a52";
  const primary = "#061e4b";

  // QR code block — uses CID inline image if available
  const qrBlock = (stripeUrl && options.qrCodeDataUri)
    ? `<div style="margin:20px 0;padding:20px;border:1px solid #e8ddd9;border-radius:8px;background:#fafafa;text-align:center">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${primary}">Scan to Pay</p>
        <p style="margin:0 0 12px;font-size:11px;color:#7b6660">Point your phone camera at the QR code below</p>
        <img src="cid:qrcode@invoice" alt="Scan to pay" width="140" height="140"
          style="display:block;margin:0 auto;border:4px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.12)" />
        <p style="margin:12px 0 0;font-size:10px;color:#9e8e89;word-break:break-all">${escapeHtml(stripeUrl)}</p>
      </div>`
    : stripeUrl
      ? `<div style="margin:16px 0;padding:14px 16px;border:1px solid #e8ddd9;border-radius:6px;background:#fafafa">
          <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:${primary}">Payment Link</p>
          <p style="margin:0;font-size:10px;color:#7b6660;word-break:break-all">${escapeHtml(stripeUrl)}</p>
        </div>`
      : "";

  return `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:32px;color:#251E1F">
    <h1 style="margin:0 0 4px;font-size:22px;color:${primary}">${escapeHtml(values.company_name)}</h1>
    <div style="width:36px;height:3px;background:${secondary};margin-bottom:24px"></div>

    <div style="white-space:pre-line;line-height:1.65;margin-bottom:20px">${escapeHtml(body)}</div>

    ${qrBlock}

    <div style="margin:24px 0">
      <a href="${escapeHtml(primaryCta)}"
        style="display:inline-block;background:${secondary};color:#fff;padding:14px 32px;
               text-decoration:none;font-weight:700;font-size:15px;border-radius:4px;letter-spacing:0.3px">
        ${stripeUrl ? "Pay Invoice Now →" : "View &amp; Pay Invoice"}
      </a>
    </div>

    ${stripeUrl ? `<p style="font-size:12px;color:#7b6660;margin:0 0 4px">
      Or copy this link into your browser:
    </p>
    <p style="font-size:11px;color:#9e8e89;word-break:break-all;margin:0 0 20px">${escapeHtml(stripeUrl)}</p>` : ""}

    <hr style="border:none;border-top:1px solid #f0e8e5;margin:20px 0" />
    <p style="font-size:12px;color:#7b6660;margin:0">${escapeHtml(settings.supportEmail || settings.financeEmail || "")}</p>
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
      recipientEmail: hydratedInvoice.customer_email,
      subject: renderTemplate(settings.emailSubjectTemplate, templateValues(hydratedInvoice, settings, options)),
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

  return {
    provider: "smtp",
    messageId: info.messageId,
    deliveredAt: new Date().toISOString(),
    recipientEmail: hydratedInvoice.customer_email,
    subject: renderTemplate(settings.emailSubjectTemplate, values)
  };
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

  const subject = `Payment Receipt - Invoice ${invoice.invoiceId}`;
  if (!transporter) {
    const result = { provider: "console", deliveredAt: new Date().toISOString(), recipientEmail: invoice.customer_email, subject };
    await logPaymentReceiptDelivery(invoice, transactionId, "Sent", result);
    return result;
  }
  const smtpFrom = process.env.SMTP_FROM || process.env.SMTP_USER;
  try {
    const info = await transporter.sendMail({
      from: settings.senderName ? `"${String(settings.senderName).replaceAll('"', "")}" <${smtpFrom}>` : smtpFrom,
      replyTo: settings.replyToEmail || settings.financeEmail || undefined,
      to: invoice.customer_email,
      subject,
      html
    });
    const result = { provider: "smtp", messageId: info.messageId, deliveredAt: new Date().toISOString(), recipientEmail: invoice.customer_email, subject };
    await logPaymentReceiptDelivery(invoice, transactionId, "Sent", result);
    return result;
  } catch (error) {
    await logPaymentReceiptDelivery(invoice, transactionId, "Failed", { subject, errorMessage: error.message, errorCode: error.code });
    throw error;
  }
}

async function logPaymentReceiptDelivery(invoice, transactionId, deliveryStatus, metadata) {
  try {
    const { pool } = require("../config/db");
    const [invoices] = await pool.query("SELECT invoice_id FROM invoice WHERE invoiceId = ? LIMIT 1", [invoice.invoiceId]);
    const invoiceId = invoices[0]?.invoice_id;
    await pool.query(
      `INSERT INTO audit_logs (
         module, activity_type, action_description, affected_record, status, created_at, new_value,
         invoice_id, delivery_status, customer_email
       ) VALUES ('Invoice', 'email_delivery', ?, ?, ?, NOW(), ?, ?, ?, ?)`,
      [
        deliveryStatus === "Sent" ? "payment_receipt_sent" : "payment_receipt_email_failed",
        invoiceId ? String(invoiceId) : null,
        deliveryStatus === "Sent" ? "Success" : "Failed",
        JSON.stringify({ ...metadata, emailType: "Payment Receipt", transactionId, triggerSource: "System" }),
        invoiceId || null,
        deliveryStatus,
        invoice.customer_email || null
      ]
    );
  } catch (error) {
    console.error("[EMAIL LOG] Unable to record payment receipt delivery:", error.message);
  }
}

module.exports = {
  buildInvoiceEmailHtml,
  renderTemplate,
  sendInvoiceEmail,
  sendInvoiceSettingsTestEmail,
  sendPaymentReceiptEmail
};
