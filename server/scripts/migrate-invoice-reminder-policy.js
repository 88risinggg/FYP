const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

require("dotenv").config({ path: path.join(__dirname, "../.env") });

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    multipleStatements: true
  });

  try {
    const migrationPath = path.join(
      __dirname,
      "../src/migrations/20260727_create_invoice_reminder_policy.sql"
    );
    await connection.query(fs.readFileSync(migrationPath, "utf8"));
    const [[settings]] = await connection.query("SELECT COUNT(*) AS total FROM reminder_settings");
    const [[logs]] = await connection.query("SELECT COUNT(*) AS total FROM reminder_logs");
    console.log(JSON.stringify({
      reminderSettings: Number(settings.total),
      reminderLogs: Number(logs.total),
      status: "ready"
    }));
  } finally {
    await connection.end();
  }
}

run().catch((error) => {
  console.error("Invoice reminder policy migration failed:", error.message);
  process.exitCode = 1;
});
