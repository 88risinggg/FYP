/**
 * Overdue Invoice Scheduler
 *
 * Runs a daily cron job at midnight to detect and mark overdue invoices.
 * Also runs once on server startup to catch any missed checks.
 */

const cron = require("node-cron");
const { checkAndMarkOverdue } = require("../services/overdueDetectionService");

/**
 * Start the overdue detection scheduler.
 * Runs daily at 00:05 (5 minutes past midnight) to avoid timezone edge cases.
 * Also performs an immediate check on startup.
 */
function startOverdueScheduler() {
  // Run immediately on startup
  setTimeout(async () => {
    try {
      const count = await checkAndMarkOverdue();
      if (count > 0) {
        console.log(`[OVERDUE SCHEDULER] Startup check: ${count} invoice(s) marked overdue.`);
      }
    } catch (error) {
      console.error("[OVERDUE SCHEDULER] Startup check failed:", error.message);
    }
  }, 5000); // 5 second delay to allow DB connection to establish

  // Schedule daily at 00:05
  cron.schedule("5 0 * * *", async () => {
    try {
      const count = await checkAndMarkOverdue();
      console.log(`[OVERDUE SCHEDULER] Daily check: ${count} invoice(s) marked overdue.`);
    } catch (error) {
      console.error("[OVERDUE SCHEDULER] Daily check failed:", error.message);

      // Retry after 1 hour
      setTimeout(async () => {
        try {
          await checkAndMarkOverdue();
          console.log("[OVERDUE SCHEDULER] Retry successful.");
        } catch (retryError) {
          console.error("[OVERDUE SCHEDULER] Retry also failed:", retryError.message);
        }
      }, 3600000);
    }
  });

  console.log("[OVERDUE SCHEDULER] Started. Running daily at 00:05.");
}

module.exports = { startOverdueScheduler };
