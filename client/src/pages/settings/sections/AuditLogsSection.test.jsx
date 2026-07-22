import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AuditLogsSection from "./AuditLogsSection.jsx";
import { fetchAuditLogs } from "../../../services/settingsService.js";

vi.mock("../../../services/settingsService.js", () => ({ fetchAuditLogs: vi.fn() }));

describe("settings audit-log search", () => {
  beforeEach(() => {
    fetchAuditLogs.mockReset();
    fetchAuditLogs.mockResolvedValue({ logs: [], total: 0 });
  });

  it("submits the current term and clears it without replaying stale state", async () => {
    render(<AuditLogsSection />);
    await waitFor(() => expect(fetchAuditLogs).toHaveBeenCalled());

    const input = screen.getByPlaceholderText("Search actions...");
    fireEvent.change(input, { target: { value: "password" } });
    fireEvent.submit(input.closest("form"));
    await waitFor(() => expect(fetchAuditLogs).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, search: "password" })));

    fireEvent.click(screen.getByRole("button", { name: "Clear audit log search" }));
    await waitFor(() => expect(fetchAuditLogs).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, search: "" })));
  });
});
