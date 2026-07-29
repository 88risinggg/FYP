/**
 * EVALUATION HEADER
 * FEATURE: SHARED / APPLICATION CORE
 * PURPOSE: Provides reusable upload Validation Service business or integration operations.
 * LAYER: Backend service - contains reusable business rules or external integrations.
 * FIND RELATED CODE: Use Find All References to locate controllers, workers, or services that call it.
 */
/**
 * Upload Validation Service
 *
 * Parses uploaded CSV/Excel files, validates each row, detects duplicates
 * against the database and within the file, and returns a structured
 * ValidationResult without modifying the staff table.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { parseFile } = require("./importParser");
const { normalizeRow, mapHeaders } = require("./uploadNormalizer");
const { validateRow } = require("./uploadRowValidator");
const uploadSessionStore = require("./uploadSessionStore");
const { pool } = require("../config/db");
const { currentCompanyId } = require("./tenantContext");

// Supported file extensions
const SUPPORTED_EXTENSIONS = [".csv", ".xlsx"];

// File size limit: 5MB
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

// Max data rows
const MAX_ROW_COUNT = 5000;

/**
 * Validates an uploaded file, parses its contents, validates each row,
 * detects duplicates (intra-file and against database), classifies rows,
 * and stores the result in the session store.
 *
 * @param {string} filePath - Path to the uploaded temp file
 * @param {string} originalName - Original filename from the upload
 * @param {string} userId - ID/email of the uploading user
 * @returns {Promise<Object>} ValidationResult
 */
async function validateUpload(filePath, originalName, userId) {
  try {
    // Step 1: Validate file format by extension
    const ext = path.extname(originalName || "").toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      throw new Error(
        "Unsupported file format. Please upload CSV or Excel (.xlsx)"
      );
    }

    // Step 2: Validate file size
    const stats = fs.statSync(filePath);
    if (stats.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(
        `File exceeds maximum size limit of 5MB (file is ${(stats.size / (1024 * 1024)).toFixed(2)}MB)`
      );
    }

    // Step 3: Parse file
    const rawRows = await parseFile(filePath, originalName);

    // Step 4: Reject empty files (zero data rows)
    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      throw new Error("File contains no data rows");
    }

    // Step 5: Reject oversized files (>5000 rows)
    if (rawRows.length > MAX_ROW_COUNT) {
      throw new Error(
        `File exceeds maximum row limit of ${MAX_ROW_COUNT} rows (file contains ${rawRows.length} rows)`
      );
    }

    // Step 6: Map headers
    const headers = Object.keys(rawRows[0]);
    const { headerMapping, missingHeaders } = mapHeaders(headers);

    // Step 7: Normalize and validate each row, track intra-file duplicates
    const validatedRows = [];
    const seenEmployeeIds = new Map(); // employee_id → first row number
    const seenEmails = new Map(); // email (lowercase) → first row number

    for (let i = 0; i < rawRows.length; i++) {
      const rawRow = rawRows[i];
      const rowNumber = i + 2; // header is row 1, data starts at row 2
      const normalized = normalizeRow(rawRow, headerMapping);

      // Add rowNumber to normalized for validateRow to use
      const rowForValidation = { ...normalized, rowNumber };
      const errors = validateRow(rowForValidation);

      // Intra-file duplicate detection (employee_id)
      if (normalized.employee_id) {
        const empId = normalized.employee_id;
        if (seenEmployeeIds.has(empId)) {
          const firstRow = seenEmployeeIds.get(empId);
          errors.push(
            `Duplicate employee_id '${empId}' within file (first occurrence at row ${firstRow})`
          );
        } else {
          seenEmployeeIds.set(empId, rowNumber);
        }
      }

      // Intra-file duplicate detection (email, case-insensitive)
      if (normalized.email) {
        const emailLower = normalized.email.toLowerCase();
        if (seenEmails.has(emailLower)) {
          const firstRow = seenEmails.get(emailLower);
          errors.push(
            `Duplicate email '${normalized.email}' within file (first occurrence at row ${firstRow})`
          );
        } else {
          seenEmails.set(emailLower, rowNumber);
        }
      }

      validatedRows.push({
        id: crypto.randomUUID(),
        rowNumber,
        data: normalized,
        errors,
        status: "pending", // will be classified in Step 9
        existingRecord: null,
      });
    }

    // Step 8: Batch query database for existing records
    const employeeIds = validatedRows
      .map((r) => r.data.employee_id)
      .filter(Boolean);
    const emails = validatedRows
      .map((r) => r.data.email)
      .filter(Boolean);

    let existingMap = new Map();

    try {
      if (employeeIds.length > 0 || emails.length > 0) {
        const [existingRows] = await pool.query(
          `SELECT * FROM staff WHERE company_id = ? AND (employee_id IN (?) OR email IN (?))`,
          [
            currentCompanyId(),
            employeeIds.length > 0 ? employeeIds : [""],
            emails.length > 0 ? emails : [""],
          ]
        );

        for (const existing of existingRows) {
          if (existing.employee_id) {
            existingMap.set(existing.employee_id, existing);
          }
          if (existing.email) {
            existingMap.set(existing.email.toLowerCase(), existing);
          }
        }
      }
    } catch (dbError) {
      throw new Error(
        "Validation could not be completed due to service unavailability"
      );
    }

    // Step 9: Classify each row
    for (const row of validatedRows) {
      if (row.errors.length > 0) {
        // Error takes highest priority
        row.status = "error";
      } else if (
        existingMap.has(row.data.employee_id) ||
        (row.data.email && existingMap.has(row.data.email.toLowerCase()))
      ) {
        // Duplicate against DB
        row.status = "duplicate";
        row.existingRecord =
          existingMap.get(row.data.employee_id) ||
          existingMap.get(row.data.email.toLowerCase());
      } else {
        // New record
        row.status = "new";
      }
    }

    // Step 10: Build summary
    const summary = {
      total: validatedRows.length,
      valid: validatedRows.filter((r) => r.status === "new").length,
      duplicates: validatedRows.filter((r) => r.status === "duplicate").length,
      errors: validatedRows.filter((r) => r.status === "error").length,
    };

    // Step 11: Store in session store and build result
    // The session store's create() generates its own UUID sessionId and returns it.
    // We build a preliminary result, store it, then set the correct sessionId.
    const timestamp = Date.now();

    const resultData = {
      rows: validatedRows,
      summary,
      missingHeaders,
      timestamp,
      headerMapping,
    };

    // Store in session store — returns the generated sessionId
    const sessionId = uploadSessionStore.create(resultData, userId);

    // Build final result with the store's sessionId
    const result = {
      sessionId,
      ...resultData,
    };

    return result;
  } finally {
    // Always delete temp file regardless of success/failure
    try {
      fs.unlinkSync(filePath);
    } catch (_err) {
      // File may already be deleted or inaccessible — ignore
    }
  }
}

module.exports = { validateUpload };
