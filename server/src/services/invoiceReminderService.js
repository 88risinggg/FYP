/**
 * Invoice Reminder Service
 *
 * Handles automatic payment reminders for invoices following this schedule:
 * - 3 days before due date ("upcoming_due")
 * - On the due date ("due_today")
 * - 3 days after due date ("overdue_3d")
 * - Every 7 days after becoming overdue ("overdue_recurring")
 *
 * Stops reminders immediately once payment is received.
 * Prevents duplicate reminders by recording last reminder date and count.
 * Sends HTML emails with payment link, QR code, and invoice details.
 * Logs every reminder sent for audit trail.
 * Notifies Finance when reminders are sent.
 */

const { pool } = require("../config/db");
const { generateQRCode } = require("./qrCodeService");
const { createNotification } = require("./invoiceNotificationService");
const nodemailer = require("nodemailer");
const {
  REMINDER_SCHEDULE,
  scheduledReminderType
} = require("./invoiceReminderSchedule");

// =====================================================
// Configuration
// =====================================================

// =====================================================
// Email Transport
// =====================================================

function createTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

// =====================================================
// Reminder Email Templates
// =====================================================

function buildReminderEmailHtml(invoice, reminderType) {
  const amount = Number(invoice.total_amount || 0).toFixed(2);
  const dueDate = invoice.due_date ? new Date(invoice.due_date).toLocaleDateString("en-SG", { year: "numeric", month: "long", day: "numeric" }) : "N/A";
  const paymentUrl = invoice.payment_url || "";
  const qrCode = invoice.qr_code_url || "";

  let subject, heading, message, urgencyColor;

  switch (reminderType) {
    case "upcoming_due":
      subject = `Upcoming Payment Due - Invoice ${invoice.invoiceId}`;
      heading = "Payment Reminder";
      message = `This is a friendly reminder that your invoice <strong>${invoice.invoiceId}</strong> for <strong>SGD ${amount}</strong> is due on <strong>${dueDate}</strong> (in 3 days).`;
      urgencyColor = "#3b82f6"; // blue
      break;
    case "due_today":
      subject = `Payment Due Today - Invoice ${invoice.invoiceId}`;
      heading = "Payment Due Today";
      message = `Your invoice <strong>${invoice.invoiceId}</strong> for <strong>SGD ${amount}</strong> is due <strong>today (${dueDate})</strong>. Please complete payment at your earliest convenience.`;
      urgencyColor = "#f59e0b"; // amber
      break;
    case "overdue_3d":
      subject = `Overdue Notice - Invoice ${invoice.invoiceId}`;
      heading = "Invoice Overdue";
      message = `Your invoice <strong>${invoice.invoiceId}</strong> for <strong>SGD ${amount}</strong> was due on <strong>${dueDate}</strong> and is now <strong>3 days overdue</strong>. Please arrange payment immediately to avoid further action.`;
      urgencyColor = "#ef4444"; // red
      break;
    case "overdue_recurring":
      const daysPast = Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / 86400000);
      subject = `Urgent: Invoice ${invoice.invoiceId} - ${daysPast} Days Overdue`;
      heading = "Urgent Payment Required";
      message = `Your invoice <strong>${invoice.invoiceId}</strong> for <strong>SGD ${amount}</strong> has been overdue for <strong>${daysPast} days</strong> (original due date: ${dueDate}). This is a recurring reminder. Please settle this invoice immediately.`;
      urgencyColor = "#dc2626"; // dark red
      break;
    default:
      subject = `Payment Reminder - Invoice ${invoice.invoiceId}`;
      heading = "Payment Reminder";
      message = `Please complete payment for invoice ${invoice.invoiceId}.`;
      urgencyColor = "#7B2FF7";
  }

  const payButton = paymentUrl ? `
    <div style="text-align: center; margin: 24px 0;">
      <a href="${paymentUrl}" style="display: inline-block; background: #7B2FF7; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">
        Pay Now - SGD ${amount}
      </a>
      <p style="margin: 8px 0 0; font-size: 11px; color: #666; word-break: break-all;">${paymentUrl}</p>
    </div>` : "";

  const qrSection = qrCode ? `
    <div style="text-align: center; margin: 16px 0;">
      <p style="font-size: 12px; color: #666; margin: 0 0 8px;">Or scan QR code to pay:</p>
      <img src="${qrCode}" alt="Payment QR Code" style="width: 140px; height: 140px;" />
    </div>` : "";

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #7B2FF7; margin: 0;">Vaniday</h1>
      </div>
      <div style="border-left: 4px solid ${urgencyColor}; padding: 16px 20px; background: #f9fafb; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
        <h2 style="margin: 0 0 8px; color: #1a1a2e; font-size: 18px;">${heading}</h2>
        <p style="margin: 0; color: #333; line-height: 1.6;">${message}</p>
      </div>
      <div style="background: #f8f4ff; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
        <table style="width: 100%; font-size: 14px; color: #333;">
          <tr><td style="padding: 4px 0; color: #666;">Invoice:</td><td style="padding: 4px 0; font-weight: bold;">${invoice.invoiceId}</td></tr>
          <tr><td style="padding: 4px 0; color: #666;">Customer:</td><td style="padding: 4px 0;">${invoice.customer_name}</td></tr>
          <tr><td style="padding: 4px 0; color: #666;">Amount:</td><td style="padding: 4px 0; font-weight: bold;">SGD ${amount}</td></tr>
          <tr><td style="padding: 4px 0; color: #666;">Due Date:</td><td style="padding: 4px 0;">${dueDate}</td></tr>
        </table>
      </div>
      ${payButton}
      ${qrSection}
      <p style="color: #666; font-size: 13px; line-height: 1.6; margin-top: 24px;">
        If you have already made this payment, please disregard this reminder.
        For any queries, please contact us at ${process.env.SMTP_FROM || "finance@vaniday.com"}.
      </p>
      <p style="color: #999; font-size: 11px; text-align: center; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px;">
        This is an automated reminder from Vaniday Invoicing System.
      </p>
    </div>
  `;

  return { subject, html };
}

// =====================================================
// Core Reminder Logic
// =====================================================

/**
 * Send a reminder email and log it.
 *
 * @param {Object} invoice - Invoice data with customer and payment info.
 * @param {string} reminderType - Type: upcoming_due, due_today, overdue_3d, overdue_recurring
 * @returns {boolean} Whether the email was sent successfully.
 */
async function sendReminderForInvoice(invoice, reminderType) {
  const transporter = createTransporter();
  const { subject, html } = buildReminderEmailHtml(invoice, reminderType);

  if (!transporter) {
    console.log(`[REMINDER] (Console) ${reminderType} → ${invoice.customer_email} for ${invoice.invoiceId}`);
    await logReminder(invoice, reminderType, "Sent", null);
    return true;
  }

  try {
    // Generate QR code inline for email if payment URL exists but no stored QR
    let qrCid = null;
    let qrBuffer = null;
    if (invoice.payment_url && !invoice.qr_code_url) {
      const { generateQRCodeBuffer } = require("./qrCodeService");
      qrBuffer = await generateQRCodeBuffer(invoice.payment_url);
      qrCid = "reminder-qr@paynivo";
    }

    const attachments = [];
    if (qrBuffer) {
      attachments.push({ filename: "qrcode.png", content: qrBuffer, contentType: "image/png", cid: qrCid });
    }

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: invoice.customer_email,
      subject,
      html,
      attachments
    });

    await logReminder(invoice, reminderType, "Sent", null);
    console.log(`[REMINDER] Sent ${reminderType} to ${invoice.customer_email} for ${invoice.invoiceId}`);
    return true;
  } catch (error) {
    await logReminder(invoice, reminderType, "Failed", error.message);
    console.error(`[REMINDER] Failed ${reminderType} for ${invoice.invoiceId}: ${error.message}`);
    return false;
  }
}

/**
 * Log a reminder to the canonical audit log.
 */
async function logReminder(invoice, reminderType, status, errorMessage) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (module, activity_type, action_description, affected_record, status, created_at, new_value)
       VALUES ('Invoice', 'invoice_reminder', ?, ?, ?, NOW(), ?)`,
      [`reminder:${reminderType}`, String(invoice.invoice_id), status,
        JSON.stringify({ reminderType, customerEmail: invoice.customer_email, errorMessage })]
    );
  } catch (e) {
    // Table may not exist yet — will be created by migration
    if (e.code !== "ER_NO_SUCH_TABLE") {
      console.error("[REMINDER LOG]", e.message);
    }
  }
}

/**
 * Check if a reminder of this type has already been sent for this invoice today.
 * For recurring reminders, checks if sent within last 7 days.
 */
async function hasRecentReminder(invoiceId, reminderType) {
  try {
    let query;
    if (reminderType === "overdue_recurring") {
      // For recurring, check if sent within last 7 days
      query = `SELECT COUNT(*) AS cnt FROM audit_logs
               WHERE affected_record = ? AND activity_type = 'invoice_reminder'
               AND action_description = ? AND status = 'Sent'
               AND sent_at > DATE_SUB(NOW(), INTERVAL 7 DAY)`;
    } else {
      // For one-time reminders, check if ever sent successfully
      query = `SELECT COUNT(*) AS cnt FROM audit_logs
               WHERE affected_record = ? AND activity_type = 'invoice_reminder'
               AND action_description = ? AND status = 'Sent'`;
    }
    query = query.replace(/sent_at/g, "created_at");
    const [rows] = await pool.query(query, [String(invoiceId), `reminder:${reminderType}`]);
    return rows[0].cnt > 0;
  } catch (e) {
    if (e.code === "ER_NO_SUCH_TABLE") return false;
    throw e;
  }
}

/**
 * Run the automatic reminder check.
 * Called by the cron scheduler. Processes all unpaid invoices
 * and sends appropriate reminders based on the schedule.
 *
 * @returns {Object} { sent: number, skipped: number }
 */
async function processAutomaticReminders() {
  let sent = 0;
  let skipped = 0;

  try {
    // When configurable reminder rules exist, reminderScheduler is the single
    // operational owner. This fixed schedule remains a compatibility fallback
    // for installations that do not yet have the rule tables.
    try {
      await pool.query("SELECT 1 FROM reminder_settings LIMIT 1");
      return { sent: 0, skipped: 0, managedByRules: true };
    } catch (shapeError) {
      if (shapeError?.code !== "ER_NO_SUCH_TABLE" && shapeError?.code !== "ER_BAD_FIELD_ERROR") {
        throw shapeError;
      }
    }

    // Find all invoices that are not paid/cancelled and have a due date
    const [invoices] = await pool.query(`
      SELECT
        i.invoice_id,
        i.invoiceId,
        i.status,
        i.total_amount,
        i.due_date,
        i.payment_url,
        i.qr_code_url,
        c.name AS customer_name,
        c.email AS customer_email
      FROM invoice i
      INNER JOIN customer c ON c.customer_id = i.customer_id
      WHERE i.status IN ('Sent', 'Viewed', 'Overdue')
        AND i.due_date IS NOT NULL
        AND c.email IS NOT NULL
      ORDER BY i.due_date ASC
    `);

    for (const invoice of invoices) {
      const reminderType = scheduledReminderType(invoice.due_date);

      if (!reminderType) {
        continue; // Not on a reminder day
      }

      // Check for deduplication
      const alreadySent = await hasRecentReminder(invoice.invoice_id, reminderType);
      if (alreadySent) {
        skipped++;
        continue;
      }

      // Generate QR code if payment URL exists but no stored QR
      if (invoice.payment_url && !invoice.qr_code_url) {
        try {
          invoice.qr_code_url = await generateQRCode(invoice.payment_url);
        } catch { /* non-critical */ }
      }

      // Send the reminder
      const success = await sendReminderForInvoice(invoice, reminderType);
      if (success) {
        sent++;
        // Notify Finance that a reminder was sent
        createNotification({
          type: "reminder_sent",
          title: "Reminder Sent",
          message: `${reminderType.replace(/_/g, " ")} reminder sent to ${invoice.customer_name} for ${invoice.invoiceId}.`
        }).catch(() => {});
      }
    }
  } catch (error) {
    console.error("[REMINDER] Error processing automatic reminders:", error.message);
  }

  return { sent, skipped };
}

/**
 * Manually send a reminder for a specific invoice (Finance action).
 *
 * @param {number} invoiceId - Invoice primary key.
 * @param {number|null} userId - Finance user who triggered it.
 * @returns {Object} Result with success flag and message.
 */
async function sendManualReminder(invoiceId, userId) {
  const [rows] = await pool.query(`
    SELECT
      i.invoice_id,
      i.invoiceId,
      i.status,
      i.total_amount,
      i.due_date,
      i.payment_url,
      i.qr_code_url,
      c.name AS customer_name,
      c.email AS customer_email
    FROM invoice i
    INNER JOIN customer c ON c.customer_id = i.customer_id
    WHERE i.invoice_id = ? LIMIT 1
  `, [invoiceId]);

  if (rows.length === 0) {
    return { success: false, message: "Invoice not found." };
  }

  const invoice = rows[0];

  if (invoice.status === "Paid") {
    return { success: false, message: "Cannot send reminder for paid invoice." };
  }

  if (!invoice.customer_email) {
    return { success: false, message: "Customer has no email address." };
  }

  // Generate QR code if needed
  if (invoice.payment_url && !invoice.qr_code_url) {
    try {
      invoice.qr_code_url = await generateQRCode(invoice.payment_url);
    } catch { /* non-critical */ }
  }

  const reminderType = "manual";
  const success = await sendReminderForInvoice(invoice, reminderType);

  if (success) {
    createNotification({
      type: "reminder_sent",
      title: "Manual Reminder Sent",
      message: `Manual reminder sent to ${invoice.customer_name} for ${invoice.invoiceId}.`,
      userId
    }).catch(() => {});
  }

  return {
    success,
    message: success ? "Reminder sent successfully." : "Failed to send reminder."
  };
}

module.exports = {
  processAutomaticReminders,
  sendManualReminder,
  sendReminderForInvoice,
  REMINDER_SCHEDULE
};
