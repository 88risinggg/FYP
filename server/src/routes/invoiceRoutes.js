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
const { generateInvoicePDF } = require("../services/pdfService");
const { sendWhatsAppReminder } = require("../services/whatsappService");
const { pool } = require("../config/db");

const router = express.Router();

router.use(authenticateToken);

router.get("/", getInvoices);
router.get("/customers", getCustomers);
router.get("/next-number", getNextInvoiceNumber);
router.post("/", createInvoice);
router.post("/schedule", scheduleInvoices);
router.post("/:id/send", sendInvoice);

/**
 * GET /api/invoices/:id/pdf
 * Download invoice as PDF.
 */
router.get("/:id/pdf", async (req, res) => {
  try {
    const invoiceId = Number(req.params.id);
    const [rows] = await pool.query(
      `SELECT i.invoice_id, i.invoiceId, i.status, i.issue_date, i.due_date, i.total_amount,
              c.name AS customer_name, c.email AS customer_email, c.address AS customer_address
       FROM invoice i INNER JOIN customer c ON c.customer_id = i.customer_id
       WHERE i.invoice_id = ? LIMIT 1`,
      [invoiceId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Invoice not found." });
    }

    const invoice = rows[0];
    const [items] = await pool.query(
      "SELECT description, quantity, unit_price, amount FROM invoice_item WHERE invoice_invoice_id = ?",
      [invoiceId]
    );
    invoice.items = items;

    const pdfBuffer = await generateInvoicePDF(invoice);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${invoice.invoiceId}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ message: "Failed to generate PDF.", detail: error.message });
  }
});

/**
 * POST /api/invoices/:id/whatsapp
 * Send WhatsApp reminder for an invoice.
 */
router.post("/:id/whatsapp", async (req, res) => {
  try {
    const invoiceId = Number(req.params.id);
    const [rows] = await pool.query(
      `SELECT i.invoiceId, i.total_amount, i.due_date, c.name AS customer_name, c.email AS customer_email
       FROM invoice i INNER JOIN customer c ON c.customer_id = i.customer_id
       WHERE i.invoice_id = ? LIMIT 1`,
      [invoiceId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Invoice not found." });
    }

    const invoice = rows[0];
    const phone = req.body.phone || "+6500000000"; // Customer phone from request or default

    const result = await sendWhatsAppReminder({
      to: phone,
      invoiceId: invoice.invoiceId,
      customerName: invoice.customer_name,
      amount: invoice.total_amount,
      dueDate: invoice.due_date
    });

    res.json({ message: "WhatsApp notification sent.", result });
  } catch (error) {
    res.status(500).json({ message: "Failed to send WhatsApp.", detail: error.message });
  }
});

module.exports = router;
