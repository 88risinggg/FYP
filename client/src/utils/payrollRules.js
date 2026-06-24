export const cpfAgeTierRows = [
  ["55 and below", "20.00", "17.00"],
  ["Above 55 to 60", "19.00", "16.00"],
  ["Above 60 to 65", "15.50", "13.00"],
  ["Above 65 to 70", "12.00", "10.00"],
  ["Above 70", "7.50", "7.50"]
].map(([ageGroup, employeeRate, employerRate]) => ({
  ageGroup,
  slug: slugify(ageGroup),
  employeeRate,
  employerRate
}));

export const earningComponentRows = [
  ["Basic salary", "Yes", "Ordinary Wage", "Base monthly salary subject to CPF."],
  ["Allowance", "Yes", "Ordinary Wage", "Regular cash allowance included in CPF wage base."],
  ["Commission", "Yes", "Additional Wage", "Variable sales or performance payment."],
  ["Bonus", "Yes", "Additional Wage", "Additional wage subject to CPF ceiling rules."],
  ["Reimbursement", "No", "Non-CPF", "Business expense repayment is excluded from CPF."],
  ["Tips", "No", "Non-CPF", "Excluded unless Admin reclassifies it as CPF-applicable pay."]
].map(([component, includeCpf, wageType, remarks]) => ({
  component,
  slug: slugify(component),
  includeCpf,
  wageType,
  remarks
}));

export const deductionComponentRows = [
  ["Employee CPF", "Statutory", "Yes", "No", "Employee CPF reduces net pay but does not reduce CPF wage base."],
  ["Loan", "Loan", "Yes", "No", "Loan repayment deduction."],
  ["MBMF", "Statutory", "Yes", "No", "Mosque Building and Mendaki Fund contribution. Applies only when staff religion is Muslim."],
  ["CDAC", "Statutory", "Yes", "No", "Chinese Development Assistance Council contribution. Applies based on staff race being Chinese."],
  ["SINDA", "Statutory", "Yes", "No", "Singapore Indian Development Association contribution. Applies based on staff race being Indian."],
  ["ECF", "Statutory", "Yes", "No", "Eurasian Community Fund contribution. Applies based on staff race being Eurasian."],
  ["Salary advance", "Recovery", "Yes", "No", "Recovery of salary already advanced."],
  ["No-pay leave", "Recovery", "Yes", "Yes", "Reduces gross CPF-applicable wages for unpaid leave."]
].map(([deduction, type, affectsNetPay, affectsCpfWageBase, remarks]) => ({
  deduction,
  slug: slugify(deduction),
  type,
  affectsNetPay,
  affectsCpfWageBase,
  remarks
}));

export const employerContributionRows = [
  ["Employer CPF", "Statutory", "CPF-applicable wages", "Employer CPF cost based on Admin age-tier rate."],
  ["SDL", "Statutory", "0.25% of monthly remuneration, minimum SGD 2 and capped at SGD 11.25", "Skills Development Levy employer-side cost."],
  ["Foreign Worker Levy", "Statutory", "MOM sector, quota and worker type", "Applies to Work Permit and S Pass holders instead of CPF where required."],
  ["Other employer-side statutory cost", "Other", "Admin-defined", "Reserved for future employer statutory costs."]
].map(([item, type, basis, remarks]) => ({
  item,
  slug: slugify(item),
  type,
  basis,
  remarks
}));

export const mbmfDefaultSettings = {
  enabled: "Enabled",
  effectiveFrom: "2026-01-01",
  rateType: "Percentage of Gross Salary",
  employeeRate: "0.50",
  employerRate: "0.50",
  monthlyWageCeiling: "7000.00",
  employerExpenseAccount: "6810 - MBMF Employer Expense",
  employeePayableAccount: "2110 - MBMF Payable (Employee)",
  clearingAccount: "2140 - MBMF Payable Clearing",
  paymentBankAccount: "1210 - Bank - MBMF",
  applicableReligion: "Muslim"
};

export const complianceDefaultSettings = {
  cpfEnabled: "Enabled",
  bankAccountEnabled: "Enabled",
  departmentEnabled: "Enabled",
  positiveNetPayEnabled: "Enabled",
  sdlEnabled: "Enabled",
  mbmfEnabled: "Enabled",
  loanRecoveryEnabled: "Enabled",
  grossIncreaseEnabled: "Enabled",
  financeApprovalLockEnabled: "Enabled",
  paymentDeadlineEnabled: "Enabled",
  auditTrailEnabled: "Enabled",
  maxOtherDeductionPercent: "30",
  maxGrossIncreasePercent: "20"
};
export const cpfCalculationSettings = [
  {
    key: "cpf_calculation_basis",
    label: "CPF Calculation Basis",
    description: "Choose whether CPF is calculated by percentage of CPF-applicable wages or fixed amount.",
    placeholder: "% of CPF-applicable wages"
  },
  {
    key: "cpf_rate_view_mode",
    label: "CPF Rate View",
    description: "Default rate view shown to Finance when reviewing CPF settings.",
    placeholder: "Age Tier"
  },
  {
    key: "cpf_additional_wage_basis",
    label: "Additional Wage Basis",
    description: "Rule for bonuses and other additional wages when included in CPF.",
    placeholder: "Apply CPF ceiling"
  }
];

export const cpfCeilingSettings = [
  {
    key: "cpf_wage_ceiling_effective_from",
    label: "Effective Date",
    description: "Date the monthly wage ceiling takes effect.",
    placeholder: "2026-01-01"
  },
  {
    key: "cpf_monthly_wage_ceiling",
    label: "Monthly Wage Ceiling (SGD)",
    description: "Monthly CPF wage ceiling applied based on pay period.",
    placeholder: "8000.00"
  }
];

export const cpfCeilingHistory = [
  ["2026-01-01", "8,000.00"],
  ["2025-01-01", "7,400.00"],
  ["2024-01-01", "6,800.00"]
];

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .replaceAll("&", "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function buildSettingsByKey(settings = []) {
  return Object.fromEntries(settings.map((setting) => [setting.setting_key, setting]));
}

export function getSettingValue(settingsByKey, key, fallback = "") {
  return settingsByKey[key]?.setting_value || fallback;
}

export function createDefaultFinancePayrollConfig() {
  return resolveFinancePayrollConfig([]);
}

export function resolveFinancePayrollConfig(settings = []) {
  const settingsByKey = buildSettingsByKey(settings);
  const latestUpdatedAt = settings
    .map((setting) => setting.updated_at)
    .filter(Boolean)
    .sort((first, second) => new Date(second) - new Date(first))[0] || "";
  const rateTiers = cpfAgeTierRows.map((row) => ({
    ageGroup: row.ageGroup,
    employeeOrdinaryRate: Number(getSettingValue(settingsByKey, `cpf_rate_${row.slug}_employee_percent`, row.employeeRate)),
    employerOrdinaryRate: Number(getSettingValue(settingsByKey, `cpf_rate_${row.slug}_employer_percent`, row.employerRate))
  }));
  const componentRules = Object.fromEntries(
    earningComponentRows.map((row) => [
      row.component.toLowerCase(),
      {
        cpfApplicable: getSettingValue(settingsByKey, `earning_component_${row.slug}_cpf_applicable`, row.includeCpf) === "Yes",
        wageType: getSettingValue(settingsByKey, `earning_component_${row.slug}_wage_type`, row.wageType),
        remarks: getSettingValue(settingsByKey, `earning_component_${row.slug}_remarks`, row.remarks)
      }
    ])
  );
  const deductionRules = Object.fromEntries(
    deductionComponentRows.map((row) => [
      row.deduction.toLowerCase(),
      {
        type: getSettingValue(settingsByKey, `deduction_component_${row.slug}_type`, row.type),
        affectsNetPay: getSettingValue(settingsByKey, `deduction_component_${row.slug}_affects_net_pay`, row.affectsNetPay) === "Yes",
        affectsCpfWageBase: getSettingValue(settingsByKey, `deduction_component_${row.slug}_affects_cpf_wage_base`, row.affectsCpfWageBase) === "Yes",
        remarks: getSettingValue(settingsByKey, `deduction_component_${row.slug}_remarks`, row.remarks)
      }
    ])
  );
  const employerContributionRules = Object.fromEntries(
    employerContributionRows.map((row) => [
      row.item.toLowerCase(),
      {
        type: getSettingValue(settingsByKey, `employer_contribution_${row.slug}_type`, row.type),
        basis: getSettingValue(settingsByKey, `employer_contribution_${row.slug}_basis`, row.basis),
        remarks: getSettingValue(settingsByKey, `employer_contribution_${row.slug}_remarks`, row.remarks)
      }
    ])
  );

  return {
    source: "Admin Payroll Settings",
    monthlyWageCeiling: Number(getSettingValue(settingsByKey, "cpf_monthly_wage_ceiling", "8000")),
    effectiveFrom: getSettingValue(settingsByKey, "cpf_wage_ceiling_effective_from", "2026-01-01"),
    paymentDue: getSettingValue(settingsByKey, "cpf_payment_due_day", "14th of next month"),
    updatedAt: latestUpdatedAt,
    compliance: {
      cpfEnabled: getSettingValue(settingsByKey, "compliance_cpf_enabled", complianceDefaultSettings.cpfEnabled) === "Enabled",
      bankAccountEnabled: getSettingValue(settingsByKey, "compliance_bank_account_enabled", complianceDefaultSettings.bankAccountEnabled) === "Enabled",
      departmentEnabled: getSettingValue(settingsByKey, "compliance_department_enabled", complianceDefaultSettings.departmentEnabled) === "Enabled",
      positiveNetPayEnabled: getSettingValue(settingsByKey, "compliance_positive_net_pay_enabled", complianceDefaultSettings.positiveNetPayEnabled) === "Enabled",
      sdlEnabled: getSettingValue(settingsByKey, "compliance_sdl_enabled", complianceDefaultSettings.sdlEnabled) === "Enabled",
      mbmfEnabled: getSettingValue(settingsByKey, "compliance_mbmf_enabled", complianceDefaultSettings.mbmfEnabled) === "Enabled",
      loanRecoveryEnabled: getSettingValue(settingsByKey, "compliance_loan_recovery_enabled", complianceDefaultSettings.loanRecoveryEnabled) === "Enabled",
      grossIncreaseEnabled: getSettingValue(settingsByKey, "compliance_gross_increase_enabled", complianceDefaultSettings.grossIncreaseEnabled) === "Enabled",
      financeApprovalLockEnabled: getSettingValue(settingsByKey, "compliance_finance_approval_lock_enabled", complianceDefaultSettings.financeApprovalLockEnabled) === "Enabled",
      paymentDeadlineEnabled: getSettingValue(settingsByKey, "compliance_payment_deadline_enabled", complianceDefaultSettings.paymentDeadlineEnabled) === "Enabled",
      auditTrailEnabled: getSettingValue(settingsByKey, "compliance_audit_trail_enabled", complianceDefaultSettings.auditTrailEnabled) === "Enabled",
      maxOtherDeductionPercent: Number(getSettingValue(settingsByKey, "compliance_max_other_deduction_percent", complianceDefaultSettings.maxOtherDeductionPercent)),
      maxGrossIncreasePercent: Number(getSettingValue(settingsByKey, "compliance_max_gross_increase_percent", complianceDefaultSettings.maxGrossIncreasePercent))
    },
    rateTiers,
    componentRules,
    deductionRules,
    employerContributionRules,
    mbmf: {
      enabled: getSettingValue(settingsByKey, "mbmf_enabled", mbmfDefaultSettings.enabled) === "Enabled",
      applicableReligion: getSettingValue(settingsByKey, "mbmf_applicable_religion", mbmfDefaultSettings.applicableReligion),
      effectiveFrom: getSettingValue(settingsByKey, "mbmf_effective_from", mbmfDefaultSettings.effectiveFrom),
      rateType: getSettingValue(settingsByKey, "mbmf_rate_type", mbmfDefaultSettings.rateType),
      employeeRate: Number(getSettingValue(settingsByKey, "mbmf_employee_rate_percent", mbmfDefaultSettings.employeeRate)),
      employerRate: Number(getSettingValue(settingsByKey, "mbmf_employer_rate_percent", mbmfDefaultSettings.employerRate)),
      monthlyWageCeiling: Number(getSettingValue(settingsByKey, "mbmf_monthly_wage_ceiling", mbmfDefaultSettings.monthlyWageCeiling)),
      employerExpenseAccount: getSettingValue(settingsByKey, "mbmf_account_employer_expense", mbmfDefaultSettings.employerExpenseAccount),
      employeePayableAccount: getSettingValue(settingsByKey, "mbmf_account_employee_payable", mbmfDefaultSettings.employeePayableAccount),
      clearingAccount: getSettingValue(settingsByKey, "mbmf_account_clearing", mbmfDefaultSettings.clearingAccount),
      paymentBankAccount: getSettingValue(settingsByKey, "mbmf_account_payment_bank", mbmfDefaultSettings.paymentBankAccount)
    }
  };
}
