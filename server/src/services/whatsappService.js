/**
 * WhatsApp Notification Service
 *
 * Sends WhatsApp messages via Meta WhatsApp Business API (Cloud API).
 * Falls back to console logging if Meta credentials are not configured.
 *
 * Required environment variables:
 * - META_WHATSAPP_TOKEN (Permanent access token)
 * - META_WHATSAPP_PHONE_ID (Phone number ID from Meta Business)
 */

const https = require("https");

const META_API_VERSION = "v18.0";

/**
 * Send a message via Meta WhatsApp Cloud API.
 *
 * @param {Object} params - { to, message }
 * @returns {Promise<Object>} API response or console log confirmation.
 */
function sendMetaWhatsApp(to, message) {
  return new Promise((resolve, reject) => {
    const token = process.env.META_WHATSAPP_TOKEN;
    const phoneId = process.env.META_WHATSAPP_PHONE_ID;

    if (!token || !phoneId) {
      console.log(`[WHATSAPP] (Demo) → ${to}: ${message}`);
      resolve({
        provider: "console",
        to,
        message,
        sentAt: new Date().toISOString(),
        note: "Meta WhatsApp API not configured. Message logged to console."
      });
      return;
    }

    // Remove '+' prefix if present for Meta API format
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
      }
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`[WHATSAPP] Sent to ${to} | ID: ${parsed.messages?.[0]?.id || "unknown"}`);
            resolve({
              provider: "meta",
              messageId: parsed.messages?.[0]?.id,
              to,
              sentAt: new Date().toISOString()
            });
          } else {
            reject(new Error(`Meta WhatsApp API error (${res.statusCode}): ${data}`));
          }
        } catch (err) {
          reject(new Error(`Failed to parse Meta API response: ${err.message}`));
        }
      });
    });

    req.on("error", (err) => {
      reject(new Error(`Meta WhatsApp request failed: ${err.message}`));
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Send a WhatsApp notification to a customer about their invoice.
 *
 * @param {Object} params - { to, invoiceId, customerName, amount, dueDate }
 * @returns {Object} Result with messageId or console log confirmation.
 */
async function sendWhatsAppReminder({ to, invoiceId, customerName, amount, dueDate }) {
  const message = `Hi ${customerName}, your invoice ${invoiceId} for SGD ${Number(amount).toFixed(2)} is due on ${dueDate}. Please arrange payment. — PayNivo`;
  return sendMetaWhatsApp(to, message);
}

/**
 * Send a WhatsApp payment confirmation.
 *
 * @param {Object} params - { to, invoiceId, amount }
 */
async function sendWhatsAppPaymentConfirmation({ to, invoiceId, amount }) {
  const message = `Payment confirmed! Invoice ${invoiceId} for SGD ${Number(amount).toFixed(2)} has been received. Thank you! — PayNivo`;
  return sendMetaWhatsApp(to, message);
}

module.exports = {
  sendWhatsAppReminder,
  sendWhatsAppPaymentConfirmation
};
