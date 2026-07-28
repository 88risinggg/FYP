import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PayrollProgressTracker from "./PayrollProgressTracker.jsx";

const stages = [
  { key: "claims", label: "Claim requests", status: "completed", detail: "Complete", path: "/claims" },
  { key: "review", label: "Payroll run review", status: "current", detail: "Current", path: "/review" },
  { key: "payment", label: "Payment preparation with a long future label", status: "blocked", detail: "Blocked", path: "/payment" }
];

afterEach(cleanup);

describe("PayrollProgressTracker", () => {
  it("contains every stage inside a dedicated horizontal viewport", () => {
    render(<PayrollProgressTracker title="Payroll Run Progress" runId="PAY-2026-07" stages={stages} />);
    const viewport = screen.getByLabelText("Payroll Run Progress stages");
    expect(viewport.classList.contains("payroll-progress__viewport")).toBe(true);
    expect(viewport.querySelector("ol").classList.contains("payroll-progress__track")).toBe(true);
    expect(screen.getByText("Payment preparation with a long future label").classList.contains("payroll-progress__label")).toBe(true);
  });

  it("supports clickable Finance stages without making read-only HR stages interactive", () => {
    const onSelectStage = vi.fn();
    const { rerender } = render(<PayrollProgressTracker stages={stages} onSelectStage={onSelectStage} />);
    fireEvent.click(screen.getByRole("button", { name: "Payroll run review: Current" }));
    expect(onSelectStage).toHaveBeenCalledWith(stages[1]);
    rerender(<PayrollProgressTracker stages={stages} />);
    expect(screen.queryByRole("button", { name: "Payroll run review: Current" })).toBeNull();
  });

  it("keeps semantic markers for complete, current, and blocked stages", () => {
    render(<PayrollProgressTracker stages={stages} />);
    expect(screen.getByText("✓")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("!")).toBeTruthy();
  });
});
