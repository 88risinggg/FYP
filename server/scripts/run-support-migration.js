const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

require("dotenv").config({ path: path.join(__dirname, "../.env") });

async function runSupportMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined,
    multipleStatements: true
  });

  try {
    const migrationPath = path.join(
      __dirname,
      "../src/migrations/20260719_support_tables.sql"
    );
    const sql = fs.readFileSync(migrationPath, "utf8");
    await connection.query(sql);
    console.log("Support tables migration completed.");
  } finally {
    await connection.end();
  }
}

runSupportMigration().catch((error) => {
  console.error("Support tables migration failed:", error.message);
  process.exitCode = 1;
});
