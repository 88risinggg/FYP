require("dotenv").config();

const port = process.env.PORT || 5000;
const host = process.env.HOST || "0.0.0.0";
const { waitForDatabase } = require("./config/db");

function schedulersEnabled() {
  return process.env.SCHEDULERS_ENABLED !== "false";
}

async function startServer() {
  try {
    await waitForDatabase();
    console.log("Database connection ready.");
  } catch (error) {
    console.error(`Unable to start: database connection failed (${error.code || error.message}).`);
    console.error("Check DB_HOST, DB_PORT, DB_SSL and the database firewall/network settings, then restart the server.");
    process.exit(1);
  }

  // Load database-backed controllers only after the database is reachable.
  const app = require("./app");
  const { startInvoiceScheduler } = require("./workers/invoiceScheduler");
  const { startReminderScheduler } = require("./services/reminderScheduler");
  const { startOverdueScheduler } = require("./workers/overdueScheduler");
  const { startReminderNotificationScheduler } = require("./workers/reminderNotificationScheduler");
  const { startPayrollReleaseScheduler } = require("./workers/payrollReleaseScheduler");
  const { startSubscriptionScheduler } = require("./workers/subscriptionScheduler");

  const server = app.listen(port, host, async () => {
    console.log(`Server listening on ${host}:${port}`);

    if (!schedulersEnabled()) {
      console.log("Background schedulers disabled.");
      return;
    }

    startInvoiceScheduler();
    await startReminderScheduler();
    startOverdueScheduler();
    startReminderNotificationScheduler();
    startPayrollReleaseScheduler();
    startSubscriptionScheduler();
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
