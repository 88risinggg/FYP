const app = require("./app");
const { startInvoiceScheduler } = require("./workers/invoiceScheduler");
const { startReminderScheduler } = require("./services/reminderScheduler");

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  startInvoiceScheduler();
  startReminderScheduler();
});

