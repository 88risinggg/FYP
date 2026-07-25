/**
 * Bulk Subscription Controller
 *
 * Handles mass subscription import from Excel/CSV files.
 * This is the primary method for adding subscriptions to the system.
 * Finance users import subscription records from external business systems.
 *
 * Provides a two-step workflow:
 * 1. Validate - Parse and validate uploaded rows, return errors per row.
 * 2. Process  - Insert all valid rows as subscriptions in a single transaction.
 *
 * Validates:
 * - File format (must be .xlsx/.xls/.csv with "subscription" in filename)
 * - Required columns present
 * - Customer names match existing customers
 * - Billing frequency is valid
 * - Amount is positive
 * - Dates are valid
 * - Duplicate subscriptions (same customer + plan name)
 */

const { pool } = require("../config/db");
const { getCompanyId } = require("../utils/companyScope");
const { createReminder } = require("../models/subscriptionReminderModel");

// ─── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_EXTENSIONS = new Set([".xlsx", ".xls", ".csv"]);
const ALLOWED_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
]);
const FILE_TYPE_ERROR = "Only Excel (.xlsx, .xls) or CSV (.csv) subscription files are allowed.";
const FILE_NAME_ERROR = 'Subscription upload file name or path must contain "subscription".';

const REQUIRED_COLUMNS = [
  "Customer Name",
  "Plan Name",
  "Amount",
  "Billing Frequency",
  "Start Date",
];

const OPTIONAL_COLUMNS = [
  "Description",
  "Next Billing Date",
  "End Date",
  "Auto Renew",
  "Auto Send",
];

const VALID_FREQUENCIES = new Set(["Weekly", "Monthly", "Quarterly", "Yearly"]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeHeader(header) {
  return String(header || "").trim().toLowerCase();
}

function getFileExtension(fileName) {
  const match = String(fileName || "").toLowerCase().match(/\.[^.]+$/);
  return match ? match[0] : "";
}

function getUploadFilePath(file = {}) {
  return String(file.path || file.name || "");
}

function validateFileMetadata(file = {}) {
  const uploadPath = getUploadFilePath(file);
  const extension = getFileExtension(uploadPath);
  const mimeType = String(file.type || "").trim();

  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return FILE_TYPE_ERROR;
  }

  if (mimeType && !ALLOWED_MIME_TYPES.has(mimeType)) {
    return FILE_TYPE_ERROR;
  }

  if (!uploadPath.toLowerCase().includes("subscription")) {
    return FILE_NAME_ERROR;
  }

  return "";
}

function getRowValue(row, columnName) {
  const normalizedColumn = normalizeHeader(columnName);
  const matchingKey = Object.keys(row || {}).find((key) => normalizeHeader(key) === normalizedColumn);
  return matchingKey ? row[matchingKey] : "";
}

function normalizeDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function parseAmount(value) {
  if (typeof value === "number") return value;
  return Number(String(value || "").replace(/[$,\s]/g, ""));
}

function parseBoolean(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  const str = String(value || "").trim().toLowerCase();
  return ["yes", "true", "1", "y"].includes(str);
}

function getMissingColumns(rows) {
  const firstRow = Array.isArray(rows) && rows.length > 0 ? rows[0] : {};
  const headers = new Set(Object.keys(firstRow).map(normalizeHeader));
  return REQUIRED_COLUMNS.filter((col) => !headers.has(normalizeHeader(col)));
}

function normalizeImportedRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row, index) => {
    const amount = parseAmount(getRowValue(row, "Amount"));
    const billingFrequency = String(getRowValue(row, "Billing Frequency") || "").trim();

    // Normalize frequency: match case-insensitively
    let normalizedFrequency = "";
    for (const freq of VALID_FREQUENCIES) {
      if (freq.toLowerCase() === billingFrequency.toLowerCase()) {
        normalizedFrequency = freq;
        break;
      }
    }

    return {
      row_number: index + 1,
      customer_name: String(getRowValue(row, "Customer Name") || "").trim(),
      plan_name: String(getRowValue(row, "Plan Name") || "").trim(),
      description: String(getRowValue(row, "Description") || "").trim(),
      amount,
      billing_frequency: normalizedFrequency || billingFrequency,
      start_date: normalizeDate(getRowValue(row, "Start Date")),
      next_billing_date: normalizeDate(getRowValue(row, "Next Billing Date")),
      end_date: normalizeDate(getRowValue(row, "End Date")),
      auto_renew: parseBoolean(getRowValue(row, "Auto Renew") || "yes"),
      auto_send: parseBoolean(getRowValue(row, "Auto Send")),
      errors: [],
    };
  });
}

// ─── Core Validation ──────────────────────────────────────────────────────────

async function validateSubscriptionImport(rows, file, connection = pool) {
  const fileError = validateFileMetadata(file);
  if (fileError) {
    return {
      message: fileError,
      rows: [],
      validCount: 0,
      invalidCount: 0,
      missingColumns: [],
    };
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      message: "Subscription file does not contain any rows.",
      rows: [],
      validCount: 0,
      invalidCount: 0,
      missingColumns: [],
    };
  }

  const missingColumns = getMissingColumns(rows);
  if (missingColumns.length > 0) {
    return {
      message: `Missing required columns: ${missingColumns.join(", ")}`,
      rows: [],
      validCount: 0,
      invalidCount: rows.length,
      missingColumns,
    };
  }

  const normalizedRows = normalizeImportedRows(rows);

  // Lookup existing customers
  const customerNames = [...new Set(normalizedRows.map((r) => r.customer_name).filter(Boolean))];
  const customerIdsByName = new Map();

  if (customerNames.length > 0) {
    const [customers] = await connection.query(
      "SELECT customer_id, name FROM customer WHERE name IN (?)",
      [customerNames]
    );
    customers.forEach((c) => {
      customerIdsByName.set(String(c.name).trim().toLowerCase(), Number(c.customer_id));
    });
  }

  // Check for existing active subscriptions to detect duplicates
  const planNames = [...new Set(normalizedRows.map((r) => r.plan_name).filter(Boolean))];
  const existingSubscriptions = new Set();

  if (planNames.length > 0 && customerNames.length > 0) {
    try {
      const [existingSubs] = await connection.query(
        `SELECT customer_id, plan_name FROM subscriptions
         WHERE plan_name IN (?) AND status = 'Active'`,
        [planNames]
      );
      existingSubs.forEach((sub) => {
        const key = `${sub.customer_id}:${String(sub.plan_name).trim().toLowerCase()}`;
        existingSubscriptions.add(key);
      });
    } catch {
      /* subscriptions table may not exist yet */
    }
  }

  // Detect duplicates within the upload itself
  const seenCombinations = new Map(); // "customerName:planName" → row_number
  const duplicateWithinUpload = new Set();

  normalizedRows.forEach((row) => {
    if (row.customer_name && row.plan_name) {
      const key = `${row.customer_name.toLowerCase()}:${row.plan_name.toLowerCase()}`;
      if (seenCombinations.has(key)) {
        duplicateWithinUpload.add(key);
      }
      seenCombinations.set(key, row.row_number);
    }
  });

  // Validate each row
  const validatedRows = normalizedRows.map((row) => {
    const errors = [];
    const customerId = customerIdsByName.get(row.customer_name.toLowerCase()) || null;

    // Required field validations
    if (!row.customer_name) {
      errors.push("Customer Name is required");
    } else if (!customerId) {
      errors.push("Customer Name must match an existing customer");
    }

    if (!row.plan_name) {
      errors.push("Plan Name is required");
    }

    if (!Number.isFinite(row.amount) || row.amount <= 0) {
      errors.push("Amount must be numeric and greater than 0");
    }

    if (!row.billing_frequency || !VALID_FREQUENCIES.has(row.billing_frequency)) {
      errors.push("Billing Frequency must be one of: Weekly, Monthly, Quarterly, Yearly");
    }

    if (!row.start_date) {
      errors.push("Start Date must be a valid date");
    }

    if (row.end_date && row.start_date && new Date(row.end_date) <= new Date(row.start_date)) {
      errors.push("End Date must be after Start Date");
    }

    if (row.next_billing_date && row.start_date && new Date(row.next_billing_date) < new Date(row.start_date)) {
      errors.push("Next Billing Date cannot be before Start Date");
    }

    // Duplicate check: existing in database
    if (customerId && row.plan_name) {
      const dbKey = `${customerId}:${row.plan_name.toLowerCase()}`;
      if (existingSubscriptions.has(dbKey)) {
        errors.push(`Duplicate subscription: An active "${row.plan_name}" subscription already exists for this customer`);
      }
    }

    // Duplicate check: within upload file
    if (row.customer_name && row.plan_name) {
      const uploadKey = `${row.customer_name.toLowerCase()}:${row.plan_name.toLowerCase()}`;
      if (duplicateWithinUpload.has(uploadKey)) {
        errors.push(`Duplicate subscription in upload: "${row.plan_name}" for "${row.customer_name}" appears multiple times`);
      }
    }

    return {
      ...row,
      customer_id: customerId,
      errors,
      is_valid: errors.length === 0,
    };
  });

  return {
    message: "",
    rows: validatedRows,
    validCount: validatedRows.filter((r) => r.is_valid).length,
    invalidCount: validatedRows.filter((r) => !r.is_valid).length,
    missingColumns: [],
  };
}

// ─── Route Handlers ───────────────────────────────────────────────────────────

/**
 * POST /api/subscriptions/import/validate
 * Validates uploaded subscription rows without inserting.
 */
async function validateSubscriptionRows(req, res) {
  try {
    const validation = await validateSubscriptionImport(req.body.rows, req.body.file);

    if (validation.message) {
      return res.status(400).json(validation);
    }

    res.json(validation);
  } catch (error) {
    res.status(500).json({
      message: "Failed to validate subscription import.",
      detail: error.message,
    });
  }
}

/**
 * POST /api/subscriptions/import/confirm
 * Validates and inserts all valid subscription rows into the database.
 */
async function processSubscriptionImport(req, res) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const companyId = getCompanyId(req);
    const userId = req.user?.userId || null;

    const validation = await validateSubscriptionImport(req.body.rows, req.body.file, connection);

    if (validation.message) {
      await connection.rollback();
      return res.status(400).json({
        message: validation.message,
        rows: validation.rows,
        invalidRows: validation.rows.filter((r) => !r.is_valid).map((r) => r.row_number),
        missingColumns: validation.missingColumns,
      });
    }

    const validRows = validation.rows.filter((r) => r.is_valid);

    if (validRows.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        message: "No valid rows to process.",
        rows: validation.rows,
        invalidRows: validation.rows.filter((r) => !r.is_valid).map((r) => r.row_number),
      });
    }

    const createdSubscriptions = [];

    for (const row of validRows) {
      // Default next_billing_date to start_date if not provided
      const nextBillingDate = row.next_billing_date || row.start_date;

      const [result] = await connection.query(
        `INSERT INTO subscriptions
           (customer_id, company_id, plan_name, description, amount,
            billing_frequency, start_date, next_billing_date, end_date,
            auto_renew, auto_send, status, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, NOW())`,
        [
          row.customer_id,
          companyId || null,
          row.plan_name,
          row.description || null,
          row.amount,
          row.billing_frequency,
          row.start_date,
          nextBillingDate,
          row.end_date || null,
          row.auto_renew ? 1 : 0,
          row.auto_send ? 1 : 0,
          userId,
        ]
      );

      const subscriptionId = result.insertId;

      createdSubscriptions.push({
        subscription_id: subscriptionId,
        customer_name: row.customer_name,
        plan_name: row.plan_name,
        amount: row.amount,
        billing_frequency: row.billing_frequency,
        start_date: row.start_date,
        next_billing_date: nextBillingDate,
      });
    }

    await connection.commit();

    // Create reminders for imported subscriptions that may need review
    // (missing description, no end date set, or auto-renew disabled without end date)
    for (const row of validRows) {
      const subEntry = createdSubscriptions.find((s) => s.plan_name === row.plan_name && s.customer_name === row.customer_name);
      if (!subEntry) continue;

      const needsReview = !row.description || (!row.end_date && !row.auto_renew);
      if (needsReview) {
        try {
          await createReminder({
            subscriptionId: subEntry.subscription_id,
            customerId:     row.customer_id,
            companyId:      companyId || null,
            customerName:   row.customer_name,
            reminderType:   "incomplete_import",
            notes:          !row.description
              ? "Imported subscription has no description."
              : "No end date set and auto-renew is disabled.",
          });
        } catch (reminderErr) {
          // Non-critical — don't fail the import
          console.error("[BulkSubscription] Reminder creation failed:", reminderErr.message);
        }
      }
    }

    res.status(201).json({
      message: "Subscriptions imported successfully.",
      createdCount: createdSubscriptions.length,
      skippedCount: validation.invalidCount,
      subscriptions: createdSubscriptions,
      invalidRows: validation.rows.filter((r) => !r.is_valid),
    });
  } catch (error) {
    await connection.rollback();
    console.error("[BulkSubscription] Import error:", error);
    res.status(500).json({
      message: "Failed to import subscriptions.",
      detail: error.message,
    });
  } finally {
    connection.release();
  }
}

/**
 * GET /api/subscriptions/import/template
 * Returns the subscription import template file path for download.
 */
function getSubscriptionTemplate(req, res) {
  const path = require("path");
  const fs = require("fs");

  const templatePath = path.join(__dirname, "../../uploads/templates/subscription_import_template.csv");

  if (!fs.existsSync(templatePath)) {
    return res.status(404).json({ message: "Template file not found." });
  }

  res.download(templatePath, "subscription_import_template.csv");
}

module.exports = {
  validateSubscriptionRows,
  processSubscriptionImport,
  getSubscriptionTemplate,
  validateSubscriptionImport,
  normalizeImportedRows,
  getMissingColumns,
  REQUIRED_COLUMNS,
  OPTIONAL_COLUMNS,
};
