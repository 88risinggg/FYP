const { calculatePayslipFromRow } = require("./payrollCalculation");

describe("uploaded payroll calculation", () => {
  test("uses the central statutory engine for variable pay", () => {
    const result = calculatePayslipFromRow(
      {
        payroll_month: 7,
        payroll_year: 2026,
        basic_salary: 4000,
        allowance: 500,
        loan_deduction: 100
      },
      {
        employee_id: 1,
        name: "Test Employee",
        email: "employee@example.com",
        base_salary: 4000,
        date_of_birth: "1990-01-01",
        bank: "DBS",
        account_no: "123456789",
        department_name: "Finance",
        race: "Indian",
        religion: "Islam"
      },
      {},
      "15",
      "hr@example.com"
    );

    expect(result.gross_salary).toBe(4500);
    expect(result.cpf_employee_deduction).toBe(900);
    expect(result.donation_fund).toBe("MBMF + SINDA");
    expect(result.donation_amount).toBe(26.5);
    expect(result.total_deductions).toBe(1026.5);
    expect(result.net_pay).toBe(3473.5);
    expect(result.compliance_exceptions).toEqual([]);
  });
});
