const express = require("express");
const {
  processBulkInvoices,
  validateBulkRows
} = require("../controllers/bulkInvoiceController");
const { authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateToken);
router.post("/validate", validateBulkRows);
router.post("/process", processBulkInvoices);

module.exports = router;
