/**
 * EVALUATION HEADER
 * FEATURE: SHARED / APPLICATION CORE
 * PURPOSE: Defines the available audit Log Routes API endpoints and connects them to handlers.
 * LAYER: Backend route - maps HTTP methods and URLs to middleware and controller functions.
 * FIND RELATED CODE: Follow the imported controller function to find request handling.
 */
/**
 * auditLogRoutes.js
 *
 * General audit log API — supports ?module= filtering.
 *
 * GET  /api/audit-logs              — list (paginated, filterable by module)
 * GET  /api/audit-logs/summary      — summary stats
 * GET  /api/audit-logs/export       — CSV export
 *
 * Finance role: can access Invoice module logs
 * HR / Payroll roles: can access their own module logs
 * Admin: can access all logs
 */

const express = require("express");
const { authenticateToken, requireRole } = require("../middleware/authMiddleware");
const {
  getAuditLogs,
  getAuditLogsSummary,
  exportAuditLogs,
} = require("../controllers/auditLogController");

const router = express.Router();

// Admin-only — audit logs are not visible to other roles
router.use(authenticateToken, requireRole("Admin"));

router.get("/",        getAuditLogs);
router.get("/summary", getAuditLogsSummary);
router.get("/export",  exportAuditLogs);

module.exports = router;
