const { _test } = require("./financePayrollAdjustmentService");
const { pool } = require("../config/db");

afterAll(async () => {
  await pool.end();
});

describe("Finance payroll adjustment proposal rules", () => {
  test("caps deductions deterministically without changing their order", () => {
    expect(_test.capDeductions([
      { label: "Loan A", amount: 300 },
      { label: "Advance B", amount: 250 }
    ], 400)).toEqual([
      { label: "Loan A", amount: 300, scheduledAmount: 300, deferredAmount: 0 },
      { label: "Advance B", amount: 100, scheduledAmount: 250, deferredAmount: 150 }
    ]);
  });

  test.each([
    ["Date of birth is required for CPF calculation", "DOB_REQUIRED", "HR"],
    ["Bank account details are incomplete", "BANK_DETAILS_REQUIRED", "HR"],
    ["Department is required", "DEPARTMENT_REQUIRED", "HR"],
    ["Base salary must be positive", "BASE_SALARY_REQUIRED", "HR/Admin"]
  ])("turns non-inventable source issues into blockers", (message, code, owner) => {
    expect(_test.blockerFor(message)).toMatchObject({ code, owner });
  });

  test("does not classify a deterministic deduction exception as missing source data", () => {
    expect(_test.blockerFor("Other deductions exceed 30% of gross salary")).toBeNull();
  });

  const snapshot = { version: "rules-v7", maxOtherDeductionPercent: 30 };
  const run = { updated_at: "2026-05-20T09:00:00.000Z" };
  const original = { grossPay: 1500, totalDeductions: 900, employeeCpf: 300, employerCpf: 255, mbmf: 5, sdl: 11.25, netPay: 600, otherDeductions: [{ amount: 550 }] };

  test("explains a deduction cap with its snapshot limit and deferred balance", () => {
    const explanation = _test.buildAdjustmentExplanation({
      code: "DEDUCTION_CAP", exceptions: ["Other deductions exceed 30% of gross salary"], original,
      proposed: { ...original, totalDeductions: 800, netPay: 700, otherDeductions: [{ amount: 450 }] },
      rules: snapshot, run, month: 5, year: 2026
    });
    expect(explanation.ruleApplied).toContain("rules-v7");
    expect(explanation.ruleApplied).toContain("30%");
    expect(explanation.changeMade).toContain("deferred");
    expect(explanation.changeMade).toContain("100");
    expect(explanation.affectedComponents).toEqual(expect.arrayContaining(["Total deductions", "Net pay"]));
    expect(explanation.period).toEqual({ month: 5, year: 2026 });
  });

  test("explains positive-net protection from available pay", () => {
    const explanation = _test.buildAdjustmentExplanation({
      code: "POSITIVE_NET_PROTECTION", exceptions: ["Net salary must remain positive"], original,
      proposed: { ...original, totalDeductions: 599.99, netPay: 0.01, otherDeductions: [{ amount: 249.99 }] },
      rules: snapshot, run, month: 5, year: 2026,
      positiveNetContext: { netWithoutRecoveries: 250, maximumSafeRecovery: 249.99 }
    });
    expect(explanation.calculationSteps.join(" ")).toContain("249.99");
    expect(explanation.expectedOutcome).toContain("0.01");
    expect(explanation.expectedOutcome).toContain("later payroll period");
  });

  test("identifies statutory components changed by snapshot recalculation", () => {
    const explanation = _test.buildAdjustmentExplanation({
      code: "STATUTORY_RECALCULATION", exceptions: ["CPF differs"], original,
      proposed: { ...original, employeeCpf: 310, netPay: 590 }, rules: snapshot, run, month: 5, year: 2026
    });
    expect(explanation.affectedComponents).toEqual(["Employee CPF", "Net pay"]);
    expect(explanation.calculationSteps).toEqual(expect.arrayContaining([expect.stringContaining("Employee CPF")]));
  });

  test("source blockers name the owner and prohibit invented data", () => {
    const blocker = _test.blockerFor("Date of birth is required for CPF calculation");
    const explanation = _test.buildSourceBlockerExplanation({ blocker, exception: "Date of birth is required for CPF calculation", rules: snapshot, run, month: 5, year: 2026 });
    expect(explanation.sourceActionRequired).toContain("HR must correct date_of_birth");
    expect(explanation.changeMade).toContain("cannot be inferred safely");
    expect(explanation.affectedComponents).toEqual([]);
  });

  test.each([
    ["Date of birth is required for CPF calculation", "date_of_birth"],
    ["Bank account details are incomplete", "bank/account_no"],
    ["Department is required", "department_name"],
    ["Base salary must be positive", "base_salary"]
  ])("explains required source action for %s", (exception, field) => {
    const blocker = _test.blockerFor(exception);
    const explanation = _test.buildSourceBlockerExplanation({ blocker, exception, rules: snapshot, run, month: 5, year: 2026 });
    expect(explanation.sourceActionRequired).toContain(field);
    expect(explanation.flaggedBecause).toBe(exception);
  });

  test("returns a regeneration-safe fallback for legacy proposals", () => {
    const explanation = _test.fallbackExplanation({ actionable: true, proposalType: "safe_recalculation", reason: "Legacy reason", ruleReference: "rules-v4" });
    expect(explanation.changeMade).toContain("Regenerate");
    expect(explanation.ruleApplied).toBe("rules-v4");
  });
});
