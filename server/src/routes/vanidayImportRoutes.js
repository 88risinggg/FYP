const express = require("express");
const multer = require("multer");
const { Readable } = require("stream");
const ExcelJS = require("exceljs");
const { authenticateToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/rolesMiddleware");
const {
  getMapping,
  processImport,
  updateMapping,
  validateImport
} = require("../controllers/vanidayImportController");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.use(authenticateToken);

// Field mapping management (Admin only)
router.get("/mapping", allowRoles("Admin"), getMapping);
router.put("/mapping", allowRoles("Admin"), updateMapping);

// Validation and processing (Admin + Finance)
router.post("/validate", allowRoles("Admin", "Finance"), validateImport);
router.post("/process", allowRoles("Admin", "Finance"), processImport);

/**
 * Convert a Buffer to a Readable stream for ExcelJS CSV parsing.
 */
function bufferToStream(buffer) {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

/**
 * POST /api/vaniday-import/parse
 * Parses an uploaded Vaniday CSV/Excel file and returns rows as JSON.
 * Supports .csv and .xlsx formats.
 */
router.post("/parse", allowRoles("Admin", "Finance"), upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded." });
    }

    const workbook = new ExcelJS.Workbook();
    const ext = (req.file.originalname || "").toLowerCase();
    if (!ext.endsWith(".csv") && !ext.endsWith(".xlsx")) {
      return res.status(400).json({ message: "Unsupported file type. Upload a CSV or XLSX file." });
    }

    if (ext.endsWith(".csv")) {
      // ExcelJS CSV uses stream-based reading, not .load()
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
        if (Object.values(rowData).some(v => v !== "")) {
          rows.push(rowData);
        }
      }
    });

    if (headers.length === 0 || headers.some((header) => !header)) {
      return res.status(400).json({ message: "The first row must contain a non-empty header for every imported column." });
    }
    if (new Set(headers.map((header) => header.toLowerCase())).size !== headers.length) {
      return res.status(400).json({ message: "Duplicate column headers were found. Rename each column header to a unique value." });
    }
    if (rows.length > 10000) {
      return res.status(400).json({ message: "Upload exceeds the 10,000-row safety limit. Split the file into smaller batches." });
    }

    res.json({ rows, headers, totalRows: rows.length });
  } catch (error) {
    console.error("[VanidayImport] Parse error:", error.message);
    res.status(500).json({ message: "Failed to parse file.", detail: error.message });
  }
});

module.exports = router;
