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
        rowNumber: Number(row.row_number) || null,
        invoiceNumber: row.invoice_number || null,
        fieldName: inferFieldName(message),
        message
      });
    });
  });

  if (validation.message && errors.length === 0) {
    errors.push({
      rowNumber: null,
      invoiceNumber: null,
      fieldName: inferFieldName(validation.message),
      message: validation.message
    });
  }

  return errors;
}

async function replaceValidationErrors(connection, uploadId, validation) {
  await connection.execute(
    "DELETE FROM invoice_upload_validation_errors WHERE upload_id = ?",
    [uploadId]
  );

  const errors = validationErrorRows(validation);
  if (!errors.length) return;

  await connection.query(
    `INSERT INTO invoice_upload_validation_errors
      (upload_id, source_row_number, invoice_number, field_name, error_message)
     VALUES ?`,
    [errors.map((error) => [
      uploadId,
      error.rowNumber,
      error.invoiceNumber,
      error.fieldName,
      String(error.message)
    ])]
  );
}

async function recordValidationAttempt({ file, validation, user }) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const totalRows = Array.isArray(validation.rows) && validation.rows.length
      ? validation.rows.length
      : Number(validation.invalidCount || validation.validCount || 0);
    const isFailed = Boolean(validation.message) || Number(validation.validCount || 0) === 0;
    const [result] = await connection.execute(
      `INSERT INTO invoice_upload_history
        (file_name, file_type, status, total_rows, valid_rows, invalid_rows,
         error_message, uploaded_by, uploader_email, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fileNameFromMetadata(file),
        String(file?.type || "").slice(0, 150) || null,
        isFailed ? "Failed" : "Validated",
        totalRows,
        Number(validation.validCount || 0),
        Number(validation.invalidCount || 0),
        validation.message || null,
        user?.userId || null,
        user?.email || null,
        isFailed ? new Date() : null
      ]
    );

    await replaceValidationErrors(connection, result.insertId, validation);
    await connection.commit();
    return result.insertId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateUploadOutcome(connection, {
  uploadId,
  userId,
  status,
  createdInvoices = 0,
  errorMessage = null
}) {
  if (!uploadId) return false;

  const [result] = await connection.execute(
    `UPDATE invoice_upload_history
     SET status = ?, created_invoices = ?, error_message = ?, completed_at = NOW()
     WHERE upload_id = ? AND (uploaded_by = ? OR uploaded_by IS NULL)`,
    [status, createdInvoices, errorMessage, uploadId, userId || null]
  );
  return result.affectedRows > 0;
}

module.exports = {
  recordValidationAttempt,
  updateUploadOutcome
};
