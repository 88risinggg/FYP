import { describe, expect, it } from "vitest";
import { cpfAgeTierRows, getShgBandAmount } from "./payrollRules.js";

describe("2026 payroll display rules", () => {
  it("uses the 2026 full-rate CPF age tiers", () => {
    expect(cpfAgeTierRows.map((tier) => [tier.employeeRate, tier.employerRate])).toEqual([
      ["20.00", "17.00"],
      ["18.00", "16.00"],
      ["12.50", "12.50"],
      ["7.50", "9.00"],
      ["5.00", "7.50"]
    ]);
  });

  it("uses wage bands for self-help group deductions", () => {
    expect(getShgBandAmount("MBMF", 5000)).toBe(19.5);
    expect(getShgBandAmount("CDAC", 5000)).toBe(1.5);
    expect(getShgBandAmount("SINDA", 5000)).toBe(9);
  });
});
