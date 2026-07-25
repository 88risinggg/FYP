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
} = require("../controllers/financeReminderController");

const router = express.Router();

router.use(authenticateToken);

// ─── Read ─────────────────────────────────────────────────────────────────────
router.get("/",        allowRoles("Admin", "Finance"), getFinanceReminders);
router.get("/summary", allowRoles("Admin", "Finance"), getFinanceRemindersSummary);

// ─── Actions ──────────────────────────────────────────────────────────────────
router.patch("/:id/complete", allowRoles("Admin", "Finance"), completeReminderHandler);
router.patch("/:id/dismiss",  allowRoles("Admin", "Finance"), dismissReminderHandler);

module.exports = router;
