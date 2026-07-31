/**
 * EVALUATION HEADER
 * FEATURE: INVOICE - SHARED
 * PURPOSE: Reads and writes invoice GST Rate Model data in the database.
 * LAYER: Backend model - contains database queries and persistence operations.
 * FIND RELATED CODE: Use Find All References to locate the controller/service that requests this data.
 */
const { pool } = require("../config/db");
const { APPLICATION_TIMEZONE } = require("../config/timezone");

const DEFAULT_GST_RATE = {
  taxCode: "GST_9",
  taxName: "GST",
  ratePercentage: 9,
  effectiveFrom: "2024-01-01",
  effectiveTo: null
};

function toDateOnly(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const dateOnlyMatch = value.match(/^(\d{4}-\d{2}-\d{2})(?:$|T)/);
    if (dateOnlyMatch) return dateOnlyMatch[1];
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: APPLICATION_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(value);
    const dateParts = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
    return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return toDateOnly(date);
}

function taxCodeFor(rate) {
  const normalized = Number(rate);
  return `GST_${Number.isInteger(normalized) ? normalized : String(normalized).replace(".", "_")}`;
}

function validateGstScheduleInput(data) {
  const rawRate = String(data.ratePercentage ?? data.rate_percentage ?? "").trim();
  const rate = Number(rawRate);
  const effectiveFrom = toDateOnly(data.effectiveFrom ?? data.effective_from);
  const effectiveTo = toDateOnly(data.effectiveTo ?? data.effective_to);
  const taxName = String(data.taxName || data.tax_name || "GST").trim() || "GST";

  if (!/^(?:\d{1,2}(?:\.\d{1,2})?|100(?:\.0{1,2})?)$/.test(rawRate) || !Number.isFinite(rate)) {
    const error = new Error("GST rate must be between 0 and 100 with no more than two decimal places.");
    error.statusCode = 400;
    throw error;
  }
  if (!effectiveFrom) {
    const error = new Error("Effective from date is required.");
    error.statusCode = 400;
    throw error;
  }
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const earliestEffectiveFrom = toDateOnly(tomorrow);
  if (effectiveFrom < earliestEffectiveFrom) {
    const error = new Error("GST effective date must be at least one day after today. Schedule tomorrow or a later date only.");
    error.statusCode = 400;
    throw error;
  }
  if (effectiveTo && effectiveTo < effectiveFrom) {
    const error = new Error("Effective to date cannot be before effective from date.");
    error.statusCode = 400;
    throw error;
  }

  return { rawRate, rate, effectiveFrom, effectiveTo, taxName };
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
    createdByUserId: row.created_by_user_id,
    createdBy: row.created_by_name || row.created_by || "System",
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
      created_by_user_id INT NULL,
      created_by VARCHAR(255) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (gst_rate_id),
      INDEX idx_invoice_gst_rates_company_dates (company_id, is_active, effective_from, effective_to)
    )
  `);
  const [creatorColumns] = await connection.query(
    "SHOW COLUMNS FROM invoice_gst_rates LIKE 'created_by_user_id'"
  );
  if (creatorColumns.length === 0) {
    try {
      await connection.query(
        "ALTER TABLE invoice_gst_rates ADD COLUMN created_by_user_id INT NULL AFTER is_active"
      );
    } catch (error) {
      // Another request may have added the compatibility column concurrently.
      if (error.code !== "ER_DUP_FIELDNAME") throw error;
    }
  }

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
    `SELECT rates.*,
            COALESCE(creator.name, creator.email, rates.created_by, 'System') AS created_by_name
     FROM invoice_gst_rates rates
     LEFT JOIN user creator ON creator.user_id = rates.created_by_user_id
     WHERE rates.is_active = 1
       AND ${companyId ? "(rates.company_id = ? OR rates.company_id IS NULL)" : "rates.company_id IS NULL"}
     ORDER BY rates.effective_from ${latestFirst ? "DESC" : "ASC"}, rates.gst_rate_id ${latestFirst ? "DESC" : "ASC"}
     ${safeLimit ? `LIMIT ${safeLimit}` : ""}`,
    companyId ? [companyId] : []
  );
  return rows.map(mapRow);
}

async function getEffectiveGstRate(companyId = null, asOf = new Date()) {
  await ensureGstRatesTable();
  const date = toDateOnly(asOf) || toDateOnly(new Date());
  const companyClause = companyId
    ? "(rates.company_id = ? OR rates.company_id IS NULL)"
    : "rates.company_id IS NULL";
  const [rows] = await pool.query(
    `SELECT rates.*,
            COALESCE(creator.name, creator.email, rates.created_by, 'System') AS created_by_name
     FROM invoice_gst_rates rates
     LEFT JOIN user creator ON creator.user_id = rates.created_by_user_id
     WHERE rates.is_active = 1
       AND ${companyClause}
       AND rates.effective_from <= ?
       AND (rates.effective_to IS NULL OR rates.effective_to >= ?)
     ORDER BY rates.effective_from DESC,
              CASE WHEN rates.company_id IS NULL THEN 0 ELSE 1 END DESC,
              rates.gst_rate_id DESC
     LIMIT 1`,
    companyId ? [companyId, date, date] : [date, date]
  );

  if (rows[0]) return mapRow(rows[0]);

  const [fallbackRows] = await pool.query(
    `SELECT rates.*,
            COALESCE(creator.name, creator.email, rates.created_by, 'System') AS created_by_name
     FROM invoice_gst_rates rates
     LEFT JOIN user creator ON creator.user_id = rates.created_by_user_id
     WHERE rates.is_active = 1
       AND ${companyClause}
     ORDER BY rates.effective_from ASC,
              CASE WHEN rates.company_id IS NULL THEN 0 ELSE 1 END DESC,
              rates.gst_rate_id ASC
     LIMIT 1`,
    companyId ? [companyId] : []
  );

  return mapRow(fallbackRows[0]) || { ...DEFAULT_GST_RATE, id: null, companyId, isActive: true };
}

async function getNextScheduledGstRate(companyId = null, asOf = new Date()) {
  await ensureGstRatesTable();
  const date = toDateOnly(asOf) || toDateOnly(new Date());
  const [rows] = await pool.query(
    `SELECT rates.*,
            COALESCE(creator.name, creator.email, rates.created_by, 'System') AS created_by_name
     FROM invoice_gst_rates rates
     LEFT JOIN user creator ON creator.user_id = rates.created_by_user_id
     WHERE rates.is_active = 1
       AND ${companyId ? "(rates.company_id = ? OR rates.company_id IS NULL)" : "rates.company_id IS NULL"}
       AND rates.effective_from > ?
     ORDER BY rates.effective_from ASC,
              CASE WHEN rates.company_id IS NULL THEN 0 ELSE 1 END DESC,
              rates.gst_rate_id ASC
     LIMIT 1`,
    companyId ? [companyId, date] : [date]
  );
  return mapRow(rows[0]);
}

async function createGstRate(data, companyId = null, createdBy = "Admin") {
  await ensureGstRatesTable();
  const { rate, effectiveFrom, effectiveTo, taxName } = validateGstScheduleInput(data);

  const previousEffectiveTo = new Date(`${effectiveFrom}T00:00:00.000Z`);
  previousEffectiveTo.setUTCDate(previousEffectiveTo.getUTCDate() - 1);
  const previousEffectiveToValue = previousEffectiveTo.toISOString().slice(0, 10);

  const taxCode = taxCodeFor(rate);
  const createdByUserId = createdBy && typeof createdBy === "object"
    ? createdBy.userId || null
    : null;
  const createdByLabel = createdBy && typeof createdBy === "object"
    ? createdBy.displayName || createdBy.email || "Admin"
    : createdBy;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `UPDATE invoice_gst_rates
       SET effective_to = ?
       WHERE is_active = 1
         AND ${companyId ? "company_id = ?" : "company_id IS NULL"}
         AND effective_to IS NULL
         AND effective_from < ?`,
      companyId ? [previousEffectiveToValue, companyId, effectiveFrom] : [previousEffectiveToValue, effectiveFrom]
    );

    const [overlaps] = await connection.query(
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

    await connection.query(
      `INSERT INTO invoice_gst_rates
        (company_id, tax_code, tax_name, rate_percentage, effective_from, effective_to, is_active, created_by_user_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [companyId, taxCode, taxName, rate, effectiveFrom, effectiveTo, createdByUserId, createdByLabel]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return listGstRates(companyId);
}

async function updateGstRate(gstRateId, data, companyId = null) {
  await ensureGstRatesTable();
  const id = Number(gstRateId);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error("GST rate ID is invalid.");
    error.statusCode = 400;
    throw error;
  }
  const { rate, effectiveFrom, effectiveTo, taxName } = validateGstScheduleInput(data);
  const taxCode = taxCodeFor(rate);
  const today = toDateOnly(new Date());

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [existingRows] = await connection.query(
      `SELECT * FROM invoice_gst_rates
       WHERE gst_rate_id = ?
         AND is_active = 1
         AND ${companyId ? "company_id = ?" : "company_id IS NULL"}
       LIMIT 1 FOR UPDATE`,
      companyId ? [id, companyId] : [id]
    );
    const existing = existingRows[0];
    if (!existing) {
      const error = new Error("GST schedule was not found.");
      error.statusCode = 404;
      throw error;
    }
    if (toDateOnly(existing.effective_from) <= today) {
      const error = new Error("Only upcoming GST schedules can be edited.");
      error.statusCode = 400;
      throw error;
    }

    const previousEffectiveTo = new Date(`${effectiveFrom}T00:00:00.000Z`);
    previousEffectiveTo.setUTCDate(previousEffectiveTo.getUTCDate() - 1);
    const previousEffectiveToValue = previousEffectiveTo.toISOString().slice(0, 10);
    const [previousRows] = await connection.query(
      `SELECT gst_rate_id FROM invoice_gst_rates
       WHERE is_active = 1
         AND gst_rate_id <> ?
         AND ${companyId ? "company_id = ?" : "company_id IS NULL"}
         AND effective_from < ?
       ORDER BY effective_from DESC, gst_rate_id DESC
       LIMIT 1 FOR UPDATE`,
      companyId ? [id, companyId, effectiveFrom] : [id, effectiveFrom]
    );
    const previousRate = previousRows[0];
    if (previousRate) {
      await connection.query(
        `UPDATE invoice_gst_rates SET effective_to = ? WHERE gst_rate_id = ?`,
        [previousEffectiveToValue, previousRate.gst_rate_id]
      );
    }

    const [overlaps] = await connection.query(
      `SELECT gst_rate_id FROM invoice_gst_rates
       WHERE is_active = 1
         AND gst_rate_id <> ?
         AND ${companyId ? "company_id = ?" : "company_id IS NULL"}
         AND effective_from <= COALESCE(?, '9999-12-31')
         AND COALESCE(effective_to, '9999-12-31') >= ?
       LIMIT 1`,
      companyId ? [id, companyId, effectiveTo, effectiveFrom] : [id, effectiveTo, effectiveFrom]
    );

    if (overlaps.length > 0) {
      const error = new Error("GST effective dates cannot overlap an existing GST rate.");
      error.statusCode = 400;
      throw error;
    }

    await connection.query(
      `UPDATE invoice_gst_rates
       SET tax_code = ?, tax_name = ?, rate_percentage = ?, effective_from = ?, effective_to = ?
       WHERE gst_rate_id = ?`,
      [taxCode, taxName, rate, effectiveFrom, effectiveTo, id]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

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
  toDateOnly,
  updateGstRate
};
