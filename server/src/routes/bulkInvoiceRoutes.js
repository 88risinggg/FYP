/**
 * EVALUATION HEADER
 * FEATURE: INVOICE - SHARED
 * PURPOSE: Defines the available bulk Invoice Routes API endpoints and connects them to handlers.
 * LAYER: Backend route - maps HTTP methods and URLs to middleware and controller functions.
 * FIND RELATED CODE: Follow the imported controller function to find request handling.
 */
const express = require("express");
const multer = require("multer");
const ExcelJS = require("exceljs");
const {
  processBulkInvoices,
  validateBulkRows
} = require("../controllers/bulkInvoiceController");
const { authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authenticateToken);
router.post("/validate", validateBulkRows);
router.post("/process", processBulkInvoices);

// Serve sample Excel template for bulk invoice upload
router.get("/template", (req, res) => {
  const path = require("path");
  const templatePath = path.join(__dirname, "..", "..", "uploads", "templates", "sample_invoice_upload_template.xlsx");
  res.download(templatePath, "sample_invoice_upload_template.xlsx", (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ message: "Template file not found." });
    }
  });
});

// Parse uploaded Excel file and return rows as JSON (replaces client-side xlsx parsing)
router.post("/parse-excel", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded." });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return res.json([]);
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
        if (Object.values(rowData).some(v => v !== "")) {
          rows.push(rowData);
        }
      }
    });

    return res.json(rows);
  } catch (err) {
    console.error("[Parse Excel]", err.message);
    return res.status(500).json({ message: "Failed to parse Excel file.", error: err.message });
  }
});

module.exports = router;
