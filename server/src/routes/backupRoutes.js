/**
 * EVALUATION HEADER
 * FEATURE: SHARED / APPLICATION CORE
 * PURPOSE: Defines the available backup Routes API endpoints and connects them to handlers.
 * LAYER: Backend route - maps HTTP methods and URLs to middleware and controller functions.
 * FIND RELATED CODE: Follow the imported controller function to find request handling.
 */
const express = require("express");
const { authenticateToken, requireRole } = require("../middleware/authMiddleware");
const {
  triggerBackup,
  getBackups,
  getAvailableTables,
  downloadBackup,
  removeBackup,
  restoreFromBackup
} = require("../controllers/backupController");

const router = express.Router();

// All backup routes require Admin authentication
router.use(authenticateToken);
router.use(requireRole("Admin"));

router.get("/", getBackups);
router.post("/", triggerBackup);
router.get("/tables", getAvailableTables);
router.get("/:id/download", downloadBackup);
router.delete("/:id", removeBackup);
router.post("/:id/restore", restoreFromBackup);

module.exports = router;
