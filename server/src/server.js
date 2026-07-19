const port = process.env.PORT || 5000;
const { waitForDatabase } = require("./config/db");

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

  const server = app.listen(port, async () => {
    console.log(`Server running on http://localhost:${port}`);
    startInvoiceScheduler();
    await startReminderScheduler();
    startOverdueScheduler();
    startReminderNotificationScheduler();
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

