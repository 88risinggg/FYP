/**
 * WhatsApp Service (Refactored)
 *
 * Sends WhatsApp messages via Twilio SDK using credentials loaded from the database
 * (encrypted in whatsapp_config table). No environment variables for Twilio credentials.
 *
 * Features:
 *   - Loads and caches decrypted credentials from DB
 *   - Phone number validation (E.164)
 *   - Template rendering with placeholders
 *   - Retry with exponential backoff
 *   - Message logging via whatsappMessageModel
 *   - Connection testing for Admin
 *   - Duplicate prevention per invoice per day
 *
 * Used by:
 *   - Finance controller (send invoice, reminder, overdue, confirmation)
 *   - Auto-triggers (invoice/payment lifecycle events)
 *   - Scheduler (daily reminders, retries)
 */

const twilio = require("twilio");
const configModel = require("../models/whatsappConfigModel");
const messageModel = require("../models/whatsappMessageModel");

// ─── Cached Twilio Client ─────────────────────────────────────────────────────

let cachedClient = null;
let cachedConfig = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // Re-read config every 60s

/**
 * Get or create a Twilio client using DB-stored credentials.
 * Returns null if credentials are not configured or integration is disabled.
 */
async function getTwilioClient() {
  const now = Date.now();
  if (cachedClient && cachedConfig && (now - cacheTimestamp < CACHE_TTL_MS)) {
    return { client: cachedClient, config: cachedConfig };
  }

  const config = await configModel.getConfig({ decryptCredentials: true });
  if (!config || !config.is_enabled) {
    cachedClient = null;
    cachedConfig = null;
    return null;
  }

  if (!config.account_sid || !config.auth_token || !config.whatsapp_number) {
    cachedClient = null;
    cachedConfig = null;
    return null;
  }

  try {
    cachedClient = twilio(config.account_sid, config.auth_token);
    cachedConfig = config;
    cacheTimestamp = now;
    return { client: cachedClient, config: cachedConfig };
  } catch (err) {
    console.error("[WHATSAPP] Failed to initialize Twilio client:", err.message);
    cachedClient = null;
    cachedConfig = null;
    return null;
  }
}

/**
 * Invalidate cached client (call after config changes).
 */
function invalidateCache() {
  cachedClient = null;
  cachedConfig = null;
  cacheTimestamp = 0;
}

// ─── Phone Number Validation ──────────────────────────────────────────────────

/**
 * Validate and normalize phone number to E.164 format.
 * @param {string} phone
 * @returns {{ valid: boolean, number: string|null, error: string|null }}
 */
function validatePhoneNumber(phone) {
  if (!phone || typeof phone !== "string") {
    return { valid: false, number: null, error: "Missing phone number" };
  }
  const cleaned = phone.replace(/[\s\-()]/g, "");
  const digits = cleaned.replace(/^\+/, "");
  if (!/^\d{8,15}$/.test(digits)) {
    return { valid: false, number: null, error: "Invalid phone number format. Must be 8-15 digits with country code." };
  }
  return { valid: true, number: digits, error: null };
}

// ─── Template Rendering ───────────────────────────────────────────────────────

/**
 * Render a message template by replacing {{placeholders}}.
 * @param {string} template
 * @param {Object} data — key/value pairs for replacement
 * @returns {string}
 */
function renderTemplate(template, data = {}) {
  if (!template) return "";
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (data[key] !== undefined && data[key] !== null) {
      return String(data[key]);
    }
    return match;
  });
}

// ─── Formatting Helpers ───────────────────────────────────────────────────────

function formatAmount(amount) {
  return Number(amount).toFixed(2);
}

function formatDate(date) {
  if (!date) return "N/A";
  const d = new Date(date);
  return d.toLocaleDateString("en-SG", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Core Send Function ───────────────────────────────────────────────────────

/**
 * Send a WhatsApp message via Twilio.
 * @param {Object} params
 * @param {string} params.to — phone number (digits with country code)
 * @param {string} params.body — message text
 * @param {string[]} [params.mediaUrls] — optional media attachments
 * @returns {Promise<Object>} — { success, messageId, status, error }
 */
async function sendMessage({ to, body, mediaUrls }) {
  const ctx = await getTwilioClient();
  if (!ctx) {
    return { success: false, messageId: null, error: "WhatsApp integration not configured or disabled." };
  }

  const { client, config } = ctx;
  const formattedTo = `whatsapp:+${to.replace(/^\+/, "")}`;

  const messageParams = {
    to: formattedTo,
    from: config.whatsapp_number.startsWith("whatsapp:") ? config.whatsapp_number : `whatsapp:${config.whatsapp_number}`,
    body
  };

  if (mediaUrls && mediaUrls.length > 0) {
    messageParams.mediaUrl = mediaUrls;
  }

  // Add status callback if configured
  if (config.webhook_url) {
    messageParams.statusCallback = config.webhook_url;
  }

  try {
    const result = await client.messages.create(messageParams);
    return {
      success: true,
      messageId: result.sid,
      status: result.status,
      error: null
    };
  } catch (err) {
    return {
      success: false,
      messageId: null,
      status: "failed",
      error: err.message
    };
  }
}

/**
 * Send with retry (exponential backoff).
 * @param {Object} params — same as sendMessage
 * @param {number} [maxRetries=3]
 * @returns {Promise<Object>}
 */
async function sendWithRetry(params, maxRetries = 3) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await sendMessage(params);
    if (result.success) return { ...result, attempts: attempt };
    lastError = result.error;
    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  return { success: false, messageId: null, error: lastError, attempts: maxRetries };
}

// ─── High-Level Send & Log ────────────────────────────────────────────────────

/**
 * Validate phone, send message, and log to database.
 * Used by all Finance send operations and auto-triggers.
 *
 * @param {Object} params
 * @param {string} params.phone — recipient phone
 * @param {string} params.messageBody — rendered message text
 * @param {string} params.messageType — invoice_sent | payment_reminder | overdue_notice | payment_confirmation | custom
 * @param {number} params.customerId
 * @param {number|null} [params.invoiceId]
 * @param {string|null} [params.recipientName]
 * @param {number|null} [params.templateId]
 * @param {number|null} [params.sentBy] — user ID of sender
 * @param {string[]} [params.mediaUrls]
 * @param {boolean} [params.useRetry=true]
 * @returns {Object} { success, messageId, logId, error }
 */
async function sendAndLog(params) {
  const {
    phone,
    messageBody,
    messageType,
    customerId,
    invoiceId = null,
    recipientName = null,
    templateId = null,
    sentBy = null,
    mediaUrls = [],
    useRetry = true
  } = params;

  // Validate phone
  const phoneValidation = validatePhoneNumber(phone);
  if (!phoneValidation.valid) {
    const logId = await messageModel.createMessage({
      customer_id: customerId,
      invoice_id: invoiceId,
      message_type: messageType,
      recipient_phone: phone || "",
      recipient_name: recipientName,
      message_body: messageBody,
      template_id: templateId,
      sent_by: sentBy
    });
    await messageModel.updateAfterSend(logId, { status: "failed", error_message: phoneValidation.error });
    return { success: false, messageId: null, logId, error: phoneValidation.error };
  }

  // Check for duplicates (same invoice + type today)
  if (invoiceId) {
    const alreadySent = await messageModel.hasSentToday(invoiceId, messageType);
    if (alreadySent) {
      return { success: false, messageId: null, logId: null, error: "A message of this type was already sent for this invoice today." };
    }
  }

  // Create log entry (queued)
  const logId = await messageModel.createMessage({
    customer_id: customerId,
    invoice_id: invoiceId,
    message_type: messageType,
    recipient_phone: phoneValidation.number,
    recipient_name: recipientName,
    message_body: messageBody,
    template_id: templateId,
    sent_by: sentBy
  });

  // Send
  const sendParams = { to: phoneValidation.number, body: messageBody };
  if (mediaUrls.length > 0) sendParams.mediaUrls = mediaUrls;

  const result = useRetry
    ? await sendWithRetry(sendParams)
    : await sendMessage(sendParams);

  if (result.success) {
    await messageModel.updateAfterSend(logId, {
      status: "sent",
      twilio_message_sid: result.messageId,
      sent_at: new Date().toISOString().slice(0, 19).replace("T", " ")
    });
  } else {
    await messageModel.updateAfterSend(logId, {
      status: "failed",
      error_message: result.error
    });
  }

  return { success: result.success, messageId: result.messageId, logId, error: result.error };
}

// ─── Typed Send Functions (for Finance & Auto-Triggers) ───────────────────────

/**
 * Send Invoice via WhatsApp.
 */
async function sendInvoice({ customerId, customerName, phone, invoiceId, invoiceNumber, amount, dueDate, paymentLink, currency, sentBy, pdfUrl }) {
  const template = await messageModel.getDefaultTemplate("invoice_sent");
  const companyName = process.env.COMPANY_NAME || "PayNivo";
  const currencySymbol = currency || "$";

  // Build payment link — prefer Stripe URL, fall back to client invoice view
  let paymentLinkText = "";
  if (paymentLink) {
    paymentLinkText = `Pay securely: ${paymentLink}`;
  } else {
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    paymentLinkText = `View invoice: ${clientUrl}/invoice/${invoiceNumber}`;
  }

  const body = template
    ? renderTemplate(template.message_body, {
        customer_name: customerName,
        invoice_number: invoiceNumber,
        invoice_amount: formatAmount(amount),
        currency: currencySymbol,
        due_date: formatDate(dueDate),
        company_name: companyName,
        payment_link: paymentLinkText
      })
    : `Hello ${customerName},\n\nYour invoice ${invoiceNumber} for ${currencySymbol}${formatAmount(amount)} is ready.\nDue: ${formatDate(dueDate)}\n\n${paymentLinkText}\n\n— ${companyName}`;

  // Include PDF as media attachment if URL is publicly accessible
  const mediaUrls = [];
  if (pdfUrl && !pdfUrl.includes("localhost")) {
    mediaUrls.push(pdfUrl);
  }

  return sendAndLog({
    phone,
    messageBody: body,
    messageType: "invoice_sent",
    customerId,
    invoiceId,
    recipientName: customerName,
    templateId: template?.id || null,
    sentBy,
    mediaUrls
  });
}

/**
 * Send Payment Reminder via WhatsApp.
 */
async function sendPaymentReminder({ customerId, customerName, phone, invoiceId, invoiceNumber, amount, dueDate, paymentLink, currency, sentBy }) {
  const template = await messageModel.getDefaultTemplate("payment_reminder");
  const companyName = process.env.COMPANY_NAME || "PayNivo";
  const currencySymbol = currency || "$";

  const body = template
    ? renderTemplate(template.message_body, {
        customer_name: customerName,
        invoice_number: invoiceNumber,
        invoice_amount: formatAmount(amount),
        currency: currencySymbol,
        due_date: formatDate(dueDate),
        company_name: companyName,
        payment_link: paymentLink ? `Pay now: ${paymentLink}` : ""
      })
    : `Payment Reminder\n\nInvoice: ${invoiceNumber}\nAmount: ${currencySymbol}${formatAmount(amount)}\nDue: ${formatDate(dueDate)}\n\n— ${companyName}`;

  return sendAndLog({
    phone,
    messageBody: body,
    messageType: "payment_reminder",
    customerId,
    invoiceId,
    recipientName: customerName,
    templateId: template?.id || null,
    sentBy
  });
}

/**
 * Send Overdue Notice via WhatsApp.
 */
async function sendOverdueNotice({ customerId, customerName, phone, invoiceId, invoiceNumber, amount, paymentLink, currency, sentBy }) {
  const template = await messageModel.getDefaultTemplate("overdue_notice");
  const companyName = process.env.COMPANY_NAME || "PayNivo";
  const currencySymbol = currency || "$";

  const body = template
    ? renderTemplate(template.message_body, {
        customer_name: customerName,
        invoice_number: invoiceNumber,
        invoice_amount: formatAmount(amount),
        currency: currencySymbol,
        due_date: "OVERDUE",
        company_name: companyName,
        payment_link: paymentLink ? `Pay immediately: ${paymentLink}` : ""
      })
    : `OVERDUE NOTICE\n\nInvoice ${invoiceNumber} is overdue.\nAmount Due: ${currencySymbol}${formatAmount(amount)}\n\nPlease pay immediately.\n— ${companyName}`;

  return sendAndLog({
    phone,
    messageBody: body,
    messageType: "overdue_notice",
    customerId,
    invoiceId,
    recipientName: customerName,
    templateId: template?.id || null,
    sentBy
  });
}

/**
 * Send Payment Confirmation via WhatsApp.
 */
async function sendPaymentConfirmation({ customerId, customerName, phone, invoiceId, invoiceNumber, amount, currency, sentBy }) {
  const template = await messageModel.getDefaultTemplate("payment_confirmation");
  const companyName = process.env.COMPANY_NAME || "PayNivo";
  const currencySymbol = currency || "$";

  const body = template
    ? renderTemplate(template.message_body, {
        customer_name: customerName,
        invoice_number: invoiceNumber,
        invoice_amount: formatAmount(amount),
        currency: currencySymbol,
        due_date: "",
        company_name: companyName,
        payment_link: ""
      })
    : `Payment Confirmed\n\nInvoice: ${invoiceNumber}\nAmount Paid: ${currencySymbol}${formatAmount(amount)}\n\nThank you.\n— ${companyName}`;

  return sendAndLog({
    phone,
    messageBody: body,
    messageType: "payment_confirmation",
    customerId,
    invoiceId,
    recipientName: customerName,
    templateId: template?.id || null,
    sentBy
  });
}

// ─── Connection Test (Admin) ──────────────────────────────────────────────────

/**
 * Test the Twilio connection by fetching account info.
 * Does NOT send any messages.
 * @returns {{ success: boolean, accountName?: string, status?: string, error?: string }}
 */
async function testConnection() {
  const config = await configModel.getConfig({ decryptCredentials: true });
  if (!config || !config.account_sid || !config.auth_token) {
    return { success: false, error: "Twilio credentials not configured." };
  }

  try {
    const client = twilio(config.account_sid, config.auth_token);
    const account = await client.api.accounts(config.account_sid).fetch();

    const status = account.status || "active";
    const accountName = account.friendlyName || "Twilio Account";

    await configModel.updateConnectionStatus("connected", accountName);
    invalidateCache();

    return { success: true, accountName, status };
  } catch (err) {
    await configModel.updateConnectionStatus("failed", null);
    invalidateCache();
    return { success: false, error: err.message };
  }
}

/**
 * Send a test message to verify WhatsApp delivery.
 * @param {string} phone
 * @returns {{ success: boolean, messageId?: string, error?: string }}
 */
async function sendTestMessage(phone) {
  const phoneValidation = validatePhoneNumber(phone);
  if (!phoneValidation.valid) {
    return { success: false, error: phoneValidation.error };
  }

  const companyName = process.env.COMPANY_NAME || "PayNivo";
  const body = `[Test Message] WhatsApp integration is working correctly. — ${companyName}`;

  const result = await sendMessage({ to: phoneValidation.number, body });
  return result;
}

// ─── Resend Failed Message ────────────────────────────────────────────────────

/**
 * Retry a specific failed message by ID.
 * @param {number} messageId
 * @returns {Object} { success, error }
 */
async function resendMessage(messageId) {
  const [rows] = await require("../config/db").pool.query(
    "SELECT * FROM whatsapp_messages WHERE id = ? AND status = 'failed' LIMIT 1",
    [messageId]
  );
  if (!rows[0]) return { success: false, error: "Message not found or not in failed status." };

  const msg = rows[0];
  if (msg.retry_count >= 3) return { success: false, error: "Maximum retry attempts reached." };

  await messageModel.incrementRetry(messageId);

  const result = await sendMessage({ to: msg.recipient_phone, body: msg.message_body });

  if (result.success) {
    await messageModel.updateAfterSend(messageId, {
      status: "sent",
      twilio_message_sid: result.messageId,
      sent_at: new Date().toISOString().slice(0, 19).replace("T", " ")
    });
  } else {
    await messageModel.updateAfterSend(messageId, {
      status: "failed",
      error_message: result.error
    });
  }

  return result;
}

module.exports = {
  // Core
  sendMessage,
  sendWithRetry,
  sendAndLog,
  validatePhoneNumber,
  renderTemplate,
  invalidateCache,
  // Typed sends
  sendInvoice,
  sendPaymentReminder,
  sendOverdueNotice,
  sendPaymentConfirmation,
  // Admin
  testConnection,
  sendTestMessage,
  // Finance
  resendMessage
};
