/**
 * EVALUATION HEADER
 * FEATURE: INVOICE - ADMIN
 * PURPOSE: Defines the available admin Audit Log Routes API endpoints and connects them to handlers.
 * LAYER: Backend route - maps HTTP methods and URLs to middleware and controller functions.
 * FIND RELATED CODE: Follow the imported controller function to find request handling.
 */
const express = require("express");

const {
  exportAuditLogs,
  getAuditLogs,
  getAuditLogsSummary
} = require("../controllers/auditLogController");
const { authenticateToken, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateToken, requireRole("Admin"));

router.get("/", getAuditLogs);
router.get("/summary", getAuditLogsSummary);
router.get("/export", exportAuditLogs);

module.exports = router;
