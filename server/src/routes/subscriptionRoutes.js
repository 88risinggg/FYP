/**
 * Subscription Routes
 *
 * RESTful endpoints for subscription management.
 * All routes require authentication (JWT) and are available to Admin/Finance roles.
 *
 * Subscriptions are created exclusively through the bulk import process.
 * Finance users cannot manually create subscriptions — they import them
 * from external business systems (CRM, Sales, ERP) via CSV/Excel upload.
 */

const express = require("express");
const multer = require("multer");
const { Readable } = require("stream");
const ExcelJS = require("exceljs");
const { authenticateToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/rolesMiddleware");
const {
  getSubscriptions,
  getSubscriptionById,
  getSubscriptionDashboard,
  getSubscriptionInvoices,
  getSubscriptionPayments,
  updateSubscriptionHandler,
  pauseSubscriptionHandler,
  resumeSubscriptionHandler,
  cancelSubscriptionHandler,
  deleteSubscriptionHandler,
  generateInvoiceNowHandler,
} = require("../controllers/subscriptionController");
const {
  validateSubscriptionRows,
  processSubscriptionImport,
  getSubscriptionTemplate,
} = require("../controllers/bulkSubscriptionController");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// All routes require authentication
router.use(authenticateToken);

// ─── Dashboard ────────────────────────────────────────────────────────────────
router.get("/dashboard", allowRoles("Admin", "Finance"), getSubscriptionDashboard);

// ─── Bulk Import (primary method for adding subscriptions) ────────────────────

/**
 * POST /api/subscriptions/import/parse
 * Parses an uploaded subscription CSV/Excel file and returns rows as JSON.
 */
function bufferToStream(buffer) {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

router.post("/import/parse", allowRoles("Admin", "Finance"), upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded." });
    }

    const workbook = new ExcelJS.Workbook();
    const ext = (req.file.originalname || "").toLowerCase();

    if (!ext.endsWith(".csv") && !ext.endsWith(".xlsx") && !ext.endsWith(".xls")) {
      return res.status(400).json({ message: "Unsupported file type. Upload a CSV, XLSX, or XLS file." });
    }

    if (ext.endsWith(".csv")) {
      const stream = bufferToStream(req.file.buffer);
      await workbook.csv.read(stream);
    } else {
      await workbook.xlsx.load(req.file.buffer);
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return res.json({ rows: [], headers: [] });
    }

    const rows = [];
    const headers = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        row.eachCell((cell) => {
          headers.push(String(cell.value || "").trim());
        });
      } else {
        const rowData = {};
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const header = headers[colNumber - 1];
          if (header) {
            rowData[header] = cell.value != null ? String(cell.value) : "";
          }
        });
        if (Object.values(rowData).some((v) => v !== "")) {
          rows.push(rowData);
        }
      }
    });

    res.json({ rows, headers, fileName: req.file.originalname });
  } catch (error) {
    res.status(500).json({ message: "Failed to parse subscription file.", detail: error.message });
  }
});

router.post("/import/validate", allowRoles("Admin", "Finance"), validateSubscriptionRows);
router.post("/import/confirm",  allowRoles("Admin", "Finance"), processSubscriptionImport);
router.get("/import/template",  allowRoles("Admin", "Finance"), getSubscriptionTemplate);

// ─── Read ─────────────────────────────────────────────────────────────────────
router.get("/",    allowRoles("Admin", "Finance"), getSubscriptions);
router.get("/:id", allowRoles("Admin", "Finance"), getSubscriptionById);

// ─── Update (edit imported subscription details) ──────────────────────────────
router.put("/:id", allowRoles("Admin", "Finance"), updateSubscriptionHandler);
router.delete("/:id", allowRoles("Admin", "Finance"), deleteSubscriptionHandler);

// ─── Status transitions ──────────────────────────────────────────────────────
router.patch("/:id/pause",  allowRoles("Admin", "Finance"), pauseSubscriptionHandler);
router.patch("/:id/resume", allowRoles("Admin", "Finance"), resumeSubscriptionHandler);
router.patch("/:id/cancel", allowRoles("Admin", "Finance"), cancelSubscriptionHandler);

// ─── Manual invoice generation override ──────────────────────────────────────
router.post("/:id/generate-invoice", allowRoles("Admin", "Finance"), generateInvoiceNowHandler);

// ─── Related data ────────────────────────────────────────────────────────────
router.get("/:id/invoices", allowRoles("Admin", "Finance"), getSubscriptionInvoices);
router.get("/:id/payments", allowRoles("Admin", "Finance"), getSubscriptionPayments);

module.exports = router;
