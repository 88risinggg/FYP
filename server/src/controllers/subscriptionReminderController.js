/**
 * Subscription Reminder Controller
 *
 * Handles API endpoints for the Subscription Reminders feature.
 * Finance users can view, filter, complete, and dismiss reminders.
 * Also provides dashboard summary and manual/scheduled generation.
 */

const { getCompanyId } = require("../utils/companyScope");
const {
  findAllReminders,
  findReminderById,
  getReminderDashboardSummary,
  completeReminder,
  dismissReminder,
  generateScheduledReminders,
  REMINDER_TYPE_LABELS,
} = require("../models/subscriptionReminderModel");

// ─── GET /api/subscription-reminders ──────────────────────────────────────────

async function getReminders(req, res) {
  try {
    const companyId = getCompanyId(req);
    const filters = {
      status:       req.query.status       || null,
      priority:     req.query.priority     || null,
      reminderType: req.query.reminderType || null,
      search:       req.query.search       || null,
    };

    const reminders = await findAllReminders(companyId, filters);

    // Enrich with human-readable labels
    const enriched = reminders.map((r) => ({
      ...r,
      reminder_type_label: REMINDER_TYPE_LABELS[r.reminder_type] || r.reminder_type,
    }));

    res.json({ reminders: enriched });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      return res.json({ reminders: [] });
    }
    res.status(500).json({ message: "Failed to fetch subscription reminders.", detail: error.message });
  }
}

// ─── GET /api/subscription-reminders/summary ──────────────────────────────────

async function getReminderSummary(req, res) {
  try {
    const companyId = getCompanyId(req);
    const summary = await getReminderDashboardSummary(companyId);
    res.json(summary);
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      return res.json({
        renewals_due_today: 0,
        renewals_due_this_week: 0,
        expired_subscriptions: 0,
        failed_invoice_generations: 0,
        failed_payments: 0,
        total_active: 0,
      });
    }
    res.status(500).json({ message: "Failed to fetch reminder summary.", detail: error.message });
  }
}

// ─── GET /api/subscription-reminders/:id ──────────────────────────────────────

async function getReminderById(req, res) {
  try {
    const reminderId = Number(req.params.id);
    if (!reminderId) {
      return res.status(400).json({ message: "Invalid reminder ID." });
    }

    const reminder = await findReminderById(reminderId);
    if (!reminder) {
      return res.status(404).json({ message: "Reminder not found." });
    }

    reminder.reminder_type_label = REMINDER_TYPE_LABELS[reminder.reminder_type] || reminder.reminder_type;
    res.json({ reminder });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch reminder.", detail: error.message });
  }
}

// ─── PATCH /api/subscription-reminders/:id/complete ───────────────────────────

async function markReminderComplete(req, res) {
  try {
    const reminderId = Number(req.params.id);
    const userId = req.user?.userId || null;

    if (!reminderId) {
      return res.status(400).json({ message: "Invalid reminder ID." });
    }

    const existing = await findReminderById(reminderId);
    if (!existing) {
      return res.status(404).json({ message: "Reminder not found." });
    }
    if (existing.status !== "Active") {
      return res.status(400).json({ message: "Only active reminders can be completed." });
    }

    await completeReminder(reminderId, userId);
    res.json({ message: "Reminder marked as completed." });
  } catch (error) {
    res.status(500).json({ message: "Failed to complete reminder.", detail: error.message });
  }
}

// ─── PATCH /api/subscription-reminders/:id/dismiss ────────────────────────────

async function markReminderDismissed(req, res) {
  try {
    const reminderId = Number(req.params.id);
    const userId = req.user?.userId || null;

    if (!reminderId) {
      return res.status(400).json({ message: "Invalid reminder ID." });
    }

    const existing = await findReminderById(reminderId);
    if (!existing) {
      return res.status(404).json({ message: "Reminder not found." });
    }
    if (existing.status !== "Active") {
      return res.status(400).json({ message: "Only active reminders can be dismissed." });
    }

    await dismissReminder(reminderId, userId);
    res.json({ message: "Reminder dismissed." });
  } catch (error) {
    res.status(500).json({ message: "Failed to dismiss reminder.", detail: error.message });
  }
}

// ─── POST /api/subscription-reminders/generate ────────────────────────────────
// Manual trigger to generate/refresh reminders based on current subscription states.

async function triggerReminderGeneration(req, res) {
  try {
    const companyId = getCompanyId(req);
    const result = await generateScheduledReminders(companyId);
    res.json({
      message: `Reminder generation complete. ${result.created} new reminder(s) created.`,
      created: result.created,
    });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      return res.status(501).json({
        message: "Subscription reminders table not found. Please run the migration first.",
      });
    }
    res.status(500).json({ message: "Failed to generate reminders.", detail: error.message });
  }
}

module.exports = {
  getReminders,
  getReminderSummary,
  getReminderById,
  markReminderComplete,
  markReminderDismissed,
  triggerReminderGeneration,
};
