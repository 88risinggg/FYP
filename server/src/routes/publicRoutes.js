/**
 * Public Routes
 *
 * Customer-facing endpoints that do NOT require authentication.
 * Used for invoice viewing and payment landing pages.
 */

const express = require("express");
const { viewInvoice } = require("../controllers/publicInvoiceController");

const router = express.Router();

/**
 * GET /api/public/invoice/:invoiceId
 * Customer views their invoice (marks as "Viewed" if status is "Sent").
 */
router.get("/invoice/:invoiceId", viewInvoice);

module.exports = router;
