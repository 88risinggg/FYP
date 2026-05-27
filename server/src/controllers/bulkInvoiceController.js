const { pool } = require("../config/db");
const {
  toCurrencyNumber,
  writeAuditLog
} = require("./invoiceController");

const VALID_STATUSES = new Set(["Draft", "Sent", "Viewed", "Paid", "Overdue"]);

function normalizeDate(value) {
  if (!value || Number.isNaN(Date.parse(value))) {
    return null;
  }

  return String(value).slice(0, 10);
}

function buildNextInvoiceNumber(lastInvoiceId, offset) {
  const match = String(lastInvoiceId || "").match(/^INV-(\d+)$/i);
  const baseNumber = match ? Number(match[1]) : 0;
  return `INV-${String(baseNumber + offset).padStart(4, "0")}`;
}

function toDatabaseInvoiceStatus(status) {
  return status === "Paid" ? "Paid" : "Pending";
}

function normalizeImportedRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row, index) => {
    const quantity = Number(row.quantity);
    const unitPrice = Number(row.unit_price);
    const status = row.status || "Sent";

    return {
      row_number: index + 1,
      customer_id: Number(row.customer_id),
      customer_name: String(row.customer_name || "").trim(),
      customer_email: String(row.customer_email || "").trim(),
      issue_date: normalizeDate(row.issue_date),
      due_date: normalizeDate(row.due_date),
      description: String(row.description || "").trim(),
      quantity,
      unit_price: toCurrencyNumber(unitPrice),
      amount: toCurrencyNumber(quantity * unitPrice),
      status,
      errors: []
    };
  });
}

async function validateBulkRows(req, res) {
  try {
    const rows = normalizeImportedRows(req.body.rows);
    const customerIds = [...new Set(rows.map((row) => row.customer_id).filter(Boolean))];
    const existingCustomerIds = new Set();

    if (customerIds.length > 0) {
      const [customers] = await pool.query(
        "SELECT customer_id FROM customer WHERE customer_id IN (?)",
        [customerIds]
      );
      customers.forEach((customer) => existingCustomerIds.add(Number(customer.customer_id)));
    }

    const validatedRows = rows.map((row) => {
      const errors = [];

      if (!row.customer_id || !existingCustomerIds.has(row.customer_id)) {
        errors.push("Valid customer_id is required");
      }

      if (!row.issue_date || !row.due_date) {
        errors.push("Valid issue_date and due_date are required");
      }

      if (!row.description) {
        errors.push("Description is required");
      }

      if (!Number.isInteger(row.quantity) || row.quantity <= 0) {
        errors.push("Quantity must be a positive whole number");
      }

      if (!Number.isFinite(row.unit_price) || row.unit_price < 0) {
        errors.push("Unit price must be zero or greater");
      }

      if (!VALID_STATUSES.has(row.status)) {
        errors.push("Status must be Draft, Sent, Viewed, Paid, or Overdue");
      }

      return {
        ...row,
        errors,
        is_valid: errors.length === 0
      };
    });

    res.json({
      rows: validatedRows,
      validCount: validatedRows.filter((row) => row.is_valid).length,
      invalidCount: validatedRows.filter((row) => !row.is_valid).length
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to validate imported rows.",
      detail: error.message
    });
  }
}

async function processBulkInvoices(req, res) {
  const validationResponse = { body: req.body };
  const rows = normalizeImportedRows(validationResponse.body.rows);

  if (rows.length === 0) {
    return res.status(400).json({ message: "No import rows were submitted." });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const customerIds = [...new Set(rows.map((row) => row.customer_id).filter(Boolean))];
    const [customers] = customerIds.length > 0
      ? await connection.query("SELECT customer_id FROM customer WHERE customer_id IN (?)", [customerIds])
      : [[]];
    const existingCustomerIds = new Set(customers.map((customer) => Number(customer.customer_id)));
    const invalidRows = rows.filter((row) =>
      !row.customer_id ||
      !existingCustomerIds.has(row.customer_id) ||
      !row.issue_date ||
      !row.due_date ||
      !row.description ||
      !Number.isInteger(row.quantity) ||
      row.quantity <= 0 ||
      row.unit_price < 0 ||
      !VALID_STATUSES.has(row.status)
    );

    if (invalidRows.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        message: "Bulk upload contains invalid rows. Validate the file before processing.",
        invalidRows: invalidRows.map((row) => row.row_number)
      });
    }

    const groupedRows = rows.reduce((acc, row) => {
      const key = [row.customer_id, row.issue_date, row.due_date, row.status].join("|");
      acc[key] = acc[key] || {
        customer_id: row.customer_id,
        issue_date: row.issue_date,
        due_date: row.due_date,
        status: row.status,
        items: []
      };
      acc[key].items.push(row);
      return acc;
    }, {});

    const invoices = Object.values(groupedRows);
    const [lastInvoiceRows] = await connection.query(`
      SELECT invoiceId
      FROM invoice
      WHERE invoiceId LIKE 'INV-%'
      ORDER BY invoice_id DESC
      LIMIT 1
      FOR UPDATE
    `);

    const createdInvoices = [];

    for (let index = 0; index < invoices.length; index += 1) {
      const invoice = invoices[index];
      const invoiceId = buildNextInvoiceNumber(lastInvoiceRows[0]?.invoiceId, index + 1);
      const totalAmount = toCurrencyNumber(invoice.items.reduce((sum, item) => sum + item.amount, 0));

      const [invoiceResult] = await connection.query(
        `
          INSERT INTO invoice
            (status, issue_date, due_date, invoiceId, total_amount, customer_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, NOW())
        `,
        [
          toDatabaseInvoiceStatus(invoice.status),
          invoice.issue_date,
          invoice.due_date,
          invoiceId,
          totalAmount,
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
        [invoice.items.map((item) => [
          item.description,
          item.quantity,
          item.unit_price,
          item.amount,
          invoicePrimaryId
        ])]
      );

      await writeAuditLog(
        connection,
        `invoice_status:${invoice.status}`,
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

      createdInvoices.push({ invoice_id: invoicePrimaryId, invoiceId, total_amount: totalAmount });
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
