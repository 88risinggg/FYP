/**
 * EVALUATION HEADER
 * FEATURE: PAYROLL - SHARED
 * PURPOSE: Provides reusable statutory Payroll Engine business or integration operations.
 * LAYER: Backend service - contains reusable business rules or external integrations.
 * FIND RELATED CODE: Use Find All References to locate controllers, workers, or services that call it.
 */
const DEFAULT_PAYROLL_RULES_2026 = Object.freeze({
  cpfOrdinaryWageCeiling: 8000,
  cpfScheme: "FULL_RATE_SC_SPR3",
  maxOtherDeductionPercent: 30,
  sdlRate: 0.0025,
  sdlMinimum: 2,
  sdlMaximum: 11.25,
  version: "SG-2026"
});

const CPF_FULL_RATE_TIERS_2026 = Object.freeze([
  { maximumAge: 55, label: "55 and below", employeeRate: 20, employerRate: 17 },
  { maximumAge: 60, label: "Above 55 to 60", employeeRate: 18, employerRate: 16 },
  { maximumAge: 65, label: "Above 60 to 65", employeeRate: 12.5, employerRate: 12.5 },
  { maximumAge: 70, label: "Above 65 to 70", employeeRate: 7.5, employerRate: 9 },
  { maximumAge: Infinity, label: "Above 70", employeeRate: 5, employerRate: 7.5 }
]);

const SHG_BANDS_2026 = Object.freeze({
  CDAC: Object.freeze([
    [2000, 0.5], [3500, 1], [5000, 1.5], [7500, 2], [Infinity, 3]
  ]),
  ECF: Object.freeze([
    [1000, 2], [1500, 4], [2500, 6], [4000, 9], [7000, 12], [10000, 16], [Infinity, 20]
  ]),
  MBMF: Object.freeze([
    [1000, 3], [2000, 4.5], [3000, 6.5], [4000, 15], [6000, 19.5], [8000, 22], [10000, 24], [Infinity, 26]
  ]),
  SINDA: Object.freeze([
    [1000, 1], [1500, 3], [2500, 5], [4500, 7], [7500, 9], [10000, 12], [15000, 18], [Infinity, 30]
  ])
});

function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function getAgeAtPeriodEnd(dateOfBirth, month, year) {
  const birthDate = dateOfBirth instanceof Date
    ? new Date(Date.UTC(dateOfBirth.getFullYear(), dateOfBirth.getMonth(), dateOfBirth.getDate()))
    : new Date(`${String(dateOfBirth).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(birthDate.getTime())) return null;

  const periodEnd = new Date(Date.UTC(year, month, 0));
  let age = periodEnd.getUTCFullYear() - birthDate.getUTCFullYear();
  const birthdayNotReached =
    periodEnd.getUTCMonth() < birthDate.getUTCMonth() ||
    (periodEnd.getUTCMonth() === birthDate.getUTCMonth() && periodEnd.getUTCDate() < birthDate.getUTCDate());
  if (birthdayNotReached) age -= 1;
  return age;
}

function getCpfTier(age, tiers = CPF_FULL_RATE_TIERS_2026) {
  return tiers.find((tier) => age <= tier.maximumAge) || tiers.at(-1);
}

function getBandAmount(fund, wages, configuredBands) {
  const bands = Array.isArray(configuredBands) && configuredBands.length
    ? configuredBands
    : SHG_BANDS_2026[fund];
  const band = bands?.find(([maximumWage]) => maximumWage === null || Number(wages) <= Number(maximumWage));
  return Number(band?.[1] || 0);
}

function isEffective(effectiveFrom, month, year) {
  if (!effectiveFrom || !month || !year) return true;
  const effectiveDate = new Date(`${String(effectiveFrom).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(effectiveDate.getTime())) return true;
  return new Date(Date.UTC(year, month - 1, 1)) >= effectiveDate;
}

function getSelfHelpGroupDeductions({ race, religion, totalWages, month, year, rules = {} }) {
  const normalizedRace = normalize(race).split(/[-/]/)[0].trim();
  const normalizedReligion = normalize(religion);
  const funds = [];
  const configuredRules = rules.selfHelpGroupRules || {};
  const bandsForPeriod = (fund) => {
    const rule = configuredRules[fund];
    if (!Array.isArray(rule?.versions) || !rule.versions.length) return rule?.bands;
    const period = `${year}-${String(month).padStart(2, "0")}-01`;
    const active = [...rule.versions]
      .filter((version) => String(version.effectiveFrom || "0000-00-00").slice(0, 10) <= period)
      .sort((a, b) => String(b.effectiveFrom).localeCompare(String(a.effectiveFrom)))[0];
    return active?.bands || rule?.bands;
  };
  const eligible = (fund, defaultEligible) => {
    const rule = configuredRules[fund];
    if (!rule) return defaultEligible;
    if (!rule.enabled || !isEffective(rule.effectiveFrom, month, year)) return false;
    const actual = rule.eligibilityField === "religion" ? normalizedReligion : normalizedRace;
    const expected = normalize(rule.eligibilityValue);
    if (["muslim", "islam"].includes(expected)) return ["muslim", "islam"].includes(actual);
    if (fund === "SINDA" && expected === "indian") {
      return ["indian", "bangladeshi", "bengali", "pakistani", "sri lankan"].includes(actual);
    }
    return actual === expected;
  };

  if (eligible("MBMF", ["islam", "muslim"].includes(normalizedReligion))) {
    funds.push({ fund: "MBMF", amount: getBandAmount("MBMF", totalWages, bandsForPeriod("MBMF")), basis: "religion" });
  }
  if (eligible("CDAC", normalizedRace === "chinese")) {
    funds.push({ fund: "CDAC", amount: getBandAmount("CDAC", totalWages), basis: "race" });
  }
  if (eligible("SINDA", ["indian", "bangladeshi", "bengali", "pakistani", "sri lankan"].includes(normalizedRace))) {
    funds.push({ fund: "SINDA", amount: getBandAmount("SINDA", totalWages), basis: "race" });
  }
  if (eligible("ECF", normalizedRace === "eurasian")) {
    funds.push({ fund: "ECF", amount: getBandAmount("ECF", totalWages), basis: "race" });
  }

  return funds.filter((item) => item.amount > 0);
}

function calculateCpf({ wages, age, rules }) {
  if (rules.cpfEnabled === false) {
    return { employee: 0, employer: 0, tier: null, wageBase: 0, unsupported: false };
  }
  if (rules.cpfScheme !== "FULL_RATE_SC_SPR3") {
    return { employee: 0, employer: 0, tier: null, wageBase: 0, unsupported: true };
  }

  const tier = getCpfTier(age, rules.cpfRateTiers || CPF_FULL_RATE_TIERS_2026);
  const wageBase = Math.min(Number(wages || 0), Number(rules.cpfOrdinaryWageCeiling));
  if (wageBase <= 50) return { employee: 0, employer: 0, tier, wageBase, unsupported: false };
  if (wageBase <= 750) return { employee: 0, employer: 0, tier, wageBase, unsupported: true };

  const totalContribution = Math.round(wageBase * ((tier.employeeRate + tier.employerRate) / 100));
  const employee = Math.floor(wageBase * (tier.employeeRate / 100));
  return {
    employee,
    employer: totalContribution - employee,
    tier,
    wageBase,
    unsupported: false
  };
}

function calculateEmployeePayroll({ staff, month, year, allowances = [], reimbursements = [], otherDeductions = [], configuration = {} }) {
  const rules = { ...DEFAULT_PAYROLL_RULES_2026, ...configuration };
  const basicSalary = roundMoney(staff.base_salary);
  const payrollEarnings = [
    ...allowances,
    ...reimbursements.map((item) => ({ ...item, label: item.label || "Claim reimbursement", cpfApplicable: false }))
  ];
  const allowanceTotal = roundMoney(payrollEarnings.reduce((sum, item) => sum + Number(item.amount || 0), 0));
  const grossSalary = roundMoney(basicSalary + allowanceTotal);
  const componentRules = rules.componentCpfApplicable || {};
  const componentKey = (label) => {
    const normalized = normalize(label).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    if (normalized.includes("commission")) return "commission";
    if (normalized.startsWith("loan")) return "loan";
    if (normalized.startsWith("salary_advance")) return "salary_advance";
    return normalized;
  };
  const defaultCpfApplicability = { reimbursement: false, tips: false };
  const basicCpfApplicable = componentRules.basic_salary ?? true;
  const cpfApplicableAllowances = payrollEarnings.filter((item) => {
    if (item.cpfApplicable === false) return false;
    const key = componentKey(item.label);
    return componentRules[key] ?? defaultCpfApplicability[key] ?? true;
  });
  const cpfApplicableWages = roundMoney(
    (basicCpfApplicable ? basicSalary : 0)
    + cpfApplicableAllowances.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  );
  const age = getAgeAtPeriodEnd(staff.date_of_birth, month, year);
  const complianceExceptions = [];

  if (rules.cpfEnabled !== false && age === null) complianceExceptions.push("Date of birth is required for CPF calculation");
  if (rules.bankAccountRequired !== false && (!staff.bank || !staff.account_no)) complianceExceptions.push("Bank account details are incomplete");
  if (rules.departmentRequired !== false && !staff.department_name) complianceExceptions.push("Department is required");
  if (basicSalary <= 0) complianceExceptions.push("Base salary must be positive");

  const configuredCeiling = rules.cpfOrdinaryWageCeiling;
  if (!isEffective(rules.cpfWageCeilingEffectiveFrom, month, year)) {
    rules.cpfOrdinaryWageCeiling = DEFAULT_PAYROLL_RULES_2026.cpfOrdinaryWageCeiling;
  }
  const cpf = age === null && rules.cpfEnabled !== false
    ? { employee: 0, employer: 0, tier: null, wageBase: 0, unsupported: true }
    : calculateCpf({ wages: cpfApplicableWages, age, rules });
  rules.cpfOrdinaryWageCeiling = configuredCeiling;
  // A missing DOB already has a precise source-data exception. Do not add the
  // derived generic CPF warning as a second blocker for the same root cause.
  if (cpf.unsupported && age !== null) {
    complianceExceptions.push("CPF scheme or wage band requires manual review");
  }

  const selfHelpGroups = getSelfHelpGroupDeductions({
    race: staff.race,
    religion: staff.religion,
    totalWages: grossSalary,
    month,
    year,
    rules
  });
  const shgTotal = roundMoney(selfHelpGroups.reduce((sum, item) => sum + item.amount, 0));
  const mbmfAmount = roundMoney(selfHelpGroups.find((item) => item.fund === "MBMF")?.amount || 0);
  const deductionRules = rules.deductionAffectsNetPay || {};
  const appliedOtherDeductions = otherDeductions.filter((item) => deductionRules[componentKey(item.label)] !== false);
  const otherDeductionTotal = roundMoney(appliedOtherDeductions.reduce((sum, item) => sum + Number(item.amount || 0), 0));
  if (grossSalary > 0 && otherDeductionTotal > grossSalary * (Number(rules.maxOtherDeductionPercent) / 100)) {
    complianceExceptions.push(`Other deductions exceed ${rules.maxOtherDeductionPercent}% of gross salary`);
  }

  const employeeCpfDeduction = deductionRules.employee_cpf === false ? 0 : cpf.employee;
  const appliedSelfHelpTotal = roundMoney(selfHelpGroups.reduce(
    (sum, item) => sum + (deductionRules[item.fund.toLowerCase()] === false ? 0 : item.amount),
    0
  ));
  const totalDeductions = roundMoney(employeeCpfDeduction + appliedSelfHelpTotal + otherDeductionTotal);
  const netSalary = roundMoney(grossSalary - totalDeductions);
  if (rules.positiveNetPayRequired !== false && netSalary <= 0) complianceExceptions.push("Net salary must be positive");

  const sdl = grossSalary <= 0 || rules.sdlEnabled === false
    ? 0
    : roundMoney(Math.max(rules.sdlMinimum, Math.min(rules.sdlMaximum, grossSalary * rules.sdlRate)));

  return {
    age,
    allowanceTotal,
    basicSalary,
    complianceExceptions,
    cpfEmployee: roundMoney(cpf.employee),
    cpfEmployer: roundMoney(cpf.employer),
    cpfTier: cpf.tier?.label || "Manual review",
    cpfWageBase: roundMoney(cpf.wageBase),
    grossSalary,
    mbmfAmount,
    netSalary,
    otherDeductionTotal,
    sdl,
    selfHelpGroups,
    totalDeductions,
    deductionBreakdown: {
      employeeCpf: roundMoney(cpf.employee),
      selfHelpGroups,
      otherDeductions: appliedOtherDeductions.map((item) => ({
        label: item.label || "Other deduction",
        amount: roundMoney(item.amount)
      })),
      reimbursements: reimbursements.map((item) => ({
        claimId: item.claimId,
        label: item.label || "Claim reimbursement",
        amount: roundMoney(item.amount),
        expenseDate: item.expenseDate || null,
        cpfApplicable: false
      }))
    }
  };
}

module.exports = {
  CPF_FULL_RATE_TIERS_2026,
  DEFAULT_PAYROLL_RULES_2026,
  SHG_BANDS_2026,
  calculateCpf,
  calculateEmployeePayroll,
  getAgeAtPeriodEnd,
  getBandAmount,
  getSelfHelpGroupDeductions
};
