/**
 * EVALUATION HEADER
 * FEATURE: PLATFORM / COMPANY
 * PURPOSE: Provides reusable company Logo Storage Service business or integration operations.
 * LAYER: Backend service - contains reusable business rules or external integrations.
 * FIND RELATED CODE: Use Find All References to locate controllers, workers, or services that call it.
 */
const { pool } = require("../config/db");

async function ensureCompanyLogoStorage(connection = pool) {
  const [rows] = await connection.query(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'companies'
       AND COLUMN_NAME IN ('logo_data', 'logo_mime')`
  );
  const columns = new Set(rows.map((row) => row.COLUMN_NAME));

  if (!columns.has("logo_data")) {
    await connection.query("ALTER TABLE companies ADD COLUMN logo_data MEDIUMBLOB NULL AFTER logo_path");
  }
  if (!columns.has("logo_mime")) {
    await connection.query("ALTER TABLE companies ADD COLUMN logo_mime VARCHAR(50) NULL AFTER logo_data");
  }
}

module.exports = { ensureCompanyLogoStorage };
