/**
 * Public Invoice Controller
 *
 * Handles customer-facing invoice viewing (no authentication required).
 * When a customer opens their invoice link, the status is updated to "Viewed"
 * if it was previously "Sent".
 */

const { pool } = require("../config/db");

/**
 * GET /api/public/invoice/:invoiceId
 *
 * Public endpoint for customers to view their invoice.
 * Updates status from "Sent" to "Viewed" on first access.
 * Returns invoice details with line items for display.
 *
 * @param {string} req.params.invoiceId - The human-readable invoice ID (e.g., INV-0001)
 */
async function viewInvoice(req, res) {
  const { invoiceId } = req.params;

  if (!invoiceId) {
    return res.status(400).json({ message: "Invoice ID is required." });
  }

  try {
    const [rows] = await pool.query(
      `SELECT
        i.invoice_id,
        i.invoiceId,
        i.status,
        i.issue_date,
        i.due_date,
        i.total_amount,
        i.created_at,
        c.name AS customer_name,
        c.email AS customer_email,
        c.address AS customer_address
      FROM invoice i
      INNER JOIN customer c ON c.customer_id = i.customer_id
      WHERE i.invoiceId = ?
      LIMIT 1`,
      [invoiceId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Invoice not found." });
    }

    const invoice = rows[0];

    // Fetch line items
    const [items] = await pool.query(
      "SELECT description, quantity, unit_price, amount FROM invoice_item WHERE invoice_invoice_id = ?",
      [invoice.invoice_id]
    );
    invoice.items = items;

    // Update status to "Viewed" if currently "Sent"
    if (invoice.status === "Sent") {
      await pool.query(
        "UPDATE invoice SET status = 'Viewed' WHERE invoice_id = ? AND status = 'Sent'",
        [invoice.invoice_id]
      );
      invoice.status = "Viewed";

      // Record audit log for status change
      try {
        await pool.query(
          `INSERT INTO audit_log (user_id, user_name, activity_type, action_description, affected_record, status, created_at)
           VALUES (NULL, 'Customer', 'Invoice Status', 'Invoice viewed by customer', ?, 'Success', NOW())`,
          [invoice.invoiceId]
        );
      } catch { /* non-critical */ }
    }

    // Return invoice data for public display
    res.json({
      invoice: {
        invoiceId: invoice.invoiceId,
        status: invoice.status,
        issue_date: invoice.issue_date,
        due_date: invoice.due_date,
        total_amount: invoice.total_amount,
        customer_name: invoice.customer_name,
        customer_email: invoice.customer_email,
        customer_address: invoice.customer_address,
        items: invoice.items
      }
    });
  } catch (error) {
    res.status(500).json({
      message: "Unable to load invoice.",
      detail: error.message
    });
  }
}

module.exports = { viewInvoice };
