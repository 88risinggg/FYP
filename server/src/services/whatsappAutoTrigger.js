/**
 * WhatsApp Auto-Trigger Service
 *
 * Automatically sends WhatsApp notifications when invoice lifecycle events occur.
 * Called from invoice/payment/subscription controllers after successful operations.
 *
 * All triggers are non-blocking: errors are logged but never propagated
 * to prevent WhatsApp failures from breaking core business operations.
 *
 * Checks notification_settings before sending:
 *   - whatsapp_enabled must be true
 *   - Individual event toggles (send_invoice_created, etc.)
 *   - Customer must have a whatsapp_number
 */

const notificationModel = require("../models/whatsappNotificationModel");
const whatsappService = require("./whatsappService");
const { pool } = require("../config/db");

/**
 * Check if WhatsApp notifications are enabled and if a specific type is active.
 * @param {string} settingKey - e.g., "send_invoice_created"
 * @returns {Object|null} settings if enabled, null if disabled
 */
async function checkEnabled(settingKey) {
  try {
    const settings = await notificationModel.getSettings();
    if (!settings || !settings.whatsapp_enabled) return null;
    if (settingKey && !settings[settingKey]) return null;
    return settings;
  } catch {
    return null;
  }
}

/**
 * Get customer WhatsApp info. Returns null if customer has no WhatsApp number.
 * @param {number} customerId
 * @returns {Object|null}
 */
async function getCustomerPhone(customerId) {
  try {
    const customer = await notificationModel.getCustomerWithWhatsApp(customerId);
    if (!customer || !customer.whatsapp_number) return null;
    return customer;
  } catch {
    return null;
  }
}

// ─── Invoice Lifecycle Triggers ───────────────────────────────────────────────

/**
 * Trigger: Invoice Created
 * Called after a new invoice is successfully created.
 * @param {Object} invoice - { invoice_id, invoiceId, total_amount, due_date, customer_id, payment_url }
 */
async function onInvoiceCreated(invoice) {
  try {
    const settings = await checkEnabled("send_invoice_created");
    if (!settings) return;
    if (!settings.auto_send_invoice) return;

    const customer = await getCustomerPhone(invoice.customer_id);
    if (!customer) return;

    await whatsappService.sendInvoiceCreated({
      customerName: customer.name,
      phone: customer.whatsapp_number,
      invoiceNumber: invoice.invoiceId,
      amount: invoice.total_amount,
      dueDate: invoice.due_date,
      paymentLink: invoice.payment_url || null,
      customerId: customer.customer_id,
      invoiceId: invoice.invoice_id,
      sendPdf: Boolean(settings.send_pdf_attachments)
    });

    console.log(`[AUTO-TRIGGER] Invoice Created notification sent for ${invoice.invoiceId}`);
  } catch (err) {
    console.error(`[AUTO-TRIGGER] Invoice Created failed for ${invoice.invoiceId}:`, err.message);
  }
}

/**
 * Trigger: Invoice Sent (after email delivery)
 * Called after an invoice is marked as "Sent".
 * @param {Object} invoice - { invoice_id, invoiceId, total_amount, due_date, customer_id, payment_url }
 */
async function onInvoiceSent(invoice) {
  try {
    const settings = await checkEnabled("send_invoice_created");
    if (!settings) return;

    const customer = await getCustomerPhone(invoice.customer_id);
    if (!customer) return;

    await whatsappService.sendInvoiceSent({
      customerName: customer.name,
      phone: customer.whatsapp_number,
      invoiceNumber: invoice.invoiceId,
      amount: invoice.total_amount,
      dueDate: invoice.due_date,
      paymentLink: invoice.payment_url || null,
      customerId: customer.customer_id,
      invoiceId: invoice.invoice_id,
      sendPdf: Boolean(settings.send_pdf_attachments)
    });

    console.log(`[AUTO-TRIGGER] Invoice Sent notification sent for ${invoice.invoiceId}`);
  } catch (err) {
    console.error(`[AUTO-TRIGGER] Invoice Sent failed for ${invoice.invoiceId}:`, err.message);
  }
}

/**
 * Trigger: Payment Received
 * Called after a payment is successfully recorded (manual or Stripe).
 * @param {Object} payment - { invoice_id, invoiceId, amount, payment_date, customer_id }
 */
async function onPaymentReceived(payment) {
  try {
    const settings = await checkEnabled("send_payment_received");
    if (!settings) return;

    const customer = await getCustomerPhone(payment.customer_id);
    if (!customer) return;

    await whatsappService.sendPaymentReceived({
      phone: customer.whatsapp_number,
      invoiceNumber: payment.invoiceId,
      amount: payment.amount,
      paymentDate: payment.payment_date || new Date(),
      customerId: customer.customer_id,
      invoiceId: payment.invoice_id,
      sendReceipt: Boolean(settings.auto_send_receipt)
    });

    console.log(`[AUTO-TRIGGER] Payment Received notification sent for ${payment.invoiceId}`);
  } catch (err) {
    console.error(`[AUTO-TRIGGER] Payment Received failed for ${payment.invoiceId}:`, err.message);
  }
}

// ─── Subscription Lifecycle Triggers ──────────────────────────────────────────

/**
 * Trigger: Subscription Started
 * @param {Object} subscription - { customer_id, subscription_name, amount, next_billing_date }
 */
async function onSubscriptionStarted(subscription) {
  try {
    const settings = await checkEnabled("send_subscription_invoice");
    if (!settings) return;
    if (!settings.auto_send_subscription) return;

    const customer = await getCustomerPhone(subscription.customer_id);
    if (!customer) return;

    await whatsappService.sendSubscriptionStarted({
      customerName: customer.name,
      phone: customer.whatsapp_number,
      subscriptionName: subscription.subscription_name || subscription.plan_name || "Subscription",
      amount: subscription.amount,
      nextBillingDate: subscription.next_billing_date,
      customerId: customer.customer_id,
      invoiceId: subscription.invoice_id || null
    });

    console.log(`[AUTO-TRIGGER] Subscription Started for customer ${customer.name}`);
  } catch (err) {
    console.error("[AUTO-TRIGGER] Subscription Started failed:", err.message);
  }
}

/**
 * Trigger: Subscription Renewed
 * @param {Object} data - { customer_id, subscription_name, amount, next_billing_date, invoiceId, invoice_id }
 */
async function onSubscriptionRenewed(data) {
  try {
    const settings = await checkEnabled("send_subscription_invoice");
    if (!settings) return;
    if (!settings.auto_send_subscription) return;

    const customer = await getCustomerPhone(data.customer_id);
    if (!customer) return;

    await whatsappService.sendSubscriptionRenewed({
      customerName: customer.name,
      phone: customer.whatsapp_number,
      subscriptionName: data.subscription_name || "Subscription",
      amount: data.amount,
      nextBillingDate: data.next_billing_date,
      invoiceNumber: data.invoiceId || "",
      customerId: customer.customer_id,
      invoiceId: data.invoice_id || null
    });

    console.log(`[AUTO-TRIGGER] Subscription Renewed for customer ${customer.name}`);
  } catch (err) {
    console.error("[AUTO-TRIGGER] Subscription Renewed failed:", err.message);
  }
}

/**
 * Trigger: Subscription Expiring
 * @param {Object} data - { customer_id, subscription_name, expiry_date }
 */
async function onSubscriptionExpiring(data) {
  try {
    const settings = await checkEnabled("send_subscription_invoice");
    if (!settings) return;
    if (!settings.auto_send_subscription) return;

    const customer = await getCustomerPhone(data.customer_id);
    if (!customer) return;

    await whatsappService.sendSubscriptionExpiring({
      customerName: customer.name,
      phone: customer.whatsapp_number,
      subscriptionName: data.subscription_name || "Subscription",
      expiryDate: data.expiry_date,
      customerId: customer.customer_id
    });

    console.log(`[AUTO-TRIGGER] Subscription Expiring for customer ${customer.name}`);
  } catch (err) {
    console.error("[AUTO-TRIGGER] Subscription Expiring failed:", err.message);
  }
}

/**
 * Trigger: Subscription Payment Failed
 * @param {Object} data - { customer_id, subscription_name, amount }
 */
async function onSubscriptionPaymentFailed(data) {
  try {
    const settings = await checkEnabled("send_subscription_invoice");
    if (!settings) return;
    if (!settings.auto_send_subscription) return;

    const customer = await getCustomerPhone(data.customer_id);
    if (!customer) return;

    await whatsappService.sendSubscriptionPaymentFailed({
      customerName: customer.name,
      phone: customer.whatsapp_number,
      subscriptionName: data.subscription_name || "Subscription",
      amount: data.amount,
      customerId: customer.customer_id
    });

    console.log(`[AUTO-TRIGGER] Subscription Payment Failed for customer ${customer.name}`);
  } catch (err) {
    console.error("[AUTO-TRIGGER] Subscription Payment Failed:", err.message);
  }
}

/**
 * Trigger: Subscription Cancelled
 * @param {Object} data - { customer_id, subscription_name }
 */
async function onSubscriptionCancelled(data) {
  try {
    const settings = await checkEnabled("send_subscription_invoice");
    if (!settings) return;
    if (!settings.auto_send_subscription) return;

    const customer = await getCustomerPhone(data.customer_id);
    if (!customer) return;

    await whatsappService.sendSubscriptionCancelled({
      customerName: customer.name,
      phone: customer.whatsapp_number,
      subscriptionName: data.subscription_name || "Subscription",
      customerId: customer.customer_id
    });

    console.log(`[AUTO-TRIGGER] Subscription Cancelled for customer ${customer.name}`);
  } catch (err) {
    console.error("[AUTO-TRIGGER] Subscription Cancelled:", err.message);
  }
}

module.exports = {
  onInvoiceCreated,
  onInvoiceSent,
  onPaymentReceived,
  onSubscriptionStarted,
  onSubscriptionRenewed,
  onSubscriptionExpiring,
  onSubscriptionPaymentFailed,
  onSubscriptionCancelled
};
