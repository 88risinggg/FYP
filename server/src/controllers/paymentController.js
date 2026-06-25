/**
 * Payment Controller
 *
 * Handles payment processing including:
 * - Outstanding invoices workspace view
 * - Manual bank transfer payment recording
 * - Stripe payment link generation
 * - Stripe webhook handling
 *
 * Integrates with fraud detection to block high-risk payments.
 */

const { pool } = require("../config/db");
const { toCurrencyNumber, writeAuditLog } = require("./invoiceController");

/**
 * Ensures a payment method exists in the database.
 * Creates it if not found. Returns the payment_method_id.
 *
 * @param {Object} connection - MySQL connection (from pool.getConnection).
 * @param {string} methodName - Name of the payment method (e.g. "Bank Transfer", "Stripe").
 * @returns {number} The payment_method_id.
 */
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

/**
 * Checks if an invoice is eligible for payment based on fraud assessment.
 * High-risk invoices that haven't been manually approved are blocked.
 *
 * @param {Object} connection - MySQL connection or pool.
 * @param {number} invoiceId - The invoice primary key.
 * @returns {Object} { allowed: boolean, message?: string }
 */
async function ensureInvoiceCanBePaid(connection, invoiceId) {
  const [rows] = await connection.query(
    `
      SELECT risk_score, risk_level, review_status
      FROM invoice_fraud_assessment
      WHERE invoice_id = ?
      LIMIT 1
    `,
    [invoiceId]
  );

  const assessment = rows[0];
  if (assessment?.risk_level === "High" && assessment.review_status !== "Approved") {
    return {
      allowed: false,
      message: "High-risk invoices require manual fraud review before payment processing."
    };
  }

  return { allowed: true };
}

/**
 * GET /api/payments
 *
 * Returns the payment workspace data:
 * - Outstanding (unpaid) invoices sorted by due date
 * - Recent payment records (last 25)
 *
 * Used by the Finance Payments view to display pending and completed payments.
 */
async function getPaymentsWorkspace(req, res) {
  try {
    // Fetch all unpaid invoices with customer details
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

    // Fetch recent payments with method and invoice details
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

/**
 * POST /api/payments/manual
 *
 * Records a manual bank transfer payment for an invoice.
 * Updates the invoice status to "Paid" and creates audit log entries.
 * Validates against fraud assessment before allowing payment.
 *
 * Request body: { invoice_id: number, amount: number, transaction_id?: string }
 * Success response: 201 with payment_id.
 * Error responses: 400 (validation), 404 (invoice not found), 500 (server error).
 */
async function recordManualPayment(req, res) {
  const invoiceId = Number(req.body.invoice_id);
  const amount = toCurrencyNumber(req.body.amount);
  const transactionId = String(req.body.transaction_id || "").trim() || `MANUAL-${Date.now()}`;

  // Validate required fields
  if (!invoiceId || amount <= 0) {
    return res.status(400).json({ message: "Invoice and positive payment amount are required." });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Lock invoice row to prevent concurrent payment
    const [invoiceRows] = await connection.query(
      "SELECT invoice_id, total_amount FROM invoice WHERE invoice_id = ? LIMIT 1 FOR UPDATE",
      [invoiceId]
    );

    if (invoiceRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Invoice not found." });
    }

    // Check fraud assessment allows payment
    const paymentCheck = await ensureInvoiceCanBePaid(connection, invoiceId);
    if (!paymentCheck.allowed) {
      await connection.rollback();
      return res.status(400).json({ message: paymentCheck.message });
    }

    // Get or create payment method record
    const paymentMethodId = await ensurePaymentMethod(connection, "Bank Transfer");

    // Insert payment record
    const [paymentResult] = await connection.query(
      `
        INSERT INTO payment
          (payment_date, amount, status, transaction_id, invoice_invoice_id, payment_method_id)
        VALUES (NOW(), ?, 'Completed', ?, ?, ?)
      `,
      [String(amount), transactionId, invoiceId, paymentMethodId]
    );

    // Update invoice status to Paid
    await connection.query(
      "UPDATE invoice SET status = 'Paid' WHERE invoice_id = ?",
      [invoiceId]
    );

    // Write audit logs for payment and status change
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

/**
 * POST /api/payments/stripe-link
 *
 * Generates a Stripe payment link for an invoice.
 * Validates against fraud assessment before generating link.
 * Currently returns a mock/test Stripe URL (production would use Stripe SDK).
 *
 * Request body: { invoice_id: number }
 * Success response: { paymentUrl: string, invoice_id, invoiceId }
 */
async function createStripePaymentLink(req, res) {
  const invoiceId = Number(req.body.invoice_id);

  if (!invoiceId) {
    return res.status(400).json({ message: "Invoice is required." });
  }

  try {
    // Fetch invoice with customer email for Stripe
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

    // Validate against fraud rules
    const paymentCheck = await ensureInvoiceCanBePaid(pool, invoiceId);
    if (!paymentCheck.allowed) {
      return res.status(400).json({ message: paymentCheck.message });
    }

    // Generate test payment URL (replace with real Stripe SDK in production)
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

/**
 * POST /api/payments/stripe/webhook
 *
 * Handles incoming Stripe webhook events.
 * Processes successful payment notifications by recording the payment.
 * In production, would verify Stripe webhook signatures.
 *
 * Request body: { invoice_id: number, amount?: number, transaction_id?: string }
 */
async function stripeWebhook(req, res) {
  const invoiceId = Number(req.body.invoice_id);

  if (!invoiceId) {
    return res.status(400).json({ message: "invoice_id is required." });
  }

  // Set defaults and delegate to manual payment recording
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
