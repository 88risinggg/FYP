/**
 * Manual Payment Controller
 *
 * Handles the customer manual payment submission workflow:
 * - Customer submits payment proof (amount, date, reference, screenshot)
 * - Invoice moves to "Pending Review" status
 * - Finance reviews and approves/rejects
 * - On approval: invoice moves to "Paid", payment record created
 * - On rejection: customer can resubmit
 *
 * Also provides Finance-facing endpoints for reviewing submissions.
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

    // Find the invoice
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

    if (invoice.status === "Cancelled" || invoice.status === "Refunded") {
      await connection.rollback();
      return res.status(400).json({ message: "This invoice is no longer active." });
    }

    // Handle file upload path (if multer provides a file)
    const proofFileUrl = req.file ? `/uploads/payment-proofs/${req.file.filename}` : null;
    const proofFileName = req.file ? req.file.originalname : null;

    // Create submission record
    const [result] = await connection.query(
      `INSERT INTO manual_payment_submission
        (invoice_id, amount, payment_date, reference_number, payment_method,
         proof_file_url, proof_file_name, customer_notes, status, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending Review', NOW())`,
      [
        invoice.invoice_id,
        parsedAmount,
        payment_date,
        reference_number || null,
        payment_method || "Bank Transfer",
        proofFileUrl,
        proofFileName,
        notes || null
      ]
    );

    // Update invoice status to "Pending Review"
    await connection.query(
      "UPDATE invoice SET status = 'Pending Review' WHERE invoice_id = ?",
      [invoice.invoice_id]
    );

    // Audit log
    await writeAuditLog(
      connection,
      "payment_submitted",
      "invoice",
      invoice.invoice_id,
      null,
      {
        newValue: JSON.stringify({ amount: parsedAmount, reference: reference_number, method: payment_method }),
        ipAddress: req.headers["x-forwarded-for"] || req.socket?.remoteAddress || null
      }
    );

    await writeAuditLog(
      connection,
      `${STATUS_AUDIT_PREFIX}Pending Review`,
      "invoice",
      invoice.invoice_id,
      null
    );

    await connection.commit();

    // Notify Finance (non-blocking)
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
    res.status(500).json({
      message: "Failed to submit payment.",
      detail: error.message
    });
  } finally {
    connection.release();
  }
}

/**
 * GET /api/payments/pending-reviews
 * Finance endpoint: List all pending payment submissions.
 */
async function getPendingReviews(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT
        mps.submission_id,
        mps.invoice_id,
        mps.amount,
        mps.payment_date,
        mps.reference_number,
        mps.payment_method,
        mps.proof_file_url,
        mps.proof_file_name,
        mps.customer_notes,
        mps.status,
        mps.submitted_at,
        mps.reviewed_by,
        mps.reviewed_at,
        mps.review_notes,
        i.invoiceId,
        i.total_amount,
        i.due_date,
        c.name AS customer_name,
        c.email AS customer_email
      FROM manual_payment_submission mps
      INNER JOIN invoice i ON i.invoice_id = mps.invoice_id
      INNER JOIN customer c ON c.customer_id = i.customer_id
      ORDER BY
        CASE mps.status WHEN 'Pending Review' THEN 0 ELSE 1 END,
        mps.submitted_at DESC
      LIMIT 100
    `);

    res.json({ submissions: rows });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      return res.json({ submissions: [] });
    }
    res.status(500).json({
      message: "Failed to fetch pending reviews.",
      detail: error.message
    });
  }
}

/**
 * POST /api/payments/review/:submissionId
 * Finance approves or rejects a manual payment submission.
 *
 * Body: { decision: "Approved"|"Rejected", notes: "" }
 */
async function reviewPaymentSubmission(req, res) {
  const submissionId = Number(req.params.submissionId);
  const { decision, notes } = req.body;

  if (!submissionId) {
    return res.status(400).json({ message: "Submission ID is required." });
  }

  if (!["Approved", "Rejected"].includes(decision)) {
    return res.status(400).json({ message: "Decision must be 'Approved' or 'Rejected'." });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Lock and fetch the submission
    const [subRows] = await connection.query(
      `SELECT mps.*, i.invoiceId, i.total_amount, i.status AS invoice_status,
              c.name AS customer_name, c.email AS customer_email
       FROM manual_payment_submission mps
       INNER JOIN invoice i ON i.invoice_id = mps.invoice_id
       INNER JOIN customer c ON c.customer_id = i.customer_id
       WHERE mps.submission_id = ? LIMIT 1 FOR UPDATE`,
      [submissionId]
    );

    if (subRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Submission not found." });
    }

    const submission = subRows[0];

    if (submission.status !== "Pending Review") {
      await connection.rollback();
      return res.status(400).json({
        message: `This submission has already been ${submission.status.toLowerCase()}.`
      });
    }

    const userId = req.user?.userId;

    // Update submission status
    await connection.query(
      `UPDATE manual_payment_submission
       SET status = ?, reviewed_by = ?, reviewed_at = NOW(), review_notes = ?
       WHERE submission_id = ?`,
      [decision, userId, notes || null, submissionId]
    );

    if (decision === "Approved") {
      // Create payment record
      const transactionId = submission.reference_number || `MANUAL-${Date.now()}`;
      await connection.query(
        `INSERT INTO payment (payment_date, amount, status, transaction_id, invoice_invoice_id, payment_method_name)
         VALUES (?, ?, 'Completed', ?, ?, ?)`,
        [
          submission.payment_date,
          String(submission.amount),
          transactionId,
          submission.invoice_id,
          submission.payment_method || "Bank Transfer"
        ]
      );

      // Update invoice to Paid
      await connection.query(
        `UPDATE invoice SET status = 'Paid', payment_date = ?, transaction_id = ?,
         payment_status = 'paid', payment_method = ?
         WHERE invoice_id = ?`,
        [submission.payment_date, transactionId, submission.payment_method, submission.invoice_id]
      );

      await writeAuditLog(connection, `${STATUS_AUDIT_PREFIX}Paid`, "invoice", submission.invoice_id, userId);
      await writeAuditLog(connection, "payment_approved", "invoice", submission.invoice_id, userId, {
        previousValue: "Pending Review",
        newValue: JSON.stringify({ amount: submission.amount, reference: transactionId })
      });

      // Send receipt email (non-blocking)
      try {
        const { sendPaymentReceiptEmail } = require("../services/invoiceDeliveryService");
        sendPaymentReceiptEmail(
          { invoiceId: submission.invoiceId, total_amount: submission.amount, customer_email: submission.customer_email },
          transactionId
        ).catch(() => {});
      } catch { /* non-blocking */ }
    } else {
      // Rejected — revert invoice to previous sendable status
      const newStatus = submission.invoice_status === "Pending Review" ? "Sent" : submission.invoice_status;
      await connection.query(
        "UPDATE invoice SET status = ? WHERE invoice_id = ? AND status = 'Pending Review'",
        [newStatus, submission.invoice_id]
      );

      await writeAuditLog(connection, "payment_rejected", "invoice", submission.invoice_id, userId, {
        previousValue: "Pending Review",
        newValue: JSON.stringify({ reason: notes || "No reason provided" })
      });
      await writeAuditLog(connection, `${STATUS_AUDIT_PREFIX}${newStatus}`, "invoice", submission.invoice_id, userId);
    }

    await connection.commit();

    // Notify
    try {
      const { createNotification } = require("../services/invoiceNotificationService");
      const msg = decision === "Approved"
        ? `Payment for ${submission.invoiceId} approved. Invoice marked as Paid.`
        : `Payment for ${submission.invoiceId} rejected. Customer may resubmit.`;
      createNotification({
        type: decision === "Approved" ? "payment_success" : "payment_failed",
        title: `Payment ${decision}`,
        message: msg,
        invoiceId: submission.invoice_id
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
    res.status(500).json({
      message: "Failed to process review.",
      detail: error.message
    });
  } finally {
    connection.release();
  }
}

module.exports = {
  getPendingReviews,
  reviewPaymentSubmission,
  submitManualPayment
};
