/**
 * Finance Reminder Controller
 *
 * Handles CRUD operations for the unified Finance Reminders module.
 * Finance users can view, filter, search, complete, and dismiss reminders.
 */

const { getCompanyId } = require("../utils/companyScope");
const {
  findAllFinanceReminders,
  getFinanceReminderSummary,
  completeFinanceReminder,
  dismissFinanceReminder,
} = require("../models/financeReminderModel");

// ─── GET /api/finance-reminders ───────────────────────────────────────────────

async function getFinanceReminders(req, res) {
  try {
    const companyId = getCompanyId(req);
    const filters = {
      status:       req.query.status       || null,
      priority:     req.query.priority     || null,
      reminderType: req.query.type         || null,
      search:       req.query.search       || null,
      dateFrom:     req.query.dateFrom     || null,
      dateTo:       req.query.dateTo       || null,
    };

    const reminders = await findAllFinanceReminders(companyId, filters);
    res.json({ reminders });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      return res.json({ reminders: [] });
    }
    res.status(500).json({ message: "Failed to fetch reminders.", detail: error.message });
  }
}

// ─── GET /api/finance-reminders/summary ───────────────────────────────────────

async function getFinanceRemindersSummary(req, res) {
  try {
    const companyId = getCompanyId(req);
    const summary = await getFinanceReminderSummary(companyId);
    res.json(summary);
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE" || error.code === "ER_BAD_FIELD_ERROR" || error.code === "ER_PARSE_ERROR") {
      return res.json({
        total_active: 0,
        high_priority: 0,
        medium_priority: 0,
        low_priority: 0,
        overdue_count: 0,
        due_today_count: 0,
        due_soon_count: 0,
        payment_failed_count: 0,
        renewal_due_count: 0,
        generation_failed_count: 0,
      });
    }
    res.status(500).json({ message: "Failed to fetch reminder summary.", detail: error.message });
  }
}

// ─── PATCH /api/finance-reminders/:id/complete ────────────────────────────────

async function completeReminderHandler(req, res) {
  try {
    const reminderId = Number(req.params.id);
    const userId = req.user?.userId || null;

    if (!reminderId) {
      return res.status(400).json({ message: "Invalid reminder ID." });
    }

    const success = await completeFinanceReminder(reminderId, userId);
    if (!success) {
      return res.status(404).json({ message: "Reminder not found or already resolved." });
    }

    res.json({ message: "Reminder marked as completed." });
  } catch (error) {
    res.status(500).json({ message: "Failed to complete reminder.", detail: error.message });
  }
}

// ─── PATCH /api/finance-reminders/:id/dismiss ─────────────────────────────────

async function dismissReminderHandler(req, res) {
  try {
    const reminderId = Number(req.params.id);
    const userId = req.user?.userId || null;

    if (!reminderId) {
      return res.status(400).json({ message: "Invalid reminder ID." });
    }

    const success = await dismissFinanceReminder(reminderId, userId);
    if (!success) {
      return res.status(404).json({ message: "Reminder not found or already resolved." });
    }

    res.json({ message: "Reminder dismissed." });
  } catch (error) {
    res.status(500).json({ message: "Failed to dismiss reminder.", detail: error.message });
  }
}

module.exports = {
  getFinanceReminders,
  getFinanceRemindersSummary,
  completeReminderHandler,
  dismissReminderHandler,
};
