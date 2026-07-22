const { buildPayslipHtml } = require("./payslipPdfService");

describe("Vaniday payslip PDF template", () => {
  test("renders the sample-inspired breakdown with an embedded Vaniday logo", () => {
    const html = buildPayslipHtml({
      employee_name: "Sample Employee",
      employee_code: "EMP-001",
      payroll_month: 7,
      payroll_year: 2026,
      base_salary: 3000,
      gross_salary: 3512,
      total_allowances: 512,
      total_deductions: 708.9,
      employee_cpf: 702.4,
      employer_cpf: 597.04,
      net_salary: 2803.1,
      deduction_breakdown: JSON.stringify({
        employeeCpf: 702.4,
        selfHelpGroups: [{ fund: "MBMF", amount: 6.5 }],
        sdl: 8.78
      }),
      claims: [{ claim_id: "CLM-001", claim_type: "Transport", amount: 42.5, expense_date: "2026-07-10" }],
      layout: { layout_name: "Vaniday Default" }
    });

    expect(html).toContain("data:image/jpeg;base64,");
    expect(html).toContain("Vaniday Singapore Pte. Ltd.");
    expect(html).toContain("Sample Employee for July 2026");
    expect(html).toContain("Total earnings:");
    expect(html).toContain("Employer CPF contribution");
    expect(html).toContain("Skills Development Levy (SDL)");
    expect(html).toContain("Claim reimbursements (released separately)");
    expect(html).toContain("CLM-001");
    expect(html).toContain("Layout: Vaniday Default");
  });
});
