/**
 * EVALUATION HEADER
 * FEATURE: INVOICE - FINANCE
 * PURPOSE: Defines the available finance Reminder Routes API endpoints and connects them to handlers.
 * LAYER: Backend route - maps HTTP methods and URLs to middleware and controller functions.
 * FIND RELATED CODE: Follow the imported controller function to find request handling.
 */
/**
 * Finance Reminder Routes
 *
 * Unified reminder endpoints for Finance users to manage all invoice
 * and subscription reminders with filtering, search, and resolution.
 */

const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/rolesMiddleware");
const {
  getFinanceReminders,
  getFinanceRemindersSummary,
  completeReminderHandler,
  dismissReminderHandler,
  generateRemindersHandler,
} = require("../controllers/financeReminderController");

const router = express.Router();

router.use(authenticateToken);

// ─── Read ─────────────────────────────────────────────────────────────────────
router.get("/",        allowRoles("Admin", "Finance"), getFinanceReminders);
router.get("/summary", allowRoles("Admin", "Finance"), getFinanceRemindersSummary);

// ─── Actions ──────────────────────────────────────────────────────────────────
router.patch("/:id/complete", allowRoles("Admin", "Finance"), completeReminderHandler);
router.patch("/:id/dismiss",  allowRoles("Admin", "Finance"), dismissReminderHandler);
router.post("/generate",      allowRoles("Admin", "Finance"), generateRemindersHandler);

module.exports = router;
