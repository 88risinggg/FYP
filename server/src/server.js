require("dotenv").config();
const { APPLICATION_TIMEZONE } = require("./config/timezone");

// Discloud routes site traffic to port 8080. PORT can still override this for
// local development and other hosting environments.
const port = process.env.PORT || 8080;
const host = process.env.HOST || "0.0.0.0";
const { waitForDatabase } = require("./config/db");

function schedulersEnabled() {
  return process.env.SCHEDULERS_ENABLED !== "false";
}

async function initializeDatabaseServices() {
  try {
    await waitForDatabase();
    console.log("Database connection ready.");
  } catch (error) {
    console.error(`Database connection unavailable (${error.code || error.message}).`);
    console.error("The web server remains online, but database-backed features and background schedulers are unavailable.");
    return;
  }

  try {
    const { ensureCompanyLogoStorage } = require("./services/companyLogoStorageService");
    await ensureCompanyLogoStorage();
  } catch (error) {
    console.error("Unable to initialize durable company-logo storage:", error.message);
  }

  if (!schedulersEnabled()) {
    console.log("Background schedulers disabled.");
    return;
  }

  try {
    const { startInvoiceScheduler } = require("./workers/invoiceScheduler");
    const { startReminderScheduler } = require("./services/reminderScheduler");
    const { startOverdueScheduler } = require("./workers/overdueScheduler");
    const { startReminderNotificationScheduler } = require("./workers/reminderNotificationScheduler");
    const { startPayrollReleaseScheduler } = require("./workers/payrollReleaseScheduler");
    const { startSubscriptionScheduler } = require("./workers/subscriptionScheduler");

    startInvoiceScheduler();
    await startReminderScheduler();
    startOverdueScheduler();
    startReminderNotificationScheduler();
    startPayrollReleaseScheduler();
    startSubscriptionScheduler();
  } catch (error) {
    console.error("Unable to start background schedulers:", error);
  }
}

function startServer() {
  // Bind the HTTP port before checking external services. Discloud can then
  // keep the site alive and /api/health can report even during a DB outage.
  const app = require("./app");
  const server = app.listen(port, host, () => {
    console.log(`Server listening on ${host}:${port} (${APPLICATION_TIMEZONE})`);
    void initializeDatabaseServices();
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${port} is already in use. Stop the existing dev server or set a different PORT in server/.env.`);
      process.exit(1);
    }

    console.error(error);
    process.exit(1);
  });
}

startServer();
