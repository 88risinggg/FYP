const { pool } = require("../config/db");

const VALID_STATUSES = new Set(["Draft", "Sent", "Viewed", "Paid", "Overdue"]);
const STATUS_AUDIT_PREFIX = "invoice_status:";

function toCurrencyNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Number(numberValue.toFixed(2)) : 0;
}

function buildNextInvoiceNumber(lastInvoiceId) {
  const match = String(lastInvoiceId || "").match(/^INV-(\d+)$/i);
  const nextNumber = match ? Number(match[1]) + 1 : 1;
  return `INV-${String(nextNumber).padStart(4, "0")}`;
}

function toDatabaseInvoiceStatus(status) {
  return status === "Paid" ? "Paid" : "Pending";
}

function toOperationalInvoiceStatus(rowStatus, auditStatus) {
  if (auditStatus && VALID_STATUSES.has(auditStatus)) {
    return auditStatus;
  }

  if (rowStatus === "Paid") {
    return "Paid";
  }

  return "Draft";
}

async function writeAuditLog(connection, action, entityType, entityId, userId) {
  await connection.query(
    `
      INSERT INTO audit_log (action, entity_type, entity_id, user_user_id)
      VALUES (?, ?, ?, ?)
    `,
    [action, entityType, entityId, userId || null]
  );
}

function normalizeDate(value) {
  if (!value || Number.isNaN(Date.parse(value))) {
    return null;
  }

  return value;
}

function validateInvoicePayload(body) {
  const customerId = Number(body.customer_id);
  const issueDate = normalizeDate(body.issue_date);
  const dueDate = normalizeDate(body.due_date);
  const status = body.status || "Draft";
  const items = Array.isArray(body.items) ? body.items : [];

  if (!customerId) {
    return { error: "Customer is required." };
  }

  if (!issueDate || !dueDate) {
    return { error: "Issue date and due date are required." };
  }

  if (!VALID_STATUSES.has(status)) {
    return { error: "Invalid invoice status." };
  }

  if (items.length === 0) {
    return { error: "At least one invoice item is required." };
  }

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
      status,
      items: normalizedItems,
      total_amount: toCurrencyNumber(
        normalizedItems.reduce((sum, item) => sum + item.amount, 0)
      )
    }
  };
}

async function getInvoices(req, res) {
  try {
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

      itemsByInvoiceId = itemRows.reduce((acc, item) => {
        const invoiceId = item.invoice_invoice_id;
        acc[invoiceId] = acc[invoiceId] || [];
        acc[invoiceId].push(item);
        return acc;
      }, {});

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

async function createInvoice(req, res) {
  const validation = validateInvoicePayload(req.body);

  if (validation.error) {
    return res.status(400).json({ message: validation.error });
  }

  const invoice = validation.value;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [lastInvoiceRows] = await connection.query(`
      SELECT invoiceId
      FROM invoice
      WHERE invoiceId LIKE 'INV-%'
      ORDER BY invoice_id DESC
      LIMIT 1
      FOR UPDATE
    `);
    const invoiceId = buildNextInvoiceNumber(lastInvoiceRows[0]?.invoiceId);

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
        invoice.total_amount,
        invoice.customer_id
      ]
    );

    const invoicePrimaryId = invoiceResult.insertId;
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

    await writeAuditLog(
      connection,
      `${STATUS_AUDIT_PREFIX}${invoice.status}`,
      "invoice",
      invoicePrimaryId,
      req.user?.userId
    );

    await connection.commit();

    res.status(201).json({
      message: "Invoice created successfully.",
      invoice: {
        invoice_id: invoicePrimaryId,
        invoiceId,
        status: invoice.status,
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

async function updateInvoiceStatus(req, res) {
  const invoiceId = Number(req.params.id);
  const status = req.body.status;

  if (!invoiceId) {
    return res.status(400).json({ message: "Invalid invoice id." });
  }

  if (!VALID_STATUSES.has(status)) {
    return res.status(400).json({ message: "Invalid invoice status." });
  }

  try {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [result] = await connection.query(
        "UPDATE invoice SET status = ? WHERE invoice_id = ?",
        [toDatabaseInvoiceStatus(status), invoiceId]
      );

      if (result.affectedRows === 0) {
        await connection.rollback();
        return res.status(404).json({ message: "Invoice not found." });
      }

      await writeAuditLog(
        connection,
        `${STATUS_AUDIT_PREFIX}${status}`,
        "invoice",
        invoiceId,
        req.user?.userId
      );

      await connection.commit();
    } finally {
      connection.release();
    }

    res.json({
      message: "Invoice status updated.",
      invoice_id: invoiceId,
      status
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update invoice status.",
      detail: error.message
    });
  }
}

module.exports = {
  createInvoice,
  getCustomers,
  getInvoices,
  getNextInvoiceNumber,
  updateInvoiceStatus,
  toCurrencyNumber,
  writeAuditLog
};
