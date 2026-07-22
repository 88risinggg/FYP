const { resolveAppliedPayrollRules } = require("./payrollRuleConfigService");

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
});
