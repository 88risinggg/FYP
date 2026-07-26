const { pool } = require("../config/db");

const DEFAULT_GST_RATE = {
  taxCode: "GST_9",
  taxName: "GST",
  ratePercentage: 9,
  effectiveFrom: "2024-01-01",
  effectiveTo: null
};

function toDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function taxCodeFor(rate) {
  const normalized = Number(rate);
  return `GST_${Number.isInteger(normalized) ? normalized : String(normalized).replace(".", "_")}`;
}

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.gst_rate_id,
    companyId: row.company_id,
    taxCode: row.tax_code,
    taxName: row.tax_name,
    ratePercentage: Number(row.rate_percentage),
    effectiveFrom: toDateOnly(row.effective_from),
    effectiveTo: toDateOnly(row.effective_to),
    isActive: row.is_active === 1 || row.is_active === true,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function ensureGstRatesTable(connection = pool) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS invoice_gst_rates (
      gst_rate_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id INT NULL,
      tax_code VARCHAR(30) NOT NULL,
      tax_name VARCHAR(30) NOT NULL DEFAULT 'GST',
      rate_percentage DECIMAL(8,2) NOT NULL,
      effective_from DATE NOT NULL,
      effective_to DATE NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_by VARCHAR(255) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (gst_rate_id),
      INDEX idx_invoice_gst_rates_company_dates (company_id, is_active, effective_from, effective_to)
    )
  `);

  const [rows] = await connection.query(
    "SELECT COUNT(*) AS count FROM invoice_gst_rates WHERE company_id IS NULL"
  );

  if (Number(rows[0]?.count || 0) === 0) {
    await connection.query(
      `INSERT INTO invoice_gst_rates
        (company_id, tax_code, tax_name, rate_percentage, effective_from, effective_to, is_active, created_by)
       VALUES (NULL, ?, ?, ?, ?, NULL, 1, 'System')`,
      [
        DEFAULT_GST_RATE.taxCode,
        DEFAULT_GST_RATE.taxName,
        DEFAULT_GST_RATE.ratePercentage,
        DEFAULT_GST_RATE.effectiveFrom
      ]
    );
  }
}

async function listGstRates(companyId = null, options = {}) {
  await ensureGstRatesTable();
  const latestFirst = options.order === "latest";
  const safeLimit = options.limit
    ? Math.max(1, Math.min(Number.parseInt(options.limit, 10) || 5, 100))
    : null;
  const [rows] = await pool.query(
    `SELECT * FROM invoice_gst_rates
     WHERE is_active = 1
       AND ${companyId ? "(company_id = ? OR company_id IS NULL)" : "company_id IS NULL"}
     ORDER BY effective_from ${latestFirst ? "DESC" : "ASC"}, gst_rate_id ${latestFirst ? "DESC" : "ASC"}
     ${safeLimit ? `LIMIT ${safeLimit}` : ""}`,
    companyId ? [companyId] : []
  );
  return rows.map(mapRow);
}

async function getEffectiveGstRate(companyId = null, asOf = new Date()) {
  await ensureGstRatesTable();
  const date = toDateOnly(asOf) || toDateOnly(new Date());
  const companyClause = companyId ? "(company_id = ? OR company_id IS NULL)" : "company_id IS NULL";
  const [rows] = await pool.query(
    `SELECT * FROM invoice_gst_rates
     WHERE is_active = 1
       AND ${companyClause}
       AND effective_from <= ?
       AND (effective_to IS NULL OR effective_to >= ?)
     ORDER BY effective_from DESC, CASE WHEN company_id IS NULL THEN 0 ELSE 1 END DESC, gst_rate_id DESC
     LIMIT 1`,
    companyId ? [companyId, date, date] : [date, date]
  );

  if (rows[0]) return mapRow(rows[0]);

  const [fallbackRows] = await pool.query(
    `SELECT * FROM invoice_gst_rates
     WHERE is_active = 1
       AND ${companyClause}
     ORDER BY effective_from ASC, CASE WHEN company_id IS NULL THEN 0 ELSE 1 END DESC, gst_rate_id ASC
     LIMIT 1`,
    companyId ? [companyId] : []
  );

  return mapRow(fallbackRows[0]) || { ...DEFAULT_GST_RATE, id: null, companyId, isActive: true };
}

async function getNextScheduledGstRate(companyId = null, asOf = new Date()) {
  await ensureGstRatesTable();
  const date = toDateOnly(asOf) || toDateOnly(new Date());
  const [rows] = await pool.query(
    `SELECT * FROM invoice_gst_rates
     WHERE is_active = 1
       AND ${companyId ? "(company_id = ? OR company_id IS NULL)" : "company_id IS NULL"}
       AND effective_from > ?
     ORDER BY effective_from ASC, CASE WHEN company_id IS NULL THEN 0 ELSE 1 END DESC, gst_rate_id ASC
     LIMIT 1`,
    companyId ? [companyId, date] : [date]
  );
  return mapRow(rows[0]);
}

async function createGstRate(data, companyId = null, createdBy = "Admin") {
  await ensureGstRatesTable();
  const rate = Number(data.ratePercentage ?? data.rate_percentage);
  const effectiveFrom = toDateOnly(data.effectiveFrom ?? data.effective_from);
  const effectiveTo = toDateOnly(data.effectiveTo ?? data.effective_to);
  const taxName = String(data.taxName || data.tax_name || "GST").trim() || "GST";

  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    const error = new Error("GST rate must be between 0 and 100.");
    error.statusCode = 400;
    throw error;
  }
  if (!effectiveFrom) {
    const error = new Error("Effective from date is required.");
    error.statusCode = 400;
    throw error;
  }
  if (effectiveTo && effectiveTo < effectiveFrom) {
    const error = new Error("Effective to date cannot be before effective from date.");
    error.statusCode = 400;
    throw error;
  }

  const previousEffectiveTo = new Date(`${effectiveFrom}T00:00:00.000Z`);
  previousEffectiveTo.setUTCDate(previousEffectiveTo.getUTCDate() - 1);
  const previousEffectiveToValue = previousEffectiveTo.toISOString().slice(0, 10);

  await pool.query(
    `UPDATE invoice_gst_rates
     SET effective_to = ?
     WHERE is_active = 1
       AND ${companyId ? "company_id = ?" : "company_id IS NULL"}
       AND effective_to IS NULL
       AND effective_from < ?`,
    companyId ? [previousEffectiveToValue, companyId, effectiveFrom] : [previousEffectiveToValue, effectiveFrom]
  );

  const [overlaps] = await pool.query(
    `SELECT gst_rate_id FROM invoice_gst_rates
     WHERE is_active = 1
       AND ${companyId ? "company_id = ?" : "company_id IS NULL"}
       AND effective_from <= COALESCE(?, '9999-12-31')
       AND COALESCE(effective_to, '9999-12-31') >= ?
     LIMIT 1`,
    companyId ? [companyId, effectiveTo, effectiveFrom] : [effectiveTo, effectiveFrom]
  );

  if (overlaps.length > 0) {
    const error = new Error("GST effective dates cannot overlap an existing GST rate.");
    error.statusCode = 400;
    throw error;
  }

  const taxCode = taxCodeFor(rate);
  await pool.query(
    `INSERT INTO invoice_gst_rates
      (company_id, tax_code, tax_name, rate_percentage, effective_from, effective_to, is_active, created_by)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
    [companyId, taxCode, taxName, rate, effectiveFrom, effectiveTo, createdBy]
  );

  return listGstRates(companyId);
}

function gstRateToSettings(rate) {
  const effective = rate || DEFAULT_GST_RATE;
  return {
    taxType: effective.taxName || "GST",
    defaultTaxRate: Number(effective.ratePercentage),
    taxEnabled: Number(effective.ratePercentage) > 0,
    taxName: effective.taxName || "GST",
    taxPercentage: Number(effective.ratePercentage),
    general: {
      defaultTax: effective.taxCode || taxCodeFor(effective.ratePercentage)
    }
  };
}

function gstRateToOption(rate) {
  return {
    value: rate.taxCode,
    label: `${rate.taxName} (${Number(rate.ratePercentage)}%)`,
    rate: Number(rate.ratePercentage),
    type: rate.taxName
  };
}

module.exports = {
  createGstRate,
  DEFAULT_GST_RATE,
  ensureGstRatesTable,
  getEffectiveGstRate,
  getNextScheduledGstRate,
  gstRateToOption,
  gstRateToSettings,
  listGstRates,
  taxCodeFor,
  toDateOnly
};
