/**
 * WhatsApp Auto-Trigger Service (Refactored)
 *
 * Non-blocking lifecycle hooks for automatic WhatsApp notifications.
 * Called from invoice/payment controllers after successful operations.
 *
 * Uses the new whatsappService which loads credentials from the database.
 * Checks whatsapp_config.is_enabled and whatsapp_notification_rules before sending.
 *
 * All triggers are non-blocking: errors are logged but never propagated.
 */

const whatsappService = require("./whatsappService");
const configModel = require("../models/whatsappConfigModel");
const { pool } = require("../config/db");

/**
 * Check if integration is enabled and a specific rule is active.
 * @param {string} ruleType
 * @returns {boolean}
 */
async function isRuleEnabled(ruleType) {
  try {
    const status = await configModel.getIntegrationStatus();
    if (!status.enabled || !status.configured) return false;

    const rules = await configModel.getNotificationRules();
    const rule = rules.find((r) => r.rule_type === ruleType);
    return rule ? rule.is_enabled : false;
  } catch {
    return false;
  }
}

/**
 * Get customer WhatsApp info.
 * @param {number} customerId
 * @returns {Object|null}
 */
async function getCustomerPhone(customerId) {
  try {
    const [rows] = await pool.query(
      "SELECT customer_id, name, whatsapp_number FROM customer WHERE customer_id = ? AND whatsapp_number IS NOT NULL AND whatsapp_number != ''",
      [customerId]
    );
    return rows[0] || null;
  } catch {
    return null;
  }
}

// ─── Lifecycle Triggers ───────────────────────────────────────────────────────

/**
 * Trigger: Invoice Sent
 * Called after an invoice is marked as "Sent".
 */
async function onInvoiceSent(invoice) {
  try {
    if (!(await isRuleEnabled("invoice_sent"))) return;

    const customer = await getCustomerPhone(invoice.customer_id);
    if (!customer) return;

    await whatsappService.sendInvoice({
      customerId: customer.customer_id,
      customerName: customer.name,
      phone: customer.whatsapp_number,
      invoiceId: invoice.invoice_id,
      invoiceNumber: invoice.invoiceId,
      amount: invoice.total_amount,
      dueDate: invoice.due_date,
      paymentLink: invoice.payment_url || null
    });

    console.log(`[AUTO-TRIGGER] Invoice Sent notification for ${invoice.invoiceId}`);
  } catch (err) {
    console.error(`[AUTO-TRIGGER] Invoice Sent failed for ${invoice.invoiceId}:`, err.message);
  }
}

/**
 * Trigger: Payment Received
 * Called after a payment is successfully recorded.
 * Looks up customer_id from the invoice if not directly provided.
 */
async function onPaymentReceived(payment) {
  try {
    if (!(await isRuleEnabled("payment_confirmation"))) return;

    // Resolve customer_id — may not be passed from webhook context
    let customerId = payment.customer_id;
    let invoiceNumber = payment.invoiceId || "";

    if (!customerId && payment.invoice_id) {
      try {
        const [rows] = await pool.query(
          "SELECT customer_id, invoiceId FROM invoice WHERE invoice_id = ? LIMIT 1",
          [payment.invoice_id]
        );
        if (rows[0]) {
          customerId = rows[0].customer_id;
          if (!invoiceNumber) invoiceNumber = rows[0].invoiceId;
        }
      } catch { /* non-critical */ }
    }

    if (!customerId) return;

    const customer = await getCustomerPhone(customerId);
    if (!customer) return;

    await whatsappService.sendPaymentConfirmation({
      customerId: customer.customer_id,
      customerName: customer.name,
      phone: customer.whatsapp_number,
      invoiceId: payment.invoice_id,
      invoiceNumber,
      amount: payment.amount
    });

    console.log(`[AUTO-TRIGGER] Payment Confirmation for ${invoiceNumber}`);
  } catch (err) {
    console.error(`[AUTO-TRIGGER] Payment Confirmation failed:`, err.message);
  }
}

module.exports = {
  onInvoiceSent,
  onPaymentReceived
};
