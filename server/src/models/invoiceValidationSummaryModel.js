/**
 * Invoice Validation Summary Model
 *
 * Upload history and validation errors are now stored in the audit_logs table
 * (activity_type = 'invoice_upload').
 */

const { pool } = require("../config/db");

function mapUpload(row) {
  if (!row) return null;

  return {
    uploadId: Number(row.audit_log_id),
    fileName: row.upload_file_name || "",
    fileType: row.upload_file_type || "",
    status: row.status === "success" ? "Successful" : row.status === "failed" ? "Failed" : "Pending",
    totalRows: Number(row.upload_total_rows || 0),
    validRows: Number(row.upload_valid_rows || 0),
    invalidRows: Number(row.upload_invalid_rows || 0),
    createdInvoices: Number(row.upload_created_invoices || 0),
    errorMessage: row.upload_error_message || "",
    uploaderEmail: row.user_name || "Unknown user",
    uploadedAt: row.created_at,
    completedAt: row.upload_completed_at
  };
}

const uploadSelect = `
  SELECT
    audit_log_id,
    upload_file_name,
    upload_file_type,
    status,
    upload_total_rows,
    upload_valid_rows,
    upload_invalid_rows,
    upload_created_invoices,
    upload_error_message,
    upload_validation_errors_json,
    upload_completed_at,
    user_name,
    created_at
  FROM audit_logs
  WHERE activity_type = 'invoice_upload'
`;

async function getInvoiceValidationSummary() {
  const [[counts], [recentRows], [historyRows], [latestErrorRows]] = await Promise.all([
    pool.execute(`
      SELECT
        COUNT(*) AS totalUploads,
        SUM(status = 'success') AS successfulUploads,
        SUM(status = 'failed') AS failedUploads
      FROM audit_logs
      WHERE activity_type = 'invoice_upload'
    `),
    pool.execute(`${uploadSelect} ORDER BY created_at DESC, audit_log_id DESC LIMIT 5`),
    pool.execute(`${uploadSelect} ORDER BY created_at DESC, audit_log_id DESC`),
    pool.execute(`
      ${uploadSelect}
      AND (upload_invalid_rows > 0 OR upload_error_message IS NOT NULL)
      ORDER BY created_at DESC, audit_log_id DESC
      LIMIT 1
    `)
  ]);

  const latestErrorUpload = mapUpload(latestErrorRows[0]);
  let validationErrors = [];

  if (latestErrorUpload && latestErrorRows[0]?.upload_validation_errors_json) {
    let errorsJson = latestErrorRows[0].upload_validation_errors_json;
    if (typeof errorsJson === "string") {
      try { errorsJson = JSON.parse(errorsJson); } catch { errorsJson = []; }
    }
    validationErrors = (errorsJson || []).map((row, idx) => ({
      validationErrorId: idx + 1,
      rowNumber: row.source_row_number === null ? null : Number(row.source_row_number),
      invoiceNumber: row.invoice_number || "",
      fieldName: row.field_name || "General",
      errorMessage: row.error_message
    }));
  }

  return {
    summary: {
      totalUploads: Number(counts[0]?.totalUploads || 0),
      successfulUploads: Number(counts[0]?.successfulUploads || 0),
      failedUploads: Number(counts[0]?.failedUploads || 0)
    },
    recentUploads: recentRows.map(mapUpload),
    latestErrorUpload,
    validationErrors,
    uploadHistory: historyRows.map(mapUpload)
  };
}

async function getAllInvoiceValidationErrors() {
  const [rows] = await pool.execute(`
    ${uploadSelect}
    AND upload_validation_errors_json IS NOT NULL
    ORDER BY created_at DESC, audit_log_id DESC
  `);

  const allErrors = [];
  for (const row of rows) {
    let errorsJson = row.upload_validation_errors_json;
    if (typeof errorsJson === "string") {
      try { errorsJson = JSON.parse(errorsJson); } catch { errorsJson = []; }
    }
    for (const err of (errorsJson || [])) {
      allErrors.push({
        validationErrorId: allErrors.length + 1,
        uploadId: Number(row.audit_log_id),
        rowNumber: err.source_row_number === null ? null : Number(err.source_row_number),
        invoiceNumber: err.invoice_number || "",
        fieldName: err.field_name || "General",
        errorMessage: err.error_message,
        fileName: row.upload_file_name,
        status: row.status === "success" ? "Successful" : row.status === "failed" ? "Failed" : "Pending",
        uploaderEmail: row.user_name || "Unknown user",
        uploadedAt: row.created_at
      });
    }
  }

  return {
    totalErrors: allErrors.length,
    errors: allErrors
  };
}

module.exports = {
  getAllInvoiceValidationErrors,
  getInvoiceValidationSummary
};
