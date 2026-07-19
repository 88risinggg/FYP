const express = require("express");
const { getInvoiceReports, exportFinancialReport } = require("../controllers/reportController");
const { authenticateToken } = require("../middleware/authMiddleware");
const puppeteer = require("puppeteer-core");

const router = express.Router();

router.use(authenticateToken);
router.get("/invoices", getInvoiceReports);
router.get("/invoices/export", exportFinancialReport);

// Server-side PDF generation from HTML (used by client pdfExportService)
router.post("/generate-pdf", async (req, res) => {
  try {
    const { html, fileName, orientation } = req.body;

    if (!html) {
      return res.status(400).json({ message: "HTML content is required." });
    }

    function getExecutablePath() {
      if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        return process.env.PUPPETEER_EXECUTABLE_PATH;
      }
      if (process.platform === "win32") {
        return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
      }
      if (process.platform === "darwin") {
        return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
      }
      return "/usr/bin/google-chrome";
    }

    const browser = await puppeteer.launch({
      headless: true,
      executablePath: getExecutablePath(),
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      const pdfBuffer = await page.pdf({
        format: "A4",
        landscape: orientation === "landscape",
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
        printBackground: true
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName || "report.pdf"}"`);
      res.send(Buffer.from(pdfBuffer));
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error("[Generate PDF]", err.message);
    res.status(500).json({ message: "PDF generation failed", error: err.message });
  }
});

module.exports = router;
