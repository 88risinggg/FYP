const { defaultSettings, getInvoiceSettings } = require("../models/invoiceSettingsModel");
const { escapeHtml, generateInvoicePDF, hydrateInvoice } = require("./pdfService");
const { createEmailTransport, emailFrom, publicClientUrl } = require("./emailTransportService");
const {
  createEmailLog,
  markEmailSent,
  markEmailFailed,
  isDuplicateEmail
} = require("./integrationLogService");

const invoiceEmailPlaceholders = new Map([
  ["invoice_number", "Invoice Number"],
  ["customer_name", "Customer Name"],
  ["amount_due", "Amount Due"],
  ["due_date", "Due Date"],
  ["company_name", "Company Name"],
  ["online_view_url", "Online Invoice"],
  ["payment_url", "Payment Link"]
]);

function formatEmailDate(value) {
  const source = String(value || "").trim();
  if (!source) return "N/A";

  const dateOnly = source.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = dateOnly
    ? new Date(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])))
    : new Date(source);

  if (Number.isNaN(date.getTime())) return source;
  return new Intl.DateTimeFormat("en-SG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

function validateInvoiceEmailTemplates(subjectTemplate, bodyTemplate) {
  const allowedPlaceholders = new Set(invoiceEmailPlaceholders.keys());
  const placeholderNames = [...allowedPlaceholders].join("|");
  const errors = [];

  if (!String(subjectTemplate || "").trim()) {
    errors.push("Subject Template is required.");
  }
  if (!String(bodyTemplate || "").trim()) {
    errors.push("Email Body is required.");
  }

  for (const { location, value } of [
    { location: "Subject Template", value: subjectTemplate },
    { location: "Email Body", value: bodyTemplate }
  ]) {
    const template = String(value || "");

    for (const match of template.matchAll(/\{\{([^{}]+)\}\}/g)) {
      if (!allowedPlaceholders.has(match[1])) {
        errors.push(`Unsupported email placeholder "{{${match[1]}}}" in ${location}.`);
      }
    }
    for (const match of template.matchAll(/\{+([a-z_]+)\}+/g)) {
      if (!allowedPlaceholders.has(match[1])) {
        errors.push(`Unsupported email placeholder "${match[0]}" in ${location}.`);
      }
    }

    const knownPlaceholderPattern = new RegExp(`\\b(${placeholderNames})\\b`, "g");
    for (const match of template.matchAll(knownPlaceholderPattern)) {
      const key = match[1];
      const placeholderLabel = invoiceEmailPlaceholders.get(key);
      let openingBraces = 0;
      let closingBraces = 0;

      for (let index = match.index - 1; index >= 0 && template[index] === "{"; index -= 1) {
        openingBraces += 1;
      }
      for (
        let index = match.index + key.length;
        index < template.length && template[index] === "}";
        index += 1
      ) {
        closingBraces += 1;
      }

      if (openingBraces < 2) {
        const missingCount = 2 - openingBraces;
        errors.push(
          `The ${placeholderLabel} placeholder "{{${key}}}" in ${location} is missing ${
            missingCount === 1 ? 'an opening "{" symbol' : 'two opening "{" symbols'
          }.`
        );
      } else if (openingBraces > 2) {
        errors.push(`The ${placeholderLabel} placeholder "{{${key}}}" in ${location} has an extra opening "{" symbol.`);
      }

      if (closingBraces < 2) {
        const missingCount = 2 - closingBraces;
        errors.push(
          `The ${placeholderLabel} placeholder "{{${key}}}" in ${location} is missing ${
            missingCount === 1 ? 'a closing "}" symbol' : 'two closing "}" symbols'
          }.`
        );
      } else if (closingBraces > 2) {
        errors.push(`The ${placeholderLabel} placeholder "{{${key}}}" in ${location} has an extra closing "}" symbol.`);
      }
    }
  }

  return [...new Set(errors)];
}

function assertInvoiceEmailTemplatesValid(settings) {
  const errors = validateInvoiceEmailTemplates(
    settings?.emailSubjectTemplate,
    settings?.emailBodyTemplate
  );
  if (errors.length === 0) return;

  const error = new Error(
    `Invoice email cannot be sent. ${errors[0]} Please ask Admin to correct the Invoice Email Settings before trying again.`
  );
  error.code = "INVALID_INVOICE_EMAIL_TEMPLATE";
  error.statusCode = 400;
  error.validationErrors = errors;
  throw error;
}

function templateValues(invoice, settings, options = {}) {
  const viewUrl = `${publicClientUrl()}/invoice/view/${invoice.invoiceId}`;
  const currency = settings.defaultCurrency || settings.general?.defaultCurrency || "SGD";
  return {
    invoice_number: invoice.invoiceId || "",
    customer_name: invoice.customer_name || "Customer",
    amount_due: `${currency} ${Number(invoice.total_amount || 0).toFixed(2)}`,
    due_date: formatEmailDate(invoice.due_date),
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
  const invoiceLink = viewUrl;
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
    <p style="font-size:12px;color:#7b6660;margin:0 0 4px">
      View invoice online:
    </p>
    <p style="font-size:11px;color:#9e8e89;word-break:break-all;margin:0 0 20px">${escapeHtml(invoiceLink)}</p>

    <hr style="border:none;border-top:1px solid #f0e8e5;margin:20px 0" />
    <p style="font-size:12px;color:#7b6660;margin:0">${escapeHtml(settings.supportEmail || settings.financeEmail || "")}</p>
  </div>`;
}

async function sendInvoiceEmail(invoice, options = {}) {
  const companyId = options.companyId || invoice.company_id || invoice.companyId || null;
  const savedSettings = (await getInvoiceSettings(companyId)) || {};
  const settings = {
    ...defaultSettings,
    ...savedSettings,
    ...(options.settingsOverride || {})
  };
  assertInvoiceEmailTemplatesValid(settings);
  const hydratedInvoice = await hydrateInvoice(invoice);
  const transporter = createEmailTransport();
  let pdfBuffer = options.pdfBuffer || null;

  if (settings.attachPdfInvoice !== false && !pdfBuffer) {
    pdfBuffer = await generateInvoicePDF(hydratedInvoice, options);
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
  const smtpFrom = emailFrom();
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

async function sendInvoiceSettingsTestEmail(recipient, options = {}) {
  const issueDate = new Date();
  const dueDate = new Date(issueDate);
  dueDate.setDate(dueDate.getDate() + 30);
  return sendInvoiceEmail({
    invoiceId: "TEST-INVOICE",
    company_id: options.companyId || null,
    status: "Draft",
    issue_date: issueDate.toISOString().slice(0, 10),
    due_date: dueDate.toISOString().slice(0, 10),
    total_amount: 100,
    customer_name: "Test Recipient",
    customer_email: recipient,
    customer_address: "",
    items: [{ description: "Invoice email configuration test", quantity: 1, unit_price: 100, amount: 100 }]
  }, {
    companyId: options.companyId || null,
    settingsOverride: options.settings || null
  });
}

async function sendPaymentReceiptEmail(invoice, transactionId) {
  // Deduplication: prevent sending the same payment receipt twice
  const dedupKey = `payment_confirmation:${invoice.invoiceId}:${transactionId}`;
  const alreadySent = await isDuplicateEmail(dedupKey);
  if (alreadySent) {
    return { provider: "skipped", message: "Payment receipt already sent for this transaction." };
  }

  const transporter = createEmailTransport();
  const settings = { ...defaultSettings, ...((await getInvoiceSettings(invoice.company_id || invoice.companyId || null)) || {}) };
  const amount = Number(invoice.total_amount || 0).toFixed(2);
  const currency = settings.defaultCurrency || "SGD";
  const subject = `Payment Receipt - Invoice ${invoice.invoiceId}`;
  const recipient = invoice.customer_email;

  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px">
    <h1>${escapeHtml(settings.companyName || "Payment Receipt")}</h1>
    <h2>Payment received</h2>
    <p>Dear ${escapeHtml(invoice.customer_name || "Customer")},</p>
    <p>We have received your payment. Here are the details:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:8px 0;color:#7b6660">Invoice:</td><td style="padding:8px 0;font-weight:700">${escapeHtml(invoice.invoiceId)}</td></tr>
      <tr><td style="padding:8px 0;color:#7b6660">Amount paid:</td><td style="padding:8px 0;font-weight:700">${escapeHtml(currency)} ${escapeHtml(amount)}</td></tr>
      <tr><td style="padding:8px 0;color:#7b6660">Transaction ID:</td><td style="padding:8px 0;font-weight:700">${escapeHtml(transactionId)}</td></tr>
      <tr><td style="padding:8px 0;color:#7b6660">Date:</td><td style="padding:8px 0">${new Date().toLocaleDateString("en-SG", { day: "2-digit", month: "short", year: "numeric" })}</td></tr>
    </table>
    <p style="color:#7b6660">Thank you for your payment.</p>
    <hr style="border:none;border-top:1px solid #f0e8e5;margin:20px 0" />
    <p style="font-size:12px;color:#9e8e89">${escapeHtml(settings.companyName || "PayNivo")}</p>
  </div>`;

  // Create email log entry
  const logId = await createEmailLog({
    customerId: invoice.customer_id || null,
    invoiceId: invoice.invoice_id || null,
    emailType: "payment_confirmation",
    recipient: recipient || "",
    subject,
    deduplicationKey: dedupKey,
    triggeredBy: "webhook"
  });

  if (!transporter) {
    console.log(`[EMAIL] Payment receipt ${invoice.invoiceId} -> ${recipient}`);
    if (logId) await markEmailSent(logId, "console-mode");
    const result = { provider: "console", deliveredAt: new Date().toISOString(), recipientEmail: recipient, subject };
    await logPaymentReceiptDelivery(invoice, transactionId, "Sent", result);
    return result;
  }

  const smtpFrom = emailFrom();
  try {
    const info = await transporter.sendMail({
      from: settings.senderName ? `"${String(settings.senderName).replaceAll('"', "")}" <${smtpFrom}>` : smtpFrom,
      replyTo: settings.replyToEmail || settings.financeEmail || undefined,
      to: recipient,
      subject,
      html,
      text: `Payment Receipt\n\nInvoice: ${invoice.invoiceId}\nAmount: ${currency} ${amount}\nTransaction: ${transactionId}\n\nThank you for your payment.`
    });

    if (logId) await markEmailSent(logId, info.messageId);
    const result = { provider: "smtp", messageId: info.messageId, deliveredAt: new Date().toISOString(), recipientEmail: recipient, subject };
    await logPaymentReceiptDelivery(invoice, transactionId, "Sent", result);
    return result;
  } catch (error) {
    if (logId) await markEmailFailed(logId, error.code || "SMTP_ERROR", error.message);
    await logPaymentReceiptDelivery(invoice, transactionId, "Failed", { subject, errorMessage: error.message, errorCode: error.code });
    throw error;
  }
}

async function logPaymentReceiptDelivery(invoice, transactionId, deliveryStatus, metadata) {
  try {
    const { pool } = require("../config/db");
    const [invoices] = await pool.query("SELECT invoice_id, company_id FROM invoice WHERE invoiceId = ? LIMIT 1", [invoice.invoiceId]);
    const invoiceId = invoices[0]?.invoice_id;
    const companyId = invoices[0]?.company_id || invoice.company_id || invoice.companyId || null;
    await pool.query(
      `INSERT INTO audit_logs (
         company_id, module, activity_type, action_description, affected_record, status, created_at, new_value,
         invoice_id, delivery_status, customer_email
       ) VALUES (?, 'Invoice', 'email_delivery', ?, ?, ?, NOW(), ?, ?, ?, ?)`,
      [
        companyId,
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
  assertInvoiceEmailTemplatesValid,
  buildInvoiceEmailHtml,
  formatEmailDate,
  renderTemplate,
  sendInvoiceEmail,
  sendInvoiceSettingsTestEmail,
  sendPaymentReceiptEmail,
  validateInvoiceEmailTemplates
};
