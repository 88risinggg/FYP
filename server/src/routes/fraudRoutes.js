/**
 * EVALUATION HEADER
 * FEATURE: INVOICE - SHARED
 * PURPOSE: Defines the available fraud Routes API endpoints and connects them to handlers.
 * LAYER: Backend route - maps HTTP methods and URLs to middleware and controller functions.
 * FIND RELATED CODE: Follow the imported controller function to find request handling.
 */
const express = require("express");
const {
  getFraudDashboard,
  reassessInvoice,
  reviewInvoice
} = require("../controllers/fraudController");
const { authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateToken);
router.get("/dashboard", getFraudDashboard);
router.post("/invoices/:id/reassess", reassessInvoice);
router.post("/invoices/:id/review", reviewInvoice);

module.exports = router;
