/**
 * WhatsApp Notification Scheduler
 *
 * Uses node-cron to run daily checks for:
 *   1. Payment reminders (7, 3, 1 days before due date)
 *   2. Overdue notices (invoices past due date)
 *   3. Retry failed notifications (max 3 attempts)
 *
 * The scheduler checks notification_settings before sending anything.
 * Duplicate prevention: only sends one reminder per invoice per day per type.
 *
 * Call startScheduler() from server.js after database is ready.
 */

const cron = require("node-cron");
const notificationModel = require("../models/whatsappNotificationModel");
const whatsappService = require("./whatsappService");

let schedulerTask = null;

/**
 * Process payment reminders for invoices due in N days.
 * Skips invoices that already got a reminder today.
 *
 * @param {number} daysBefore
 * @returns {Object} { sent, failed }
 */
async function processReminders(daysBefore) {
  let sent = 0;
  let failed = 0;

  try {
    const invoices = await notificationModel.getInvoicesDueInDays(daysBefore);

    for (const invoice of invoices) {
      try {
        const result = await whatsappService.sendPaymentReminder({
          phone: invoice.whatsapp_number,
          invoiceNumber: invoice.invoiceId,
          amount: invoice.total_amount,
          dueDate: invoice.due_date,
          customerId: invoice.customer_id,
          invoiceId: invoice.invoice_id
        });

        if (result.success) {
          sent++;
        } else {
          failed++;
        }
      } catch (err) {
        failed++;
        console.error(`[SCHEDULER] Reminder failed for invoice ${invoice.invoiceId}:`, err.message);
      }
    }
  } catch (err) {
    console.error(`[SCHEDULER] Error processing ${daysBefore}-day reminders:`, err.message);
  }

  return { sent, failed };
}

/**
 * Process overdue notices for all overdue invoices.
 * Only sends once per invoice per day.
 *
 * @returns {Object} { sent, failed }
 */
async function processOverdueNotices() {
  let sent = 0;
  let failed = 0;

  try {
    const invoices = await notificationModel.getOverdueInvoices();

    for (const invoice of invoices) {
      try {
        const result = await whatsappService.sendOverdueNotice({
          phone: invoice.whatsapp_number,
          invoiceNumber: invoice.invoiceId,
          amount: invoice.total_amount,
          customerId: invoice.customer_id,
          invoiceId: invoice.invoice_id
        });

        if (result.success) {
          sent++;
        } else {
          failed++;
        }
      } catch (err) {
        failed++;
        console.error(`[SCHEDULER] Overdue notice failed for invoice ${invoice.invoiceId}:`, err.message);
      }
    }
  } catch (err) {
    console.error("[SCHEDULER] Error processing overdue notices:", err.message);
  }

  return { sent, failed };
}

/**
 * Retry previously failed notifications (max 3 retries per message).
 *
 * @returns {Object} { retried, succeeded }
 */
async function processRetries() {
  let retried = 0;
  let succeeded = 0;

  try {
    const failedLogs = await notificationModel.getRetryableLogs();

    for (const log of failedLogs) {
      retried++;
      const result = await whatsappService.retryNotification(log);
      if (result.success) succeeded++;
    }
  } catch (err) {
    console.error("[SCHEDULER] Error processing retries:", err.message);
  }

  return { retried, succeeded };
}

/**
 * Main scheduled job — runs all notification tasks.
 * Checks settings first; if WhatsApp is disabled, skips everything.
 */
async function runScheduledNotifications() {
  console.log("[SCHEDULER] WhatsApp notification job started:", new Date().toISOString());

  try {
    // Check if WhatsApp notifications are enabled
    const settings = await notificationModel.getSettings();
    if (!settings || !settings.whatsapp_enabled) {
      console.log("[SCHEDULER] WhatsApp notifications disabled. Skipping.");
      return;
    }

    const results = {
      reminders: { sent: 0, failed: 0 },
      overdue: { sent: 0, failed: 0 },
      retries: { retried: 0, succeeded: 0 }
    };

    // 1. Payment Reminders
    if (settings.send_payment_reminder) {
      const reminderDays = settings.reminder_days_before || [7, 3, 1];

      for (const days of reminderDays) {
        const dayResult = await processReminders(days);
        results.reminders.sent += dayResult.sent;
        results.reminders.failed += dayResult.failed;
      }

      if (results.reminders.sent > 0 || results.reminders.failed > 0) {
        console.log(`[SCHEDULER] Reminders: ${results.reminders.sent} sent, ${results.reminders.failed} failed`);
      }
    }

    // 2. Overdue Notices
    if (settings.send_overdue_notice) {
      results.overdue = await processOverdueNotices();

      if (results.overdue.sent > 0 || results.overdue.failed > 0) {
        console.log(`[SCHEDULER] Overdue: ${results.overdue.sent} sent, ${results.overdue.failed} failed`);
      }
    }

    // 3. Retry failed notifications
    results.retries = await processRetries();

    if (results.retries.retried > 0) {
      console.log(`[SCHEDULER] Retries: ${results.retries.retried} attempted, ${results.retries.succeeded} succeeded`);
    }

    console.log("[SCHEDULER] WhatsApp notification job complete:", new Date().toISOString());
  } catch (err) {
    console.error("[SCHEDULER] Unexpected error in scheduled job:", err.message);
  }
}

/**
 * Start the WhatsApp notification scheduler.
 * Runs daily at 9:00 AM (server timezone).
 * Also runs retries every 4 hours.
 */
function startScheduler() {
  // Daily at 9:00 AM — reminders, overdue, retries
  schedulerTask = cron.schedule("0 9 * * *", runScheduledNotifications, {
    timezone: "Asia/Singapore"
  });

  // Retry failed notifications every 4 hours
  cron.schedule("0 */4 * * *", async () => {
    try {
      const settings = await notificationModel.getSettings();
      if (!settings || !settings.whatsapp_enabled) return;

      const result = await processRetries();
      if (result.retried > 0) {
        console.log(`[SCHEDULER] Retry cycle: ${result.retried} attempted, ${result.succeeded} succeeded`);
      }
    } catch (err) {
      console.error("[SCHEDULER] Retry cycle error:", err.message);
    }
  }, { timezone: "Asia/Singapore" });

  console.log("[SCHEDULER] WhatsApp notification scheduler started (daily 9:00 AM SGT, retries every 4h)");
}

/**
 * Stop the scheduler (for graceful shutdown).
 */
function stopScheduler() {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
    console.log("[SCHEDULER] WhatsApp notification scheduler stopped");
  }
}

module.exports = {
  startScheduler,
  stopScheduler,
  runScheduledNotifications,
  processReminders,
  processOverdueNotices,
  processRetries
};
