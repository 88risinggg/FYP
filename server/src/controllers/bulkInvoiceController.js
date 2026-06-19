const { pool } = require("../config/db");
const {
  toCurrencyNumber,
  writeAuditLog
} = require("./invoiceController");
const { assessInvoiceRisk } = require("../services/fraudDetectionService");

const EXCEL_FILE_ERROR = "Only Excel invoice files (.xlsx, .xls) are allowed.";
const INVOICE_FILE_NAME_ERROR = 'Invoice upload file name or path must contain "invoice".';
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

    return {
      ...row,
      customer_id: customerId,
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

    if (validation.message) {
      return res.status(400).json(validation);
    }

    res.json(validation);
  } catch (error) {
    res.status(500).json({
      message: "Failed to validate imported rows.",
      detail: error.message
    });
  }
}

async function processBulkInvoices(req, res) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const validation = await validateInvoiceImport(req.body.rows, req.body.file, connection);

    if (validation.message || validation.invalidCount > 0) {
      await connection.rollback();
      return res.status(400).json({
        message: validation.message || "Bulk upload contains invalid rows. No invoices were saved.",
        rows: validation.rows,
        invalidRows: validation.rows.filter((row) => !row.is_valid).map((row) => row.row_number),
        missingColumns: validation.missingColumns
      });
    }

    const invoices = validation.rows;

    const createdInvoices = [];

    // Inserts happen only after all validation passes, keeping invalid uploads out of the database.
    for (const invoice of invoices) {
      const [invoiceResult] = await connection.query(
        `
          INSERT INTO invoice
            (status, issue_date, due_date, invoiceId, total_amount, customer_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, NOW())
        `,
        [
          "Draft",
          invoice.issue_date,
          invoice.due_date,
          invoice.invoice_number,
          invoice.amount,
          invoice.customer_id
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

    await connection.commit();

    res.status(201).json({
      message: "Bulk invoices processed successfully.",
      createdCount: createdInvoices.length,
      invoices: createdInvoices
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({
      message: "Failed to process bulk invoices.",
      detail: error.message
    });
  } finally {
    connection.release();
  }
}

module.exports = {
  processBulkInvoices,
  validateBulkRows
};
