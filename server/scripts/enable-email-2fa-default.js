require("dotenv").config();
const mysql = require("mysql2/promise");

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined
  });
  try {
    await connection.beginTransaction();
    await connection.query("ALTER TABLE user MODIFY COLUMN two_fa_enabled TINYINT(1) NOT NULL DEFAULT 1");
    await connection.query("ALTER TABLE user MODIFY COLUMN two_fa_method VARCHAR(30) NULL DEFAULT 'Email OTP'");
    const [result] = await connection.query(
      "UPDATE user SET two_fa_enabled = 1, two_fa_method = 'Email OTP' WHERE status = 1"
    );
    await connection.commit();
    console.log(`Email OTP 2FA enabled for ${result.affectedRows} active account(s).`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("Unable to enable default email OTP 2FA:", error.code || error.message);
  process.exitCode = 1;
});
