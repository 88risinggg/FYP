const express = require("express");
const { getInvoiceReports, exportFinancialReport } = require("../controllers/reportController");
const { authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateToken);
router.get("/invoices", getInvoiceReports);
router.get("/invoices/export", exportFinancialReport);

module.exports = router;
