const { buildEffectiveRuleCatalogue, resolveAppliedPayrollRules } = require("./payrollRuleConfigService");

describe("admin payroll rule configuration", () => {
  test("converts stored Admin settings into calculation rules", () => {
    const rules = resolveAppliedPayrollRules([
      { setting_key: "cpf_monthly_wage_ceiling", setting_value: "6500" },
      { setting_key: "cpf_rate_55_and_below_employee_percent", setting_value: "19" },
      { setting_key: "compliance_bank_account_enabled", setting_value: "Disabled" },
      { setting_key: "earning_component_allowance_cpf_applicable", setting_value: "No" },
      { setting_key: "deduction_component_loan_affects_net_pay", setting_value: "No" },
      { setting_key: "mbmf_enabled", setting_value: "Disabled" }
    ]);

    expect(rules.cpfOrdinaryWageCeiling).toBe(6500);
    expect(rules.cpfRateTiers[0].employeeRate).toBe(19);
    expect(rules.bankAccountRequired).toBe(false);
    expect(rules.componentCpfApplicable.allowance).toBe(false);
    expect(rules.deductionAffectsNetPay.loan).toBe(false);
    expect(rules.selfHelpGroupRules.MBMF.enabled).toBe(false);
  });

  test("rejects unsafe numeric values by falling back to statutory defaults", () => {
    const rules = resolveAppliedPayrollRules([
      { setting_key: "cpf_monthly_wage_ceiling", setting_value: "not-a-number" },
      { setting_key: "cpf_rate_55_and_below_employee_percent", setting_value: "120" }
    ]);

    expect(rules.cpfOrdinaryWageCeiling).toBe(8000);
    expect(rules.cpfRateTiers[0].employeeRate).toBe(20);
  });

  test("groups resolved values and excludes operational accounting references", () => {
    const catalogue = buildEffectiveRuleCatalogue([
      { setting_id: 1, setting_key: "cpf_monthly_wage_ceiling", setting_value: "7500", effective_from: "2026-02-01", updated_at: "2026-01-20", updated_by_name: "Admin User" },
      { setting_id: 2, setting_key: "cpf_account_employee_payable", setting_value: "2100", usage_type: "reference", updated_at: "2026-01-20", updated_by_name: "Admin User" },
      { setting_id: "default_compliance_cpf_enabled", setting_key: "compliance_cpf_enabled", setting_value: "Enabled", effective_from: "2026-01-01", updated_by_name: "System default" }
    ], new Date("2026-07-24T00:00:00Z"));

    expect(catalogue.groupCount).toBeGreaterThan(1);
    expect(catalogue.rules.find((rule) => rule.key === "cpf_wage_ceiling")).toMatchObject({
      value: "SGD 7,500",
      source: "Admin Override",
      effectiveFrom: "2026-02-01"
    });
    expect(catalogue.rules.some((rule) => rule.key.includes("payable"))).toBe(false);
  });
});
