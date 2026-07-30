/**
 * EVALUATION HEADER
 * FEATURE: PAYROLL - FINANCE
 * PURPOSE: Runs scheduled payroll Release Scheduler background processing.
 * LAYER: Background worker - performs scheduled processing outside a user request.
 * FIND RELATED CODE: Trace its imports to find the scheduler registration and services it runs.
 */
const { processDueScheduledReleases } = require("../services/financePayrollScheduleService");

const INTERVAL_MS = Number(process.env.PAYROLL_RELEASE_SCHEDULER_INTERVAL_MS || 60000);

// FUNCTION: Starts the recurring background check for confirmed payroll releases.
function startPayrollReleaseScheduler() {
  if (process.env.PAYROLL_RELEASE_SCHEDULER_ENABLED === "false") return null;
  const run = () => processDueScheduledReleases().catch((error) => console.error("Payroll release scheduler failed:", error.message));
  run();
  const timer = setInterval(run, INTERVAL_MS);
  if (typeof timer.unref === "function") timer.unref();
  console.log(`Payroll release scheduler running every ${INTERVAL_MS / 1000}s.`);
  return timer;
}

module.exports = { startPayrollReleaseScheduler };
