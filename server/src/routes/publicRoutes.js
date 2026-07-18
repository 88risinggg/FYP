/**
 * Public Routes
 *
 * Customer-facing endpoints that do NOT require authentication.
 * Used for invoice viewing, payment landing pages, and receipt downloads.
 */

const express = require("express");
const { viewInvoice } = require("../controllers/publicInvoiceController");
const { pool } = require("../config/db");

const router = express.Router();

/**
 * GET /api/public/invoice/:invoiceId
 * Customer views their invoice (marks as "Viewed" if status is "Sent").
 */
router.get("/invoice/:invoiceId", viewInvoice);

/**
 * GET /api/public/invoice/:invoiceId/receipt
 * Customer downloads payment receipt (only available for Paid invoices).
 */
router.get("/invoice/:invoiceId/receipt", async (req, res) => {
  const { invoiceId } = req.params;

  try {
    const [rows] = await pool.query(`
      SELECT
        i.invoice_id, i.invoiceId, i.status, i.total_amount,
        i.payment_date, i.transaction_id, i.payment_method,
        i.issue_date, i.due_date,
        c.name AS customer_name, c.email AS customer_email
      FROM invoice i
      INNER JOIN customer c ON c.customer_id = i.customer_id
      WHERE i.invoiceId = ? LIMIT 1
    `, [invoiceId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Invoice not found." });
    }

    const invoice = rows[0];
    if (invoice.status !== "Paid") {
      return res.status(400).json({ message: "Receipt is only available for paid invoices." });
    }

    // Fetch payment record
    const [payments] = await pool.query(`
      SELECT p.payment_date, p.amount, p.transaction_id, pm.name AS payment_method
      FROM payment p
      LEFT JOIN payment_method pm ON pm.payment_method_id = p.payment_method_id
      WHERE p.invoice_invoice_id = ?
      ORDER BY p.payment_date DESC LIMIT 1
    `, [invoice.invoice_id]);

    const payment = payments[0] || {};

    res.json({
      receipt: {
        invoiceId: invoice.invoiceId,
        customerName: invoice.customer_name,
        customerEmail: invoice.customer_email,
        amount: invoice.total_amount,
        paymentDate: payment.payment_date || invoice.payment_date,
        transactionId: payment.transaction_id || invoice.transaction_id,
        paymentMethod: payment.payment_method || invoice.payment_method || "Stripe",
        issueDate: invoice.issue_date,
        dueDate: invoice.due_date,
        status: "Paid"
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Unable to generate receipt.", detail: error.message });
  }
});

/**
 * GET /api/public/invoice/:invoiceId/payments
 * Customer views payment history for their invoice.
 */
router.get("/invoice/:invoiceId/payments", async (req, res) => {
  const { invoiceId } = req.params;

  try {
    const [invoiceRows] = await pool.query(
      "SELECT invoice_id, status FROM invoice WHERE invoiceId = ? LIMIT 1",
      [invoiceId]
    );

    if (invoiceRows.length === 0) {
      return res.status(404).json({ message: "Invoice not found." });
    }

    const [payments] = await pool.query(`
      SELECT p.payment_date, p.amount, p.status, p.transaction_id, pm.name AS payment_method
      FROM payment p
      LEFT JOIN payment_method pm ON pm.payment_method_id = p.payment_method_id
      WHERE p.invoice_invoice_id = ?
      ORDER BY p.payment_date DESC
    `, [invoiceRows[0].invoice_id]);

    res.json({ payments, invoiceStatus: invoiceRows[0].status });
  } catch (error) {
    res.status(500).json({ message: "Unable to fetch payment history.", detail: error.message });
  }
});

module.exports = router;
