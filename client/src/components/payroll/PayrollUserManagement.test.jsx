import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../services/payrollUserService.js", () => ({
  getPayrollUsers: vi.fn(),
  createPayrollHire: vi.fn(),
  reviewActivationRequest: vi.fn(),
  updateActivationRequest: vi.fn()
}));
vi.mock("../../services/adminPayrollService.js", () => ({
  resetUserPassword: vi.fn(),
  updateUserRole: vi.fn(),
  updateUserStatus: vi.fn()
}));
vi.mock("../../services/apiClient.js", () => ({ apiRequest: vi.fn() }));

import { getPayrollUsers } from "../../services/payrollUserService.js";
import PayrollUserManagement, { normalizeManagedUsers } from "./PayrollUserManagement.jsx";

afterEach(() => cleanup());

describe("payroll user response normalization", () => {
  it.each([undefined, null, [], "invalid", { users: null, roles: null }])("makes malformed payloads render-safe", (payload) => {
    const result = normalizeManagedUsers(payload);
    expect(result.users).toEqual([]);
    expect(result.roles).toEqual(["Admin", "Finance", "HR", "Staff"]);
  });

  it("preserves valid users and roles", () => {
    const users = [{ user_id: 1, name: "Admin" }];
    const roles = ["Admin", "Staff"];
    expect(normalizeManagedUsers({ users, roles })).toMatchObject({ users, roles });
  });
});

describe("Admin payroll user directory", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows loading and then a safe empty state", async () => {
    let resolveUsers;
    getPayrollUsers.mockReturnValue(new Promise((resolve) => { resolveUsers = resolve; }));
    render(<PayrollUserManagement role="Admin" />);
    expect(screen.getByText("Loading users...")).toBeTruthy();
    resolveUsers({ users: [], roles: [] });
    expect(await screen.findByText("No users match the selected filters.")).toBeTruthy();
  });

  it("filters users and displays locked account details with reactivation", async () => {
    getPayrollUsers.mockResolvedValue({
      roles: ["Admin", "Finance", "HR", "Staff"],
      users: [
        { user_id: 1, staff_name: "Alice Admin", staff_email: "alice@example.com", role_name: "Admin", account_status: 1, activation_status: "Approved", employee_id: 11 },
        { user_id: 2, staff_name: "Locked Staff", staff_email: "locked@example.com", role_name: "Staff", account_status: 1, activation_status: "Approved", employee_id: 12, failed_login_attempts: 5, account_locked_at: "2026-07-24T10:00:00.000Z", account_lock_reason: "Too many failed password attempts" }
      ]
    });
    render(<PayrollUserManagement role="Admin" />);
    expect(await screen.findByText("Alice Admin")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("Search by name, email, or employee code..."), { target: { value: "locked" } });
    await waitFor(() => expect(screen.queryByText("Alice Admin")).toBeNull());
    expect(screen.getByText("Locked Staff")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Manage Account Details/i }));
    expect(screen.getByText(/Too many failed password attempts/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reactivate account" })).toBeTruthy();
  });
});
