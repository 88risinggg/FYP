const { getCompanyId } = require("../utils/companyScope");
const {
  getSubscriptionSettings,
  saveSubscriptionSettings
} = require("../models/subscriptionSettingsModel");
const { MODULE, writeAuditLog } = require("../services/auditService");
const { getClientIp, getDeviceInfo } = require("../models/auditLogModel");

function planSnapshot(plan) {
  return {
    id: plan.id,
    name: plan.name,
    description: plan.description || "",
    billingFrequency: plan.billingFrequency,
    active: plan.active !== false
  };
}

function planChanged(before, after) {
  return JSON.stringify(planSnapshot(before)) !== JSON.stringify(planSnapshot(after));
}

async function writePlanAuditLogs(req, companyId, beforePlans, afterPlans) {
  const previousById = new Map(beforePlans.map((plan) => [String(plan.id), plan]));
  const userId = req.user?.userId || null;
  const common = {
    module: MODULE.INVOICE,
    entityType: "subscription_plan",
    userId,
    userName: req.user?.name || req.user?.email || null,
    companyId,
    ipAddress: getClientIp(req),
    deviceInfo: getDeviceInfo(req)
  };

  for (const plan of afterPlans) {
    const previous = previousById.get(String(plan.id));

    if (!previous) {
      await writeAuditLog({
        ...common,
        activityType: "subscription_plan_created",
        action: `Created subscription plan template "${plan.name}".`,
        entityId: plan.id,
        newValue: JSON.stringify(planSnapshot(plan))
      });
      continue;
    }

    if (!planChanged(previous, plan)) continue;

    const statusOnlyChanged =
      previous.active !== plan.active
      && previous.name === plan.name
      && previous.description === plan.description
      && previous.billingFrequency === plan.billingFrequency;

    await writeAuditLog({
      ...common,
      activityType: statusOnlyChanged
        ? "subscription_plan_status_changed"
        : "subscription_plan_updated",
      action: statusOnlyChanged
        ? `Changed subscription plan template "${plan.name}" to ${plan.active ? "Active" : "Inactive"}.`
        : `Updated subscription plan template "${plan.name}".`,
      entityId: plan.id,
      previousValue: JSON.stringify(planSnapshot(previous)),
      newValue: JSON.stringify(planSnapshot(plan))
    });
  }
}

async function getAdminSubscriptionSettings(req, res) {
  try {
    const settings = await getSubscriptionSettings(getCompanyId(req));
    res.json(settings);
  } catch (error) {
    console.error("[Subscription settings] Failed to load:", error);
    res.status(500).json({ message: "Unable to load subscription settings." });
  }
}

async function putAdminSubscriptionSettings(req, res) {
  try {
    const companyId = getCompanyId(req);
    const previousSettings = await getSubscriptionSettings(companyId);
    const incomingPlans = Array.isArray(req.body?.plans) ? req.body.plans : [];
    const incomingIds = new Set(incomingPlans.map((plan) => String(plan.id || "")));
    const removedPlan = previousSettings.plans.find(
      (plan) => !incomingIds.has(String(plan.id))
    );

    if (removedPlan) {
      return res.status(400).json({
        message: `Plan "${removedPlan.name}" cannot be deleted. Mark it Inactive instead.`
      });
    }

    const settings = await saveSubscriptionSettings(
      companyId,
      req.body,
      req.user?.userId
    );

    await writePlanAuditLogs(
      req,
      companyId,
      previousSettings.plans,
      settings.plans
    );

    res.json({ message: "Subscription settings saved.", ...settings });
  } catch (error) {
    console.error("[Subscription settings] Failed to save:", error);
    res.status(error.status || 500).json({
      message: error.status === 400 ? error.message : "Unable to save subscription settings."
    });
  }
}

module.exports = {
  getAdminSubscriptionSettings,
  putAdminSubscriptionSettings
};
