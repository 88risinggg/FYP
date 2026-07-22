import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import Sidebar from "./Sidebar.jsx";

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function renderSidebar(props = {}) {
  return render(
    <MemoryRouter initialEntries={["/dashboard/payroll/admin"]}>
      <Sidebar sections={[]} mobileOpen {...props} />
      <LocationProbe />
    </MemoryRouter>
  );
}

afterEach(cleanup);

describe("Sidebar module selector navigation", () => {
  it("renders a working module selector link when enabled", () => {
    const onClose = vi.fn();
    renderSidebar({ showModuleSelectorLink: true, onClose });

    fireEvent.click(screen.getByRole("link", { name: "Back to module selector" }));

    expect(screen.getByTestId("location").textContent).toBe("/module-selection");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not render branding or module navigation when disabled", () => {
    renderSidebar({ showModuleSelectorLink: false });

    expect(screen.queryByRole("link", { name: "Back to module selector" })).toBeNull();
    expect(screen.queryByLabelText("PayNivo")).toBeNull();
  });
});
