const app = require("./app");
const { startReminderScheduler } = require("./services/reminderScheduler");

const port = process.env.PORT || 5000;

const server = app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  startReminderScheduler();
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Stop the existing dev server or set a different PORT in server/.env.`);
    process.exit(1);
  }

  console.error(error);
  process.exit(1);
});

