const express = require("express");
const { getInvoiceReports } = require("../controllers/reportController");
const { exportReportExcel, exportReportCsv } = require("../controllers/exportController");
const { authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateToken);
router.get("/invoices", getInvoiceReports);
router.get("/invoices/export/excel", exportReportExcel);
router.get("/invoices/export/csv", exportReportCsv);

module.exports = router;
