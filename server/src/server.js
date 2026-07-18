const app = require("./app");
const { startInvoiceScheduler } = require("./workers/invoiceScheduler");
const { startReminderScheduler } = require("./services/reminderScheduler");
const { startOverdueScheduler } = require("./workers/overdueScheduler");
const { startReminderNotificationScheduler } = require("./workers/reminderNotificationScheduler");

const port = process.env.PORT || 5000;

const server = app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  startInvoiceScheduler();
  startReminderScheduler();
  startOverdueScheduler();
  startReminderNotificationScheduler();
});

// Secondary listener for Singpass callback (staging demo requires port 3080)
const { startCallbackServer } = require("./controllers/singpassController");
startCallbackServer();

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Stop the existing dev server or set a different PORT in server/.env.`);
    process.exit(1);
  }

  console.error(error);
  process.exit(1);
});

