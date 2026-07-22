import { describe, expect, it } from "vitest";

import { buildPayrollReportPdf } from "./payrollReportPdf.js";

describe("payroll report PDF generator", () => {
  it("uses the PayNivo logo and includes every row across multiple pages", () => {
    const rows = [
      ["Employee", "Location", "Bank", "Earnings", "Deductions", "Net Pay", "Status"],
      ...Array.from({ length: 80 }, (_, index) => [
        `Employee ${String(index + 1).padStart(3, "0")}`,
        "Singapore",
        `Bank account ${index + 1}`,
        `S$${3000 + index}.00`,
        `S$${500 + index}.00`,
        `S$${2500 + index}.00`,
        index % 2 ? "Approved" : "Pending review"
      ])
    ];
    const pdf = buildPayrollReportPdf({
      category: "FINANCE PAYROLL",
      title: "Payroll Summary",
      subtitle: "July 2026",
      tableRows: rows
    });

    expect(pdf).toContain("/Subtype /Image");
    expect(pdf).toContain("/Logo Do");
    expect(pdf).not.toContain("VANIDAY");
    expect(pdf).toContain("FINANCE PAYROLL");
    expect(pdf).toContain("Employee 001");
    expect(pdf).toContain("Employee 080");
    expect(pdf).toContain("/MediaBox [0 0 842 595]");
    expect(pdf.match(/\/Type \/Page\b/g)?.length).toBeGreaterThan(1);
    expect(pdf).not.toContain("Showing first");
  });

  it("keeps narrower admin reports in portrait A4", () => {
    const pdf = buildPayrollReportPdf({
      category: "ADMIN PAYROLL",
      title: "Payroll Control Summary",
      summaryRows: [["Records", "2", "Admin review"]],
      tableRows: [["Control Item", "Current Value"], ["Active users", "42"]]
    });

    expect(pdf).toContain("/MediaBox [0 0 595 842]");
    expect(pdf).toContain("Payroll Control Summary".toUpperCase());
    expect(pdf.match(/\/Type \/Page\b/g)).toHaveLength(1);
  });
});
