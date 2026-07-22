import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import AdminValidationSummaryPage from "./AdminValidationSummaryPage.jsx";

vi.mock("../../services/adminDashboardService.js", () => ({
  fetchInvoiceValidationSummary: vi.fn().mockResolvedValue({
    summary: { totalUploads: 18, successfulUploads: 10, failedUploads: 5 },
    recentUploads: [
      { uploadId: 1, fileName: "invoice-a.xlsx", uploaderEmail: "admin@example.com", uploadedAt: "2026-07-21T01:00:00Z", totalRows: 10, validRows: 8, invalidRows: 2, createdInvoices: 8, status: "Partial Success" }
    ],
    validationErrors: []
  })
}));

describe("Admin Invoice Validation Summary", () => {
  it("uses totalUploads for the first clickable card and keeps recent uploads as a table", async () => {
    render(<MemoryRouter><AdminValidationSummaryPage /></MemoryRouter>);

    expect(await screen.findByText("Total Uploads")).toBeTruthy();
    expect(screen.getByText("18")).toBeTruthy();
    expect(screen.getByText("Recent Uploads")).toBeTruthy();
    expect(screen.getByText("invoice-a.xlsx")).toBeTruthy();
    expect(screen.getByText("Partial Success")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Total Uploads/ }).getAttribute("href")).toContain("upload-history");
    expect(screen.getByRole("link", { name: /Failed Uploads/ }).getAttribute("href")).toContain("status=Failed");
  });
});
