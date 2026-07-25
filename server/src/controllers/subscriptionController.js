/**
 * Subscription Controller
 *
 * Handles subscription management operations with validation,
 * duplicate detection, and notification integration.
 *
 * NOTE: Manual subscription creation has been removed.
 * Subscriptions are created exclusively through the bulk import process
 * (see bulkSubscriptionController.js). Finance users import subscription
 * records from external business systems (CRM, Sales, ERP).
 *
 * Follows the same patterns as invoiceController.js for consistency.
 */

const { pool } = require("../config/db");
const { getCompanyId } = require("../utils/companyScope");
const { createNotification } = require("../services/invoiceNotificationService");
const {
  createReminder,
  autoResolveReminders,
} = require("../models/subscriptionReminderModel");
const {
  findAllSubscriptions,
  findSubscriptionById,
  findSubscriptionInvoices,
  findSubscriptionPayments,
  updateSubscription: updateSubscriptionRow,
  pauseSubscription: pauseSubscriptionRow,
  resumeSubscription: resumeSubscriptionRow,
  cancelSubscription: cancelSubscriptionRow,
  hasDuplicateActiveSubscription,
  getSubscriptionDashboardMetrics,
  toDateString,
} = require("../models/subscriptionModel");
const { generateSubscriptionInvoice } = require("../workers/subscriptionScheduler");

// ─── Billing frequencies accepted by the system ───────────────────────────────
const VALID_FREQUENCIES = new Set(["Weekly", "Monthly", "Quarterly", "Yearly"]);

// ─── Validation helpers ───────────────────────────────────────────────────────

function validateSubscriptionPayload(body) {
  const errors = [];

  if (!body.customer_id) errors.push("Customer is required.");
  if (!body.plan_name || !String(body.plan_name).trim()) errors.push("Plan name is required.");
  if (!body.amount || Number(body.amount) <= 0) errors.push("Amount must be a positive number.");
  if (!body.billing_frequency || !VALID_FREQUENCIES.has(body.billing_frequency)) {
    errors.push("Billing frequency must be one of: Weekly, Monthly, Quarterly, Yearly.");
  }
  if (!body.start_date || Number.isNaN(Date.parse(body.start_date))) {
    errors.push("Start date is required and must be a valid date.");
  }
  if (body.next_billing_date && Number.isNaN(Date.parse(body.next_billing_date))) {
    errors.push("Next billing date must be a valid date.");
  }
  if (body.end_date && Number.isNaN(Date.parse(body.end_date))) {
    errors.push("End date must be a valid date.");
  }

  // Prevent past next billing dates on new subscriptions
  if (body.next_billing_date) {
    const nextDate = new Date(body.next_billing_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (nextDate < today && !body._isUpdate) {
      errors.push("Next billing date cannot be in the past for new subscriptions.");
    }
  }

  return errors;
}

// ─── GET /api/subscriptions ───────────────────────────────────────────────────

async function getSubscriptions(req, res) {
  try {
    const companyId = getCompanyId(req);
    const filters = {
      status:     req.query.status     || null,
      customerId: req.query.customerId || null,
      frequency:  req.query.frequency  || null,
    };

    const subscriptions = await findAllSubscriptions(companyId, filters);
    res.json({ subscriptions });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      return res.json({ subscriptions: [] });
    }
    res.status(500).json({ message: "Failed to fetch subscriptions.", detail: error.message });
  }
}

// ─── GET /api/subscriptions/dashboard ─────────────────────────────────────────

async function getSubscriptionDashboard(req, res) {
  try {
    const companyId = getCompanyId(req);
    const metrics = await getSubscriptionDashboardMetrics(companyId);
    res.json(metrics);
  } catch (error) {
    // If subscriptions table doesn't exist yet, return empty metrics
    if (error.code === "ER_NO_SUCH_TABLE") {
      return res.json({
        active_count: 0,
        paused_count: 0,
        cancelled_count: 0,
        expired_count: 0,
        mrr: 0,
        arr: 0,
        upcoming_renewals: 0,
        overdue_invoices: 0,
        revenue_by_plan: [],
        recent_activity: [],
      });
    }
    res.status(500).json({ message: "Failed to fetch subscription dashboard.", detail: error.message });
  }
}

// ─── GET /api/subscriptions/:id ───────────────────────────────────────────────

async function getSubscriptionById(req, res) {
  try {
    const subscriptionId = Number(req.params.id);
    const companyId = getCompanyId(req);

    if (!subscriptionId) {
      return res.status(400).json({ message: "Invalid subscription ID." });
    }

    const subscription = await findSubscriptionById(subscriptionId, companyId);
    if (!subscription) {
      return res.status(404).json({ message: "Subscription not found." });
    }

    res.json({ subscription });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch subscription.", detail: error.message });
  }
}

// ─── GET /api/subscriptions/:id/invoices ──────────────────────────────────────

async function getSubscriptionInvoices(req, res) {
  try {
    const subscriptionId = Number(req.params.id);
    const companyId = getCompanyId(req);
    const invoices = await findSubscriptionInvoices(subscriptionId, companyId);
    res.json({ invoices });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch subscription invoices.", detail: error.message });
  }
}

// ─── GET /api/subscriptions/:id/payments ──────────────────────────────────────

async function getSubscriptionPayments(req, res) {
  try {
    const subscriptionId = Number(req.params.id);
    const companyId = getCompanyId(req);
    const payments = await findSubscriptionPayments(subscriptionId, companyId);
    res.json({ payments });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch subscription payments.", detail: error.message });
  }
}

// ─── POST /api/subscriptions/:id/generate-invoice ─────────────────────────────
// Manual invoice generation override — allows Finance to trigger an invoice
// immediately for an active subscription without waiting for the scheduler.

async function generateInvoiceNowHandler(req, res) {
  try {
    const subscriptionId = Number(req.params.id);
    const companyId = getCompanyId(req);
    const userId = req.user?.userId || null;
    const customAmount = req.body?.amount ? Number(req.body.amount) : null;

    if (!subscriptionId) {
      return res.status(400).json({ message: "Invalid subscription ID." });
    }

    if (customAmount !== null && (isNaN(customAmount) || customAmount <= 0)) {
      return res.status(400).json({ message: "Amount must be a positive number." });
    }

    const existing = await findSubscriptionById(subscriptionId, companyId);
    if (!existing) {
      return res.status(404).json({ message: "Subscription not found." });
    }
    if (existing.status !== "Active") {
      return res.status(400).json({ message: "Only active subscriptions can generate invoices." });
    }

    // Check remaining balance — invoices must add up to the subscription amount
    const invoiceData = await findSubscriptionInvoices(subscriptionId, companyId);
    const totalInvoiced = invoiceData
      .filter((inv) => inv.status !== "Void" && inv.status !== "Cancelled")
      .reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
    const remainingBalance = Number(existing.amount) - totalInvoiced;

    if (remainingBalance <= 0) {
      return res.status(400).json({ message: "Fully invoiced. All partial invoices already add up to the subscription amount." });
    }

    const invoiceAmount = customAmount || remainingBalance;
    if (invoiceAmount > remainingBalance) {
      return res.status(400).json({
        message: `Amount exceeds remaining balance. Remaining: $${remainingBalance.toFixed(2)}`,
      });
    }

    // Reuse the scheduler's invoice generation logic with manual override
    const result = await generateSubscriptionInvoice({
      subscription_id:   existing.subscription_id,
      customer_id:       existing.customer_id,
      company_id:        existing.company_id,
      plan_name:         existing.plan_name,
      description:       existing.description,
      amount:            existing.amount,
      billing_frequency: existing.billing_frequency,
      next_billing_date: existing.next_billing_date,
      auto_send:         existing.auto_send,
      auto_renew:        existing.auto_renew,
      end_date:          existing.end_date,
      customer_name:     existing.customer_name,
      customer_email:    existing.customer_email,
    }, { manual: true, amount: invoiceAmount });

    if (!result.success) {
      return res.status(400).json({
        message: result.reason || "Failed to generate invoice.",
      });
    }

    res.status(201).json({
      message: result.skipped
        ? "Invoice already exists for this billing cycle. Date advanced."
        : "Invoice generated successfully.",
      invoiceId: result.invoiceId || null,
      sent: result.sent || false,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to generate invoice.", detail: error.message });
  }
}

// ─── PUT /api/subscriptions/:id ───────────────────────────────────────────────

async function updateSubscriptionHandler(req, res) {
  try {
    const subscriptionId = Number(req.params.id);
    const companyId = getCompanyId(req);
    const userId = req.user?.userId || null;

    if (!subscriptionId) {
      return res.status(400).json({ message: "Invalid subscription ID." });
    }

    const existing = await findSubscriptionById(subscriptionId, companyId);
    if (!existing) {
      return res.status(404).json({ message: "Subscription not found." });
    }

    // Cannot edit cancelled/expired subscriptions
    if (existing.status === "Cancelled" || existing.status === "Expired") {
      return res.status(400).json({ message: `Cannot edit a ${existing.status.toLowerCase()} subscription.` });
    }

    const payload = { ...req.body, _isUpdate: true };
    const errors = validateSubscriptionPayload(payload);
    if (errors.length) {
      return res.status(400).json({ message: errors.join(" ") });
    }

    // Duplicate check (exclude self)
    const isDuplicate = await hasDuplicateActiveSubscription(
      Number(req.body.customer_id),
      String(req.body.plan_name).trim(),
      subscriptionId,
      companyId
    );
    if (isDuplicate) {
      return res.status(409).json({
        message: "Another active subscription already exists for this customer with the same plan name."
      });
    }

    await updateSubscriptionRow(subscriptionId, {
      plan_name:         String(req.body.plan_name).trim(),
      description:       req.body.description || null,
      amount:            Number(req.body.amount),
      billing_frequency: req.body.billing_frequency,
      start_date:        toDateString(req.body.start_date),
      next_billing_date: toDateString(req.body.next_billing_date || req.body.start_date),
      end_date:          req.body.end_date ? toDateString(req.body.end_date) : null,
      auto_renew:        req.body.auto_renew !== false,
      auto_send:         Boolean(req.body.auto_send),
    });

    res.json({ message: "Subscription updated successfully." });
  } catch (error) {
    res.status(500).json({ message: "Failed to update subscription.", detail: error.message });
  }
}

// ─── PATCH /api/subscriptions/:id/pause ───────────────────────────────────────

async function pauseSubscriptionHandler(req, res) {
  try {
    const subscriptionId = Number(req.params.id);
    const companyId = getCompanyId(req);
    const userId = req.user?.userId || null;

    const existing = await findSubscriptionById(subscriptionId, companyId);
    if (!existing) {
      return res.status(404).json({ message: "Subscription not found." });
    }
    if (existing.status !== "Active") {
      return res.status(400).json({ message: "Only active subscriptions can be paused." });
    }

    await pauseSubscriptionRow(subscriptionId);

    // Auto-generate "subscription_paused" reminder
    try {
      await createReminder({
        subscriptionId,
        customerId: existing.customer_id,
        companyId:  existing.company_id,
        customerName: existing.customer_name,
        reminderType: "subscription_paused",
      });
    } catch (reminderErr) {
      console.error("[SUBSCRIPTION] Failed to create pause reminder:", reminderErr.message);
    }

    res.json({ message: "Subscription paused." });
  } catch (error) {
    res.status(500).json({ message: "Failed to pause subscription.", detail: error.message });
  }
}

// ─── PATCH /api/subscriptions/:id/resume ──────────────────────────────────────

async function resumeSubscriptionHandler(req, res) {
  try {
    const subscriptionId = Number(req.params.id);
    const companyId = getCompanyId(req);
    const userId = req.user?.userId || null;

    const existing = await findSubscriptionById(subscriptionId, companyId);
    if (!existing) {
      return res.status(404).json({ message: "Subscription not found." });
    }
    if (existing.status !== "Paused") {
      return res.status(400).json({ message: "Only paused subscriptions can be resumed." });
    }

    await resumeSubscriptionRow(subscriptionId);

    // Auto-resolve "subscription_paused" reminder since it's been resumed
    try {
      await autoResolveReminders(subscriptionId, ["subscription_paused"]);
    } catch (reminderErr) {
      console.error("[SUBSCRIPTION] Failed to auto-resolve pause reminder:", reminderErr.message);
    }

    res.json({ message: "Subscription resumed." });
  } catch (error) {
    res.status(500).json({ message: "Failed to resume subscription.", detail: error.message });
  }
}

// ─── PATCH /api/subscriptions/:id/cancel ──────────────────────────────────────

async function cancelSubscriptionHandler(req, res) {
  try {
    const subscriptionId = Number(req.params.id);
    const companyId = getCompanyId(req);
    const userId = req.user?.userId || null;

    const existing = await findSubscriptionById(subscriptionId, companyId);
    if (!existing) {
      return res.status(404).json({ message: "Subscription not found." });
    }
    if (existing.status === "Cancelled" || existing.status === "Expired") {
      return res.status(400).json({ message: `Subscription is already ${existing.status.toLowerCase()}.` });
    }

    await cancelSubscriptionRow(subscriptionId);

    // Auto-resolve all active reminders for this cancelled subscription
    try {
      await autoResolveReminders(subscriptionId, [
        "renewal_due_7_days", "expires_today", "billing_today",
        "subscription_paused", "auto_renew_disabled", "incomplete_import",
      ]);
    } catch (reminderErr) {
      console.error("[SUBSCRIPTION] Failed to auto-resolve reminders on cancel:", reminderErr.message);
    }

    await createNotification({
      type:    "subscription_cancelled",
      title:   "Subscription Cancelled",
      message: `Subscription #${subscriptionId} (${existing.plan_name}) for ${existing.customer_name} has been cancelled.`,
    });

    res.json({ message: "Subscription cancelled." });
  } catch (error) {
    res.status(500).json({ message: "Failed to cancel subscription.", detail: error.message });
  }
}

// ─── DELETE /api/subscriptions/:id ────────────────────────────────────────────

async function deleteSubscriptionHandler(req, res) {
  try {
    const subscriptionId = Number(req.params.id);
    const companyId = getCompanyId(req);
    const userId = req.user?.userId || null;

    const existing = await findSubscriptionById(subscriptionId, companyId);
    if (!existing) {
      return res.status(404).json({ message: "Subscription not found." });
    }

    // Only allow deletion if no invoices have been generated
    const invoices = await findSubscriptionInvoices(subscriptionId, companyId);
    if (invoices.length > 0) {
      return res.status(400).json({
        message: "Cannot delete a subscription that has generated invoices. Cancel it instead."
      });
    }

    await pool.query("DELETE FROM subscriptions WHERE subscription_id = ?", [subscriptionId]);

    res.json({ message: "Subscription deleted." });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete subscription.", detail: error.message });
  }
}

module.exports = {
  getSubscriptions,
  getSubscriptionById,
  getSubscriptionDashboard,
  getSubscriptionInvoices,
  getSubscriptionPayments,
  updateSubscriptionHandler,
  pauseSubscriptionHandler,
  resumeSubscriptionHandler,
  cancelSubscriptionHandler,
  deleteSubscriptionHandler,
  generateInvoiceNowHandler,
};
