/**
 * WhatsApp Notification Service
 *
 * Sends WhatsApp messages via Meta WhatsApp Business API (Cloud API).
 * Falls back to console logging if Meta credentials are not configured.
 *
 * Provides high-level notification functions for:
 *   - Invoice Created
 *   - Payment Received
 *   - Payment Reminder (upcoming due)
 *   - Overdue Notice
 *   - Subscription Invoice
 *
 * Each function validates the phone number, formats the message,
 * sends via the API, and logs the result.
 *
 * Required environment variables:
 * - META_WHATSAPP_TOKEN (Permanent access token)
 * - META_WHATSAPP_PHONE_ID (Phone number ID from Meta Business)
 */

const https = require("https");
const notificationModel = require("../models/whatsappNotificationModel");

const META_API_VERSION = "v18.0";

// ─── Phone Number Validation ──────────────────────────────────────────────────

/**
 * Validate and normalize an international phone number.
 * Accepts formats: +65XXXXXXXX, 65XXXXXXXX, +1XXXXXXXXXX, etc.
 * Must be at least 8 digits after country code.
 *
 * @param {string} phone - Raw phone number string.
 * @returns {{ valid: boolean, number: string|null, error: string|null }}
 */
function validatePhoneNumber(phone) {
  if (!phone || typeof phone !== "string") {
    return { valid: false, number: null, error: "Missing phone number" };
  }

  // Remove spaces, dashes, parentheses
  const cleaned = phone.replace(/[\s\-()]/g, "");

  // Must start with + or digits, must be 8-15 digits total
  const digits = cleaned.replace(/^\+/, "");

  if (!/^\d{8,15}$/.test(digits)) {
    return { valid: false, number: null, error: "Invalid phone number format. Must be 8-15 digits with country code." };
  }

  return { valid: true, number: digits, error: null };
}

// ─── Core API Call ────────────────────────────────────────────────────────────

/**
 * Determine which WhatsApp provider is configured.
 * Priority: Twilio > Meta > Console (demo mode).
 *
 * @returns {"twilio"|"meta"|"console"}
 */
function getActiveProvider() {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM) {
    return "twilio";
  }
  if (process.env.META_WHATSAPP_TOKEN && process.env.META_WHATSAPP_PHONE_ID) {
    return "meta";
  }
  return "console";
}

/**
 * Send a WhatsApp message via Twilio.
 *
 * @param {string} to - Phone number (digits only, with country code).
 * @param {string} message - Message body text.
 * @returns {Promise<Object>}
 */
function sendTwilioWhatsApp(to, message) {
  return new Promise((resolve, reject) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_WHATSAPP_FROM; // e.g. "whatsapp:+14155238886"

    // Format destination: Twilio expects "whatsapp:+<number>"
    const formattedTo = `whatsapp:+${to.replace(/^\+/, "")}`;

    const postData = new URLSearchParams({
      To: formattedTo,
      From: from,
      Body: message
    }).toString();

    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

    const options = {
      hostname: "api.twilio.com",
      path: `/2010-04-01/Accounts/${accountSid}/Messages.json`,
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(postData)
      },
      timeout: 30000
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`[WHATSAPP/TWILIO] Sent to ${to} | SID: ${parsed.sid || "unknown"}`);
            resolve({
              provider: "twilio",
              messageId: parsed.sid || null,
              to,
              sentAt: new Date().toISOString()
            });
          } else {
            const errMsg = parsed.message || parsed.more_info || `HTTP ${res.statusCode}`;
            reject(new Error(`Twilio WhatsApp API error: ${errMsg}`));
          }
        } catch (err) {
          reject(new Error(`Failed to parse Twilio API response: ${err.message}`));
        }
      });
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Twilio WhatsApp API request timed out (30s)"));
    });

    req.on("error", (err) => {
      reject(new Error(`Twilio WhatsApp request failed: ${err.message}`));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Send a message via Meta WhatsApp Cloud API.
 *
 * @param {string} to - Phone number (digits only, with country code).
 * @param {string} message - Message body text.
 * @returns {Promise<Object>} API response or console log confirmation.
 */
function sendMetaWhatsApp(to, message) {
  return new Promise((resolve, reject) => {
    const token = process.env.META_WHATSAPP_TOKEN;
    const phoneId = process.env.META_WHATSAPP_PHONE_ID;

    const formattedTo = to.replace(/^\+/, "");

    const payload = JSON.stringify({
      messaging_product: "whatsapp",
      to: formattedTo,
      type: "text",
      text: { body: message }
    });

    const options = {
      hostname: "graph.facebook.com",
      path: `/${META_API_VERSION}/${phoneId}/messages`,
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      },
      timeout: 30000
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`[WHATSAPP/META] Sent to ${to} | ID: ${parsed.messages?.[0]?.id || "unknown"}`);
            resolve({
              provider: "meta",
              messageId: parsed.messages?.[0]?.id || null,
              to,
              sentAt: new Date().toISOString()
            });
          } else {
            const errMsg = parsed.error?.message || `HTTP ${res.statusCode}`;
            reject(new Error(`Meta WhatsApp API error: ${errMsg}`));
          }
        } catch (err) {
          reject(new Error(`Failed to parse Meta API response: ${err.message}`));
        }
      });
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Meta WhatsApp API request timed out (30s)"));
    });

    req.on("error", (err) => {
      reject(new Error(`Meta WhatsApp request failed: ${err.message}`));
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Send a WhatsApp message using the active provider.
 * Automatically selects Twilio, Meta, or console demo mode.
 *
 * @param {string} to - Phone number (digits only, with country code).
 * @param {string} message - Message body text.
 * @returns {Promise<Object>}
 */
function sendWhatsAppMessage(to, message) {
  const provider = getActiveProvider();

  if (provider === "twilio") {
    return sendTwilioWhatsApp(to, message);
  }

  if (provider === "meta") {
    return sendMetaWhatsApp(to, message);
  }

  // Console / demo mode
  console.log(`[WHATSAPP] (Demo) → ${to}: ${message}`);
  return Promise.resolve({
    provider: "console",
    to,
    message,
    messageId: `demo_${Date.now()}`,
    sentAt: new Date().toISOString(),
    note: "No WhatsApp provider configured (Twilio/Meta). Message logged to console."
  });
}

// ─── Message Formatting Helpers ───────────────────────────────────────────────

/**
 * Format a currency amount.
 * @param {number|string} amount
 * @returns {string}
 */
function formatAmount(amount) {
  return `$${Number(amount).toFixed(2)}`;
}

/**
 * Format a date string for display.
 * @param {string|Date} date
 * @returns {string}
 */
function formatDate(date) {
  if (!date) return "N/A";
  const d = new Date(date);
  return d.toLocaleDateString("en-SG", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Notification Send + Log Helper ──────────────────────────────────────────

/**
 * Internal helper: validate, send, and log a WhatsApp notification.
 * Handles all error cases gracefully without crashing.
 *
 * @param {Object} params
 * @param {string} params.phone - Customer phone number.
 * @param {string} params.message - Formatted message.
 * @param {string} params.notificationType - Enum value for log.
 * @param {number|null} params.customerId
 * @param {number|null} params.invoiceId
 * @returns {Object} { success, logId, messageId, error }
 */
async function sendAndLog({ phone, message, notificationType, customerId = null, invoiceId = null }) {
  // Validate phone number
  const phoneValidation = validatePhoneNumber(phone);
  if (!phoneValidation.valid) {
    // Log the failure
    const logId = await notificationModel.createLog({
      customer_id: customerId,
      invoice_id: invoiceId,
      notification_type: notificationType,
      message,
      status: "failed",
      provider: "meta",
      phone_number: phone || null,
      error_message: phoneValidation.error
    });
    return { success: false, logId, messageId: null, error: phoneValidation.error };
  }

  // Create pending log entry
  const logId = await notificationModel.createLog({
    customer_id: customerId,
    invoice_id: invoiceId,
    notification_type: notificationType,
    message,
    status: "pending",
    provider: "meta",
    phone_number: phoneValidation.number
  });

  try {
    // Send the message
    const result = await sendWhatsAppMessage(phoneValidation.number, message);

    // Update log as sent
    await notificationModel.updateLog(logId, {
      status: "sent",
      message_id: result.messageId || null,
      sent_at: result.sentAt || new Date().toISOString(),
      error_message: null
    });

    return { success: true, logId, messageId: result.messageId, error: null };
  } catch (err) {
    // Update log as failed
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
 *
 * @param {Object} params
 * @param {string} params.customerName
 * @param {string} params.phone - Customer WhatsApp number.
 * @param {string} params.invoiceNumber - e.g. "INV-0001"
 * @param {number|string} params.amount
 * @param {string|Date} params.dueDate
 * @param {string} [params.paymentLink]
 * @param {number} params.customerId
 * @param {number} params.invoiceId
 * @returns {Object}
 */
async function sendInvoiceCreated({ customerName, phone, invoiceNumber, amount, dueDate, paymentLink, customerId, invoiceId }) {
  const message =
    `Hello ${customerName},\n\n` +
    `Your invoice *${invoiceNumber}* has been generated.\n\n` +
    `Amount:\n${formatAmount(amount)}\n\n` +
    `Due Date:\n${formatDate(dueDate)}\n\n` +
    (paymentLink ? `You may pay using:\n${paymentLink}\n\n` : "") +
    `Thank you.`;

  return sendAndLog({
    phone,
    message,
    notificationType: "invoice_created",
    customerId,
    invoiceId
  });
}

/**
 * Send Subscription Invoice notification.
 *
 * @param {Object} params
 * @param {string} params.customerName
 * @param {string} params.phone
 * @param {string} params.invoiceNumber
 * @param {string} params.billingPeriod
 * @param {number|string} params.amount
 * @param {string|Date} params.dueDate
 * @param {number} params.customerId
 * @param {number} params.invoiceId
 * @returns {Object}
 */
async function sendSubscriptionInvoice({ customerName, phone, invoiceNumber, billingPeriod, amount, dueDate, customerId, invoiceId }) {
  const message =
    `Hello ${customerName},\n\n` +
    `Your scheduled invoice *${invoiceNumber}* has been generated.\n\n` +
    `Billing Period:\n${billingPeriod}\n\n` +
    `Amount:\n${formatAmount(amount)}\n\n` +
    `Due:\n${formatDate(dueDate)}`;

  return sendAndLog({
    phone,
    message,
    notificationType: "subscription_invoice",
    customerId,
    invoiceId
  });
}

/**
 * Send Payment Received notification.
 *
 * @param {Object} params
 * @param {string} params.phone
 * @param {string} params.invoiceNumber
 * @param {number|string} params.amount
 * @param {number} params.customerId
 * @param {number} params.invoiceId
 * @returns {Object}
 */
async function sendPaymentReceived({ phone, invoiceNumber, amount, customerId, invoiceId }) {
  const message =
    `Payment received successfully.\n\n` +
    `Invoice:\n${invoiceNumber}\n\n` +
    `Amount:\n${formatAmount(amount)}\n\n` +
    `Status:\nPaid\n\n` +
    `Thank you for your payment.`;

  return sendAndLog({
    phone,
    message,
    notificationType: "payment_received",
    customerId,
    invoiceId
  });
}

/**
 * Send Payment Reminder (upcoming due) notification.
 *
 * @param {Object} params
 * @param {string} params.phone
 * @param {string} params.invoiceNumber
 * @param {number|string} params.amount
 * @param {string|Date} params.dueDate
 * @param {number} params.customerId
 * @param {number} params.invoiceId
 * @returns {Object}
 */
async function sendPaymentReminder({ phone, invoiceNumber, amount, dueDate, customerId, invoiceId }) {
  const message =
    `Reminder\n\n` +
    `Invoice:\n${invoiceNumber}\n\n` +
    `Amount:\n${formatAmount(amount)}\n\n` +
    `Due:\n${formatDate(dueDate)}\n\n` +
    `Please complete payment before the due date.`;

  return sendAndLog({
    phone,
    message,
    notificationType: "payment_reminder",
    customerId,
    invoiceId
  });
}

/**
 * Send Overdue Notice notification.
 *
 * @param {Object} params
 * @param {string} params.phone
 * @param {string} params.invoiceNumber
 * @param {number|string} params.amount
 * @param {number} params.customerId
 * @param {number} params.invoiceId
 * @returns {Object}
 */
async function sendOverdueNotice({ phone, invoiceNumber, amount, customerId, invoiceId }) {
  const message =
    `Your invoice ${invoiceNumber} is overdue.\n\n` +
    `Amount:\n${formatAmount(amount)}\n\n` +
    `Please complete payment as soon as possible.`;

  return sendAndLog({
    phone,
    message,
    notificationType: "overdue_notice",
    customerId,
    invoiceId
  });
}

/**
 * Send a test notification (for settings page testing).
 *
 * @param {string} phone - Phone number to test.
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
 * Retry a failed notification log entry.
 *
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

module.exports = {
  // Core
  validatePhoneNumber,
  getActiveProvider,
  sendWhatsAppMessage,
  sendTwilioWhatsApp,
  sendMetaWhatsApp,
  sendAndLog,
  // High-level notification functions
  sendInvoiceCreated,
  sendSubscriptionInvoice,
  sendPaymentReceived,
  sendPaymentReminder,
  sendOverdueNotice,
  // Utilities
  sendTestNotification,
  retryNotification,
  formatAmount,
  formatDate
};
