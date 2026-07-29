/**
 * EVALUATION HEADER
 * FEATURE: INVOICE - SHARED
 * PURPOSE: Provides reusable invoice Upload History Service business or integration operations.
 * LAYER: Backend service - contains reusable business rules or external integrations.
 * FIND RELATED CODE: Use Find All References to locate controllers, workers, or services that call it.
 */
/**
 * Invoice Upload History Service
 *
 * Upload records are now stored in audit_logs table (activity_type = 'invoice_upload').
 * Validation errors are stored as JSON in upload_validation_errors_json column.
 */

const crypto = require("crypto");

const { pool } = require("../config/db");

function fileNameFromMetadata(file = {}) {
  return String(file.name || file.path || "Unknown invoice upload").trim().slice(0, 255);
}

function inferFieldName(message) {
  const normalized = String(message || "").toLowerCase();
  if (normalized.includes("invoice number")) return "Invoice Number";
  if (normalized.includes("customer name")) return "Customer Name";
  if (normalized.includes("invoice date")) return "Invoice Date";
  if (normalized.includes("due date")) return "Due Date";
  if (normalized.includes("amount")) return "Amount";
  if (normalized.includes("column")) return "Template";
  if (normalized.includes("file")) return "File";
  return null;
}

function validationErrorRows(validation = {}) {
  const errors = [];

  (validation.rows || []).forEach((row) => {
    (row.errors || []).forEach((message) => {
      errors.push({
        source_row_number: Number(row.row_number) || null,
        invoice_number: row.invoice_number || null,
        field_name: inferFieldName(message),
        error_message: message
      });
    });
  });

  if (validation.message && errors.length === 0) {
    errors.push({
      source_row_number: null,
      invoice_number: null,
      field_name: inferFieldName(validation.message),
      error_message: validation.message
    });
  }

  return errors;
}

async function recordValidationAttempt({ file, validation, user }) {
  const totalRows = Array.isArray(validation.rows) && validation.rows.length
    ? validation.rows.length
    : Number(validation.invalidCount || validation.validCount || 0);
  const isFailed = Boolean(validation.message) || Number(validation.validCount || 0) === 0;
  const errors = validationErrorRows(validation);
  const requestFingerprint = crypto.createHash("sha256").update(JSON.stringify({
    userId: user?.userId || null,
    fileName: fileNameFromMetadata(file),
    fileType: String(file?.type || ""),
    totalRows,
    validCount: Number(validation.validCount || 0),
    invalidCount: Number(validation.invalidCount || 0),
    rows: validation.rows || [],
    message: validation.message || ""
  })).digest("hex");

  // A browser retry can submit the exact validation request twice. Reuse only
  // a very recent identical request; completed or deliberately repeated uploads
  // outside this retry window remain separate audit batches.
  const [duplicateRows] = await pool.execute(
    `SELECT audit_log_id
     FROM audit_logs
     WHERE activity_type = 'invoice_upload'
       AND user_id <=> ?
       AND new_value = ?
       AND created_at >= DATE_SUB(NOW(), INTERVAL 10 SECOND)
     ORDER BY audit_log_id DESC
     LIMIT 1`,
    [user?.userId || null, JSON.stringify({ requestFingerprint })]
  );
  if (duplicateRows[0]?.audit_log_id) {
    return Number(duplicateRows[0].audit_log_id);
  }

  const uploadBatchId = `UPL-${crypto.randomUUID()}`;

  const [result] = await pool.execute(
    `INSERT INTO audit_logs (
      module, activity_type, action_description, affected_record, status, user_id, user_name,
      upload_file_name, upload_file_type, upload_total_rows, upload_valid_rows,
      upload_invalid_rows, upload_created_invoices, upload_error_message,
      upload_validation_errors_json, upload_completed_at, new_value, created_at
    ) VALUES (
      'Invoice', 'invoice_upload', ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, 0, ?,
      ?, ?, ?, NOW()
    )`,
    [
      `Upload: ${fileNameFromMetadata(file)} (${isFailed ? "Failed" : "Validated"})`,
      uploadBatchId,
      isFailed ? "Failed" : "Info",
      user?.userId || null,
      user?.email || "System",
      fileNameFromMetadata(file),
      String(file?.type || "").slice(0, 150) || null,
      totalRows,
      Number(validation.validCount || 0),
      Number(validation.invalidCount || 0),
      validation.message || null,
      errors.length > 0 ? JSON.stringify(errors) : null,
      isFailed ? new Date() : null,
      JSON.stringify({ requestFingerprint })
    ]
  );

  return result.insertId;
}

async function updateUploadOutcome(connection, {
  uploadId,
  userId,
  status,
  createdInvoices = 0,
  errorMessage = null
}) {
  if (!uploadId) return false;

  const dbStatus = status === "Successful" ? "Success" : status === "Failed" ? "Failed" : "Info";

  const [result] = await connection.execute(
    `UPDATE audit_logs
     SET status = IF(? = 'Success' AND ? > 0
                       AND (COALESCE(upload_invalid_rows, 0) > 0 OR ? < COALESCE(upload_valid_rows, 0)),
                     'Warning', ?),
         upload_created_invoices = ?, upload_error_message = ?, upload_completed_at = NOW(),
         action_description = CONCAT(
           'Upload: ', upload_file_name, ' (',
           IF(? = 'Success' AND ? > 0
                 AND (COALESCE(upload_invalid_rows, 0) > 0 OR ? < COALESCE(upload_valid_rows, 0)),
              'Partial Success', ?),
           ')'
         )
     WHERE audit_log_id = ? AND activity_type = 'invoice_upload'`,
    [
      dbStatus,
      createdInvoices,
      createdInvoices,
      dbStatus,
      createdInvoices,
      errorMessage,
      dbStatus,
      createdInvoices,
      createdInvoices,
      status,
      uploadId
    ]
  );
  return result.affectedRows > 0;
}

module.exports = {
  recordValidationAttempt,
  updateUploadOutcome
};
