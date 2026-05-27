const { pool } = require("../config/db");
const { toCurrencyNumber, writeAuditLog } = require("./invoiceController");

async function ensurePaymentMethod(connection, methodName) {
  const [existingRows] = await connection.query(
    "SELECT payment_method_id FROM payment_method WHERE name = ? LIMIT 1",
    [methodName]
  );

  if (existingRows.length > 0) {
    return existingRows[0].payment_method_id;
  }

  const [result] = await connection.query(
    `
      INSERT INTO payment_method (name, description, is_active)
      VALUES (?, ?, 1)
    `,
    [methodName, `${methodName} payments`]
  );

  return result.insertId;
}

async function getPaymentsWorkspace(req, res) {
  try {
    const [outstandingInvoices] = await pool.query(`
      SELECT
        i.invoice_id,
        i.invoiceId,
        i.issue_date,
        i.due_date,
        i.total_amount,
        i.status AS database_status,
        c.name AS customer_name,
        c.email AS customer_email
      FROM invoice i
      INNER JOIN customer c ON c.customer_id = i.customer_id
      WHERE i.status <> 'Paid'
      ORDER BY i.due_date ASC, i.invoice_id DESC
    `);

    const [payments] = await pool.query(`
      SELECT
        p.payment_id,
        p.payment_date,
        p.amount,
        p.status,
        p.transaction_id,
        p.invoice_invoice_id,
        pm.name AS payment_method,
        i.invoiceId,
        c.name AS customer_name
      FROM payment p
      LEFT JOIN payment_method pm ON pm.payment_method_id = p.payment_method_id
      LEFT JOIN invoice i ON i.invoice_id = p.invoice_invoice_id
      LEFT JOIN customer c ON c.customer_id = i.customer_id
      ORDER BY p.payment_date DESC, p.payment_id DESC
      LIMIT 25
    `);

    res.json({
      outstandingInvoices: outstandingInvoices.map((invoice) => ({
        ...invoice,
        total_amount: toCurrencyNumber(invoice.total_amount)
      })),
      payments
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to load payment workspace.",
      detail: error.message
    });
  }
}

async function recordManualPayment(req, res) {
  const invoiceId = Number(req.body.invoice_id);
  const amount = toCurrencyNumber(req.body.amount);
  const transactionId = String(req.body.transaction_id || "").trim() || `MANUAL-${Date.now()}`;

  if (!invoiceId || amount <= 0) {
    return res.status(400).json({ message: "Invoice and positive payment amount are required." });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [invoiceRows] = await connection.query(
      "SELECT invoice_id, total_amount FROM invoice WHERE invoice_id = ? LIMIT 1 FOR UPDATE",
      [invoiceId]
    );

    if (invoiceRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Invoice not found." });
    }

    const paymentMethodId = await ensurePaymentMethod(connection, "Bank Transfer");

    const [paymentResult] = await connection.query(
      `
        INSERT INTO payment
          (payment_date, amount, status, transaction_id, invoice_invoice_id, payment_method_id)
        VALUES (NOW(), ?, 'Completed', ?, ?, ?)
      `,
      [String(amount), transactionId, invoiceId, paymentMethodId]
    );

    await connection.query(
      "UPDATE invoice SET status = 'Paid' WHERE invoice_id = ?",
      [invoiceId]
    );

    await writeAuditLog(connection, "manual_payment_recorded", "payment", paymentResult.insertId, req.user?.userId);
    await writeAuditLog(connection, "invoice_status:Paid", "invoice", invoiceId, req.user?.userId);

    await connection.commit();

    res.status(201).json({
      message: "Manual payment recorded.",
      payment_id: paymentResult.insertId
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({
      message: "Failed to record manual payment.",
      detail: error.message
    });
  } finally {
    connection.release();
  }
}

async function createStripePaymentLink(req, res) {
  const invoiceId = Number(req.body.invoice_id);

  if (!invoiceId) {
    return res.status(400).json({ message: "Invoice is required." });
  }

  try {
    const [rows] = await pool.query(
      `
        SELECT i.invoice_id, i.invoiceId, i.total_amount, c.email
        FROM invoice i
        INNER JOIN customer c ON c.customer_id = i.customer_id
        WHERE i.invoice_id = ?
        LIMIT 1
      `,
      [invoiceId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Invoice not found." });
    }

    const invoice = rows[0];
    const paymentUrl = `https://pay.stripe.com/test_${Buffer.from(`${invoice.invoiceId}:${invoice.invoice_id}`).toString("base64url")}`;

    res.json({
      message: "Stripe payment link generated.",
      invoice_id: invoice.invoice_id,
      invoiceId: invoice.invoiceId,
      paymentUrl
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to create payment link.",
      detail: error.message
    });
  }
}

async function stripeWebhook(req, res) {
  const invoiceId = Number(req.body.invoice_id);

  if (!invoiceId) {
    return res.status(400).json({ message: "invoice_id is required." });
  }

  req.body.amount = req.body.amount || 0.01;
  req.body.transaction_id = req.body.transaction_id || `STRIPE-${Date.now()}`;
  return recordManualPayment(req, res);
}

module.exports = {
  createStripePaymentLink,
  getPaymentsWorkspace,
  recordManualPayment,
  stripeWebhook
};
