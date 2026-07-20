/**
 * Invoice Upload History Service
 *
 * Upload records are now stored in audit_logs table (activity_type = 'invoice_upload').
 * Validation errors are stored as JSON in upload_validation_errors_json column.
 */

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

  const [result] = await pool.execute(
    `INSERT INTO audit_logs (
      module, activity_type, action_description, affected_record, status, user_id, user_name,
      upload_file_name, upload_file_type, upload_total_rows, upload_valid_rows,
      upload_invalid_rows, upload_created_invoices, upload_error_message,
      upload_validation_errors_json, upload_completed_at, created_at
    ) VALUES (
      'Invoice', 'invoice_upload', ?, NULL, ?, ?, ?,
      ?, ?, ?, ?,
      ?, 0, ?,
      ?, ?, NOW()
    )`,
    [
      `Upload: ${fileNameFromMetadata(file)} (${isFailed ? "Failed" : "Validated"})`,
      isFailed ? "failed" : "pending",
      user?.userId || null,
      user?.email || "System",
      fileNameFromMetadata(file),
      String(file?.type || "").slice(0, 150) || null,
      totalRows,
      Number(validation.validCount || 0),
      Number(validation.invalidCount || 0),
      validation.message || null,
      errors.length > 0 ? JSON.stringify(errors) : null,
      isFailed ? new Date() : null
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

  const dbStatus = status === "Successful" ? "success" : status === "Failed" ? "failed" : "pending";

  const [result] = await connection.execute(
    `UPDATE audit_logs
     SET status = ?, upload_created_invoices = ?, upload_error_message = ?, upload_completed_at = NOW(),
         action_description = CONCAT('Upload: ', upload_file_name, ' (', ?, ')')
     WHERE audit_log_id = ? AND activity_type = 'invoice_upload'`,
    [dbStatus, createdInvoices, errorMessage, status, uploadId]
  );
  return result.affectedRows > 0;
}

module.exports = {
  recordValidationAttempt,
  updateUploadOutcome
};
