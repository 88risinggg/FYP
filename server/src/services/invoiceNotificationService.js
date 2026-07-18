/**
 * Invoice Notification Service
 *
 * Creates in-app notifications for Finance users about invoice events.
 * Notifications are stored in the invoice_notification table.
 * If the table doesn't exist, operations are no-ops.
 */

const { pool } = require("../config/db");

/**
 * Create a notification for Finance users.
 *
 * @param {Object} data - Notification data.
 * @param {string} data.type - Notification type (draft_saved, invoice_sent, customer_viewed, etc.)
 * @param {string} data.title - Short title.
 * @param {string} data.message - Notification message.
 * @param {number|null} data.invoiceId - Related invoice primary key.
 * @param {number|null} data.userId - Target user ID (null = all Finance users).
 */
async function createNotification(data) {
  try {
    const { type, title, message, invoiceId, userId } = data;

    if (userId) {
      await pool.query(
        `INSERT INTO invoice_notification (type, title, message, invoice_id, user_id, is_read, created_at)
         VALUES (?, ?, ?, ?, ?, 0, NOW())`,
        [type, title, message, invoiceId || null, userId]
      );
    } else {
      // Notify all Finance and Admin users
      const [users] = await pool.query(`
        SELECT u.user_id FROM user u
        INNER JOIN role r ON r.role_id = u.role_id
        WHERE r.role_name IN ('Finance', 'Admin') AND u.status = 1
      `);

      if (users.length > 0) {
        const values = users.map((u) => [type, title, message, invoiceId || null, u.user_id, 0]);
        await pool.query(
          `INSERT INTO invoice_notification (type, title, message, invoice_id, user_id, is_read)
           VALUES ?`,
          [values]
        );
      }
    }
  } catch (error) {
    // Non-blocking — notification table may not exist
    if (error.code !== "ER_NO_SUCH_TABLE") {
      console.error("[NOTIFICATION]", error.message);
    }
  }
}

/**
 * Notify Finance that a draft was saved.
 */
async function notifyDraftSaved(invoiceNumber, userId) {
  await createNotification({
    type: "draft_saved",
    title: "Draft Saved",
    message: `Invoice ${invoiceNumber} saved as draft.`,
    userId
  });
}

/**
 * Notify Finance that an invoice was sent.
 */
async function notifyInvoiceSent(invoiceNumber, customerName, userId) {
  await createNotification({
    type: "invoice_sent",
    title: "Invoice Sent",
    message: `Invoice ${invoiceNumber} sent to ${customerName}.`,
    userId
  });
}

/**
 * Notify Finance that a customer viewed an invoice.
 */
async function notifyCustomerViewed(invoiceNumber, customerName) {
  await createNotification({
    type: "customer_viewed",
    title: "Invoice Viewed",
    message: `${customerName} viewed invoice ${invoiceNumber}.`
  });
}

/**
 * Notify Finance that a customer downloaded the PDF.
 */
async function notifyCustomerDownloaded(invoiceNumber, customerName) {
  await createNotification({
    type: "customer_downloaded",
    title: "PDF Downloaded",
    message: `${customerName} downloaded invoice ${invoiceNumber}.`
  });
}

/**
 * Notify Finance that a customer clicked Pay Now.
 */
async function notifyPayNowClicked(invoiceNumber, customerName) {
  await createNotification({
    type: "pay_now_clicked",
    title: "Payment Initiated",
    message: `${customerName} clicked Pay Now on invoice ${invoiceNumber}.`
  });
}

/**
 * Notify Finance that payment succeeded.
 */
async function notifyPaymentSuccess(invoiceNumber, customerName, amount) {
  await createNotification({
    type: "payment_success",
    title: "Payment Received",
    message: `Payment of SGD ${Number(amount).toFixed(2)} received for invoice ${invoiceNumber} from ${customerName}.`
  });
}

/**
 * Notify Finance that payment failed.
 */
async function notifyPaymentFailed(invoiceNumber, customerName) {
  await createNotification({
    type: "payment_failed",
    title: "Payment Failed",
    message: `Payment failed for invoice ${invoiceNumber} from ${customerName}.`
  });
}

/**
 * Notify Finance that an invoice became overdue.
 */
async function notifyInvoiceOverdue(invoiceNumber, customerName, amount) {
  await createNotification({
    type: "invoice_overdue",
    title: "Invoice Overdue",
    message: `Invoice ${invoiceNumber} (SGD ${Number(amount).toFixed(2)}) from ${customerName} is now overdue.`
  });
}

/**
 * Notify Finance that a payment was refunded.
 */
async function notifyPaymentRefunded(invoiceNumber, customerName) {
  await createNotification({
    type: "payment_refunded",
    title: "Payment Refunded",
    message: `Payment for invoice ${invoiceNumber} from ${customerName} has been refunded.`
  });
}

/**
 * Notify Finance that a reminder was sent.
 */
async function notifyReminderSent(invoiceNumber, customerName, reminderType) {
  await createNotification({
    type: "reminder_sent",
    title: "Reminder Sent",
    message: `${reminderType} reminder sent to ${customerName} for invoice ${invoiceNumber}.`
  });
}

/**
 * Notify Finance that an invoice was cancelled.
 */
async function notifyInvoiceCancelled(invoiceNumber, customerName, userId) {
  await createNotification({
    type: "invoice_cancelled",
    title: "Invoice Cancelled",
    message: `Invoice ${invoiceNumber} for ${customerName} has been cancelled.`,
    userId
  });
}

module.exports = {
  createNotification,
  notifyDraftSaved,
  notifyInvoiceSent,
  notifyCustomerViewed,
  notifyCustomerDownloaded,
  notifyPayNowClicked,
  notifyPaymentSuccess,
  notifyPaymentFailed,
  notifyInvoiceOverdue,
  notifyPaymentRefunded,
  notifyReminderSent,
  notifyInvoiceCancelled
};
