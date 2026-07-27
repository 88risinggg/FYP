const { randomUUID } = require("crypto");
const { pool } = require("../config/db");

const VALID_FREQUENCIES = new Set(["Weekly", "Monthly", "Quarterly", "Yearly"]);
const VALID_AUTO_SEND_MODES = new Set(["finance_choice", "always", "never"]);

const defaultSubscriptionSettings = {
  plans: [],
  billingRules: {
    requireApprovedPlan: false,
    lockPlanPricing: true,
    allowPause: true,
    allowCancellation: true,
    allowManualInvoiceGeneration: true,
    defaultAutoRenew: true
  },
  automation: {
    automaticInvoiceGeneration: true,
    autoSendMode: "finance_choice",
    renewalReminderDays: 7,
    notifyFinanceOnFailure: true
  }
};

let settingsTableReady = false;

function boolValue(value, fallback) {
  if (value === undefined || value === null) return fallback;
  return value === true || value === 1 || value === "1";
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizePlan(plan, index) {
  const name = String(plan?.name || "").trim();
  const price = Number(plan?.price);
  const billingFrequency = VALID_FREQUENCIES.has(plan?.billingFrequency)
    ? plan.billingFrequency
    : "Monthly";

  if (!name) {
    const error = new Error(`Plan ${index + 1} requires a name.`);
    error.status = 400;
    throw error;
  }
  if (!Number.isFinite(price) || price <= 0) {
    const error = new Error(`${name} requires a price greater than zero.`);
    error.status = 400;
    throw error;
  }

  return {
    id: String(plan?.id || randomUUID()),
    name,
    description: String(plan?.description || "").trim(),
    price: Number(price.toFixed(2)),
    billingFrequency,
    active: boolValue(plan?.active, true),
    autoRenewDefault: boolValue(plan?.autoRenewDefault, true)
  };
}

function normalizeSubscriptionSettings(input = {}) {
  const rawPlans = Array.isArray(input.plans) ? input.plans : [];
  const plans = rawPlans.map(normalizePlan);
  const planNames = new Set();

  for (const plan of plans) {
    const key = plan.name.toLowerCase();
    if (planNames.has(key)) {
      const error = new Error(`Plan names must be unique. "${plan.name}" is duplicated.`);
      error.status = 400;
      throw error;
    }
    planNames.add(key);
  }

  const billing = input.billingRules || {};
  const automation = input.automation || {};
  const reminderDays = Number(automation.renewalReminderDays);

  return {
    plans,
    billingRules: {
      requireApprovedPlan: boolValue(
        billing.requireApprovedPlan,
        defaultSubscriptionSettings.billingRules.requireApprovedPlan
      ),
      lockPlanPricing: boolValue(
        billing.lockPlanPricing,
        defaultSubscriptionSettings.billingRules.lockPlanPricing
      ),
      allowPause: boolValue(billing.allowPause, defaultSubscriptionSettings.billingRules.allowPause),
      allowCancellation: boolValue(
        billing.allowCancellation,
        defaultSubscriptionSettings.billingRules.allowCancellation
      ),
      allowManualInvoiceGeneration: boolValue(
        billing.allowManualInvoiceGeneration,
        defaultSubscriptionSettings.billingRules.allowManualInvoiceGeneration
      ),
      defaultAutoRenew: boolValue(
        billing.defaultAutoRenew,
        defaultSubscriptionSettings.billingRules.defaultAutoRenew
      )
    },
    automation: {
      automaticInvoiceGeneration: boolValue(
        automation.automaticInvoiceGeneration,
        defaultSubscriptionSettings.automation.automaticInvoiceGeneration
      ),
      autoSendMode: VALID_AUTO_SEND_MODES.has(automation.autoSendMode)
        ? automation.autoSendMode
        : defaultSubscriptionSettings.automation.autoSendMode,
      renewalReminderDays: Number.isInteger(reminderDays) && reminderDays >= 0 && reminderDays <= 90
        ? reminderDays
        : defaultSubscriptionSettings.automation.renewalReminderDays,
      notifyFinanceOnFailure: boolValue(
        automation.notifyFinanceOnFailure,
        defaultSubscriptionSettings.automation.notifyFinanceOnFailure
      )
    }
  };
}

async function ensureSubscriptionSettingsTable() {
  if (settingsTableReady) return;
  // Subscription settings are now stored directly on the companies table (1:1 merge).
  // Ensure the column exists for backward compatibility during migration.
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'companies' AND COLUMN_NAME = 'subscription_settings_json'`
    );
    if (cols.length === 0) {
      await pool.query(`ALTER TABLE companies ADD COLUMN subscription_settings_json JSON NULL`);
    }
  } catch (error) {
    // Column already exists — safe to ignore
    if (error.code !== "ER_DUP_FIELDNAME") throw error;
  }
  settingsTableReady = true;
}

async function getSubscriptionSettings(companyId) {
  await ensureSubscriptionSettingsTable();
  const companyKey = Number(companyId) > 0 ? Number(companyId) : 0;

  if (companyKey === 0) {
    return { ...normalizeSubscriptionSettings(defaultSubscriptionSettings), updatedAt: null };
  }

  const [rows] = await pool.query(
    `SELECT subscription_settings_json, updated_at
     FROM companies
     WHERE company_id = ?
     LIMIT 1`,
    [companyKey]
  );

  if (!rows[0] || !rows[0].subscription_settings_json) {
    return { ...normalizeSubscriptionSettings(defaultSubscriptionSettings), updatedAt: null };
  }

  const raw = parseJson(rows[0].subscription_settings_json, {});
  const normalized = normalizeSubscriptionSettings({
    plans: raw.plans || [],
    billingRules: raw.billingRules || {},
    automation: raw.automation || {}
  });

  return { ...normalized, updatedAt: rows[0].updated_at || null };
}

async function saveSubscriptionSettings(companyId, input, updatedBy) {
  await ensureSubscriptionSettingsTable();
  const companyKey = Number(companyId) > 0 ? Number(companyId) : 0;
  const settings = normalizeSubscriptionSettings(input);

  if (companyKey === 0) {
    return { ...settings, updatedAt: null };
  }

  const payload = JSON.stringify({
    plans: settings.plans,
    billingRules: settings.billingRules,
    automation: settings.automation
  });

  await pool.query(
    `UPDATE companies SET subscription_settings_json = ?, updated_at = NOW() WHERE company_id = ?`,
    [payload, companyKey]
  );

  return getSubscriptionSettings(companyKey);
}

function findActivePlan(settings, planName) {
  const key = String(planName || "").trim().toLowerCase();
  return settings?.plans?.find((plan) => plan.active && plan.name.toLowerCase() === key) || null;
}

module.exports = {
  defaultSubscriptionSettings,
  findActivePlan,
  getSubscriptionSettings,
  normalizeSubscriptionSettings,
  saveSubscriptionSettings
};
