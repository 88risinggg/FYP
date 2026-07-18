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

  test("calculates SDL from remuneration with minimum and maximum", () => {
    expect(calculateEmployeePayroll({ staff: staff({ base_salary: 500 }), month: 7, year: 2026 }).sdl).toBe(2);
    expect(calculateEmployeePayroll({ staff: staff({ base_salary: 10000 }), month: 7, year: 2026 }).sdl).toBe(11.25);
  });

  test("places unsupported low-wage CPF cases on hold", () => {
    const result = calculateEmployeePayroll({ staff: staff({ base_salary: 700 }), month: 7, year: 2026 });
    expect(result.complianceExceptions).toContain("CPF scheme or wage band requires manual review");
  });
});
