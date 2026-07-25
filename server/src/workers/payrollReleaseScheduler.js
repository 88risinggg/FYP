const { processDueScheduledReleases } = require("../services/financePayrollScheduleService");

const INTERVAL_MS = Number(process.env.PAYROLL_RELEASE_SCHEDULER_INTERVAL_MS || 60000);

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
