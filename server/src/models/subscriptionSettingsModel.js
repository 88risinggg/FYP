const { randomUUID } = require("crypto");
const { pool } = require("../config/db");

const VALID_FREQUENCIES = new Set(["Weekly", "Monthly", "Quarterly", "Yearly"]);

const defaultSubscriptionSettings = {
  plans: [],
  billingRules: {
    requireApprovedPlan: false,
    lockPlanPricing: false,
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
  const billingFrequency = VALID_FREQUENCIES.has(plan?.billingFrequency)
    ? plan.billingFrequency
    : "Monthly";

  if (!name) {
    const error = new Error(`Plan ${index + 1} requires a name.`);
    error.status = 400;
    throw error;
  }
  return {
    id: String(plan?.id || randomUUID()),
    name,
    description: String(plan?.description || "").trim(),
    billingFrequency,
    active: boolValue(plan?.active, true)
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

  return {
    plans,
    // These are internal operating safeguards, not Admin-facing configuration.
    // Keep Finance customer pricing editable and keep recurring billing reliable.
    billingRules: { ...defaultSubscriptionSettings.billingRules },
    automation: { ...defaultSubscriptionSettings.automation }
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

  let usageByPlan = new Map();
  try {
    const [usageRows] = await pool.query(
      `SELECT LOWER(TRIM(plan_name)) AS plan_key, COUNT(*) AS usage_count
       FROM subscriptions
       WHERE company_id = ?
         AND status IN ('Active', 'Paused')
       GROUP BY LOWER(TRIM(plan_name))`,
      [companyKey]
    );
    usageByPlan = new Map(
      usageRows.map((row) => [row.plan_key, Number(row.usage_count || 0)])
    );
  } catch (error) {
    if (error.code !== "ER_NO_SUCH_TABLE") throw error;
  }

  return {
    ...normalized,
    plans: normalized.plans.map((plan) => ({
      ...plan,
      usageCount: usageByPlan.get(plan.name.toLowerCase()) || 0
    })),
    updatedAt: rows[0]?.updated_at || null
  };
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
