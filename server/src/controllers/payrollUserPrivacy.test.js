jest.mock("../models/payrollUserModel", () => ({
  ROLE_NAMES: ["Admin", "Finance", "HR", "Staff"],
  createHireWithAccount: jest.fn(),
  listManagedUsers: jest.fn(),
  reviewActivationRequest: jest.fn(),
  updatePendingRequest: jest.fn()
}));
jest.mock("../services/payrollNotificationService", () => ({
  notifyRoles: jest.fn(),
  notifyUser: jest.fn()
}));

const { toAdminManagedUser, toHrManagedUser } = require("./payrollUserController");

describe("Admin payroll user privacy projection", () => {
  test("keeps access-management fields and removes private HR/payroll fields", () => {
    const projected = toAdminManagedUser({
      user_id: 8,
      name: "Example User",
      email: "example@paynivo.test",
      role_name: "Staff",
      account_status: 1,
      employee_id: 18,
      employee_code: "EMP018",
      staff_name: "Example User",
      staff_email: "example@paynivo.test",
      department_name: "Operations",
      phone: "81234567",
      hire_date: "2026-01-01",
      base_salary: 5000,
      bank: "Private Bank",
      account_no: "123456789"
    });

    expect(projected).toMatchObject({
      user_id: 8,
      email: "example@paynivo.test",
      employee_code: "EMP018",
      department_name: "Operations",
      role_name: "Staff"
    });
    expect(projected).not.toHaveProperty("phone");
    expect(projected).not.toHaveProperty("hire_date");
    expect(projected).not.toHaveProperty("base_salary");
    expect(projected).not.toHaveProperty("bank");
    expect(projected).not.toHaveProperty("account_no");
  });
});

describe("HR payroll user privacy projection", () => {
  test("removes security lockout metadata while preserving employment workflow fields", () => {
    const projected = toHrManagedUser({
      user_id: 8,
      employee_id: 18,
      staff_name: "Example User",
      activation_status: "Approved",
      failed_login_attempts: 5,
      account_locked_at: "2026-07-24T10:00:00.000Z",
      account_lock_reason: "Too many failed password attempts"
    });

    expect(projected).toMatchObject({ user_id: 8, employee_id: 18, activation_status: "Approved" });
    expect(projected).not.toHaveProperty("failed_login_attempts");
    expect(projected).not.toHaveProperty("account_locked_at");
    expect(projected).not.toHaveProperty("account_lock_reason");
  });
});
