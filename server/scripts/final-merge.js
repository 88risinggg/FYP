/**
 * Final merge: invoice_upload_history → absorbed into audit_logs
 * The upload history is essentially audit/tracking data.
 * We'll add upload tracking columns to audit_logs and drop the table.
 */
const mysql = require("mysql2/promise");
require("dotenv").config();

async function addColumn(pool, table, column, definition) {
  try {
    await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  } catch (e) {
    if (e.code !== "ER_DUP_FIELDNAME") throw e;
  }
}

(async () => {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined
  });

  console.log("Merging invoice_upload_history into audit_logs...\n");

  // Add upload-specific columns to audit_logs
  await addColumn(pool, "audit_logs", "upload_file_name", "VARCHAR(255) NULL");
  await addColumn(pool, "audit_logs", "upload_file_type", "VARCHAR(150) NULL");
  await addColumn(pool, "audit_logs", "upload_total_rows", "INT UNSIGNED NULL");
  await addColumn(pool, "audit_logs", "upload_valid_rows", "INT UNSIGNED NULL");
  await addColumn(pool, "audit_logs", "upload_invalid_rows", "INT UNSIGNED NULL");
  await addColumn(pool, "audit_logs", "upload_created_invoices", "INT UNSIGNED NULL");
  await addColumn(pool, "audit_logs", "upload_error_message", "TEXT NULL");
  await addColumn(pool, "audit_logs", "upload_validation_errors_json", "JSON NULL");
  await addColumn(pool, "audit_logs", "upload_completed_at", "DATETIME NULL");

  // Migrate existing upload history records
  try {
    const [uploads] = await pool.query("SELECT * FROM invoice_upload_history");
    for (const u of uploads) {
      await pool.query(`
        INSERT INTO audit_logs (activity_type, action_description, affected_record, status, user_name,
          upload_file_name, upload_file_type, upload_total_rows, upload_valid_rows, upload_invalid_rows,
          upload_created_invoices, upload_error_message, upload_validation_errors_json, upload_completed_at, created_at)
        VALUES ('invoice_upload', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        `Upload: ${u.file_name} (${u.status})`,
        u.upload_id,
        u.status === 'Successful' ? 'success' : (u.status === 'Failed' ? 'failed' : 'pending'),
        u.uploader_email || 'System',
        u.file_name, u.file_type, u.total_rows, u.valid_rows, u.invalid_rows,
        u.created_invoices, u.error_message, u.validation_errors_json, u.completed_at, u.created_at
      ]);
    }
    console.log(`Migrated ${uploads.length} upload history records.`);
  } catch (e) {
    console.log("Note:", e.message.substring(0, 80));
  }

  // Drop table
  await pool.query("SET FOREIGN_KEY_CHECKS = 0");
  await pool.query("DROP TABLE IF EXISTS invoice_upload_history");
  await pool.query("SET FOREIGN_KEY_CHECKS = 1");
  console.log("Dropped: invoice_upload_history");

  const [tables] = await pool.query("SHOW TABLES");
  console.log(`\nFinal: ${tables.length} tables`);
  tables.forEach((r, i) => console.log(`  ${i + 1}. ${Object.values(r)[0]}`));

  await pool.end();
})();
