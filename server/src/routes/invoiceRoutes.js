const express = require("express");
const {
  createInvoice,
  getCustomers,
  getInvoices,
  getNextInvoiceNumber,
  scheduleInvoices,
  sendInvoice
} = require("../controllers/invoiceController");
const { authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateToken);

router.get("/", getInvoices);
router.get("/customers", getCustomers);
router.get("/next-number", getNextInvoiceNumber);
router.post("/", createInvoice);
router.post("/schedule", scheduleInvoices);
router.post("/:id/send", sendInvoice);

module.exports = router;
