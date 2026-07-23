import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InsightBarChart } from "./AdminPayrollPage.jsx";

describe("Admin Users by Role chart", () => {
  it("renders responsive role rows without SVG-positioned labels", () => {
    const { container } = render(<InsightBarChart insight={{ series: [{ data: [
      { x: "Admin", value: 2 }, { x: "Finance", value: 0 }, { x: "HR", value: 3 },
      { x: "Staff", value: 55 }, { x: "Unassigned", value: 1 }
    ] }] }}/>);

    expect(screen.getByText("Unassigned")).toBeInTheDocument();
    expect(screen.getByLabelText("Finance: 0 users")).toBeInTheDocument();
    expect(screen.getByLabelText("Staff: 55 users")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
    expect(container.querySelectorAll(".admin-role-bars__row")).toHaveLength(5);
  });
});
