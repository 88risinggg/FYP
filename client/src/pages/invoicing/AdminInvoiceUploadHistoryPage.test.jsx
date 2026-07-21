import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { fetchInvoiceUploadHistory } from "../../services/adminDashboardService.js";
import AdminInvoiceUploadHistoryPage from "./AdminInvoiceUploadHistoryPage.jsx";

vi.mock("../../services/adminDashboardService.js", () => ({
  fetchInvoiceUploadHistory: vi.fn().mockResolvedValue({
    uploads: [{
      uploadId: 4,
      uploadBatchId: "UPL-test-batch",
      fileName: "invoice-failed.xlsx",
      uploaderEmail: "admin@example.com",
      uploadedAt: "2026-07-21T01:00:00Z",
      totalRows: 20,
      validRows: 0,
      invalidRows: 20,
      createdInvoices: 0,
      status: "Failed",
      processingDurationMs: 1200
    }],
    uploaders: ["admin@example.com"],
    pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 }
  })
}));

describe("Admin Invoice Upload History", () => {
  it("loads the card-supplied status filter and renders batch-level records", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/invoicing/admin/dashboard/validation-summary/upload-history?status=Failed"]}>
        <AdminInvoiceUploadHistoryPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("invoice-failed.xlsx")).toBeTruthy();
    expect(screen.getByText("UPL-test-batch")).toBeTruthy();
    await waitFor(() => expect(fetchInvoiceUploadHistory).toHaveBeenCalledWith(expect.objectContaining({ status: "Failed" })));
  });
});
