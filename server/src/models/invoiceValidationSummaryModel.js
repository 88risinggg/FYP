const { pool } = require("../config/db");

function mapUpload(row) {
  if (!row) return null;

  return {
    uploadId: Number(row.uploadId),
    fileName: row.fileName,
    fileType: row.fileType,
    status: row.status,
    totalRows: Number(row.totalRows || 0),
    validRows: Number(row.validRows || 0),
    invalidRows: Number(row.invalidRows || 0),
    createdInvoices: Number(row.createdInvoices || 0),
    errorMessage: row.errorMessage || "",
    uploaderEmail: row.uploaderEmail || "Unknown user",
    uploadedAt: row.uploadedAt,
    completedAt: row.completedAt
  };
}

const uploadSelect = `
  SELECT
    upload_id AS uploadId,
    file_name AS fileName,
    file_type AS fileType,
    status,
    total_rows AS totalRows,
    valid_rows AS validRows,
    invalid_rows AS invalidRows,
    created_invoices AS createdInvoices,
    error_message AS errorMessage,
    uploader_email AS uploaderEmail,
    created_at AS uploadedAt,
    completed_at AS completedAt
  FROM invoice_upload_history
`;

async function getInvoiceValidationSummary() {
  const [[counts], [recentRows], [historyRows], [latestErrorRows]] = await Promise.all([
    pool.execute(`
      SELECT
        COUNT(*) AS totalUploads,
        SUM(status = 'Successful') AS successfulUploads,
        SUM(status = 'Failed') AS failedUploads
      FROM invoice_upload_history
    `),
    pool.execute(`${uploadSelect} ORDER BY created_at DESC, upload_id DESC LIMIT 5`),
    pool.execute(`${uploadSelect} ORDER BY created_at DESC, upload_id DESC`),
    pool.execute(`
      ${uploadSelect}
      WHERE invalid_rows > 0 OR error_message IS NOT NULL
      ORDER BY created_at DESC, upload_id DESC
      LIMIT 1
    `)
  ]);

  const latestErrorUpload = mapUpload(latestErrorRows[0]);
  let validationErrors = [];

  if (latestErrorUpload) {
    const [errorRows] = await pool.execute(
      `SELECT
        validation_error_id AS validationErrorId,
        source_row_number AS rowNumber,
        invoice_number AS invoiceNumber,
        field_name AS fieldName,
        error_message AS errorMessage
       FROM invoice_upload_validation_errors
       WHERE upload_id = ?
       ORDER BY source_row_number IS NULL, source_row_number, validation_error_id`,
      [latestErrorUpload.uploadId]
    );

    validationErrors = errorRows.map((row) => ({
      validationErrorId: Number(row.validationErrorId),
      rowNumber: row.rowNumber === null ? null : Number(row.rowNumber),
      invoiceNumber: row.invoiceNumber || "",
      fieldName: row.fieldName || "General",
      errorMessage: row.errorMessage
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
    SELECT
      validation_error_id AS validationErrorId,
      invoice_upload_validation_errors.upload_id AS uploadId,
      source_row_number AS rowNumber,
      invoice_number AS invoiceNumber,
      field_name AS fieldName,
      invoice_upload_validation_errors.error_message AS errorMessage,
      invoice_upload_history.file_name AS fileName,
      invoice_upload_history.status,
      invoice_upload_history.uploader_email AS uploaderEmail,
      invoice_upload_history.created_at AS uploadedAt
    FROM invoice_upload_validation_errors
    INNER JOIN invoice_upload_history
      ON invoice_upload_history.upload_id = invoice_upload_validation_errors.upload_id
    ORDER BY invoice_upload_history.created_at DESC,
      invoice_upload_validation_errors.upload_id DESC,
      source_row_number IS NULL,
      source_row_number,
      validation_error_id
  `);

  return {
    totalErrors: rows.length,
    errors: rows.map((row) => ({
      validationErrorId: Number(row.validationErrorId),
      uploadId: Number(row.uploadId),
      rowNumber: row.rowNumber === null ? null : Number(row.rowNumber),
      invoiceNumber: row.invoiceNumber || "",
      fieldName: row.fieldName || "General",
      errorMessage: row.errorMessage,
      fileName: row.fileName,
      status: row.status,
      uploaderEmail: row.uploaderEmail || "Unknown user",
      uploadedAt: row.uploadedAt
    }))
  };
}

module.exports = {
  getAllInvoiceValidationErrors,
  getInvoiceValidationSummary
};
