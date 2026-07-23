const {
  CPF_FULL_RATE_TIERS_2026,
  DEFAULT_PAYROLL_RULES_2026
} = require("./statutoryPayrollEngine");

function getPool() {
  return require("../config/db").pool;
}

const CPF_TIER_SLUGS = [
  "55_and_below",
  "above_55_to_60",
  "above_60_to_65",
  "above_65_to_70",
  "above_70"
];

const RULE_USAGE = Object.freeze({
  CALCULATION: "calculation",
  VALIDATION: "validation",
  REFERENCE: "reference"
});

function defaultMetadata(key) {
  if (/^cpf_rate_/.test(key)) return { ruleCategory: "CPF", usageType: RULE_USAGE.CALCULATION, effectiveFrom: "2026-01-01" };
  if (/^cpf_(monthly_wage_ceiling|wage_ceiling_effective_from)$/.test(key)) return { ruleCategory: "CPF", usageType: RULE_USAGE.CALCULATION, effectiveFrom: "2026-01-01" };
  if (key === "compliance_cpf_enabled") return { ruleCategory: "CPF", usageType: RULE_USAGE.CALCULATION, effectiveFrom: "2026-01-01" };
  if (key === "compliance_sdl_enabled") return { ruleCategory: "SDL", usageType: RULE_USAGE.CALCULATION, effectiveFrom: "2026-01-01" };
  if (/^compliance_/.test(key)) return { ruleCategory: "Validation", usageType: RULE_USAGE.VALIDATION, effectiveFrom: "2026-01-01" };
  if (/^mbmf_(enabled|effective_from|applicable_religion)$/.test(key) || /^(cdac|sinda|ecf)_(enabled|effective_from|applicable_race)$/.test(key)) return { ruleCategory: "Community Funds", usageType: RULE_USAGE.CALCULATION, effectiveFrom: "2026-01-01" };
  if (/^earning_component_.+_cpf_applicable$/.test(key)) return { ruleCategory: "Earnings", usageType: RULE_USAGE.CALCULATION, effectiveFrom: null };
  if (/^deduction_component_.+_affects_net_pay$/.test(key)) return { ruleCategory: "Deductions", usageType: RULE_USAGE.CALCULATION, effectiveFrom: null };
  return { ruleCategory: "Operational Reference", usageType: RULE_USAGE.REFERENCE, effectiveFrom: null };
}

const DEFAULT_SETTINGS = [
  ["cpf_monthly_wage_ceiling", "8000", "Monthly CPF ordinary wage ceiling."],
  ["cpf_wage_ceiling_effective_from", "2026-01-01", "Effective date for the CPF wage ceiling."],
  ["compliance_cpf_enabled", "Enabled", "Apply CPF calculation and validation."],
  ["compliance_bank_account_enabled", "Enabled", "Require employee bank details."],
  ["compliance_department_enabled", "Enabled", "Require an employee department."],
  ["compliance_positive_net_pay_enabled", "Enabled", "Require positive net salary."],
  ["compliance_sdl_enabled", "Enabled", "Apply SDL calculation."],
  ["compliance_max_other_deduction_percent", "30", "Maximum non-statutory deductions as a percentage of gross salary."],
  ["mbmf_enabled", "Enabled", "Apply MBMF where the employee is eligible."],
  ["mbmf_effective_from", "2026-01-01", "MBMF rule effective date."],
  ["mbmf_applicable_religion", "Muslim", "Religion used for MBMF eligibility."],
  ["cdac_enabled", "Enabled", "Apply CDAC where the employee is eligible."],
  ["cdac_effective_from", "2026-01-01", "CDAC rule effective date."],
  ["cdac_applicable_race", "Chinese", "Race used for CDAC eligibility."],
  ["sinda_enabled", "Enabled", "Apply SINDA where the employee is eligible."],
  ["sinda_effective_from", "2026-01-01", "SINDA rule effective date."],
  ["sinda_applicable_race", "Indian", "Race used for SINDA eligibility."],
  ["ecf_enabled", "Enabled", "Apply ECF where the employee is eligible."],
  ["ecf_effective_from", "2026-01-01", "ECF rule effective date."],
  ["ecf_applicable_race", "Eurasian", "Race used for ECF eligibility."]
];

CPF_FULL_RATE_TIERS_2026.forEach((tier, index) => {
  DEFAULT_SETTINGS.push(
    [`cpf_rate_${CPF_TIER_SLUGS[index]}_employee_percent`, String(tier.employeeRate), `${tier.label} employee CPF rate.`],
    [`cpf_rate_${CPF_TIER_SLUGS[index]}_employer_percent`, String(tier.employerRate), `${tier.label} employer CPF rate.`]
  );
});

async function ensurePayrollConfigurationTable(connection = getPool()) {
  await connection.execute(
    `CREATE TABLE IF NOT EXISTS payroll_configuration (
      configuration_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      configuration_type VARCHAR(40) NOT NULL DEFAULT 'setting',
      configuration_key VARCHAR(191) NOT NULL,
      configuration_value LONGTEXT NOT NULL,
      description VARCHAR(500) NULL,
      effective_from DATE NULL,
      rule_category VARCHAR(80) NULL,
      usage_type VARCHAR(24) NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      updated_by INT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (configuration_id),
      UNIQUE KEY uq_payroll_configuration_type_key (configuration_type, configuration_key),
      KEY idx_payroll_configuration_updated_by (updated_by)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
  const requiredColumns = [
    ["effective_from", "DATE NULL AFTER description"],
    ["rule_category", "VARCHAR(80) NULL AFTER effective_from"],
    ["usage_type", "VARCHAR(24) NULL AFTER rule_category"],
    ["is_active", "TINYINT(1) NOT NULL DEFAULT 1 AFTER usage_type"]
  ];
  for (const [column, definition] of requiredColumns) {
    const [rows] = await connection.execute(`SHOW COLUMNS FROM payroll_configuration LIKE '${column}'`);
    if (!rows.length) {
      try { await connection.execute(`ALTER TABLE payroll_configuration ADD COLUMN ${column} ${definition}`); }
      catch (error) { if (error.code !== "ER_DUP_FIELDNAME") throw error; }
    }
  }
}

async function listStoredPayrollSettings(connection = getPool()) {
  await ensurePayrollConfigurationTable(connection);
  const [rows] = await connection.execute(
    `SELECT pc.configuration_id AS setting_id, pc.configuration_key AS setting_key,
            pc.configuration_value AS setting_value, pc.description, pc.effective_from,
            pc.rule_category, pc.usage_type, pc.is_active, pc.created_at, pc.updated_at,
            COALESCE(u.name, 'System') AS updated_by_name
     FROM payroll_configuration pc
     LEFT JOIN user u ON u.user_id = pc.updated_by
     WHERE pc.configuration_type = 'setting'
     ORDER BY pc.configuration_key`
  );
  const storedByKey = new Map(rows.map((row) => [row.setting_key, row]));
  const defaults = DEFAULT_SETTINGS
    .filter(([key]) => !storedByKey.has(key))
    .map(([key, value, description]) => ({
      ...(() => {
        const metadata = defaultMetadata(key);
        return {
          effective_from: metadata.effectiveFrom,
          rule_category: metadata.ruleCategory,
          usage_type: metadata.usageType,
          is_active: 1
        };
      })(),
      setting_id: `default_${key}`,
      setting_key: key,
      setting_value: value,
      description,
      updated_at: null,
      updated_by_name: "System default"
    }));
  return [...rows, ...defaults].sort((a, b) => a.setting_key.localeCompare(b.setting_key));
}

async function upsertStoredPayrollSetting({ settingKey, settingValue, description, effectiveFrom, ruleCategory, usageType, isActive, updatedBy }, connection = getPool()) {
  await ensurePayrollConfigurationTable(connection);
  const metadata = defaultMetadata(settingKey);
  await connection.execute(
    `INSERT INTO payroll_configuration
       (configuration_type, configuration_key, configuration_value, description, effective_from,
        rule_category, usage_type, is_active, updated_by)
     VALUES ('setting', ?, ?, ?, COALESCE(?, CURRENT_DATE), ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       configuration_value = VALUES(configuration_value),
       description = VALUES(description),
       effective_from = COALESCE(VALUES(effective_from), CURRENT_DATE),
       rule_category = VALUES(rule_category),
       usage_type = VALUES(usage_type),
       is_active = VALUES(is_active),
       updated_by = VALUES(updated_by),
       updated_at = CURRENT_TIMESTAMP`,
    [settingKey, settingValue, description || null, effectiveFrom || metadata.effectiveFrom,
      ruleCategory || metadata.ruleCategory, usageType || metadata.usageType,
      isActive === false || Number(isActive) === 0 ? 0 : 1, updatedBy || null]
  );
}

function isEnabled(value, fallback = true) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["enabled", "yes", "true", "1", "active"].includes(String(value).trim().toLowerCase());
}

function finiteNumber(value, fallback, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

function resolveAppliedPayrollRules(settings = []) {
  const values = Object.fromEntries(settings.map((setting) => [setting.setting_key, setting.setting_value]));
  const get = (key, fallback) => values[key] ?? fallback;
  const cpfRateTiers = CPF_FULL_RATE_TIERS_2026.map((tier, index) => ({
    ...tier,
    employeeRate: finiteNumber(get(`cpf_rate_${CPF_TIER_SLUGS[index]}_employee_percent`, tier.employeeRate), tier.employeeRate, 0, 100),
    employerRate: finiteNumber(get(`cpf_rate_${CPF_TIER_SLUGS[index]}_employer_percent`, tier.employerRate), tier.employerRate, 0, 100)
  }));
  const componentCpfApplicable = {};
  const deductionAffectsNetPay = {};

  Object.entries(values).forEach(([key, value]) => {
    const earningMatch = key.match(/^earning_component_(.+)_cpf_applicable$/);
    if (earningMatch) componentCpfApplicable[earningMatch[1]] = isEnabled(value);
    const deductionMatch = key.match(/^deduction_component_(.+)_affects_net_pay$/);
    if (deductionMatch) deductionAffectsNetPay[deductionMatch[1]] = isEnabled(value);
  });

  return {
    ...DEFAULT_PAYROLL_RULES_2026,
    cpfOrdinaryWageCeiling: finiteNumber(get("cpf_monthly_wage_ceiling", DEFAULT_PAYROLL_RULES_2026.cpfOrdinaryWageCeiling), DEFAULT_PAYROLL_RULES_2026.cpfOrdinaryWageCeiling, 0),
    cpfWageCeilingEffectiveFrom: get("cpf_wage_ceiling_effective_from", "2026-01-01"),
    maxOtherDeductionPercent: finiteNumber(get("compliance_max_other_deduction_percent", DEFAULT_PAYROLL_RULES_2026.maxOtherDeductionPercent), DEFAULT_PAYROLL_RULES_2026.maxOtherDeductionPercent, 0, 100),
    cpfEnabled: isEnabled(get("compliance_cpf_enabled", "Enabled")),
    bankAccountRequired: isEnabled(get("compliance_bank_account_enabled", "Enabled")),
    departmentRequired: isEnabled(get("compliance_department_enabled", "Enabled")),
    positiveNetPayRequired: isEnabled(get("compliance_positive_net_pay_enabled", "Enabled")),
    sdlEnabled: isEnabled(get("compliance_sdl_enabled", get("sdl_enabled", "Enabled"))),
    cpfRateTiers,
    componentCpfApplicable,
    deductionAffectsNetPay,
    selfHelpGroupRules: {
      MBMF: { enabled: isEnabled(get("mbmf_enabled", "Enabled")), effectiveFrom: get("mbmf_effective_from", "2026-01-01"), eligibilityField: "religion", eligibilityValue: get("mbmf_applicable_religion", "Muslim") },
      CDAC: { enabled: isEnabled(get("cdac_enabled", "Enabled")), effectiveFrom: get("cdac_effective_from", "2026-01-01"), eligibilityField: "race", eligibilityValue: get("cdac_applicable_race", "Chinese") },
      SINDA: { enabled: isEnabled(get("sinda_enabled", "Enabled")), effectiveFrom: get("sinda_effective_from", "2026-01-01"), eligibilityField: "race", eligibilityValue: get("sinda_applicable_race", "Indian") },
      ECF: { enabled: isEnabled(get("ecf_enabled", "Enabled")), effectiveFrom: get("ecf_effective_from", "2026-01-01"), eligibilityField: "race", eligibilityValue: get("ecf_applicable_race", "Eurasian") }
    }
  };
}

function buildEffectiveRuleCatalogue(settings = [], asOf = new Date()) {
  const resolved = resolveAppliedPayrollRules(settings);
  const matching = (patterns) => settings.filter((setting) => patterns.some((pattern) => pattern instanceof RegExp ? pattern.test(setting.setting_key) : setting.setting_key === pattern));
  const dateValue = (value) => value ? String(value).slice(0, 10) : null;
  const makeRule = ({ key, name, category, usage, settingPatterns, value, details = [], enabled = true, editPath }) => {
    const members = matching(settingPatterns);
    const stored = members.filter((setting) => !String(setting.setting_id || "").startsWith("default_"));
    const active = enabled && !members.some((setting) => Number(setting.is_active) === 0);
    const timestamps = stored.map((setting) => setting.updated_at).filter(Boolean).sort((a, b) => new Date(b) - new Date(a));
    const effectiveFrom = members.map((setting) => dateValue(setting.effective_from)).find(Boolean)
      || dateValue(members.find((setting) => /_effective_from$/.test(setting.setting_key))?.setting_value)
      || dateValue(timestamps[0])
      || "2026-01-01";
    return {
      key, name, category, usage, value, details,
      source: stored.length ? "Admin Override" : "System Default",
      effectiveFrom,
      status: active ? "Active" : "Inactive",
      isActive: Boolean(active),
      updatedAt: timestamps[0] || null,
      updatedBy: stored.map((setting) => setting.updated_by_name).find((name) => name && name !== "System default") || "System default",
      editPath
    };
  };
  const cpfDetails = resolved.cpfRateTiers.map((tier) => ({
    label: tier.label,
    value: `Employee ${tier.employeeRate}% / Employer ${tier.employerRate}%`
  }));
  const earningRules = new Map([["basic_salary", true], ["allowances", true], ["reimbursement", false], ["tips", false], ...Object.entries(resolved.componentCpfApplicable)]);
  const earningDetails = [...earningRules].map(([component, enabled]) => ({ label: component.replaceAll("_", " "), value: enabled ? "CPF applicable" : "Not CPF applicable" }));
  const deductionDetails = [
    { label: "Default deduction treatment", value: "Affects net pay unless explicitly excluded" },
    ...Object.entries(resolved.deductionAffectsNetPay).map(([component, enabled]) => ({ label: component.replaceAll("_", " "), value: enabled ? "Affects net pay" : "Does not affect net pay" }))
  ];
  const rules = [
    makeRule({ key: "cpf_contribution_rates", name: "CPF Contribution Rates", category: "CPF", usage: RULE_USAGE.CALCULATION, settingPatterns: [/^cpf_rate_.*_(employee|employer)_percent$/], value: `${cpfDetails.length} statutory age tiers`, details: cpfDetails, enabled: resolved.cpfEnabled, editPath: "/dashboard/payroll/admin/compliance-rules" }),
    makeRule({ key: "cpf_wage_ceiling", name: "CPF Monthly Wage Ceiling", category: "CPF", usage: RULE_USAGE.CALCULATION, settingPatterns: ["cpf_monthly_wage_ceiling", "cpf_wage_ceiling_effective_from"], value: `SGD ${Number(resolved.cpfOrdinaryWageCeiling).toLocaleString("en-SG")}`, enabled: resolved.cpfEnabled, editPath: "/dashboard/payroll/admin/compliance-rules" }),
    makeRule({ key: "cpf_calculation", name: "CPF Calculation", category: "CPF", usage: RULE_USAGE.CALCULATION, settingPatterns: ["compliance_cpf_enabled"], value: resolved.cpfEnabled ? "Enabled" : "Disabled", enabled: resolved.cpfEnabled, editPath: "/dashboard/payroll/admin/compliance-rules" }),
    makeRule({ key: "sdl", name: "Skills Development Levy", category: "SDL", usage: RULE_USAGE.CALCULATION, settingPatterns: ["compliance_sdl_enabled", "sdl_enabled"], value: resolved.sdlEnabled ? "Enabled" : "Disabled", enabled: resolved.sdlEnabled, editPath: "/dashboard/payroll/admin/compliance-rules" }),
    makeRule({ key: "maximum_other_deductions", name: "Maximum Other Deductions", category: "Validation", usage: RULE_USAGE.VALIDATION, settingPatterns: ["compliance_max_other_deduction_percent"], value: `${resolved.maxOtherDeductionPercent}% of gross salary`, editPath: "/dashboard/payroll/admin/compliance-rules" }),
    makeRule({ key: "bank_details_validation", name: "Employee Bank Details Validation", category: "Validation", usage: RULE_USAGE.VALIDATION, settingPatterns: ["compliance_bank_account_enabled"], value: resolved.bankAccountRequired ? "Required" : "Not required", enabled: resolved.bankAccountRequired, editPath: "/dashboard/payroll/admin/compliance-rules" }),
    makeRule({ key: "department_validation", name: "Employee Department Validation", category: "Validation", usage: RULE_USAGE.VALIDATION, settingPatterns: ["compliance_department_enabled"], value: resolved.departmentRequired ? "Required" : "Not required", enabled: resolved.departmentRequired, editPath: "/dashboard/payroll/admin/compliance-rules" }),
    makeRule({ key: "positive_net_pay_validation", name: "Positive Net Pay Validation", category: "Validation", usage: RULE_USAGE.VALIDATION, settingPatterns: ["compliance_positive_net_pay_enabled"], value: resolved.positiveNetPayRequired ? "Required" : "Not required", enabled: resolved.positiveNetPayRequired, editPath: "/dashboard/payroll/admin/compliance-rules" }),
    ...Object.entries(resolved.selfHelpGroupRules).map(([scheme, rule]) => makeRule({ key: scheme.toLowerCase(), name: `${scheme} Contribution`, category: "Community Funds", usage: RULE_USAGE.CALCULATION, settingPatterns: [scheme === "MBMF" ? /^mbmf_(enabled|effective_from|applicable_religion)$/ : new RegExp(`^${scheme.toLowerCase()}_(enabled|effective_from|applicable_race)$`)], value: rule.enabled ? `Enabled for ${rule.eligibilityValue}` : "Disabled", enabled: rule.enabled, editPath: "/dashboard/payroll/admin/compliance-rules" })),
    makeRule({ key: "earning_classification", name: "Earning Component CPF Classification", category: "Earnings", usage: RULE_USAGE.CALCULATION, settingPatterns: [/^earning_component_.+_cpf_applicable$/], value: `${earningDetails.length} component rules`, details: earningDetails, editPath: "/dashboard/payroll/admin/compliance-rules" }),
    makeRule({ key: "deduction_classification", name: "Deduction Net Pay Classification", category: "Deductions", usage: RULE_USAGE.CALCULATION, settingPatterns: [/^deduction_component_.+_affects_net_pay$/], value: `${deductionDetails.length} policy values`, details: deductionDetails, editPath: "/dashboard/payroll/admin/compliance-rules" })
  ];
  const categories = [...new Set(rules.map((rule) => rule.category))].map((category) => ({
    category,
    count: rules.filter((rule) => rule.category === category).length,
    active: rules.filter((rule) => rule.category === category && rule.isActive).length
  }));
  return { asOf: asOf.toISOString(), groupCount: rules.length, activeGroupCount: rules.filter((rule) => rule.isActive).length, categories, rules };
}

async function getEffectivePayrollRules(connection = getPool()) {
  return buildEffectiveRuleCatalogue(await listStoredPayrollSettings(connection));
}

async function getActivePayrollRules(connection = getPool()) {
  return resolveAppliedPayrollRules(await listStoredPayrollSettings(connection));
}

module.exports = {
  buildEffectiveRuleCatalogue,
  DEFAULT_SETTINGS,
  ensurePayrollConfigurationTable,
  getActivePayrollRules,
  getEffectivePayrollRules,
  listStoredPayrollSettings,
  resolveAppliedPayrollRules,
  upsertStoredPayrollSetting
};
