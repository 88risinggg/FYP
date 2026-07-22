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
      updated_by INT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (configuration_id),
      UNIQUE KEY uq_payroll_configuration_type_key (configuration_type, configuration_key),
      KEY idx_payroll_configuration_updated_by (updated_by)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

async function listStoredPayrollSettings(connection = getPool()) {
  await ensurePayrollConfigurationTable(connection);
  const [rows] = await connection.execute(
    `SELECT pc.configuration_id AS setting_id, pc.configuration_key AS setting_key,
            pc.configuration_value AS setting_value, pc.description, pc.updated_at,
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
      setting_id: `default_${key}`,
      setting_key: key,
      setting_value: value,
      description,
      updated_at: null,
      updated_by_name: "System default"
    }));
  return [...rows, ...defaults].sort((a, b) => a.setting_key.localeCompare(b.setting_key));
}

async function upsertStoredPayrollSetting({ settingKey, settingValue, description, updatedBy }, connection = getPool()) {
  await ensurePayrollConfigurationTable(connection);
  await connection.execute(
    `INSERT INTO payroll_configuration
       (configuration_type, configuration_key, configuration_value, description, updated_by)
     VALUES ('setting', ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       configuration_value = VALUES(configuration_value),
       description = VALUES(description),
       updated_by = VALUES(updated_by),
       updated_at = CURRENT_TIMESTAMP`,
    [settingKey, settingValue, description || null, updatedBy || null]
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

async function getActivePayrollRules(connection = getPool()) {
  return resolveAppliedPayrollRules(await listStoredPayrollSettings(connection));
}

module.exports = {
  DEFAULT_SETTINGS,
  ensurePayrollConfigurationTable,
  getActivePayrollRules,
  listStoredPayrollSettings,
  resolveAppliedPayrollRules,
  upsertStoredPayrollSetting
};
