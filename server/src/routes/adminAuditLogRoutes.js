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
