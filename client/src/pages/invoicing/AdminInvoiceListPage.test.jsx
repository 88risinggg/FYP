import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import AdminInvoiceListPage from "./AdminInvoiceListPage.jsx";

vi.mock("../../services/invoiceService.js", () => ({
  fetchInvoices: vi.fn().mockResolvedValue({
    invoices: [
      { invoice_id: 1, invoiceId: "INV-001", customer_name: "Acme Salon", customer_email: "billing@acme.test", status: "Sent", total_amount: 100 },
      { invoice_id: 2, invoiceId: "INV-002", customer_name: "Beta Spa", customer_email: "billing@beta.test", status: "Sent", total_amount: 200 }
    ]
  })
}));

describe("admin invoice search", () => {
  it("honours a search term supplied by the shared header through the URL", async () => {
    render(<MemoryRouter initialEntries={["/dashboard/invoicing/admin/invoices?search=acme"]}><AdminInvoiceListPage /></MemoryRouter>);
    expect(await screen.findByText("Acme Salon")).toBeTruthy();
    expect(screen.queryByText("Beta Spa")).toBeNull();
    expect(screen.getByPlaceholderText("Search invoice or customer").value).toBe("acme");
  });
});
