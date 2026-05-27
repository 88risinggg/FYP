const express = require("express");
const { getInvoiceReports } = require("../controllers/reportController");
const { authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateToken);
router.get("/invoices", getInvoiceReports);

module.exports = router;
