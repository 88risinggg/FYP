/**
 * Invoice Validation Summary Model
 *
 * One audit_logs row with activity_type = 'invoice_upload' represents one
 * upload batch. Row-level validation errors remain embedded on that batch.
 */

const { pool } = require("../config/db");

const statusLabels = {
  success: "Successful",
  warning: "Partial Success",
  failed: "Failed",
  info: "Pending",
  pending: "Pending"
};

function uploadStatus(row = {}) {
  const status = String(row.status || "").toLowerCase();
  const invalidRows = Number(row.upload_invalid_rows || 0);
  const validRows = Number(row.upload_valid_rows || 0);
  const createdInvoices = Number(row.upload_created_invoices || 0);

  if (
    status === "warning" ||
    (status === "success" && createdInvoices > 0 && (invalidRows > 0 || createdInvoices < validRows))
  ) {
    return "Partial Success";
  }
  return statusLabels[status] || "Pending";
}

function mapUpload(row) {
  if (!row) return null;

  const uploadedAt = row.created_at;
  const completedAt = row.upload_completed_at;
  const started = uploadedAt ? new Date(uploadedAt).getTime() : NaN;
  const completed = completedAt ? new Date(completedAt).getTime() : NaN;

  return {
    uploadId: Number(row.audit_log_id),
    uploadBatchId: String(row.affected_record || row.audit_log_id),
    fileName: row.upload_file_name || "",
    fileType: row.upload_file_type || "",
    status: uploadStatus(row),
    totalRows: Number(row.upload_total_rows || 0),
    validRows: Number(row.upload_valid_rows || 0),
    invalidRows: Number(row.upload_invalid_rows || 0),
    createdInvoices: Number(row.upload_created_invoices || 0),
    errorMessage: row.upload_error_message || "",
    uploaderEmail: row.user_name || "Unknown user",
    uploadedAt,
    completedAt,
    processingDurationMs: Number.isFinite(started) && Number.isFinite(completed)
      ? Math.max(0, completed - started)
      : null
  };
}

const uploadSelect = `
  SELECT
    audit_log_id,
    affected_record,
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

function parseErrors(row) {
  let errorsJson = row?.upload_validation_errors_json;
  if (typeof errorsJson === "string") {
    try { errorsJson = JSON.parse(errorsJson); } catch { errorsJson = []; }
  }
  return Array.isArray(errorsJson) ? errorsJson : [];
}

function mapValidationErrors(row, startingIndex = 0) {
  return parseErrors(row).map((error, index) => ({
    validationErrorId: `${row.audit_log_id}-${startingIndex + index + 1}`,
    uploadId: Number(row.audit_log_id),
    uploadBatchId: String(row.affected_record || row.audit_log_id),
    rowNumber: error.source_row_number === null ? null : Number(error.source_row_number),
    invoiceNumber: error.invoice_number || "",
    fieldName: error.field_name || "General",
    invalidValue: error.invalid_value ?? null,
    errorMessage: error.error_message,
    fileName: row.upload_file_name,
    status: uploadStatus(row),
    uploaderEmail: row.user_name || "Unknown user",
    uploadedAt: row.created_at
  }));
}

async function getInvoiceValidationSummary() {
  const [[counts], [recentRows], [latestErrorRows]] = await Promise.all([
    pool.execute(`
      SELECT
        COUNT(*) AS totalUploads,
        SUM(
          status = 'Success'
          AND COALESCE(upload_invalid_rows, 0) = 0
          AND COALESCE(upload_created_invoices, 0) >= COALESCE(upload_valid_rows, 0)
        ) AS successfulUploads,
        SUM(status = 'Failed') AS failedUploads
      FROM audit_logs
      WHERE activity_type = 'invoice_upload'
    `),
    pool.execute(`${uploadSelect} ORDER BY created_at DESC, audit_log_id DESC LIMIT 5`),
    pool.execute(`
      ${uploadSelect}
      AND (upload_invalid_rows > 0 OR upload_error_message IS NOT NULL)
      ORDER BY created_at DESC, audit_log_id DESC
      LIMIT 1
    `)
  ]);

  const latestErrorRow = latestErrorRows[0] || null;

  return {
    summary: {
      totalUploads: Number(counts[0]?.totalUploads || 0),
      successfulUploads: Number(counts[0]?.successfulUploads || 0),
      failedUploads: Number(counts[0]?.failedUploads || 0)
    },
    recentUploads: recentRows.map(mapUpload),
    latestErrorUpload: mapUpload(latestErrorRow),
    validationErrors: latestErrorRow ? mapValidationErrors(latestErrorRow) : []
  };
}

function normalizeHistoryFilters(filters = {}) {
  const page = Math.max(1, Number.parseInt(filters.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(10, Number.parseInt(filters.pageSize, 10) || 20));
  const statusMap = {
    successful: "Success",
    failed: "Failed",
    "partial success": "Warning",
    partial_success: "Warning",
    pending: "Info"
  };

  return {
    page,
    pageSize,
    status: statusMap[String(filters.status || "").toLowerCase()] || "",
    uploadedBy: String(filters.uploadedBy || "").trim().slice(0, 255),
    fileName: String(filters.fileName || "").trim().slice(0, 255),
    batchId: String(filters.batchId || "").trim().slice(0, 100),
    startDate: String(filters.startDate || "").trim(),
    endDate: String(filters.endDate || "").trim(),
    sort: ["latest", "oldest", "invalid-desc", "created-desc"].includes(filters.sort)
      ? filters.sort
      : "latest"
  };
}

async function getInvoiceUploadHistory(rawFilters = {}) {
  const filters = normalizeHistoryFilters(rawFilters);
  const where = ["activity_type = 'invoice_upload'"];
  const params = [];

  if (filters.status === "Warning") {
    where.push(`(
      status = 'Warning'
      OR (
        status = 'Success'
        AND COALESCE(upload_created_invoices, 0) > 0
        AND (
          COALESCE(upload_invalid_rows, 0) > 0
          OR COALESCE(upload_created_invoices, 0) < COALESCE(upload_valid_rows, 0)
        )
      )
    )`);
  } else if (filters.status === "Success") {
    where.push(`status = 'Success'
      AND COALESCE(upload_invalid_rows, 0) = 0
      AND COALESCE(upload_created_invoices, 0) >= COALESCE(upload_valid_rows, 0)`);
  } else if (filters.status) {
    where.push("status = ?");
    params.push(filters.status);
  }
  if (filters.uploadedBy) {
    where.push("LOWER(user_name) LIKE LOWER(?)");
    params.push(`%${filters.uploadedBy}%`);
  }
  if (filters.fileName) {
    where.push("LOWER(upload_file_name) LIKE LOWER(?)");
    params.push(`%${filters.fileName}%`);
  }
  if (filters.batchId) {
    where.push("LOWER(CAST(affected_record AS CHAR)) LIKE LOWER(?)");
    params.push(`%${filters.batchId}%`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(filters.startDate)) {
    where.push("created_at >= ?");
    params.push(filters.startDate);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(filters.endDate)) {
    where.push("created_at < DATE_ADD(?, INTERVAL 1 DAY)");
    params.push(filters.endDate);
  }

  const orderBy = {
    latest: "created_at DESC, audit_log_id DESC",
    oldest: "created_at ASC, audit_log_id ASC",
    "invalid-desc": "upload_invalid_rows DESC, created_at DESC, audit_log_id DESC",
    "created-desc": "upload_created_invoices DESC, created_at DESC, audit_log_id DESC"
  }[filters.sort];
  const whereSql = where.join(" AND ");
  const offset = (filters.page - 1) * filters.pageSize;

  const [[countRows], [rows], [uploaderRows]] = await Promise.all([
    pool.execute(`SELECT COUNT(*) AS total FROM audit_logs WHERE ${whereSql}`, params),
    pool.execute(
      `${uploadSelect.replace("activity_type = 'invoice_upload'", whereSql)} ORDER BY ${orderBy} LIMIT ${filters.pageSize} OFFSET ${offset}`,
      params
    ),
    pool.execute(`
      SELECT DISTINCT user_name
      FROM audit_logs
      WHERE activity_type = 'invoice_upload' AND user_name IS NOT NULL AND user_name <> ''
      ORDER BY user_name
    `)
  ]);

  const total = Number(countRows[0]?.total || 0);
  return {
    uploads: rows.map(mapUpload),
    uploaders: uploaderRows.map((row) => row.user_name),
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / filters.pageSize))
    }
  };
}

async function getAllInvoiceValidationErrors(filters = {}) {
  const params = [];
  let filterSql = "";
  const uploadId = Number.parseInt(filters.uploadId, 10);

  if (Number.isInteger(uploadId) && uploadId > 0) {
    filterSql = " AND audit_log_id = ?";
    params.push(uploadId);
  }

  const [rows] = await pool.execute(`
    ${uploadSelect}
    AND upload_validation_errors_json IS NOT NULL
    ${filterSql}
    ORDER BY created_at DESC, audit_log_id DESC
  `, params);

  const allErrors = rows.flatMap((row) => mapValidationErrors(row));
  return {
    totalErrors: allErrors.length,
    upload: rows.length === 1 ? mapUpload(rows[0]) : null,
    errors: allErrors
  };
}

module.exports = {
  getAllInvoiceValidationErrors,
  getInvoiceUploadHistory,
  getInvoiceValidationSummary,
  mapUpload,
  normalizeHistoryFilters,
  uploadStatus
};
