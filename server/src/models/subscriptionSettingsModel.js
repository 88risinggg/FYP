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
  await pool.query(
    `CREATE TABLE IF NOT EXISTS subscription_settings (
      company_id INT NOT NULL,
      plans_json JSON NULL,
      billing_rules_json JSON NULL,
      automation_settings_json JSON NULL,
      updated_by INT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (company_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
  settingsTableReady = true;
}

async function getSubscriptionSettings(companyId) {
  await ensureSubscriptionSettingsTable();
  const companyKey = Number(companyId) > 0 ? Number(companyId) : 0;
  const [rows] = await pool.query(
    `SELECT plans_json, billing_rules_json, automation_settings_json, updated_at
     FROM subscription_settings
     WHERE company_id = ?
     LIMIT 1`,
    [companyKey]
  );

  const normalized = rows[0]
    ? normalizeSubscriptionSettings({
        plans: parseJson(rows[0].plans_json, []),
        billingRules: parseJson(rows[0].billing_rules_json, {}),
        automation: parseJson(rows[0].automation_settings_json, {})
      })
    : normalizeSubscriptionSettings(defaultSubscriptionSettings);

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

  await pool.query(
    `INSERT INTO subscription_settings
       (company_id, plans_json, billing_rules_json, automation_settings_json, updated_by)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       plans_json = VALUES(plans_json),
       billing_rules_json = VALUES(billing_rules_json),
       automation_settings_json = VALUES(automation_settings_json),
       updated_by = VALUES(updated_by),
       updated_at = NOW()`,
    [
      companyKey,
      JSON.stringify(settings.plans),
      JSON.stringify(settings.billingRules),
      JSON.stringify(settings.automation),
      updatedBy || null
    ]
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
