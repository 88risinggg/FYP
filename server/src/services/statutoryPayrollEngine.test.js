const {
  calculateEmployeePayroll,
  getAgeAtPeriodEnd,
  getSelfHelpGroupDeductions
} = require("./statutoryPayrollEngine");

function staff(overrides = {}) {
  return {
    account_no: "123456789",
    bank: "DBS",
    base_salary: 5000,
    date_of_birth: "1990-01-01",
    department_name: "Finance",
    race: "Chinese",
    religion: "Christianity",
    ...overrides
  };
}

describe("2026 statutory payroll engine", () => {
  test("derives age at the payroll period end", () => {
    expect(getAgeAtPeriodEnd("1970-08-01", 7, 2026)).toBe(55);
    expect(getAgeAtPeriodEnd("1970-07-01", 7, 2026)).toBe(56);
    expect(getAgeAtPeriodEnd(new Date(1970, 7, 1), 7, 2026)).toBe(55);
  });

  test("applies full-rate CPF and the 2026 ordinary wage ceiling", () => {
    const result = calculateEmployeePayroll({
      staff: staff({ base_salary: 10000 }),
      month: 7,
      year: 2026
    });
    expect(result.cpfWageBase).toBe(8000);
    expect(result.cpfEmployee).toBe(1600);
    expect(result.cpfEmployer).toBe(1360);
  });

  test("uses the correct above-60 2026 CPF tier", () => {
    const result = calculateEmployeePayroll({
      staff: staff({ date_of_birth: "1964-01-01" }),
      month: 7,
      year: 2026
    });
    expect(result.cpfTier).toBe("Above 60 to 65");
    expect(result.cpfEmployee).toBe(625);
    expect(result.cpfEmployer).toBe(625);
  });

  test("applies both SINDA and MBMF to an Indian Muslim employee", () => {
    const deductions = getSelfHelpGroupDeductions({
      race: "Indian",
      religion: "Islam",
      totalWages: 5000
    });
    expect(deductions).toEqual([
      { fund: "MBMF", amount: 19.5, basis: "religion" },
      { fund: "SINDA", amount: 9, basis: "race" }
    ]);
  });

  test("selects the effective-dated MBMF schedule for the payroll period", () => {
    const rules = { selfHelpGroupRules: { MBMF: { enabled: true, eligibilityField: "religion", eligibilityValue: "Muslim", versions: [
      { effectiveFrom: "2016-06-01", bands: [[null, 15]] },
      { effectiveFrom: "2027-01-01", bands: [[null, 18]] }
    ] } } };
    expect(getSelfHelpGroupDeductions({ race: "", religion: "Muslim", totalWages: 4000, month: 12, year: 2026, rules })[0].amount).toBe(15);
    expect(getSelfHelpGroupDeductions({ race: "", religion: "Muslim", totalWages: 4000, month: 1, year: 2027, rules })[0].amount).toBe(18);
  });

  test("calculates SDL from remuneration with minimum and maximum", () => {
    expect(calculateEmployeePayroll({ staff: staff({ base_salary: 500 }), month: 7, year: 2026 }).sdl).toBe(2);
    expect(calculateEmployeePayroll({ staff: staff({ base_salary: 10000 }), month: 7, year: 2026 }).sdl).toBe(11.25);
  });

  test("places unsupported low-wage CPF cases on hold", () => {
    const result = calculateEmployeePayroll({ staff: staff({ base_salary: 700 }), month: 7, year: 2026 });
    expect(result.complianceExceptions).toContain("CPF scheme or wage band requires manual review");
  });

  test("applies configured CPF rates, wage ceiling and earning classifications", () => {
    const result = calculateEmployeePayroll({
      staff: staff({ base_salary: 4000 }),
      month: 7,
      year: 2026,
      allowances: [{ label: "Allowance", amount: 1000 }],
      configuration: {
        cpfOrdinaryWageCeiling: 3000,
        cpfRateTiers: [
          { maximumAge: Infinity, label: "Configured", employeeRate: 10, employerRate: 8 }
        ],
        componentCpfApplicable: { allowance: false }
      }
    });

    expect(result.grossSalary).toBe(5000);
    expect(result.cpfWageBase).toBe(3000);
    expect(result.cpfEmployee).toBe(300);
    expect(result.cpfEmployer).toBe(240);
  });

  test("honours disabled compliance and statutory rules", () => {
    const result = calculateEmployeePayroll({
      staff: staff({ bank: "", account_no: "", department_name: "", race: "Indian", religion: "Islam" }),
      month: 7,
      year: 2026,
      configuration: {
        cpfEnabled: false,
        sdlEnabled: false,
        bankAccountRequired: false,
        departmentRequired: false,
        selfHelpGroupRules: {
          MBMF: { enabled: false },
          SINDA: { enabled: false }
        }
      }
    });

    expect(result.cpfEmployee).toBe(0);
    expect(result.selfHelpGroups).toEqual([]);
    expect(result.sdl).toBe(0);
    expect(result.complianceExceptions).toEqual([]);
  });

  test("adds claim reimbursements to net salary without increasing CPF wages", () => {
    const baseline = calculateEmployeePayroll({ staff: staff({ base_salary: 4000 }), month: 7, year: 2026 });
    const result = calculateEmployeePayroll({
      staff: staff({ base_salary: 4000 }), month: 7, year: 2026,
      reimbursements: [{ claimId: "CLM-1", label: "Transport reimbursement", amount: 125 }]
    });
    expect(result.grossSalary).toBe(baseline.grossSalary + 125);
    expect(result.netSalary).toBe(baseline.netSalary + 125);
    expect(result.cpfEmployee).toBe(baseline.cpfEmployee);
    expect(result.cpfEmployer).toBe(baseline.cpfEmployer);
    expect(result.deductionBreakdown.reimbursements[0]).toMatchObject({ claimId: "CLM-1", cpfApplicable: false, amount: 125 });
  });
});
