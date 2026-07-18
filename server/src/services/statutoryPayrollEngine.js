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

function getCpfTier(age) {
  return CPF_FULL_RATE_TIERS_2026.find((tier) => age <= tier.maximumAge) || CPF_FULL_RATE_TIERS_2026.at(-1);
}

function getBandAmount(fund, wages) {
  const band = SHG_BANDS_2026[fund]?.find(([maximumWage]) => Number(wages) <= maximumWage);
  return Number(band?.[1] || 0);
}

function getSelfHelpGroupDeductions({ race, religion, totalWages }) {
  const normalizedRace = normalize(race).split(/[-/]/)[0].trim();
  const normalizedReligion = normalize(religion);
  const funds = [];

  if (["islam", "muslim"].includes(normalizedReligion)) {
    funds.push({ fund: "MBMF", amount: getBandAmount("MBMF", totalWages), basis: "religion" });
  }
  if (normalizedRace === "chinese") {
    funds.push({ fund: "CDAC", amount: getBandAmount("CDAC", totalWages), basis: "race" });
  }
  if (["indian", "bangladeshi", "bengali", "pakistani", "sri lankan"].includes(normalizedRace)) {
    funds.push({ fund: "SINDA", amount: getBandAmount("SINDA", totalWages), basis: "race" });
  }
  if (normalizedRace === "eurasian") {
    funds.push({ fund: "ECF", amount: getBandAmount("ECF", totalWages), basis: "race" });
  }

  return funds.filter((item) => item.amount > 0);
}

function calculateCpf({ wages, age, rules }) {
  if (rules.cpfScheme !== "FULL_RATE_SC_SPR3") {
    return { employee: 0, employer: 0, tier: null, wageBase: 0, unsupported: true };
  }

  const tier = getCpfTier(age);
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

function calculateEmployeePayroll({ staff, month, year, allowances = [], otherDeductions = [], configuration = {} }) {
  const rules = { ...DEFAULT_PAYROLL_RULES_2026, ...configuration };
  const basicSalary = roundMoney(staff.base_salary);
  const allowanceTotal = roundMoney(allowances.reduce((sum, item) => sum + Number(item.amount || 0), 0));
  const grossSalary = roundMoney(basicSalary + allowanceTotal);
  const age = getAgeAtPeriodEnd(staff.date_of_birth, month, year);
  const complianceExceptions = [];

  if (age === null) complianceExceptions.push("Date of birth is required for CPF calculation");
  if (!staff.bank || !staff.account_no) complianceExceptions.push("Bank account details are incomplete");
  if (!staff.department_name) complianceExceptions.push("Department is required");
  if (basicSalary <= 0) complianceExceptions.push("Base salary must be positive");

  const cpf = age === null
    ? { employee: 0, employer: 0, tier: null, wageBase: 0, unsupported: true }
    : calculateCpf({ wages: grossSalary, age, rules });
  if (cpf.unsupported) {
    complianceExceptions.push("CPF scheme or wage band requires manual review");
  }

  const selfHelpGroups = getSelfHelpGroupDeductions({
    race: staff.race,
    religion: staff.religion,
    totalWages: grossSalary
  });
  const shgTotal = roundMoney(selfHelpGroups.reduce((sum, item) => sum + item.amount, 0));
  const mbmfAmount = roundMoney(selfHelpGroups.find((item) => item.fund === "MBMF")?.amount || 0);
  const otherDeductionTotal = roundMoney(otherDeductions.reduce((sum, item) => sum + Number(item.amount || 0), 0));
  if (grossSalary > 0 && otherDeductionTotal > grossSalary * (Number(rules.maxOtherDeductionPercent) / 100)) {
    complianceExceptions.push(`Other deductions exceed ${rules.maxOtherDeductionPercent}% of gross salary`);
  }

  const totalDeductions = roundMoney(cpf.employee + shgTotal + otherDeductionTotal);
  const netSalary = roundMoney(grossSalary - totalDeductions);
  if (netSalary <= 0) complianceExceptions.push("Net salary must be positive");

  const sdl = grossSalary <= 0
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
      otherDeductions: otherDeductions.map((item) => ({
        label: item.label || "Other deduction",
        amount: roundMoney(item.amount)
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
