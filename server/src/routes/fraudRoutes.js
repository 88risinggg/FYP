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
