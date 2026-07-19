/**
 * Reminder Notification Scheduler
 *
 * Runs at regular intervals to process automatic invoice payment reminders.
 * Also runs once on server startup (with 10s delay).
 *
 * Schedule:
 * - 3 days before due date: friendly upcoming payment reminder
 * - On due date: payment due today reminder
 * - 3 days after due date: overdue notice
 * - Every 7 days after overdue: recurring urgent reminder
 *
 * Reminders stop immediately once an invoice is paid.
 */

const { processAutomaticReminders } = require("../services/invoiceReminderService");

// Run every 6 hours (covers morning and afternoon checks)
const REMINDER_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Start the automatic reminder scheduler.
 * Runs every 6 hours and once on startup.
 */
function startReminderNotificationScheduler() {
  // Run on startup after a delay
  setTimeout(async () => {
    try {
      const result = await processAutomaticReminders();
      if (result.sent > 0 || result.skipped > 0) {
        console.log(`[REMINDER SCHEDULER] Startup: sent ${result.sent}, skipped ${result.skipped} (already sent).`);
      }
    } catch (error) {
      console.error("[REMINDER SCHEDULER] Startup check failed:", error.message);
    }
  }, 10000); // 10 second delay

  // Schedule every 6 hours
  setInterval(async () => {
    try {
      const result = await processAutomaticReminders();
      console.log(`[REMINDER SCHEDULER] Periodic run: sent ${result.sent}, skipped ${result.skipped}.`);
    } catch (error) {
      console.error("[REMINDER SCHEDULER] Periodic run failed:", error.message);
    }
  }, REMINDER_INTERVAL_MS);

  console.log("[REMINDER SCHEDULER] Started. Running every 6 hours.");
}

module.exports = { startReminderNotificationScheduler };
