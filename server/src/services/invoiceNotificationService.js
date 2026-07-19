/**
 * Invoice Notification Service
 *
 * Creates in-app notifications for Finance users about invoice events.
 * Uses the existing `notification` table with columns:
 *   notification_id, user_user_id, type, subject, message, status (Unread/Read), sent_at
 *
 * Only Finance role users receive these notifications.
 */

const { pool } = require("../config/db");

/**
 * Create a notification for Finance users using the existing notification table.
 *
 * @param {Object} data - Notification data.
 * @param {string} data.type - Notification type (e.g. invoice_sent, payment_success, fraud_alert).
 * @param {string} data.title - Short title (stored in `subject` column).
 * @param {string} data.message - Notification message.
 * @param {number|null} data.invoiceId - Related invoice primary key (not stored, for reference only).
 * @param {number|null} data.userId - Target user ID (null = all Finance users).
 */
async function createNotification(data) {
  try {
    const { type, title, message, userId } = data;

    if (userId) {
      // Verify the user is Finance role before creating notification
      const [userRows] = await pool.query(
        "SELECT user_id, role_name FROM user WHERE user_id = ? AND role_name = 'Finance' AND status = 1 LIMIT 1",
        [userId]
      );
      if (userRows.length > 0) {
        await pool.query(
          "INSERT INTO notification (user_user_id, type, subject, message, status, sent_at) VALUES (?, ?, ?, ?, 'Unread', NOW())",
          [userId, type || "system", title, message || null]
        );
      }
    } else {
      // Notify only Finance users
      const [users] = await pool.query(
        "SELECT user_id FROM user WHERE role_name = 'Finance' AND status = 1"
      );

      if (users.length > 0) {
        const values = users.map((u) => [u.user_id, type || "system", title, message || null, "Unread"]);
        await pool.query(
          "INSERT INTO notification (user_user_id, type, subject, message, status, sent_at) VALUES ?",
          [values.map((v) => [...v, new Date()])]
        );
      }
    }
  } catch (error) {
    // Non-blocking — log but don't crash
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

/**
 * Notify Finance about a fraud detection alert (score exceeds threshold).
 */
async function notifyFraudAlert(invoiceNumber, score) {
  await createNotification({
    type: "fraud_alert",
    title: "Fraud Detection Alert",
    message: `Invoice ${invoiceNumber} flagged as High Risk (score: ${score}). Immediate review required.`
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
  notifyInvoiceCancelled,
  notifyFraudAlert
};
