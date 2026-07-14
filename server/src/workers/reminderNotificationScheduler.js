/**
 * Reminder Notification Scheduler
 *
 * Runs daily at 09:00 SGT to process automatic invoice payment reminders.
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

const cron = require("node-cron");
const { processAutomaticReminders } = require("../services/invoiceReminderService");

/**
 * Start the automatic reminder scheduler.
 * Runs daily at 09:00 Singapore time.
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

  // Schedule daily at 09:00 SGT
  cron.schedule("0 9 * * *", async () => {
    try {
      const result = await processAutomaticReminders();
      console.log(`[REMINDER SCHEDULER] Daily run: sent ${result.sent}, skipped ${result.skipped}.`);
    } catch (error) {
      console.error("[REMINDER SCHEDULER] Daily run failed:", error.message);
    }
  }, { timezone: "Asia/Singapore" });

  // Also run at 14:00 SGT for afternoon follow-ups (overdue only)
  cron.schedule("0 14 * * *", async () => {
    try {
      const result = await processAutomaticReminders();
      if (result.sent > 0) {
        console.log(`[REMINDER SCHEDULER] Afternoon run: sent ${result.sent}.`);
      }
    } catch (error) {
      console.error("[REMINDER SCHEDULER] Afternoon run failed:", error.message);
    }
  }, { timezone: "Asia/Singapore" });

  console.log("[REMINDER SCHEDULER] Started. Running daily at 09:00 and 14:00 SGT.");
}

module.exports = { startReminderNotificationScheduler };
