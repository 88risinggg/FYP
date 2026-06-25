/**
 * Invoice Controller
 *
 * Core controller for invoice CRUD operations.
 * Handles invoice creation, retrieval, status management, scheduling, and sending.
 * All database operations use transactions for data integrity.
 * Integrates with fraud detection service on invoice creation.
 */

const { pool } = require("../config/db");
const { assessInvoiceRisk } = require("../services/fraudDetectionService");
const { sendInvoiceEmail } = require("../services/invoiceDeliveryService");

/** Set of valid invoice statuses used throughout the application. */
const VALID_STATUSES = new Set(["Draft", "Scheduled", "Sent", "Paid", "Overdue"]);

/** Prefix used in audit_log entries for status change tracking. */
const STATUS_AUDIT_PREFIX = "invoice_status:";

/**
 * Convert any value to a safe 2-decimal currency number.
 * Returns 0 if the value is not a finite number.
 *
 * @param {*} value - The value to convert.
 * @returns {number} Rounded to 2 decimal places.
 */
function toCurrencyNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Number(numberValue.toFixed(2)) : 0;
}

/**
 * Generate the next sequential invoice number (INV-0001, INV-0002, etc.).
 * Parses the last used invoice ID and increments by 1.
 *
 * @param {string|null} lastInvoiceId - The most recent invoiceId from the database.
 * @returns {string} Next invoice number in INV-XXXX format.
 */
function buildNextInvoiceNumber(lastInvoiceId) {
  const match = String(lastInvoiceId || "").match(/^INV-(\d+)$/i);
  const nextNumber = match ? Number(match[1]) + 1 : 1;
  return `INV-${String(nextNumber).padStart(4, "0")}`;
}

/**
 * Normalize a status string to a valid database ENUM value.
 * Falls back to "Draft" if the status is not recognized.
 *
 * @param {string} status - The status to normalize.
 * @returns {string} A valid invoice status.
 */
function toDatabaseInvoiceStatus(status) {
  return VALID_STATUSES.has(status) ? status : "Draft";
}

/**
 * Determine the operational status of an invoice.
 * Prefers the latest audit log status over the raw database column,
 * ensuring the UI reflects the most recent status transition.
 *
 * @param {string} rowStatus - The status column from the invoice table.
 * @param {string|undefined} auditStatus - The latest status from the audit_log.
 * @returns {string} The effective operational status.
 */
function toOperationalInvoiceStatus(rowStatus, auditStatus) {
  if (auditStatus && VALID_STATUSES.has(auditStatus)) {
    return auditStatus;
  }

  if (VALID_STATUSES.has(rowStatus)) {
    return rowStatus;
  }

  return "Draft";
}

/**
 * Insert a record into the audit_log table.
 * Used to track all invoice operations for compliance and debugging.
 *
 * @param {Object} connection - MySQL connection (from pool.getConnection).
 * @param {string} action - The action performed (e.g. "invoice_created", "invoice_status:Sent").
 * @param {string} entityType - The entity type (e.g. "invoice", "payment").
 * @param {number|null} entityId - The primary key of the affected entity.
 * @param {number|null} userId - The user who performed the action.
 */
async function writeAuditLog(connection, action, entityType, entityId, userId) {
  await connection.query(
    `
      INSERT INTO audit_log (action, entity_type, entity_id, user_user_id)
      VALUES (?, ?, ?, ?)
    `,
    [action, entityType, entityId, userId || null]
  );
}

/**
 * Validate and normalize a date value.
 * Returns null if the value is not a parseable date.
 *
 * @param {*} value - The date value to normalize.
 * @returns {string|null} The normalized date string or null.
 */
function normalizeDate(value) {
  if (!value || Number.isNaN(Date.parse(value))) {
    return null;
  }

  return value;
}

/**
 * Validate the invoice creation/update payload.
 * Checks for required fields: customer_id, dates, and at least one valid line item.
 * Returns either an error message or the normalized invoice value.
 *
 * @param {Object} body - The request body.
 * @returns {Object} { error: string } on failure, { value: Object } on success.
 */
function validateInvoicePayload(body) {
  const customerId = Number(body.customer_id);
  const issueDate = normalizeDate(body.issue_date);
  const dueDate = normalizeDate(body.due_date);
  const items = Array.isArray(body.items) ? body.items : [];

  if (!customerId) {
    return { error: "Customer is required." };
  }

  if (!issueDate || !dueDate) {
    return { error: "Issue date and due date are required." };
  }

  if (items.length === 0) {
    return { error: "At least one invoice item is required." };
  }

  // Normalize line items: calculate amounts and validate fields
  const normalizedItems = items.map((item) => {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unit_price);
    const amount = toCurrencyNumber(quantity * unitPrice);

    return {
      description: String(item.description || "").trim(),
      quantity,
      unit_price: toCurrencyNumber(unitPrice),
      amount
    };
  });

  const hasInvalidItem = normalizedItems.some((item) =>
    !item.description ||
    !Number.isInteger(item.quantity) ||
    item.quantity <= 0 ||
    item.unit_price < 0
  );

  if (hasInvalidItem) {
    return {
      error: "Each invoice item requires a description, positive whole quantity, and valid unit price."
    };
  }

  return {
    value: {
      customer_id: customerId,
      issue_date: issueDate,
      due_date: dueDate,
      status: "Draft",
      items: normalizedItems,
      total_amount: toCurrencyNumber(
        normalizedItems.reduce((sum, item) => sum + item.amount, 0)
      )
    }
  };
}

/**
 * GET /api/invoices
 *
 * Retrieves all invoices with their line items and customer details.
 * Resolves the operational status from the audit log for accurate display.
 * Results sorted by creation date (newest first).
 *
 * Response: { invoices: [{ invoice_id, invoiceId, status, issue_date, due_date, total_amount, customer_name, items, ... }] }
 */
async function getInvoices(req, res) {
  try {
    // Fetch all invoices joined with customer data
    const [rows] = await pool.query(`
      SELECT
        i.invoice_id,
        i.invoiceId,
        i.status,
        i.issue_date,
        i.due_date,
        i.total_amount,
        i.customer_id,
        i.created_at,
        i.scheduled_at,
        c.name AS customer_name,
        c.email AS customer_email,
        c.address AS customer_address
      FROM invoice i
      INNER JOIN customer c ON c.customer_id = i.customer_id
      ORDER BY i.created_at DESC, i.invoice_id DESC
    `);

    const invoiceIds = rows.map((row) => row.invoice_id);
    let itemsByInvoiceId = {};
    let statusByInvoiceId = {};

    if (invoiceIds.length > 0) {
      // Batch-load all line items for the fetched invoices
      const [itemRows] = await pool.query(
        `
          SELECT
            item_id,
            description,
            quantity,
            unit_price,
            amount,
            invoice_invoice_id
          FROM invoice_item
          WHERE invoice_invoice_id IN (?)
          ORDER BY item_id ASC
        `,
        [invoiceIds]
      );

      // Group items by invoice ID for O(1) lookup
      itemsByInvoiceId = itemRows.reduce((acc, item) => {
        const invoiceId = item.invoice_invoice_id;
        acc[invoiceId] = acc[invoiceId] || [];
        acc[invoiceId].push(item);
        return acc;
      }, {});

      // Resolve the latest operational status from audit logs
      const [statusRows] = await pool.query(
        `
          SELECT al.entity_id, al.action
          FROM audit_log al
          INNER JOIN (
            SELECT entity_id, MAX(log_id) AS log_id
            FROM audit_log
            WHERE entity_type = 'invoice'
              AND action LIKE ?
              AND entity_id IN (?)
            GROUP BY entity_id
          ) latest ON latest.log_id = al.log_id
        `,
        [`${STATUS_AUDIT_PREFIX}%`, invoiceIds]
      );

      statusByInvoiceId = statusRows.reduce((acc, row) => {
        acc[row.entity_id] = String(row.action || "").replace(STATUS_AUDIT_PREFIX, "");
        return acc;
      }, {});
    }

    // Map results with resolved status and attached items
    res.json({
      invoices: rows.map((row) => ({
        ...row,
        database_status: row.status,
        status: toOperationalInvoiceStatus(row.status, statusByInvoiceId[row.invoice_id]),
        total_amount: toCurrencyNumber(row.total_amount),
        items: itemsByInvoiceId[row.invoice_id] || []
      }))
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch invoices.",
      detail: error.message
    });
  }
}

/**
 * GET /api/invoices/customers
 *
 * Retrieves all customers for the invoice creation dropdown.
 * Lightweight query returning only id, name, email, address.
 */
async function getCustomers(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT customer_id, name, email, address
      FROM customer
      ORDER BY name ASC
    `);

    res.json({ customers: rows });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch customers.",
      detail: error.message
    });
  }
}

/**
 * GET /api/invoices/next-number
 *
 * Calculates and returns the next available invoice number.
 * Looks at the highest existing INV-XXXX number and increments.
 *
 * Response: { invoiceId: "INV-0033" }
 */
async function getNextInvoiceNumber(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT invoiceId
      FROM invoice
      WHERE invoiceId LIKE 'INV-%'
      ORDER BY invoice_id DESC
      LIMIT 1
    `);

    res.json({
      invoiceId: buildNextInvoiceNumber(rows[0]?.invoiceId)
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to calculate next invoice number.",
      detail: error.message
    });
  }
}

/**
 * POST /api/invoices
 *
 * Creates a new invoice with line items.
 * Uses a database transaction to ensure atomicity.
 * Generates a sequential invoice number (INV-XXXX) using row-level locking.
 * Triggers fraud risk assessment after creation.
 * Writes audit logs for creation and initial status.
 *
 * Request body: { customer_id, issue_date, due_date, items: [{ description, quantity, unit_price }] }
 * Success response: 201 with { invoice: { invoice_id, invoiceId, status, total_amount } }
 */
async function createInvoice(req, res) {
  const validation = validateInvoicePayload(req.body);

  if (validation.error) {
    return res.status(400).json({ message: validation.error });
  }

  const invoice = validation.value;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Lock last invoice row to prevent duplicate numbers under concurrency
    const [lastInvoiceRows] = await connection.query(`
      SELECT invoiceId
      FROM invoice
      WHERE invoiceId LIKE 'INV-%'
      ORDER BY invoice_id DESC
      LIMIT 1
      FOR UPDATE
    `);
    const invoiceId = buildNextInvoiceNumber(lastInvoiceRows[0]?.invoiceId);

    // Insert invoice header
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
        invoiceId,
        invoice.total_amount,
        invoice.customer_id
      ]
    );

    const invoicePrimaryId = invoiceResult.insertId;

    // Batch-insert line items
    const itemValues = invoice.items.map((item) => [
      item.description,
      item.quantity,
      item.unit_price,
      item.amount,
      invoicePrimaryId
    ]);

    await connection.query(
      `
        INSERT INTO invoice_item
          (description, quantity, unit_price, amount, invoice_invoice_id)
        VALUES ?
      `,
      [itemValues]
    );

    // Audit trail: record creation and initial status
    await writeAuditLog(
      connection,
      `${STATUS_AUDIT_PREFIX}Draft`,
      "invoice",
      invoicePrimaryId,
      req.user?.userId
    );
    await writeAuditLog(connection, "invoice_created", "invoice", invoicePrimaryId, req.user?.userId);

    // Run fraud risk assessment on the new invoice
    await assessInvoiceRisk(connection, invoicePrimaryId, {
      vendor_name: req.body.vendor_name,
      bank_account: req.body.bank_account,
      source: "single_invoice"
    });

    await connection.commit();

    res.status(201).json({
      message: "Invoice created successfully.",
      invoice: {
        invoice_id: invoicePrimaryId,
        invoiceId,
        status: "Draft",
        total_amount: invoice.total_amount
      }
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({
      message: "Failed to create invoice.",
      detail: error.message
    });
  } finally {
    connection.release();
  }
}

/**
 * POST /api/invoices/:id/send
 *
 * Sends an invoice to the customer via email.
 * Updates the invoice status from Draft/Scheduled to "Sent".
 * Clears any scheduled_at timestamp.
 * Prevents re-sending of already-paid invoices.
 *
 * URL param: id (invoice primary key)
 * Success response: { message, invoice_id, status: "Sent" }
 */
async function sendInvoice(req, res) {
  const invoiceId = Number(req.params.id);

  if (!invoiceId) {
    return res.status(400).json({ message: "Invalid invoice id." });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Lock invoice row and fetch details for email
    const [rows] = await connection.query(
      `
        SELECT
          i.invoice_id,
          i.invoiceId,
          i.status,
          i.total_amount,
          c.name AS customer_name,
          c.email AS customer_email
        FROM invoice i
        INNER JOIN customer c ON c.customer_id = i.customer_id
        WHERE i.invoice_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [invoiceId]
    );

    const invoice = rows[0];
    if (!invoice) {
      await connection.rollback();
      return res.status(404).json({ message: "Invoice not found." });
    }

    if (invoice.status === "Paid") {
      await connection.rollback();
      return res.status(400).json({ message: "Paid invoices cannot be sent again." });
    }

    // Send invoice via email service
    await sendInvoiceEmail(invoice);

    // Update status to Sent and clear schedule
    await connection.query(
      "UPDATE invoice SET status = 'Sent', scheduled_at = NULL WHERE invoice_id = ?",
      [invoiceId]
    );
    await writeAuditLog(connection, `${STATUS_AUDIT_PREFIX}Sent`, "invoice", invoiceId, req.user?.userId);
    await writeAuditLog(connection, "invoice_sent", "invoice", invoiceId, req.user?.userId);

    await connection.commit();

    res.json({
      message: "Invoice sent.",
      invoice_id: invoiceId,
      status: "Sent"
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({
      message: "Failed to send invoice.",
      detail: error.message
    });
  } finally {
    connection.release();
  }
}

/**
 * Validate and parse a scheduled_at timestamp.
 * Returns null if the value is not a valid date.
 *
 * @param {*} value - The timestamp value.
 * @returns {Date|null} Parsed Date object or null.
 */
function normalizeScheduledAt(value) {
  if (!value || Number.isNaN(Date.parse(value))) {
    return null;
  }

  return new Date(value);
}

/**
 * POST /api/invoices/schedule
 *
 * Schedules one or more Draft invoices for automatic future sending.
 * The background invoice scheduler worker picks these up when the time arrives.
 * Only Draft invoices can be scheduled.
 *
 * Request body: { invoice_ids: number[], scheduled_at: string (ISO datetime) }
 * Validation: scheduled_at must be in the future; all IDs must exist and be Draft.
 * Success response: { message, scheduledCount, scheduled_at }
 */
async function scheduleInvoices(req, res) {
  const invoiceIds = Array.isArray(req.body.invoice_ids)
    ? [...new Set(req.body.invoice_ids.map((id) => Number(id)).filter(Boolean))]
    : [];
  const scheduledAt = normalizeScheduledAt(req.body.scheduled_at);

  if (invoiceIds.length === 0) {
    return res.status(400).json({ message: "At least one invoice id is required." });
  }

  if (!scheduledAt) {
    return res.status(400).json({ message: "A valid scheduled_at timestamp is required." });
  }

  if (scheduledAt.getTime() <= Date.now()) {
    return res.status(400).json({ message: "Schedule time must be in the future." });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Lock all target invoices and verify they exist
    const [existingInvoices] = await connection.query(
      "SELECT invoice_id, status FROM invoice WHERE invoice_id IN (?) FOR UPDATE",
      [invoiceIds]
    );
    const existingIds = existingInvoices.map((invoice) => Number(invoice.invoice_id));

    if (existingIds.length !== invoiceIds.length) {
      await connection.rollback();
      return res.status(404).json({ message: "One or more invoices were not found." });
    }

    // Ensure all invoices are in Draft status
    const unschedulableInvoice = existingInvoices.find((invoice) => invoice.status !== "Draft");
    if (unschedulableInvoice) {
      await connection.rollback();
      return res.status(400).json({ message: "Only draft invoices can be scheduled." });
    }

    // Batch-update status and scheduled_at
    await connection.query(
      "UPDATE invoice SET status = 'Scheduled', scheduled_at = ? WHERE invoice_id IN (?)",
      [scheduledAt, invoiceIds]
    );

    // Write audit logs for each scheduled invoice
    for (const invoiceId of invoiceIds) {
      await writeAuditLog(
        connection,
        `${STATUS_AUDIT_PREFIX}Scheduled`,
        "invoice",
        invoiceId,
        req.user?.userId
      );
      await writeAuditLog(
        connection,
        `invoice_scheduled:${scheduledAt.toISOString()}`,
        "invoice",
        invoiceId,
        req.user?.userId
      );
    }

    await connection.commit();

    res.json({
      message: "Invoices scheduled successfully.",
      scheduledCount: invoiceIds.length,
      scheduled_at: scheduledAt.toISOString()
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({
      message: "Failed to schedule invoices.",
      detail: error.message
    });
  } finally {
    connection.release();
  }
}

module.exports = {
  buildNextInvoiceNumber,
  createInvoice,
  getCustomers,
  getInvoices,
  getNextInvoiceNumber,
  scheduleInvoices,
  sendInvoice,
  toCurrencyNumber,
  STATUS_AUDIT_PREFIX,
  toDatabaseInvoiceStatus,
  toOperationalInvoiceStatus,
  validateInvoicePayload,
  writeAuditLog
};
