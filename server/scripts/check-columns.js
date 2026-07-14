require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mysql = require("mysql2/promise");

async function check() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined
  });
  const [rows] = await pool.query("SHOW COLUMNS FROM invoice WHERE Field IN ('payment_url','qr_code_url','stripe_session_id','payment_date')");
  console.log("Invoice columns:");
  rows.forEach((r) => console.log(`  ${r.Field}: ${r.Type}`));

  // Fix qr_code_url to MEDIUMTEXT if it's just TEXT (base64 images need more space)
  const qrCol = rows.find((r) => r.Field === "qr_code_url");
  if (qrCol && qrCol.Type.toLowerCase() === "text") {
    await pool.query("ALTER TABLE invoice MODIFY COLUMN qr_code_url MEDIUMTEXT NULL");
    console.log("  -> Upgraded qr_code_url to MEDIUMTEXT");
  }

  await pool.end();
}
check().catch(console.error);
