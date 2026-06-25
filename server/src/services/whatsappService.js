/**
 * WhatsApp Notification Service
 *
 * Sends WhatsApp messages via Twilio API.
 * Falls back to console logging if Twilio credentials are not configured.
 *
 * Required environment variables:
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_AUTH_TOKEN
 * - TWILIO_WHATSAPP_FROM (e.g. "whatsapp:+14155238886")
 */

/**
 * Send a WhatsApp notification to a customer about their invoice.
 *
 * @param {Object} params - { to, invoiceId, customerName, amount, dueDate }
 * @param {string} params.to - Customer phone number (e.g. "+6591234567")
 * @param {string} params.invoiceId - Invoice number (e.g. "INV-0001")
 * @param {string} params.customerName - Customer name
 * @param {number} params.amount - Invoice amount
 * @param {string} params.dueDate - Due date string
 * @returns {Object} Result with sid or console log confirmation.
 */
async function sendWhatsAppReminder({ to, invoiceId, customerName, amount, dueDate }) {
  const message = `Hi ${customerName}, your invoice ${invoiceId} for SGD ${Number(amount).toFixed(2)} is due on ${dueDate}. Please arrange payment. — PayNivo`;

  // Check if Twilio is configured
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.log(`[WHATSAPP] (Demo) → ${to}: ${message}`);
    return {
      provider: "console",
      to,
      message,
      sentAt: new Date().toISOString(),
      note: "Twilio not configured. Message logged to console."
    };
  }

  // Real Twilio delivery
  const twilio = require("twilio");
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  const result = await client.messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886",
    to: `whatsapp:${to}`,
    body: message
  });

  console.log(`[WHATSAPP] Sent to ${to} | SID: ${result.sid}`);

  return {
    provider: "twilio",
    sid: result.sid,
    to,
    sentAt: new Date().toISOString()
  };
}

/**
 * Send a WhatsApp payment confirmation.
 *
 * @param {Object} params - { to, invoiceId, amount }
 */
async function sendWhatsAppPaymentConfirmation({ to, invoiceId, amount }) {
  const message = `Payment confirmed! Invoice ${invoiceId} for SGD ${Number(amount).toFixed(2)} has been received. Thank you! — PayNivo`;

  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.log(`[WHATSAPP] (Demo) → ${to}: ${message}`);
    return { provider: "console", to, message, sentAt: new Date().toISOString() };
  }

  const twilio = require("twilio");
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  const result = await client.messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886",
    to: `whatsapp:${to}`,
    body: message
  });

  return { provider: "twilio", sid: result.sid, to, sentAt: new Date().toISOString() };
}

module.exports = {
  sendWhatsAppReminder,
  sendWhatsAppPaymentConfirmation
};
