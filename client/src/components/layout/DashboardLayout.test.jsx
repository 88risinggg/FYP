import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import DashboardLayout from "./DashboardLayout.jsx";
import { apiRequest } from "../../services/apiClient.js";

vi.mock("./Sidebar.jsx", () => ({ default: () => <aside data-testid="sidebar" /> }));
vi.mock("../../services/apiClient.js", () => ({ apiRequest: vi.fn() }));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderLayout(props = {}) {
  return render(
    <MemoryRouter initialEntries={["/dashboard/payroll/hr"]}>
      <DashboardLayout pageTitle="Test" {...props}><p>Content</p></DashboardLayout>
      <LocationProbe />
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DashboardLayout search", () => {
  it("uses the Vaniday logo as a module dashboard link when a home path is provided", () => {
    renderLayout({ homePath: "/dashboard/payroll/admin" });

    fireEvent.click(screen.getByRole("link", { name: "Go to dashboard" }));
    expect(screen.getByTestId("location").textContent).toBe("/dashboard/payroll/admin");
  });

  it("does not render an inert search input", () => {
    renderLayout({ searchPlaceholder: "Decorative search" });
    expect(screen.queryByPlaceholderText("Decorative search")).toBeNull();
  });

  it("forwards live searches and clearing to the page handler", () => {
    const onSearch = vi.fn();
    renderLayout({ onSearch, searchPlaceholder: "Search records" });

    fireEvent.change(screen.getByPlaceholderText("Search records"), { target: { value: "Acme" } });
    expect(onSearch).toHaveBeenLastCalledWith("Acme");
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onSearch).toHaveBeenLastCalledWith("");
  });

  it("queries an endpoint and navigates to a selected staff result", async () => {
    apiRequest.mockResolvedValue([{ employee_id: "STF-12", name: "Aisha Tan", email: "aisha@example.com" }]);
    renderLayout({ searchEndpoint: "/api/hr/search", searchPlaceholder: "Search HR" });

    fireEvent.change(screen.getByPlaceholderText("Search HR"), { target: { value: "Aisha" } });
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith("/api/hr/search?q=Aisha"));
    fireEvent.click(await screen.findByRole("button", { name: /Aisha Tan/i }));
    expect(screen.getByTestId("location").textContent).toBe("/dashboard/payroll/hr/staff?highlight=STF-12");
  });
});
