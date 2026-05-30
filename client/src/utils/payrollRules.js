export const cpfAgeTierRows = [
  ["55 and below", "20.00", "17.00"],
  ["Above 55 to 60", "18.00", "16.00"],
  ["Above 60 to 65", "12.50", "12.50"],
  ["Above 65 to 70", "7.50", "9.00"],
  ["Above 70", "5.00", "7.50"]
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
