/**
 * WhatsApp Notification Service
 *
 * Sends WhatsApp messages via the official Twilio SDK.
 * Falls back to console logging if credentials are not configured.
 *
 * Features:
 *   - Official Twilio SDK integration
 *   - PDF attachment support via media URLs
 *   - Message template rendering with placeholders
 *   - Retry with exponential backoff (max 3 attempts)
 *   - Subscription lifecycle notifications
 *   - Payment link embedding
 *   - Delivery status tracking via webhooks
 *
 * Required environment variables:
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
 *   TWILIO_STATUS_CALLBACK_URL (optional)
 *   APP_BASE_URL (for generating PDF URLs)
 */

const twilio = require("twilio");
const notificationModel = require("../models/whatsappNotificationModel");

// ─── Twilio Client Initialization ─────────────────────────────────────────────

let twilioClient = null;

function getTwilioClient() {
  if (twilioClient) return twilioClient;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (sid && token) {
    twilioClient = twilio(sid, token);
  }
  return twilioClient;
}

// ─── Phone Number Validation ──────────────────────────────────────────────────

/**
 * Validate and normalize phone number to E.164 format.
 * @param {string} phone - Raw phone number.
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

// ─── Provider Detection ───────────────────────────────────────────────────────

/**
 * Determine active WhatsApp provider.
 * @returns {"twilio"|"console"}
 */
function getActiveProvider() {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM) {
    return "twilio";
  }
  return "console";
}

// ─── Core Send Functions ──────────────────────────────────────────────────────

/**
 * Send a WhatsApp message via Twilio SDK.
 * @param {string} to - Phone number (digits only, with country code).
 * @param {string} message - Message body text.
 * @param {Object} [options] - Additional options.
 * @param {string[]} [options.mediaUrls] - Array of media URLs (e.g., PDF links).
 * @param {string} [options.statusCallback] - Status callback URL.
 * @returns {Promise<Object>}
 */
async function sendTwilioWhatsApp(to, message, options = {}) {
  const client = getTwilioClient();
  if (!client) {
    throw new Error("Twilio client not initialized. Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.");
  }

  const from = process.env.TWILIO_WHATSAPP_FROM;
  const formattedTo = `whatsapp:+${to.replace(/^\+/, "")}`;
  const rawCallback = options.statusCallback || process.env.TWILIO_STATUS_CALLBACK_URL || "";
  const statusCallback = rawCallback.startsWith("https://") ? rawCallback : null;

  const messageParams = {
    to: formattedTo,
    from,
    body: message
  };

  if (options.mediaUrls && options.mediaUrls.length > 0) {
    messageParams.mediaUrl = options.mediaUrls;
  }

  if (statusCallback) {
    messageParams.statusCallback = statusCallback;
  }

  const result = await client.messages.create(messageParams);

  console.log(`[WHATSAPP/TWILIO] Sent to ${to} | SID: ${result.sid}`);
  return {
    provider: "twilio",
    messageId: result.sid,
    to,
    status: result.status,
    sentAt: new Date().toISOString()
  };
}

/**
 * Send a WhatsApp message using the active provider.
 * @param {string} to - Phone number (digits only, with country code).
 * @param {string} message - Message body text.
 * @param {Object} [options] - Additional options (mediaUrls, statusCallback).
 * @returns {Promise<Object>}
 */
async function sendWhatsAppMessage(to, message, options = {}) {
  const provider = getActiveProvider();

  if (provider === "twilio") {
    return sendTwilioWhatsApp(to, message, options);
  }

  // Console / demo mode
  console.log(`[WHATSAPP] (Demo) -> ${to}: ${message}`);
  if (options.mediaUrls) {
    console.log(`[WHATSAPP] (Demo) Attachments: ${options.mediaUrls.join(", ")}`);
  }
  return {
    provider: "console",
    to,
    message,
    messageId: `demo_${Date.now()}`,
    status: "sent",
    sentAt: new Date().toISOString(),
    note: "No WhatsApp provider configured. Message logged to console."
  };
}

// ─── Retry with Exponential Backoff ───────────────────────────────────────────

/**
 * Send message with retry logic.
 * @param {string} to
 * @param {string} message
 * @param {Object} [options]
 * @param {number} [maxRetries=3]
 * @returns {Promise<Object>}
 */
async function sendWithRetry(to, message, options = {}, maxRetries = 3) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await sendWhatsAppMessage(to, message, options);
      return { ...result, attempts: attempt };
    } catch (err) {
      lastError = err;
      console.error(`[WHATSAPP] Attempt ${attempt}/${maxRetries} failed: ${err.message}`);
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

// ─── Message Template Rendering ───────────────────────────────────────────────

/**
 * Render a message template by replacing placeholders.
 * Supports: {{CustomerName}}, {{InvoiceNumber}}, {{Amount}}, {{DueDate}},
 * {{InvoiceDate}}, {{PaymentLink}}, {{CompanyName}}, {{BillingPeriod}},
 * {{PaymentDate}}, {{SubscriptionName}}
 *
 * @param {string} template - Template string with {{placeholders}}.
 * @param {Object} data - Key-value pairs for replacement.
 * @returns {string}
 */
function renderTemplate(template, data = {}) {
  if (!template) return "";
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (data[key] !== undefined && data[key] !== null) {
      return String(data[key]);
    }
    return match; // Leave unreplaced placeholders as-is
  });
}

// ─── Formatting Helpers ───────────────────────────────────────────────────────

function formatAmount(amount) {
  return `$${Number(amount).toFixed(2)}`;
}

function formatDate(date) {
  if (!date) return "N/A";
  const d = new Date(date);
  return d.toLocaleDateString("en-SG", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── PDF URL Generation ───────────────────────────────────────────────────────

/**
 * Generate a public URL for an invoice PDF.
 * @param {number} invoiceId - Internal invoice ID.
 * @returns {string}
 */
function getInvoicePdfUrl(invoiceId) {
  const baseUrl = process.env.APP_BASE_URL || "http://localhost:5002";
  return `${baseUrl}/api/invoices/${invoiceId}/pdf/public`;
}

/**
 * Generate a public URL for a receipt PDF.
 * @param {number} invoiceId - Internal invoice ID.
 * @returns {string}
 */
function getReceiptPdfUrl(invoiceId) {
  const baseUrl = process.env.APP_BASE_URL || "http://localhost:5002";
  return `${baseUrl}/api/invoices/${invoiceId}/receipt/public`;
}

// ─── Send and Log Helper ──────────────────────────────────────────────────────

/**
 * Validate, send, and log a WhatsApp notification.
 * @param {Object} params
 * @param {string} params.phone
 * @param {string} params.message
 * @param {string} params.notificationType
 * @param {number|null} params.customerId
 * @param {number|null} params.invoiceId
 * @param {string[]} [params.mediaUrls]
 * @param {boolean} [params.useRetry=false]
 * @returns {Object} { success, logId, messageId, error }
 */
async function sendAndLog({ phone, message, notificationType, customerId = null, invoiceId = null, mediaUrls = [], useRetry = false }) {
  const phoneValidation = validatePhoneNumber(phone);
  if (!phoneValidation.valid) {
    const logId = await notificationModel.createLog({
      customer_id: customerId,
      invoice_id: invoiceId,
      notification_type: notificationType,
      message,
      status: "failed",
      provider: "twilio",
      phone_number: phone || null,
      error_message: phoneValidation.error
    });
    return { success: false, logId, messageId: null, error: phoneValidation.error };
  }

  const logId = await notificationModel.createLog({
    customer_id: customerId,
    invoice_id: invoiceId,
    notification_type: notificationType,
    message,
    status: "queued",
    provider: "twilio",
    phone_number: phoneValidation.number
  });

  try {
    const options = {};
    if (mediaUrls.length > 0) options.mediaUrls = mediaUrls;

    const result = useRetry
      ? await sendWithRetry(phoneValidation.number, message, options)
      : await sendWhatsAppMessage(phoneValidation.number, message, options);

    await notificationModel.updateLog(logId, {
      status: "sent",
      message_id: result.messageId || null,
      sent_at: result.sentAt || new Date().toISOString(),
      error_message: null
    });

    return { success: true, logId, messageId: result.messageId, error: null };
  } catch (err) {
    await notificationModel.updateLog(logId, {
      status: "failed",
      error_message: err.message
    });
    console.error(`[WHATSAPP] Send failed for ${phone}:`, err.message);
    return { success: false, logId, messageId: null, error: err.message };
  }
}

// ─── High-Level Notification Functions ────────────────────────────────────────

/**
 * Send Invoice Created notification.
 */
async function sendInvoiceCreated({ customerName, phone, invoiceNumber, amount, dueDate, paymentLink, customerId, invoiceId, sendPdf = false }) {
  const companyName = process.env.COMPANY_NAME || "PayNivo";
  const message =
    `Hello ${customerName},\n\n` +
    `Your invoice *${invoiceNumber}* has been generated.\n\n` +
    `Amount: ${formatAmount(amount)}\n` +
    `Due Date: ${formatDate(dueDate)}\n\n` +
    (paymentLink ? `Pay securely: ${paymentLink}\n\n` : "") +
    `Thank you.\n— ${companyName}`;

  const mediaUrls = sendPdf ? [getInvoicePdfUrl(invoiceId)] : [];

  return sendAndLog({
    phone, message,
    notificationType: "invoice_created",
    customerId, invoiceId, mediaUrls, useRetry: true
  });
}

/**
 * Send Invoice Sent notification (after email delivery).
 */
async function sendInvoiceSent({ customerName, phone, invoiceNumber, amount, dueDate, paymentLink, customerId, invoiceId, sendPdf = false }) {
  const companyName = process.env.COMPANY_NAME || "PayNivo";
  const message =
    `Hello ${customerName},\n\n` +
    `Invoice *${invoiceNumber}* has been sent to you.\n\n` +
    `Amount: ${formatAmount(amount)}\n` +
    `Due Date: ${formatDate(dueDate)}\n\n` +
    (paymentLink ? `Pay securely: ${paymentLink}\n\n` : "") +
    `Please check your email for the full details.\n— ${companyName}`;

  const mediaUrls = sendPdf ? [getInvoicePdfUrl(invoiceId)] : [];

  return sendAndLog({
    phone, message,
    notificationType: "invoice_sent",
    customerId, invoiceId, mediaUrls, useRetry: true
  });
}

/**
 * Send Payment Reminder notification.
 */
async function sendPaymentReminder({ phone, invoiceNumber, amount, dueDate, customerId, invoiceId, paymentLink }) {
  const companyName = process.env.COMPANY_NAME || "PayNivo";
  const message =
    `Payment Reminder\n\n` +
    `Invoice: ${invoiceNumber}\n` +
    `Amount: ${formatAmount(amount)}\n` +
    `Due: ${formatDate(dueDate)}\n\n` +
    (paymentLink ? `Pay now: ${paymentLink}\n\n` : "") +
    `Please complete payment before the due date.\n— ${companyName}`;

  return sendAndLog({
    phone, message,
    notificationType: "payment_reminder",
    customerId, invoiceId, useRetry: true
  });
}

/**
 * Send Overdue Notice notification.
 */
async function sendOverdueNotice({ phone, invoiceNumber, amount, customerId, invoiceId, paymentLink }) {
  const companyName = process.env.COMPANY_NAME || "PayNivo";
  const message =
    `OVERDUE NOTICE\n\n` +
    `Invoice ${invoiceNumber} is overdue.\n\n` +
    `Amount Due: ${formatAmount(amount)}\n\n` +
    (paymentLink ? `Pay immediately: ${paymentLink}\n\n` : "") +
    `Please complete payment as soon as possible to avoid further action.\n— ${companyName}`;

  return sendAndLog({
    phone, message,
    notificationType: "overdue_notice",
    customerId, invoiceId, useRetry: true
  });
}

/**
 * Send Payment Received notification.
 */
async function sendPaymentReceived({ phone, invoiceNumber, amount, paymentDate, customerId, invoiceId, sendReceipt = false }) {
  const companyName = process.env.COMPANY_NAME || "PayNivo";
  const message =
    `Payment Confirmation\n\n` +
    `Invoice: ${invoiceNumber}\n` +
    `Amount Paid: ${formatAmount(amount)}\n` +
    `Payment Date: ${formatDate(paymentDate || new Date())}\n` +
    `Status: Paid\n\n` +
    `Thank you for your payment.\n— ${companyName}`;

  const mediaUrls = sendReceipt ? [getReceiptPdfUrl(invoiceId)] : [];

  return sendAndLog({
    phone, message,
    notificationType: "payment_received",
    customerId, invoiceId, mediaUrls, useRetry: true
  });
}

// ─── Subscription Notifications ───────────────────────────────────────────────

/**
 * Send Subscription Started notification.
 */
async function sendSubscriptionStarted({ customerName, phone, subscriptionName, amount, nextBillingDate, customerId, invoiceId }) {
  const companyName = process.env.COMPANY_NAME || "PayNivo";
  const message =
    `Hello ${customerName},\n\n` +
    `Your subscription *${subscriptionName}* is now active.\n\n` +
    `Amount: ${formatAmount(amount)}/billing cycle\n` +
    `Next Billing: ${formatDate(nextBillingDate)}\n\n` +
    `Thank you for subscribing.\n— ${companyName}`;

  return sendAndLog({
    phone, message,
    notificationType: "subscription_started",
    customerId, invoiceId, useRetry: true
  });
}

/**
 * Send Subscription Renewed notification.
 */
async function sendSubscriptionRenewed({ customerName, phone, subscriptionName, amount, nextBillingDate, invoiceNumber, customerId, invoiceId }) {
  const companyName = process.env.COMPANY_NAME || "PayNivo";
  const message =
    `Hello ${customerName},\n\n` +
    `Your subscription *${subscriptionName}* has been renewed.\n\n` +
    `Invoice: ${invoiceNumber}\n` +
    `Amount: ${formatAmount(amount)}\n` +
    `Next Billing: ${formatDate(nextBillingDate)}\n\n` +
    `— ${companyName}`;

  return sendAndLog({
    phone, message,
    notificationType: "subscription_renewed",
    customerId, invoiceId, useRetry: true
  });
}

/**
 * Send Subscription Expiring notification.
 */
async function sendSubscriptionExpiring({ customerName, phone, subscriptionName, expiryDate, customerId }) {
  const companyName = process.env.COMPANY_NAME || "PayNivo";
  const message =
    `Hello ${customerName},\n\n` +
    `Your subscription *${subscriptionName}* will expire on ${formatDate(expiryDate)}.\n\n` +
    `Please renew to continue your service.\n— ${companyName}`;

  return sendAndLog({
    phone, message,
    notificationType: "subscription_expiring",
    customerId, invoiceId: null, useRetry: true
  });
}

/**
 * Send Subscription Payment Failed notification.
 */
async function sendSubscriptionPaymentFailed({ customerName, phone, subscriptionName, amount, customerId }) {
  const companyName = process.env.COMPANY_NAME || "PayNivo";
  const message =
    `Hello ${customerName},\n\n` +
    `Payment of ${formatAmount(amount)} for subscription *${subscriptionName}* has failed.\n\n` +
    `Please update your payment method to avoid service interruption.\n— ${companyName}`;

  return sendAndLog({
    phone, message,
    notificationType: "subscription_payment_failed",
    customerId, invoiceId: null, useRetry: true
  });
}

/**
 * Send Subscription Cancelled notification.
 */
async function sendSubscriptionCancelled({ customerName, phone, subscriptionName, customerId }) {
  const companyName = process.env.COMPANY_NAME || "PayNivo";
  const message =
    `Hello ${customerName},\n\n` +
    `Your subscription *${subscriptionName}* has been cancelled.\n\n` +
    `If this was a mistake, please contact our support team.\n— ${companyName}`;

  return sendAndLog({
    phone, message,
    notificationType: "subscription_cancelled",
    customerId, invoiceId: null, useRetry: true
  });
}

/**
 * Send Subscription Invoice notification.
 */
async function sendSubscriptionInvoice({ customerName, phone, invoiceNumber, billingPeriod, amount, dueDate, customerId, invoiceId, sendPdf = false }) {
  const companyName = process.env.COMPANY_NAME || "PayNivo";
  const message =
    `Hello ${customerName},\n\n` +
    `Your subscription invoice *${invoiceNumber}* has been generated.\n\n` +
    `Billing Period: ${billingPeriod}\n` +
    `Amount: ${formatAmount(amount)}\n` +
    `Due: ${formatDate(dueDate)}\n\n` +
    `— ${companyName}`;

  const mediaUrls = sendPdf ? [getInvoicePdfUrl(invoiceId)] : [];

  return sendAndLog({
    phone, message,
    notificationType: "subscription_invoice",
    customerId, invoiceId, mediaUrls, useRetry: true
  });
}

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Send a test notification (for settings page).
 * @param {string} phone
 * @returns {Object}
 */
async function sendTestNotification(phone) {
  const message = "This is a test WhatsApp notification from PayNivo. If you received this, your WhatsApp integration is working correctly.";

  const phoneValidation = validatePhoneNumber(phone);
  if (!phoneValidation.valid) {
    return { success: false, error: phoneValidation.error };
  }

  try {
    const result = await sendWhatsAppMessage(phoneValidation.number, message);
    return { success: true, messageId: result.messageId, provider: result.provider };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Test the Twilio connection by verifying credentials.
 * @returns {Object} { success, accountName, error }
 */
async function testConnection() {
  try {
    const client = getTwilioClient();
    if (!client) {
      return { success: false, error: "Twilio credentials not configured." };
    }
    const account = await client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
    return { success: true, accountName: account.friendlyName, status: account.status };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Retry a failed notification log entry.
 * @param {Object} log - The notification log row.
 * @returns {Object} { success, error }
 */
async function retryNotification(log) {
  try {
    const result = await sendWhatsAppMessage(log.phone_number, log.message);

    await notificationModel.updateLog(log.id, {
      status: "sent",
      message_id: result.messageId || null,
      sent_at: result.sentAt || new Date().toISOString(),
      error_message: null,
      retry_count: (log.retry_count || 0) + 1
    });

    return { success: true, error: null };
  } catch (err) {
    await notificationModel.updateLog(log.id, {
      status: "failed",
      error_message: err.message,
      retry_count: (log.retry_count || 0) + 1
    });

    return { success: false, error: err.message };
  }
}

/**
 * Handle Twilio delivery status webhook update.
 * Maps Twilio statuses to internal statuses.
 * @param {Object} webhookData - Twilio webhook payload.
 * @returns {Object} { updated, messageSid, status }
 */
async function handleStatusCallback(webhookData) {
  const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = webhookData;

  if (!MessageSid || !MessageStatus) {
    return { updated: false, error: "Missing MessageSid or MessageStatus" };
  }

  // Map Twilio status to internal status
  const statusMap = {
    queued: "queued",
    sent: "sent",
    delivered: "delivered",
    read: "read",
    failed: "failed",
    undelivered: "undelivered"
  };

  const internalStatus = statusMap[MessageStatus] || MessageStatus;
  const errorMsg = ErrorCode ? `${ErrorCode}: ${ErrorMessage || "Unknown error"}` : null;

  // Find log by message_id (Twilio SID)
  const updated = await notificationModel.updateLogByMessageId(MessageSid, {
    status: internalStatus,
    error_message: errorMsg
  });

  return { updated: Boolean(updated), messageSid: MessageSid, status: internalStatus };
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  // Core
  validatePhoneNumber,
  getActiveProvider,
  sendWhatsAppMessage,
  sendTwilioWhatsApp,
  sendWithRetry,
  sendAndLog,
  // Template
  renderTemplate,
  // High-level notifications
  sendInvoiceCreated,
  sendInvoiceSent,
  sendPaymentReminder,
  sendOverdueNotice,
  sendPaymentReceived,
  // Subscription notifications
  sendSubscriptionStarted,
  sendSubscriptionRenewed,
  sendSubscriptionExpiring,
  sendSubscriptionPaymentFailed,
  sendSubscriptionCancelled,
  sendSubscriptionInvoice,
  // Utilities
  sendTestNotification,
  testConnection,
  retryNotification,
  handleStatusCallback,
  // Helpers
  formatAmount,
  formatDate,
  getInvoicePdfUrl,
  getReceiptPdfUrl,
  getTwilioClient
};
