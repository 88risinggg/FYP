/**
 * Subscription Reminder Routes
 *
 * RESTful endpoints for the Subscription Reminders feature.
 * All routes require authentication (JWT) and are available to Admin/Finance roles.
 */

const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/rolesMiddleware");
const {
  getReminders,
  getReminderSummary,
  getReminderById,
  markReminderComplete,
  markReminderDismissed,
  triggerReminderGeneration,
} = require("../controllers/subscriptionReminderController");

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ─── Dashboard summary (widget data) ─────────────────────────────────────────
router.get("/summary", allowRoles("Admin", "Finance"), getReminderSummary);

// ─── List reminders (with filters) ───────────────────────────────────────────
router.get("/", allowRoles("Admin", "Finance"), getReminders);

// ─── Get single reminder ─────────────────────────────────────────────────────
router.get("/:id", allowRoles("Admin", "Finance"), getReminderById);

// ─── Mark reminder as completed ──────────────────────────────────────────────
router.patch("/:id/complete", allowRoles("Admin", "Finance"), markReminderComplete);

// ─── Dismiss reminder ────────────────────────────────────────────────────────
router.patch("/:id/dismiss", allowRoles("Admin", "Finance"), markReminderDismissed);

// ─── Manual generation trigger ───────────────────────────────────────────────
router.post("/generate", allowRoles("Admin", "Finance"), triggerReminderGeneration);

module.exports = router;
