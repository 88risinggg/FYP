/**
 * Overdue Invoice Scheduler
 *
 * Runs a daily interval to detect and mark overdue invoices.
 * Also runs once on server startup to catch any missed checks.
 */

const { checkAndMarkOverdue } = require("../services/overdueDetectionService");

// 24 hours in milliseconds
const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Start the overdue detection scheduler.
 * Runs every 24 hours and performs an immediate check on startup.
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

  // Schedule every 24 hours
  setInterval(async () => {
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
  }, DAILY_INTERVAL_MS);

  console.log("[OVERDUE SCHEDULER] Started. Running every 24 hours.");
}

module.exports = { startOverdueScheduler };
