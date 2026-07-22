import { describe, expect, it } from "vitest";

import { buildVanidayPayslipHtml, normalizeVanidayPayslip } from "./vanidayPayslipTemplate.js";

describe("Vaniday payslip template", () => {
  const payslip = {
    employee_name: "Sample Employee",
    employee_code: "EMP-001",
    payroll_month: 7,
    payroll_year: 2026,
    base_salary: 3000,
    total_allowances: 512,
    total_deductions: 708.9,
    employee_cpf: 702.4,
    employer_cpf: 597.04,
    net_salary: 2803.1,
    deduction_breakdown: {
      employeeCpf: 702.4,
      selfHelpGroups: [{ fund: "MBMF", amount: 6.5 }],
      sdl: 8.78
    }
  };

  it("normalizes earnings, statutory deductions and totals", () => {
    const normalized = normalizeVanidayPayslip(payslip);
    expect(normalized.period).toBe("July 2026");
    expect(normalized.totalEarnings).toBe(3512);
    expect(normalized.deductions.map((item) => item.label)).toEqual(["Employee CPF", "MBMF"]);
    expect(normalized.netPay).toBe(2803.1);
  });

  it("renders the Vaniday sample-inspired layout and escapes employee data", () => {
    const html = buildVanidayPayslipHtml({ ...payslip, employee_name: "<Sample Employee>" });
    expect(html).toContain("Vaniday Singapore Pte. Ltd.");
    expect(html).toContain("Total earnings:");
    expect(html).toContain("Employer CPF contribution");
    expect(html).toContain("Skills Development Levy (SDL)");
    expect(html).toContain("&lt;Sample Employee&gt;");
    expect(html).not.toContain("<Sample Employee>");
  });
});
