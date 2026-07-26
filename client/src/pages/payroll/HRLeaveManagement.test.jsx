import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getPendingApplications = vi.fn();
const getAllApplications = vi.fn();
const getLeaveTypes = vi.fn();

vi.mock("../../services/leaveService.js", () => ({
  getPendingApplications: (...args) => getPendingApplications(...args),
  getAllApplications: (...args) => getAllApplications(...args),
  getLeaveTypes: (...args) => getLeaveTypes(...args)
}));

import HRLeaveManagement from "./HRLeaveManagement.jsx";

describe("HR leave management pagination", () => {
  beforeEach(() => {
    getPendingApplications.mockResolvedValue([{ id: 11, staff_name: "Pending Staff", department: "HR", leave_type_name: "Annual Leave", start_date: "2026-07-28", end_date: "2026-07-29", total_days: 2, status: "pending", hr_comment: "" }]);
    getLeaveTypes.mockResolvedValue([{ id: 1, name: "Annual Leave" }]);
    getAllApplications.mockImplementation(({ page }) => Promise.resolve({
      applications: page === 1
        ? [{ id: 21, staff_name: "Page One", department: "HR", leave_type_name: "Annual Leave", start_date: "2026-07-01", end_date: "2026-07-02", total_days: 2, status: "approved", hr_comment: "ok" }]
        : [{ id: 22, staff_name: "Page Two", department: "Finance", leave_type_name: "Medical Leave", start_date: "2026-07-03", end_date: "2026-07-03", total_days: 1, status: "rejected", hr_comment: "note" }],
      total: 51
    }));
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("fetches paged all-applications data and advances pages", async () => {
    render(<HRLeaveManagement />);

    fireEvent.click(screen.getByRole("button", { name: "All Applications" }));

    expect(await screen.findByText("Page One")).toBeTruthy();
    expect(screen.getByText("Page 1 of 2")).toBeTruthy();
    expect(getAllApplications).toHaveBeenCalledWith({ page: 1, pageSize: 50 });

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => expect(getAllApplications).toHaveBeenCalledWith({ page: 2, pageSize: 50 }));
    expect(await screen.findByText("Page Two")).toBeTruthy();
    expect(screen.getByText("Page 2 of 2")).toBeTruthy();
  });
});
