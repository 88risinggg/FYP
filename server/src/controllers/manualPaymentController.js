/**
 * Manual Payment Controller
 *
 * Handles the customer manual payment submission workflow.
 * Data is now stored in the payment table (manual_payment_submission was merged into payment).
 *
 * - Customer submits payment proof → payment row with review_status = 'Pending Review'
 * - Invoice moves to "Pending Review" status
 * - Finance reviews and approves/rejects
 * - On approval: invoice moves to "Paid"
 * - On rejection: invoice reverts to Sent
 */

const { pool } = require("../config/db");
const { writeAuditLog, STATUS_AUDIT_PREFIX } = require("./invoiceController");

/**
 * POST /api/public/invoice/:invoiceId/submit-payment
 * Customer submits manual payment proof (no auth required).
 */
async function submitManualPayment(req, res) {
  const { invoiceId } = req.params;
  const { amount, payment_date, reference_number, payment_method, notes } = req.body;

  if (!invoiceId || !amount || !payment_date) {
    return res.status(400).json({
      message: "Invoice ID, payment amount, and payment date are required."
    });
  }

  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ message: "Payment amount must be a positive number." });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [invoiceRows] = await connection.query(
      `SELECT i.invoice_id, i.invoiceId, i.status, i.total_amount,
              c.name AS customer_name, c.email AS customer_email
       FROM invoice i
       INNER JOIN customer c ON c.customer_id = i.customer_id
       WHERE i.invoiceId = ? LIMIT 1 FOR UPDATE`,
      [invoiceId]
    );

    if (invoiceRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Invoice not found." });
    }

    const invoice = invoiceRows[0];

    if (invoice.status === "Paid") {
      await connection.rollback();
      return res.status(400).json({ message: "This invoice has already been paid." });
    }

    if (["Cancelled", "Refunded"].includes(invoice.status)) {
      await connection.rollback();
      return res.status(400).json({ message: "This invoice is no longer active." });
    }

    const proofFileUrl = req.file ? `/uploads/payment-proofs/${req.file.filename}` : null;
    const proofFileName = req.file ? req.file.originalname : null;

    // Insert into payment table using new review columns
    const [result] = await connection.query(
      `INSERT INTO payment
        (invoice_invoice_id, amount, status, payment_date_input, reference_number,
         payment_method_name, proof_file_url, proof_file_name, customer_notes,
         review_status, submitted_at, created_at)
       VALUES (?, ?, 'Pending', ?, ?, ?, ?, ?, ?, 'Pending Review', NOW(), NOW())`,
      [
        invoice.invoice_id,
        String(parsedAmount),
        payment_date,
        reference_number || null,
        payment_method || "Bank Transfer",
        proofFileUrl,
        proofFileName,
        notes || null
      ]
    );

    await connection.query(
      "UPDATE invoice SET status = 'Pending Review' WHERE invoice_id = ?",
      [invoice.invoice_id]
    );

    await writeAuditLog(connection, "payment_submitted", "invoice", invoice.invoice_id, null, {
      newValue: JSON.stringify({ amount: parsedAmount, reference: reference_number, method: payment_method }),
      ipAddress: req.headers["x-forwarded-for"] || req.socket?.remoteAddress || null
    });
    await writeAuditLog(connection, `${STATUS_AUDIT_PREFIX}Pending Review`, "invoice", invoice.invoice_id, null);

    await connection.commit();

    try {
      const { createNotification } = require("../services/invoiceNotificationService");
      createNotification({
        type: "finance_payment_submitted",
        title: "Manual Payment Submitted",
        message: `${invoice.customer_name} submitted a payment of SGD ${parsedAmount.toFixed(2)} for ${invoice.invoiceId}. Review required.`,
        invoiceId: invoice.invoice_id
      }).catch(() => {});
    } catch { /* non-blocking */ }

    res.status(201).json({
      message: "Payment submitted for review.",
      submission_id: result.insertId,
      invoice_status: "Pending Review"
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ message: "Failed to submit payment.", detail: error.message });
  } finally {
    connection.release();
  }
}

/**
 * GET /api/payments/pending-reviews
 * Finance: List all pending payment submissions from the payment table.
 */
async function getPendingReviews(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT
        p.payment_id AS submission_id,
        p.invoice_invoice_id AS invoice_id,
        p.amount,
        p.payment_date_input AS payment_date,
        p.reference_number,
        p.payment_method_name AS payment_method,
        p.proof_file_url,
        p.proof_file_name,
        p.customer_notes,
        p.review_status AS status,
        p.submitted_at,
        p.reviewed_by,
        p.reviewed_at,
        p.review_notes,
        i.invoiceId,
        i.total_amount,
        i.due_date,
        c.name AS customer_name,
        c.email AS customer_email
      FROM payment p
      INNER JOIN invoice i ON i.invoice_id = p.invoice_invoice_id
      INNER JOIN customer c ON c.customer_id = i.customer_id
      WHERE p.review_status IS NOT NULL
      ORDER BY
        CASE p.review_status WHEN 'Pending Review' THEN 0 ELSE 1 END,
        p.submitted_at DESC
      LIMIT 100
    `);

    res.json({ submissions: rows });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch pending reviews.", detail: error.message });
  }
}

/**
 * POST /api/payments/review/:submissionId
 * Finance approves or rejects a manual payment submission.
 * submissionId = payment.payment_id
 */
async function reviewPaymentSubmission(req, res) {
  const submissionId = Number(req.params.submissionId);
  const { decision, notes } = req.body;

  if (!submissionId) return res.status(400).json({ message: "Submission ID is required." });
  if (!["Approved", "Rejected"].includes(decision)) {
    return res.status(400).json({ message: "Decision must be 'Approved' or 'Rejected'." });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [subRows] = await connection.query(
      `SELECT p.*, i.invoiceId, i.total_amount, i.status AS invoice_status,
              c.name AS customer_name, c.email AS customer_email
       FROM payment p
       INNER JOIN invoice i ON i.invoice_id = p.invoice_invoice_id
       INNER JOIN customer c ON c.customer_id = i.customer_id
       WHERE p.payment_id = ? LIMIT 1 FOR UPDATE`,
      [submissionId]
    );

    if (subRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Submission not found." });
    }

    const submission = subRows[0];

    if (submission.review_status !== "Pending Review") {
      await connection.rollback();
      return res.status(400).json({
        message: `This submission has already been ${(submission.review_status || "").toLowerCase()}.`
      });
    }

    const userId = req.user?.userId;

    // Update review status on payment row
    await connection.query(
      `UPDATE payment SET review_status = ?, reviewed_by = ?, reviewed_at = NOW(), review_notes = ? WHERE payment_id = ?`,
      [decision, userId, notes || null, submissionId]
    );

    if (decision === "Approved") {
      const transactionId = submission.reference_number || `MANUAL-${Date.now()}`;

      // Promote payment to Completed
      await connection.query(
        `UPDATE payment SET status = 'Completed', transaction_id = ?, payment_method_name = ? WHERE payment_id = ?`,
        [transactionId, submission.payment_method_name || "Bank Transfer", submissionId]
      );

      await connection.query(
        `UPDATE invoice SET status = 'Paid', payment_date = ?, transaction_id = ?,
         payment_status = 'paid', payment_method = ? WHERE invoice_id = ?`,
        [submission.payment_date_input, transactionId, submission.payment_method_name, submission.invoice_invoice_id]
      );

      await writeAuditLog(connection, `${STATUS_AUDIT_PREFIX}Paid`, "invoice", submission.invoice_invoice_id, userId);
      await writeAuditLog(connection, "payment_approved", "invoice", submission.invoice_invoice_id, userId, {
        previousValue: "Pending Review",
        newValue: JSON.stringify({ amount: submission.amount, reference: transactionId })
      });

      try {
        const { sendPaymentReceiptEmail } = require("../services/invoiceDeliveryService");
        sendPaymentReceiptEmail(
          { invoiceId: submission.invoiceId, total_amount: submission.amount, customer_email: submission.customer_email },
          transactionId
        ).catch(() => {});
      } catch { /* non-blocking */ }
    } else {
      const newStatus = submission.invoice_status === "Pending Review" ? "Sent" : submission.invoice_status;
      await connection.query(
        "UPDATE invoice SET status = ? WHERE invoice_id = ? AND status = 'Pending Review'",
        [newStatus, submission.invoice_invoice_id]
      );
      await writeAuditLog(connection, "payment_rejected", "invoice", submission.invoice_invoice_id, userId, {
        previousValue: "Pending Review",
        newValue: JSON.stringify({ reason: notes || "No reason provided" })
      });
      await writeAuditLog(connection, `${STATUS_AUDIT_PREFIX}${newStatus}`, "invoice", submission.invoice_invoice_id, userId);
    }

    await connection.commit();

    try {
      const { createNotification } = require("../services/invoiceNotificationService");
      const msg = decision === "Approved"
        ? `Payment for ${submission.invoiceId} approved. Invoice marked as Paid.`
        : `Payment for ${submission.invoiceId} rejected. Customer may resubmit.`;
      createNotification({
        type: decision === "Approved" ? "payment_success" : "payment_failed",
        title: `Payment ${decision}`,
        message: msg,
        invoiceId: submission.invoice_invoice_id
      }).catch(() => {});
    } catch { /* non-blocking */ }

    res.json({
      message: `Payment submission ${decision.toLowerCase()}.`,
      submission_id: submissionId,
      decision,
      invoice_status: decision === "Approved" ? "Paid" : "Sent"
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ message: "Failed to process review.", detail: error.message });
  } finally {
    connection.release();
  }
}

module.exports = {
  getPendingReviews,
  reviewPaymentSubmission,
  submitManualPayment
};
