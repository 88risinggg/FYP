import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  AlertCircle,
  Banknote,
  Building2,
  CreditCard,
  Eye,
  FileBarChart,
  LayoutDashboard,
  Link as LinkIcon,
  Loader2,
  Plus,
  ReceiptText,
  Search,
  Send,
  Trash2,
  Upload,
  X
} from "lucide-react";

import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import {
  createInvoice,
  createStripePaymentLink,
  fetchCustomers,
  fetchInvoiceCustomers,
  fetchInvoiceReports,
  fetchInvoices,
  fetchNextInvoiceNumber,
  fetchPaymentsWorkspace,
  processBulkInvoiceRows,
  recordManualPayment,
  updateInvoiceStatus,
  validateBulkInvoiceRows
} from "../../services/invoiceService.js";
import { getStoredSession } from "../../services/sessionService.js";

const financeSidebarSections = [
  {
    label: "MAIN",
    items: [
      {
        label: "Dashboard",
        icon: LayoutDashboard,
        path: "/dashboard/invoicing/finance",
        end: true
      }
    ]
  },
  {
    label: "INVOICING",
    items: [
      {
        label: "Customers",
        icon: Building2,
        path: "/dashboard/invoicing/finance/customers"
      },
      {
        label: "Invoices",
        icon: ReceiptText,
        path: "/dashboard/invoicing/finance/invoices"
      },
      {
        label: "Bulk Upload",
        icon: Upload,
        path: "/dashboard/invoicing/finance/bulk-upload"
      },
      {
        label: "Payments",
        icon: CreditCard,
        path: "/dashboard/invoicing/finance/payments"
      }
    ]
  },
  {
    label: "REPORTS",
    items: [
      {
        label: "Reports",
        icon: FileBarChart,
        path: "/dashboard/invoicing/finance/reports"
      }
    ]
  }
];

const invoiceStatuses = ["Draft", "Sent", "Viewed", "Paid", "Overdue"];

const statusStyles = {
  Draft: "border-slate-400/25 bg-slate-400/10 text-slate-200",
  Sent: "border-blue-400/30 bg-blue-500/15 text-blue-200",
  Viewed: "border-cyan-400/30 bg-cyan-500/15 text-cyan-200",
  Paid: "border-emerald-400/30 bg-emerald-500/15 text-emerald-200",
  Overdue: "border-rose-400/30 bg-rose-500/15 text-rose-200"
};

const emptyItem = {
  description: "",
  quantity: 1,
  unit_price: ""
};

const csvTemplateHeaders = [
  "customer_id",
  "customer_name",
  "customer_email",
  "issue_date",
  "due_date",
  "description",
  "quantity",
  "unit_price",
  "status"
];

function formatCurrency(value) {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD"
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-SG", {
    year: "numeric",
    month: "short",
    day: "2-digit"
  }).format(new Date(value));
}

function toDateInputValue(date) {
  return date.toISOString().slice(0, 10);
}

function getItemAmount(item) {
  return Number(item.quantity || 0) * Number(item.unit_price || 0);
}

function InvoiceStatusBadge({ status }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[status] || statusStyles.Draft}`}>
      {status}
    </span>
  );
}

function MetricCard({ label, value, accent = "text-white" }) {
  return (
    <div className="neon-glass neon-border rounded-xl px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#d8c6e8]/70">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-semibold ${accent}`}>{value}</p>
    </div>
  );
}

function SectionShell({ eyebrow, title, description, action, children }) {
  return (
    <section className="neon-glass neon-border rounded-2xl p-5">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#C77DFF]">{eyebrow}</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">{title}</h2>
          {description ? (
            <p className="mt-2 max-w-3xl text-sm text-[#d8c6e8]/75">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ErrorBanner({ message }) {
  if (!message) {
    return null;
  }

  return (
    <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
      {message}
    </div>
  );
}

function LoadingPanel({ label }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-xl border border-white/10 px-5 py-16 text-[#d8c6e8]">
      <Loader2 size={20} className="animate-spin" />
      {label}
    </div>
  );
}

function InvoiceDetailsModal({ invoice, onClose }) {
  if (!invoice) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#090014]/80 p-4 backdrop-blur">
      <div className="neon-glass neon-border w-full max-w-3xl rounded-2xl">
        <div className="flex items-start justify-between border-b border-white/10 p-5">
          <div>
            <p className="text-sm text-[#C77DFF]">{invoice.invoiceId}</p>
            <h2 className="mt-1 text-xl font-semibold text-white">{invoice.customer_name}</h2>
            <p className="mt-1 text-sm text-[#d8c6e8]/75">{invoice.customer_email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[#d8c6e8] hover:bg-white/10 hover:text-white"
            aria-label="Close invoice details"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-4">
          <div>
            <p className="text-xs text-[#d8c6e8]/60">Issue Date</p>
            <p className="mt-1 text-sm font-medium text-white">{formatDate(invoice.issue_date)}</p>
          </div>
          <div>
            <p className="text-xs text-[#d8c6e8]/60">Due Date</p>
            <p className="mt-1 text-sm font-medium text-white">{formatDate(invoice.due_date)}</p>
          </div>
          <div>
            <p className="text-xs text-[#d8c6e8]/60">Status</p>
            <div className="mt-1">
              <InvoiceStatusBadge status={invoice.status} />
            </div>
          </div>
          <div>
            <p className="text-xs text-[#d8c6e8]/60">Total</p>
            <p className="mt-1 text-sm font-semibold text-white">{formatCurrency(invoice.total_amount)}</p>
          </div>
        </div>

        <div className="px-5 pb-5">
          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.06] text-xs uppercase tracking-wide text-[#d8c6e8]/70">
                <tr>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Unit Price</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {invoice.items?.map((item) => (
                  <tr key={item.item_id} className="text-[#f7edff]">
                    <td className="px-4 py-3">{item.description}</td>
                    <td className="px-4 py-3 text-right">{item.quantity}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(item.unit_price)}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function InvoiceCreationModal({ customers, nextInvoiceId, onCancel, onCreated }) {
  const today = toDateInputValue(new Date());
  const defaultDueDate = toDateInputValue(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));
  const [form, setForm] = useState({
    customer_id: "",
    issue_date: today,
    due_date: defaultDueDate,
    items: [{ ...emptyItem }]
  });
  const [savingStatus, setSavingStatus] = useState("");
  const [error, setError] = useState("");

  const subtotal = useMemo(
    () => form.items.reduce((sum, item) => sum + getItemAmount(item), 0),
    [form.items]
  );

  function updateItem(index, field, value) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    }));
  }

  function addItem() {
    setForm((current) => ({
      ...current,
      items: [...current.items, { ...emptyItem }]
    }));
  }

  function removeItem(index) {
    setForm((current) => ({
      ...current,
      items: current.items.filter((_, itemIndex) => itemIndex !== index)
    }));
  }

  async function submitInvoice(status) {
    setError("");
    setSavingStatus(status);

    try {
      await createInvoice({
        customer_id: form.customer_id,
        issue_date: form.issue_date,
        due_date: form.due_date,
        status,
        items: form.items.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price)
        }))
      });
      await onCreated();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingStatus("");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#090014]/80 p-4 backdrop-blur">
      <div className="neon-glass neon-border my-6 w-full max-w-5xl rounded-2xl p-5">
        <div className="flex flex-col gap-3 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#C77DFF]">Create Single Invoice</p>
            <h2 className="mt-1 text-xl font-semibold text-white">{nextInvoiceId || "INV-0001"}</h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="self-start rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-[#d8c6e8] hover:bg-white/10 hover:text-white sm:self-auto"
          >
            Cancel
          </button>
        </div>

        <div className="mt-4">
          <ErrorBanner message={error} />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <label className="block">
            <span className="text-sm font-medium text-[#d8c6e8]">Customer</span>
            <select
              value={form.customer_id}
              onChange={(event) => setForm((current) => ({ ...current, customer_id: event.target.value }))}
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#120022]/90 px-3 py-3 text-sm text-white outline-none focus:border-[#C77DFF]"
            >
              <option value="">Select customer</option>
              {customers.map((customer) => (
                <option key={customer.customer_id} value={customer.customer_id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[#d8c6e8]">Issue Date</span>
            <input
              type="date"
              value={form.issue_date}
              onChange={(event) => setForm((current) => ({ ...current, issue_date: event.target.value }))}
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#120022]/90 px-3 py-3 text-sm text-white outline-none focus:border-[#C77DFF]"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[#d8c6e8]">Due Date</span>
            <input
              type="date"
              value={form.due_date}
              onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))}
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#120022]/90 px-3 py-3 text-sm text-white outline-none focus:border-[#C77DFF]"
            />
          </label>
        </div>

        <div className="mt-6 overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-[760px] w-full text-left text-sm">
            <thead className="bg-white/[0.06] text-xs uppercase tracking-wide text-[#d8c6e8]/70">
              <tr>
                <th className="px-4 py-3">Description</th>
                <th className="w-28 px-4 py-3 text-right">Qty</th>
                <th className="w-40 px-4 py-3 text-right">Unit Price</th>
                <th className="w-40 px-4 py-3 text-right">Amount</th>
                <th className="w-16 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {form.items.map((item, index) => (
                <tr key={index}>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(event) => updateItem(index, "description", event.target.value)}
                      placeholder="Service or product description"
                      className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-white outline-none placeholder:text-[#d8c6e8]/45 focus:border-[#C77DFF]"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={item.quantity}
                      onChange={(event) => updateItem(index, "quantity", event.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-right text-white outline-none focus:border-[#C77DFF]"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(event) => updateItem(index, "unit_price", event.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-right text-white outline-none focus:border-[#C77DFF]"
                    />
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-white">
                    {formatCurrency(getItemAmount(item))}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      disabled={form.items.length === 1}
                      className="rounded-lg p-2 text-[#d8c6e8] hover:bg-white/10 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Remove item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-2 self-start rounded-xl border border-[#C77DFF]/30 px-4 py-2 text-sm font-semibold text-[#f0dcff] hover:bg-[#C77DFF]/10"
          >
            <Plus size={16} />
            Add Item
          </button>

          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-white/[0.05] p-4">
            <div className="flex justify-between py-1 text-sm text-[#d8c6e8]">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between py-1 text-sm text-[#d8c6e8]">
              <span>Tax</span>
              <span>{formatCurrency(0)}</span>
            </div>
            <div className="mt-3 flex justify-between border-t border-white/10 pt-3 text-base font-semibold text-white">
              <span>Total</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => submitInvoice("Draft")}
            disabled={Boolean(savingStatus)}
            className="rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60"
          >
            {savingStatus === "Draft" ? "Saving..." : "Save as Draft"}
          </button>
          <button
            type="button"
            onClick={() => submitInvoice("Sent")}
            disabled={Boolean(savingStatus)}
            className="neon-button inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold disabled:opacity-60"
          >
            <Send size={16} />
            {savingStatus === "Sent" ? "Sending..." : "Save & Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

function InvoiceTable({ invoices, onView, onStatusChange }) {
  if (invoices.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/15 px-5 py-12 text-center text-sm text-[#d8c6e8]">
        No invoices found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="min-w-[940px] w-full text-left text-sm">
        <thead className="bg-white/[0.06] text-xs uppercase tracking-wide text-[#d8c6e8]/70">
          <tr>
            <th className="px-4 py-3">Invoice Number</th>
            <th className="px-4 py-3">Customer</th>
            <th className="px-4 py-3">Issue Date</th>
            <th className="px-4 py-3">Due Date</th>
            <th className="px-4 py-3 text-right">Total Amount</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {invoices.map((invoice) => (
            <tr key={invoice.invoice_id} className="text-[#f7edff] transition hover:bg-white/[0.04]">
              <td className="px-4 py-4 font-semibold text-white">{invoice.invoiceId}</td>
              <td className="px-4 py-4">
                <p className="font-medium text-white">{invoice.customer_name}</p>
                <p className="text-xs text-[#d8c6e8]/65">{invoice.customer_email}</p>
              </td>
              <td className="px-4 py-4">{formatDate(invoice.issue_date)}</td>
              <td className="px-4 py-4">{formatDate(invoice.due_date)}</td>
              <td className="px-4 py-4 text-right font-semibold">{formatCurrency(invoice.total_amount)}</td>
              <td className="px-4 py-4">
                <InvoiceStatusBadge status={invoice.status} />
              </td>
              <td className="px-4 py-4">
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => onView(invoice)}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-[#f0dcff] hover:bg-white/10"
                  >
                    <Eye size={14} />
                    View Details
                  </button>
                  <select
                    value={invoice.status}
                    onChange={(event) => onStatusChange(invoice.invoice_id, event.target.value)}
                    className="rounded-lg border border-white/10 bg-[#120022]/95 px-3 py-2 text-xs font-semibold text-white outline-none focus:border-[#C77DFF]"
                  >
                    {invoiceStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CustomersView({ customers, invoices, isLoading, error, onViewInvoices }) {
  const [query, setQuery] = useState("");
  const filteredCustomers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return customers;
    }

    return customers.filter((customer) =>
      [customer.name, customer.email, customer.address]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [customers, query]);

  return (
    <SectionShell
      eyebrow="Customer Directory"
      title="Organization Clients"
      description="Search customer records and jump directly into their associated invoice history."
      action={
        <div className="flex w-full max-w-sm items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2">
          <Search size={16} className="text-[#C77DFF]" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search customers..."
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[#d8c6e8]/60"
          />
        </div>
      }
    >
      <ErrorBanner message={error} />
      {isLoading ? (
        <LoadingPanel label="Loading customers..." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-[860px] w-full text-left text-sm">
            <thead className="bg-white/[0.06] text-xs uppercase tracking-wide text-[#d8c6e8]/70">
              <tr>
                <th className="px-4 py-3">Customer Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Date Added</th>
                <th className="px-4 py-3 text-right">Invoices</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filteredCustomers.map((customer) => {
                const invoiceCount = Number(customer.invoice_count ?? invoices.filter((invoice) => invoice.customer_id === customer.customer_id).length);

                return (
                  <tr key={customer.customer_id} className="text-[#f7edff] hover:bg-white/[0.04]">
                    <td className="px-4 py-4 font-semibold text-white">{customer.name}</td>
                    <td className="px-4 py-4">{customer.email || "-"}</td>
                    <td className="px-4 py-4">{customer.address || "-"}</td>
                    <td className="px-4 py-4">{formatDate(customer.created_at)}</td>
                    <td className="px-4 py-4 text-right">{invoiceCount}</td>
                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => onViewInvoices(customer.customer_id)}
                        className="rounded-lg border border-[#C77DFF]/30 px-3 py-2 text-xs font-semibold text-[#f0dcff] hover:bg-[#C77DFF]/10"
                      >
                        View Associated Invoices
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionShell>
  );
}

function InvoicesView({
  invoices,
  customers,
  nextInvoiceId,
  isLoading,
  error,
  customerFilter,
  onClearCustomerFilter,
  onCreateClick,
  onViewInvoice,
  onStatusChange
}) {
  const visibleInvoices = useMemo(() => {
    if (!customerFilter) {
      return invoices;
    }

    return invoices.filter((invoice) => Number(invoice.customer_id) === Number(customerFilter));
  }, [customerFilter, invoices]);

  const metrics = useMemo(() => {
    return invoiceStatuses.reduce((acc, status) => {
      acc[status] = visibleInvoices
        .filter((invoice) => invoice.status === status)
        .reduce((sum, invoice) => sum + Number(invoice.total_amount || 0), 0);
      return acc;
    }, {});
  }, [visibleInvoices]);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Draft" value={formatCurrency(metrics.Draft)} accent="text-slate-100" />
        <MetricCard label="Sent" value={formatCurrency(metrics.Sent)} accent="text-blue-200" />
        <MetricCard label="Paid" value={formatCurrency(metrics.Paid)} accent="text-emerald-200" />
        <MetricCard label="Overdue" value={formatCurrency(metrics.Overdue)} accent="text-rose-200" />
      </section>

      <SectionShell
        eyebrow="Core Invoicing"
        title="Invoices Workspace"
        description="A finance workspace for creating invoices, tracking sent statements, and managing collection state."
        action={
          <button
            type="button"
            onClick={onCreateClick}
            className="neon-button inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold"
          >
            <Plus size={17} />
            Create Single Invoice
          </button>
        }
      >
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <ErrorBanner message={error} />
          {customerFilter ? (
            <button
              type="button"
              onClick={onClearCustomerFilter}
              className="self-start rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-[#d8c6e8] hover:bg-white/10 hover:text-white"
            >
              Clear customer filter
            </button>
          ) : (
            <p className="text-xs text-[#d8c6e8]/65">Next invoice number: {nextInvoiceId || "INV-0001"}</p>
          )}
        </div>

        {isLoading ? (
          <LoadingPanel label="Loading invoices..." />
        ) : (
          <InvoiceTable
            invoices={visibleInvoices}
            onView={onViewInvoice}
            onStatusChange={onStatusChange}
          />
        )}
      </SectionShell>
    </div>
  );
}

function parseCsv(text) {
  const lines = text.replace(/\r/g, "").split("\n").filter((line) => line.trim());

  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].split(",").map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = line.split(",").map((value) => value.trim());
    return headers.reduce((row, header, index) => {
      row[header] = values[index] || "";
      return row;
    }, {});
  });
}

async function parseSpreadsheetFile(file) {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".csv")) {
    return parseCsv(await file.text());
  }

  if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      return [];
    }

    return XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
      defval: "",
      raw: false
    });
  }

  throw new Error("Upload a CSV, XLS, or XLSX file.");
}

function BulkUploadView({ onProcessed }) {
  const [rows, setRows] = useState([]);
  const [validatedRows, setValidatedRows] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const validRows = validatedRows.filter((row) => row.is_valid);
  const invalidRows = validatedRows.filter((row) => !row.is_valid);

  async function validateRows(importRows) {
    setError("");
    setMessage("");
    setIsProcessing(true);

    try {
      const response = await validateBulkInvoiceRows(importRows);
      setValidatedRows(response.rows || []);
      setMessage(`${response.validCount || 0} rows ready, ${response.invalidCount || 0} rows need attention.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleFile(file) {
    setError("");
    setMessage("");

    if (!file) {
      return;
    }

    try {
      const parsedRows = await parseSpreadsheetFile(file);
      setRows(parsedRows);
      await validateRows(parsedRows);
    } catch (fileError) {
      setError(fileError.message);
    }
  }

  async function processRows() {
    setError("");
    setMessage("");
    setIsProcessing(true);

    try {
      const response = await processBulkInvoiceRows(validatedRows);
      setMessage(`${response.createdCount || 0} invoices were saved and marked for mass sending.`);
      setRows([]);
      setValidatedRows([]);
      await onProcessed();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <SectionShell
      eyebrow="Bulk Upload"
      title="Mass Invoice Import"
      description={`Template columns: ${csvTemplateHeaders.join(", ")}.`}
      action={
        <button
          type="button"
          onClick={processRows}
          disabled={validRows.length === 0 || invalidRows.length > 0 || isProcessing}
          className="neon-button inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send size={16} />
          Send Mass Invoices
        </button>
      }
    >
      <div className="space-y-5">
        <ErrorBanner message={error} />
        {message ? (
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {message}
          </div>
        ) : null}

        <label
          className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#C77DFF]/40 bg-white/[0.04] px-6 py-12 text-center hover:bg-white/[0.07]"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            handleFile(event.dataTransfer.files?.[0]);
          }}
        >
          <Upload size={34} className="text-[#C77DFF]" />
          <span className="mt-3 text-sm font-semibold text-white">Drop CSV template here or choose a file</span>
          <span className="mt-1 text-xs text-[#d8c6e8]/65">CSV, XLS, and XLSX templates are supported.</span>
          <input
            type="file"
            accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
        </label>

        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-[980px] w-full text-left text-sm">
            <thead className="bg-white/[0.06] text-xs uppercase tracking-wide text-[#d8c6e8]/70">
              <tr>
                <th className="px-4 py-3">Row</th>
                <th className="px-4 py-3">Customer ID</th>
                <th className="px-4 py-3">Issue</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Unit</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Validation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {(validatedRows.length ? validatedRows : rows).map((row, index) => (
                <tr key={`${row.row_number || index}-${row.description || index}`} className="text-[#f7edff]">
                  <td className="px-4 py-3">{row.row_number || index + 1}</td>
                  <td className="px-4 py-3">{row.customer_id}</td>
                  <td className="px-4 py-3">{row.issue_date}</td>
                  <td className="px-4 py-3">{row.due_date}</td>
                  <td className="px-4 py-3">{row.description}</td>
                  <td className="px-4 py-3 text-right">{row.quantity}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(row.unit_price)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(row.amount)}</td>
                  <td className="px-4 py-3">
                    {row.is_valid ? (
                      <span className="text-emerald-200">Ready</span>
                    ) : (
                      <span className="text-rose-200">{row.errors?.join("; ") || "Pending validation"}</span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && validatedRows.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-4 py-10 text-center text-[#d8c6e8]/70">
                    Imported rows will appear here before database insertion.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </SectionShell>
  );
}

function PaymentsView() {
  const [workspace, setWorkspace] = useState({ outstandingInvoices: [], payments: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentLink, setPaymentLink] = useState("");
  const outstandingTotal = workspace.outstandingInvoices.reduce((sum, invoice) => sum + Number(invoice.total_amount || 0), 0);

  async function loadPayments() {
    setError("");
    const response = await fetchPaymentsWorkspace();
    setWorkspace(response);
  }

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        await loadPayments();
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, []);

  async function markPaid(invoice) {
    setError("");
    setPaymentLink("");

    try {
      await recordManualPayment({
        invoice_id: invoice.invoice_id,
        amount: invoice.total_amount,
        transaction_id: `BANK-${invoice.invoiceId}-${Date.now()}`
      });
      await loadPayments();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function generateStripeLink(invoiceId) {
    setError("");

    try {
      const response = await createStripePaymentLink(invoiceId);
      setPaymentLink(response.paymentUrl);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Outstanding Bills" value={workspace.outstandingInvoices.length} accent="text-white" />
        <MetricCard label="Outstanding Amount" value={formatCurrency(outstandingTotal)} accent="text-rose-200" />
        <MetricCard label="Recent Payments" value={workspace.payments.length} accent="text-emerald-200" />
      </section>

      <SectionShell
        eyebrow="Collections"
        title="Payments Workspace"
        description="Manage unpaid statements, generate collection links, and record matched bank transfers."
      >
        <ErrorBanner message={error} />
        {paymentLink ? (
          <div className="mb-5 rounded-xl border border-blue-400/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
            Stripe link: {paymentLink}
          </div>
        ) : null}

        {isLoading ? (
          <LoadingPanel label="Loading payments..." />
        ) : (
          <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="min-w-[760px] w-full text-left text-sm">
                <thead className="bg-white/[0.06] text-xs uppercase tracking-wide text-[#d8c6e8]/70">
                  <tr>
                    <th className="px-4 py-3">Invoice</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Due Date</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {workspace.outstandingInvoices.map((invoice) => (
                    <tr key={invoice.invoice_id} className="text-[#f7edff]">
                      <td className="px-4 py-4 font-semibold text-white">{invoice.invoiceId}</td>
                      <td className="px-4 py-4">{invoice.customer_name}</td>
                      <td className="px-4 py-4">{formatDate(invoice.due_date)}</td>
                      <td className="px-4 py-4 text-right">{formatCurrency(invoice.total_amount)}</td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => generateStripeLink(invoice.invoice_id)}
                            className="inline-flex items-center gap-2 rounded-lg border border-blue-400/30 px-3 py-2 text-xs font-semibold text-blue-100 hover:bg-blue-500/10"
                          >
                            <LinkIcon size={14} />
                            Stripe Link
                          </button>
                          <button
                            type="button"
                            onClick={() => markPaid(invoice)}
                            className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/30 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/10"
                          >
                            <Banknote size={14} />
                            Record Transfer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <h3 className="text-sm font-semibold text-white">Recent Payment Matches</h3>
              <div className="mt-4 space-y-3">
                {workspace.payments.map((payment) => (
                  <div key={payment.payment_id} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white">{payment.invoiceId || "Unlinked"}</p>
                      <span className="text-xs text-emerald-200">{payment.status}</span>
                    </div>
                    <p className="mt-1 text-xs text-[#d8c6e8]/70">{payment.customer_name || "-"} - {payment.payment_method || "Manual"}</p>
                    <p className="mt-2 text-sm text-white">{formatCurrency(payment.amount)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </SectionShell>
    </div>
  );
}

function SimpleBarChart({ data, labelKey, valueKey }) {
  const maxValue = Math.max(...data.map((item) => Number(item[valueKey] || 0)), 1);

  return (
    <div className="space-y-3">
      {data.map((item) => {
        const value = Number(item[valueKey] || 0);

        return (
          <div key={item[labelKey]} className="grid grid-cols-[90px_1fr_96px] items-center gap-3 text-sm">
            <span className="truncate text-[#d8c6e8]">{item[labelKey]}</span>
            <div className="h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#7B2FF7] to-[#FF4DDB]"
                style={{ width: `${Math.max((value / maxValue) * 100, 4)}%` }}
              />
            </div>
            <span className="text-right font-semibold text-white">{formatCurrency(value)}</span>
          </div>
        );
      })}
    </div>
  );
}

function SimpleLineChart({ data }) {
  const width = 640;
  const height = 220;
  const maxValue = Math.max(...data.map((item) => Number(item.revenue || 0)), 1);
  const points = data.map((item, index) => {
    const x = data.length === 1 ? width / 2 : (index / (data.length - 1)) * width;
    const y = height - (Number(item.revenue || 0) / maxValue) * (height - 20) - 10;
    return `${x},${y}`;
  });

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-64 min-w-[620px] w-full">
        <polyline
          fill="none"
          stroke="#C77DFF"
          strokeWidth="4"
          points={points.join(" ")}
        />
        {data.map((item, index) => {
          const [x, y] = points[index].split(",").map(Number);
          return (
            <g key={item.month}>
              <circle cx={x} cy={y} r="5" fill="#FF4DDB" />
              <text x={x} y={height - 4} textAnchor="middle" fill="#d8c6e8" fontSize="12">
                {item.month}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ReportsView() {
  const [reports, setReports] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadReports() {
      setIsLoading(true);
      try {
        const response = await fetchInvoiceReports();
        setReports(response);
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setIsLoading(false);
      }
    }

    loadReports();
  }, []);

  if (isLoading) {
    return <LoadingPanel label="Loading reports..." />;
  }

  return (
    <div className="space-y-6">
      <ErrorBanner message={error} />
      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Total Revenue" value={formatCurrency(reports?.summary?.total_revenue)} />
        <MetricCard label="Paid Revenue" value={formatCurrency(reports?.summary?.paid_revenue)} accent="text-emerald-200" />
        <MetricCard label="Outstanding" value={formatCurrency(reports?.summary?.outstanding_revenue)} accent="text-rose-200" />
        <MetricCard label="Invoices" value={reports?.summary?.invoice_count || 0} accent="text-blue-200" />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionShell eyebrow="Analytics" title="Revenue Over Time">
          <SimpleLineChart data={reports?.monthlyRevenue || []} />
        </SectionShell>
        <SectionShell eyebrow="Collections" title="Aging Receivables">
          <SimpleBarChart data={reports?.agingReceivables || []} labelKey="bucket" valueKey="total" />
        </SectionShell>
        <SectionShell eyebrow="Status" title="Invoice Status Distribution">
          <SimpleBarChart data={reports?.statusDistribution || []} labelKey="status" valueKey="total" />
        </SectionShell>
        <SectionShell eyebrow="Customers" title="Top Customer Revenue">
          <SimpleBarChart data={reports?.topCustomers || []} labelKey="name" valueKey="total" />
        </SectionShell>
      </div>
    </div>
  );
}

export default function FinanceInvoicingPage() {
  const session = getStoredSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [nextInvoiceId, setNextInvoiceId] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const activeView = useMemo(() => {
    if (location.pathname.endsWith("/customers")) {
      return "customers";
    }

    if (location.pathname.endsWith("/bulk-upload")) {
      return "bulk-upload";
    }

    if (location.pathname.endsWith("/payments")) {
      return "payments";
    }

    if (location.pathname.endsWith("/reports")) {
      return "reports";
    }

    return "invoices";
  }, [location.pathname]);

  async function loadWorkspaceData() {
    setError("");
    const [invoiceResponse, customerResponse, numberResponse, customerDirectoryResponse] = await Promise.all([
      fetchInvoices(),
      fetchInvoiceCustomers(),
      fetchNextInvoiceNumber(),
      fetchCustomers()
    ]);

    setInvoices(invoiceResponse.invoices || []);
    setCustomers(customerDirectoryResponse.customers || customerResponse.customers || []);
    setNextInvoiceId(numberResponse.invoiceId || "INV-0001");
  }

  useEffect(() => {
    async function loadInitialData() {
      setIsLoading(true);
      try {
        await loadWorkspaceData();
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setIsLoading(false);
      }
    }

    loadInitialData();
  }, []);

  async function handleStatusChange(invoiceId, status) {
    const previousInvoices = invoices;
    setInvoices((current) =>
      current.map((invoice) =>
        invoice.invoice_id === invoiceId ? { ...invoice, status } : invoice
      )
    );

    try {
      await updateInvoiceStatus(invoiceId, status);
    } catch (requestError) {
      setInvoices(previousInvoices);
      setError(requestError.message);
    }
  }

  async function handleCreated() {
    setIsCreating(false);
    await loadWorkspaceData();
  }

  function renderActiveView() {
    if (activeView === "customers") {
      return (
        <CustomersView
          customers={customers}
          invoices={invoices}
          isLoading={isLoading}
          error={error}
          onViewInvoices={(customerId) => navigate(`/dashboard/invoicing/finance/invoices?customerId=${customerId}`)}
        />
      );
    }

    if (activeView === "bulk-upload") {
      return <BulkUploadView onProcessed={loadWorkspaceData} />;
    }

    if (activeView === "payments") {
      return <PaymentsView />;
    }

    if (activeView === "reports") {
      return <ReportsView />;
    }

    return (
      <InvoicesView
        invoices={invoices}
        customers={customers}
        nextInvoiceId={nextInvoiceId}
        isLoading={isLoading}
        error={error}
        customerFilter={searchParams.get("customerId")}
        onClearCustomerFilter={() => setSearchParams({})}
        onCreateClick={() => setIsCreating(true)}
        onViewInvoice={setSelectedInvoice}
        onStatusChange={handleStatusChange}
      />
    );
  }

  return (
    <DashboardLayout
      pageTitle="Automated Invoicing System - Finance Invoice Management"
      user={session?.user}
      sidebarSections={financeSidebarSections}
      searchPlaceholder="Search invoices, customers, payments..."
    >
      <div className="space-y-6">
        {renderActiveView()}
      </div>

      {isCreating ? (
        <InvoiceCreationModal
          customers={customers}
          nextInvoiceId={nextInvoiceId}
          onCancel={() => setIsCreating(false)}
          onCreated={handleCreated}
        />
      ) : null}

      <InvoiceDetailsModal
        invoice={selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
      />
    </DashboardLayout>
  );
}
