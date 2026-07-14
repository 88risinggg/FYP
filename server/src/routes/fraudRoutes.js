const express = require("express");
const {
  getFraudDashboard,
  reassessInvoice,
  reviewInvoice,
  sendFraudReportNotification,
  flagInvalidRows
} = require("../controllers/fraudController");
const { authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateToken);
router.get("/dashboard", getFraudDashboard);
router.post("/invoices/:id/reassess", reassessInvoice);
router.post("/invoices/:id/review", reviewInvoice);
router.post("/report-notification", sendFraudReportNotification);
router.post("/flag-invalid-rows", flagInvalidRows);

module.exports = router;
