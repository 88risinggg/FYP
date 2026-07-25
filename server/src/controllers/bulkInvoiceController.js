/**
 * Bulk Invoice Controller
 *
 * Handles mass invoice import from Excel/CSV files.
 * Provides two-step workflow:
 * 1. Validate - Parse and validate uploaded rows, return errors per row.
 * 2. Process - Insert all valid rows as invoices in a single transaction.
 *
 * Enforces file format validation (must be .xlsx/.xls with "invoice" in filename).
 * Validates against existing customers and duplicate invoice numbers.
 * Triggers fraud risk assessment on each created invoice.
 */

const { pool } = require("../config/db");
const {
  toCurrencyNumber,
  writeAuditLog
} = require("./invoiceController");
const { assessInvoiceRisk } = require("../services/fraudDetectionService");
const {
  recordValidationAttempt,
  updateUploadOutcome
} = require("../services/invoiceUploadHistoryService");

/** Error message when file is not an Excel format. */
const EXCEL_FILE_ERROR = "Only Excel invoice files (.xlsx, .xls) are allowed.";

/** Error message when file name doesn't contain "invoice". */
const INVOICE_FILE_NAME_ERROR = 'Invoice upload file name or path must contain "invoice".';

/** Accepted Excel file extensions. */
const ALLOWED_EXCEL_EXTENSIONS = new Set([".xlsx", ".xls"]);
const ALLOWED_EXCEL_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel"
]);
const REQUIRED_TEMPLATE_COLUMNS = [
  "Invoice Number",
  "Customer Name",
  "Invoice Date",
  "Due Date",
  "Amount"
];

// Optional columns that are recognized but not required
const OPTIONAL_TEMPLATE_COLUMNS = ["Subscription", "Vendor Name", "Bank Account"];

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

function validateExcelFileMetadata(file = {}) {
  const uploadPath = getUploadFilePath(file);
  const extension = getFileExtension(uploadPath);
  const mimeType = String(file.type || "").trim();

  if (!ALLOWED_EXCEL_EXTENSIONS.has(extension)) {
    return EXCEL_FILE_ERROR;
  }

  if (mimeType && !ALLOWED_EXCEL_MIME_TYPES.has(mimeType)) {
    return EXCEL_FILE_ERROR;
  }

  if (!uploadPath.toLowerCase().includes("invoice")) {
    return INVOICE_FILE_NAME_ERROR;
  }

  return "";
}

function getRowValue(row, columnName) {
  const normalizedColumn = normalizeHeader(columnName);
  const matchingKey = Object.keys(row || {}).find((key) => normalizeHeader(key) === normalizedColumn);
  return matchingKey ? row[matchingKey] : "";
}

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function parseAmount(value) {
  if (typeof value === "number") {
    return value;
  }

  return Number(String(value || "").replace(/[$,\s]/g, ""));
}

function normalizeImportedRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row, index) => {
    const amount = parseAmount(getRowValue(row, "Amount"));

    return {
      row_number: index + 1,
      invoice_number: String(getRowValue(row, "Invoice Number") || "").trim(),
      customer_name: String(getRowValue(row, "Customer Name") || "").trim(),
      issue_date: normalizeDate(getRowValue(row, "Invoice Date")),
      due_date: normalizeDate(getRowValue(row, "Due Date")),
      amount: toCurrencyNumber(amount),
      vendor_name: String(getRowValue(row, "Vendor Name") || "").trim(),
      bank_account: String(getRowValue(row, "Bank Account") || "").trim(),
      subscription: String(getRowValue(row, "Subscription") || "").trim(),
      status: "Draft",
      errors: []
    };
  });
}

function getMissingTemplateColumns(rows) {
  const firstRow = Array.isArray(rows) && rows.length > 0 ? rows[0] : {};
  const headers = new Set(Object.keys(firstRow).map(normalizeHeader));

  return REQUIRED_TEMPLATE_COLUMNS.filter((column) => !headers.has(normalizeHeader(column)));
}

async function validateInvoiceImport(rows, file, connection = pool) {
  const fileError = validateExcelFileMetadata(file);
  if (fileError) {
    return {
      message: fileError,
      rows: [],
      validCount: 0,
      invalidCount: 0,
      missingColumns: []
    };
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      message: "Invoice file does not contain any invoice rows.",
      rows: [],
      validCount: 0,
      invalidCount: 0,
      missingColumns: []
    };
  }

  // The template check runs before row processing so malformed spreadsheets fail as a whole.
  const missingColumns = getMissingTemplateColumns(rows);
  if (missingColumns.length > 0) {
    return {
      message: `Missing required columns: ${missingColumns.join(", ")}`,
      rows: [],
      validCount: 0,
      invalidCount: rows.length,
      missingColumns
    };
  }

  const normalizedRows = normalizeImportedRows(rows);
  const customerNames = [...new Set(normalizedRows.map((row) => row.customer_name).filter(Boolean))];
  const invoiceNumbers = normalizedRows.map((row) => row.invoice_number).filter(Boolean);
  const customerIdsByName = new Map();
  const existingInvoiceNumbers = new Set();

  if (customerNames.length > 0) {
    const [customers] = await connection.query(
      "SELECT customer_id, name FROM customer WHERE name IN (?)",
      [customerNames]
    );
    customers.forEach((customer) => {
      customerIdsByName.set(String(customer.name).trim().toLowerCase(), Number(customer.customer_id));
    });
  }

  if (invoiceNumbers.length > 0) {
    const [existingInvoices] = await connection.query(
      "SELECT invoiceId FROM invoice WHERE invoiceId IN (?)",
      [invoiceNumbers]
    );
    existingInvoices.forEach((invoice) => existingInvoiceNumbers.add(String(invoice.invoiceId).trim()));
  }

  // Resolve subscription plan names to subscription_id for rows that have a Subscription value
  const subscriptionPlanNames = [...new Set(normalizedRows.map((row) => row.subscription).filter(Boolean))];
  const subscriptionLookup = new Map(); // "customerId:planName" → subscription_id

  if (subscriptionPlanNames.length > 0) {
    try {
      const [subRows] = await connection.query(
        `SELECT subscription_id, customer_id, plan_name
         FROM subscriptions
         WHERE plan_name IN (?) AND status = 'Active'`,
        [subscriptionPlanNames]
      );
      subRows.forEach((sub) => {
        const key = `${sub.customer_id}:${String(sub.plan_name).trim().toLowerCase()}`;
        subscriptionLookup.set(key, sub.subscription_id);
      });
    } catch { /* subscriptions table may not exist yet */ }
  }

  const seenInvoiceNumbers = new Set();
  const duplicateInvoiceNumbers = new Set();
  invoiceNumbers.forEach((invoiceNumber) => {
    if (seenInvoiceNumbers.has(invoiceNumber)) {
      duplicateInvoiceNumbers.add(invoiceNumber);
    }
    seenInvoiceNumbers.add(invoiceNumber);
  });

  // Each row is validated independently, but any invalid row blocks the later insert step.
  const validatedRows = normalizedRows.map((row) => {
    const errors = [];
    const customerId = customerIdsByName.get(row.customer_name.toLowerCase()) || null;

    if (!row.invoice_number) {
      errors.push("Invoice Number is required");
    }

    if (row.invoice_number && existingInvoiceNumbers.has(row.invoice_number)) {
      errors.push(`Duplicate invoice number already exists: ${row.invoice_number}`);
    }

    if (row.invoice_number && duplicateInvoiceNumbers.has(row.invoice_number)) {
      errors.push(`Duplicate invoice number in upload: ${row.invoice_number}`);
    }

    if (!row.customer_name || !customerId) {
      errors.push("Customer Name must match an existing customer");
    }

    if (!row.issue_date) {
      errors.push("Invoice Date must be a valid date");
    }

    if (!row.due_date) {
      errors.push("Due Date must be a valid date");
    }

    if (!Number.isFinite(row.amount) || row.amount <= 0) {
      errors.push("Amount must be numeric and greater than 0");
    }

    // Resolve subscription_id if Subscription column is provided
    let subscription_id = null;
    if (row.subscription && customerId) {
      const subKey = `${customerId}:${row.subscription.toLowerCase()}`;
      subscription_id = subscriptionLookup.get(subKey) || null;
      if (!subscription_id) {
        errors.push(`Subscription "${row.subscription}" not found for this customer or is not active`);
      }
    }

    return {
      ...row,
      customer_id: customerId,
      subscription_id,
      errors,
      is_valid: errors.length === 0
    };
  });

  return {
    message: "",
    rows: validatedRows,
    validCount: validatedRows.filter((row) => row.is_valid).length,
    invalidCount: validatedRows.filter((row) => !row.is_valid).length,
    missingColumns: []
  };
}

async function validateBulkRows(req, res) {
  try {
    const validation = await validateInvoiceImport(req.body.rows, req.body.file);
    const uploadId = await recordValidationAttempt({
      file: req.body.file,
      validation,
      user: req.user
    });

    if (validation.message) {
      return res.status(400).json({ ...validation, uploadId });
    }

    res.json({ ...validation, uploadId });
  } catch (error) {
    res.status(500).json({
      message: "Failed to validate imported rows.",
      detail: error.message
    });
  }
}

async function processBulkInvoices(req, res) {
  const connection = await pool.getConnection();
  const uploadId = Number(req.body.uploadId) || null;

  try {
    await connection.beginTransaction();

    const validation = await validateInvoiceImport(req.body.rows, req.body.file, connection);

    if (validation.message) {
      await connection.rollback();
      await updateUploadOutcome(pool, {
        uploadId,
        userId: req.user?.userId,
        status: "Failed",
        errorMessage: validation.message
      });
      return res.status(400).json({
        message: validation.message,
        rows: validation.rows,
        invalidRows: validation.rows.filter((row) => !row.is_valid).map((row) => row.row_number),
        missingColumns: validation.missingColumns
      });
    }

    // Process only valid rows, skip invalid ones
    const invoices = validation.rows.filter((row) => row.is_valid);

    if (invoices.length === 0) {
      await connection.rollback();
      await updateUploadOutcome(pool, {
        uploadId,
        userId: req.user?.userId,
        status: "Failed",
        errorMessage: "No valid rows to process."
      });
      return res.status(400).json({
        message: "No valid rows to process.",
        rows: validation.rows,
        invalidRows: validation.rows.filter((row) => !row.is_valid).map((row) => row.row_number)
      });
    }

    const createdInvoices = [];

    // Inserts happen only after all validation passes, keeping invalid uploads out of the database.
    for (const invoice of invoices) {
      const [invoiceResult] = await connection.query(
        `
          INSERT INTO invoice
            (status, issue_date, due_date, invoiceId, total_amount, customer_id, subscription_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        `,
        [
          "Draft",
          invoice.issue_date,
          invoice.due_date,
          invoice.invoice_number,
          invoice.amount,
          invoice.customer_id,
          invoice.subscription_id || null
        ]
      );

      const invoicePrimaryId = invoiceResult.insertId;
      await connection.query(
        `
          INSERT INTO invoice_item
            (description, quantity, unit_price, amount, invoice_invoice_id)
          VALUES ?
        `,
        [[[
          `Imported invoice ${invoice.invoice_number}`,
          1,
          invoice.amount,
          invoice.amount,
          invoicePrimaryId
        ]]]
      );

      await writeAuditLog(
        connection,
        "invoice_status:Draft",
        "invoice",
        invoicePrimaryId,
        req.user?.userId
      );
      await writeAuditLog(
        connection,
        "bulk_invoice_created",
        "invoice",
        invoicePrimaryId,
        req.user?.userId
      );
      await writeAuditLog(connection, "invoice_uploaded", "invoice", invoicePrimaryId, req.user?.userId);

      await assessInvoiceRisk(connection, invoicePrimaryId, {
        vendor_name: invoice.vendor_name,
        bank_account: invoice.bank_account,
        source: "bulk_invoice"
      });

      createdInvoices.push({
        invoice_id: invoicePrimaryId,
        invoiceId: invoice.invoice_number,
        total_amount: invoice.amount
      });
    }

    await writeAuditLog(
      connection,
      `bulk_invoice_batch_processed:${createdInvoices.length}`,
      "bulk_upload",
      null,
      req.user?.userId
    );

    await updateUploadOutcome(connection, {
      uploadId,
      userId: req.user?.userId,
      status: "Successful",
      createdInvoices: createdInvoices.length
    });

    await connection.commit();

    res.status(201).json({
      message: "Bulk invoices processed successfully.",
      createdCount: createdInvoices.length,
      invoices: createdInvoices
    });
  } catch (error) {
    await connection.rollback();
    try {
      await updateUploadOutcome(pool, {
        uploadId,
        userId: req.user?.userId,
        status: "Failed",
        errorMessage: error.message
      });
    } catch (historyError) {
      console.error("[BulkInvoice] Unable to update upload history:", historyError.message);
    }
    console.error("[BulkInvoice] Processing error:", error);
    res.status(500).json({
      message: "Failed to process bulk invoices.",
      detail: error.message
    });
  } finally {
    connection.release();
  }
}

module.exports = {
  getMissingTemplateColumns,
  normalizeImportedRows,
  processBulkInvoices,
  validateBulkRows,
  validateExcelFileMetadata,
  validateInvoiceImport
};
