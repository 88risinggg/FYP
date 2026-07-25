const { pool } = require("../src/config/db");
const { ensureGstRatesTable } = require("../src/models/invoiceGstRateModel");

async function columnExists(tableName, columnName) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND column_name = ?`,
    [tableName, columnName]
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function addColumn(tableName, columnName, definition) {
  if (await columnExists(tableName, columnName)) {
    console.log(`exists: ${tableName}.${columnName}`);
    return;
  }
  await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  console.log(`added: ${tableName}.${columnName}`);
}

async function main() {
  await ensureGstRatesTable();
  console.log("ready: invoice_gst_rates");

  await addColumn("invoice", "subtotal_amount", "DECIMAL(12,2) NULL");
  await addColumn("invoice", "tax_name", "VARCHAR(30) NULL");
  await addColumn("invoice", "tax_rate", "DECIMAL(8,2) NULL");
  await addColumn("invoice", "tax_amount", "DECIMAL(12,2) NULL");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
