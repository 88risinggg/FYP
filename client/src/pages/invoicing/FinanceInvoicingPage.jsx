import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  AlertCircle,
  Banknote,
  Building2,
  CalendarClock,
  CreditCard,
  Download,
  Eye,
  FileBarChart,
  LayoutDashboard,
  Link as LinkIcon,
  Loader2,
  Plus,
  ReceiptText,
  Search,
  Send,
  ShieldAlert,
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
  fetchFraudDashboard,
  fetchNextInvoiceNumber,
  fetchPaymentsWorkspace,
  processBulkInvoiceRows,
  recordManualPayment,
  reassessFraudInvoice,
  reviewFraudInvoice,
  scheduleBulkInvoices,
  sendInvoice,
  validateBulkInvoiceRows
} from "../../services/invoiceService.js";
import {
  Building2,
  CreditCard,
  FileBarChart,
  LayoutDashboard,
  ReceiptText,
  Upload
} from "lucide-react";

import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
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
      },
      {
        label: "Fraud Detection",
        icon: ShieldAlert,
        path: "/dashboard/invoicing/finance/fraud"
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

const invoiceStatuses = ["Draft", "Scheduled", "Sent", "Paid", "Overdue"];

const statusStyles = {
  Draft: "border-slate-400/25 bg-slate-400/10 text-slate-200",
  Scheduled: "border-violet-400/30 bg-violet-500/15 text-violet-100",
  Sent: "border-blue-400/30 bg-blue-500/15 text-blue-200",
  Paid: "border-emerald-400/30 bg-emerald-500/15 text-emerald-200",
  Overdue: "border-rose-400/30 bg-rose-500/15 text-rose-200"
};

const emptyItem = {
  description: "",
  quantity: 1,
  unit_price: ""
};

const excelFileTypeError = "Only Excel invoice files (.xlsx, .xls) are allowed.";
const invoiceFileNameError = 'Invoice upload file name or path must contain "invoice".';
const allowedExcelExtensions = [".xlsx", ".xls"];
const allowedExcelMimeTypes = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel"
];
const invoiceTemplateHeaders = [
  "Invoice Number",
  "Customer Name",
  "Invoice Date",
  "Due Date",
  "Amount"
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

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-SG", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function openPrintableInvoice(invoice) {
  const lineItems = (invoice.items || []).map((item) => `
    <tr>
      <td>${escapeHtml(item.description)}</td>
      <td>${escapeHtml(item.quantity)}</td>
      <td>${escapeHtml(formatCurrency(item.unit_price))}</td>
      <td>${escapeHtml(formatCurrency(item.amount))}</td>
    </tr>
  `).join("");
  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    return;
  }

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${escapeHtml(invoice.invoiceId)} invoice</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111827; margin: 40px; }
          header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 1px solid #d1d5db; padding-bottom: 20px; }
          h1 { margin: 0 0 8px; font-size: 28px; }
          .muted { color: #6b7280; }
          table { width: 100%; border-collapse: collapse; margin-top: 28px; }
          th, td { border-bottom: 1px solid #e5e7eb; padding: 10px; text-align: left; }
          th { background: #f9fafb; }
          .total { margin-top: 24px; text-align: right; font-size: 18px; font-weight: 700; }
          @media print { button { display: none; } body { margin: 24px; } }
        </style>
      </head>
      <body>
        <button onclick="window.print()">Save as PDF</button>
        <header>
          <div>
            <h1>Invoice ${escapeHtml(invoice.invoiceId)}</h1>
            <div class="muted">Status: ${escapeHtml(invoice.status)}</div>
          </div>
          <div>
            <strong>${escapeHtml(invoice.customer_name)}</strong><br />
            <span class="muted">${escapeHtml(invoice.customer_email)}</span><br />
            <span class="muted">${escapeHtml(invoice.customer_address || "")}</span>
          </div>
        </header>
        <p>Issue date: ${escapeHtml(formatDate(invoice.issue_date))}</p>
        <p>Due date: ${escapeHtml(formatDate(invoice.due_date))}</p>
        <table>
          <thead>
            <tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr>
          </thead>
          <tbody>${lineItems}</tbody>
        </table>
        <div class="total">Total: ${escapeHtml(formatCurrency(invoice.total_amount))}</div>
        <script>window.onload = () => window.print();</script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

function downloadReceipt(invoice) {
  const receipt = [
    `Receipt for ${invoice.invoiceId}`,
    `Customer: ${invoice.customer_name}`,
    `Email: ${invoice.customer_email}`,
    `Amount Paid: ${formatCurrency(invoice.total_amount)}`,
    `Status: ${invoice.status}`,
    `Generated: ${formatDateTime(new Date().toISOString())}`
  ].join("\n");
  const blob = new Blob([receipt], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${invoice.invoiceId}-receipt.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

function toDateInputValue(date) {
  return date.toISOString().slice(0, 10);
}

function toTimeInputValue(date) {
  return date.toTimeString().slice(0, 5);
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
  const [isSaving, setIsSaving] = useState(false);
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

  async function submitInvoice() {
    setError("");
    setIsSaving(true);

    try {
      await createInvoice({
        customer_id: form.customer_id,
        issue_date: form.issue_date,
        due_date: form.due_date,
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
      setIsSaving(false);
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
            onClick={submitInvoice}
            disabled={isSaving}
            className="neon-button inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold disabled:opacity-60"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            {isSaving ? "Creating..." : "Create Draft Invoice"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ScheduleInvoiceModal({ selectedCount, onCancel, onConfirm }) {
  const defaultDate = new Date(Date.now() + 60 * 60 * 1000);
  const [date, setDate] = useState(toDateInputValue(defaultDate));
  const [time, setTime] = useState(toTimeInputValue(defaultDate));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function confirmSchedule() {
    setError("");

    const scheduledDate = new Date(`${date}T${time}`);
    if (Number.isNaN(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now()) {
      setError("Choose a future date and time.");
      return;
    }

    setIsSaving(true);
    try {
      await onConfirm(scheduledDate.toISOString());
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#090014]/80 p-4 backdrop-blur">
      <div className="neon-glass neon-border w-full max-w-lg rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="text-sm font-semibold text-[#C77DFF]">Schedule Invoice</p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              {selectedCount} {selectedCount === 1 ? "invoice" : "invoices"} selected
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-2 text-[#d8c6e8] hover:bg-white/10 hover:text-white"
            aria-label="Close schedule dialog"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <ErrorBanner message={error} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-[#d8c6e8]">Date</span>
              <input
                type="date"
                value={date}
                min={toDateInputValue(new Date())}
                onChange={(event) => setDate(event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#120022]/90 px-3 py-3 text-sm text-white outline-none focus:border-[#C77DFF]"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-[#d8c6e8]">Time</span>
              <input
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#120022]/90 px-3 py-3 text-sm text-white outline-none focus:border-[#C77DFF]"
              />
            </label>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirmSchedule}
            disabled={isSaving}
            className="neon-button inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CalendarClock size={16} />
            {isSaving ? "Scheduling..." : "Confirm Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}

function InvoiceTable({
  invoices,
  selectedInvoiceIds,
  onToggleInvoice,
  onToggleAll,
  onView,
  onSend,
  onScheduleInvoice
}) {
  if (invoices.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/15 px-5 py-12 text-center text-sm text-[#d8c6e8]">
        No invoices found.
      </div>
    );
  }

  const schedulableInvoices = invoices.filter((invoice) => invoice.status === "Draft");
  const selectedVisibleCount = schedulableInvoices.filter((invoice) => selectedInvoiceIds.has(invoice.invoice_id)).length;
  const allVisibleSelected = schedulableInvoices.length > 0 && selectedVisibleCount === schedulableInvoices.length;

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="min-w-[1080px] w-full text-left text-sm">
        <thead className="bg-white/[0.06] text-xs uppercase tracking-wide text-[#d8c6e8]/70">
          <tr>
            <th className="w-12 px-4 py-3">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                disabled={schedulableInvoices.length === 0}
                onChange={(event) => onToggleAll(event.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-[#120022] accent-[#C77DFF] disabled:opacity-30"
                aria-label="Select all draft invoices"
              />
            </th>
            <th className="px-4 py-3">Invoice Number</th>
            <th className="px-4 py-3">Customer</th>
            <th className="px-4 py-3">Issue Date</th>
            <th className="px-4 py-3">Due Date</th>
            <th className="px-4 py-3">Scheduled</th>
            <th className="px-4 py-3 text-right">Total Amount</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {invoices.map((invoice) => (
            <tr key={invoice.invoice_id} className="text-[#f7edff] transition hover:bg-white/[0.04]">
              <td className="px-4 py-4">
                <input
                  type="checkbox"
                  checked={selectedInvoiceIds.has(invoice.invoice_id)}
                  disabled={invoice.status !== "Draft"}
                  onChange={(event) => onToggleInvoice(invoice.invoice_id, event.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-[#120022] accent-[#C77DFF] disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label={`Select invoice ${invoice.invoiceId}`}
                />
              </td>
              <td className="px-4 py-4 font-semibold text-white">{invoice.invoiceId}</td>
              <td className="px-4 py-4">
                <p className="font-medium text-white">{invoice.customer_name}</p>
                <p className="text-xs text-[#d8c6e8]/65">{invoice.customer_email}</p>
              </td>
              <td className="px-4 py-4">{formatDate(invoice.issue_date)}</td>
              <td className="px-4 py-4">{formatDate(invoice.due_date)}</td>
              <td className="px-4 py-4 text-[#d8c6e8]">{invoice.scheduled_at ? formatDateTime(invoice.scheduled_at) : "-"}</td>
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
                  {invoice.status === "Draft" ? (
                    <button
                      type="button"
                      onClick={() => onSend(invoice.invoice_id)}
                      className="inline-flex items-center gap-2 rounded-lg border border-blue-400/30 px-3 py-2 text-xs font-semibold text-blue-100 hover:bg-blue-500/10"
                    >
                      <Send size={14} />
                      Send Invoice
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => openPrintableInvoice(invoice)}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-[#f0dcff] hover:bg-white/10"
                  >
                    <Download size={14} />
                    Download PDF
                  </button>
                  {invoice.status === "Draft" ? (
                    <button
                      type="button"
                      onClick={() => onScheduleInvoice(invoice.invoice_id)}
                      className="inline-flex items-center gap-2 rounded-lg border border-violet-400/30 px-3 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-500/10"
                    >
                      <CalendarClock size={14} />
                      Schedule Invoice
                    </button>
                  ) : null}
                  {invoice.status === "Paid" ? (
                    <button
                      type="button"
                      onClick={() => downloadReceipt(invoice)}
                      className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/30 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/10"
                    >
                      <ReceiptText size={14} />
                      Download Receipt
                    </button>
                  ) : null}
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
  globalSearch,
  onClearCustomerFilter,
  onCreateClick,
  onViewInvoice,
  onSendInvoice,
  onScheduleInvoices
}) {
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState(new Set());
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState("");
  const visibleInvoices = useMemo(() => {
    let filtered = invoices;

    if (customerFilter) {
      filtered = filtered.filter((invoice) => Number(invoice.customer_id) === Number(customerFilter));
    }

    if (globalSearch && globalSearch.trim()) {
      const query = globalSearch.trim().toLowerCase();
      filtered = filtered.filter((invoice) =>
        (invoice.invoiceId || "").toLowerCase().includes(query) ||
        (invoice.customer_name || "").toLowerCase().includes(query) ||
        (invoice.customer_email || "").toLowerCase().includes(query) ||
        (invoice.status || "").toLowerCase().includes(query) ||
        String(invoice.total_amount || "").includes(query)
      );
    }

    return filtered;
  }, [customerFilter, globalSearch, invoices]);

  const metrics = useMemo(() => {
    return invoiceStatuses.reduce((acc, status) => {
      acc[status] = visibleInvoices
        .filter((invoice) => invoice.status === status)
        .reduce((sum, invoice) => sum + Number(invoice.total_amount || 0), 0);
      return acc;
    }, {});
  }, [visibleInvoices]);
  const selectedCount = selectedInvoiceIds.size;

  useEffect(() => {
    const visibleIds = new Set(visibleInvoices.map((invoice) => invoice.invoice_id));
    setSelectedInvoiceIds((current) => {
      const next = new Set([...current].filter((invoiceId) => visibleIds.has(invoiceId)));
      return next.size === current.size ? current : next;
    });
  }, [visibleInvoices]);

  function toggleInvoice(invoiceId, checked) {
    setScheduleMessage("");
    const invoice = visibleInvoices.find((inv) => inv.invoice_id === invoiceId);
    if (invoice && invoice.status !== "Draft") return;
    setSelectedInvoiceIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(invoiceId);
      } else {
        next.delete(invoiceId);
      }
      return next;
    });
  }

  function toggleAllInvoices(checked) {
    setScheduleMessage("");
    setSelectedInvoiceIds((current) => {
      const next = new Set(current);
      visibleInvoices.forEach((invoice) => {
        if (invoice.status !== "Draft") return;
        if (checked) {
          next.add(invoice.invoice_id);
        } else {
          next.delete(invoice.invoice_id);
        }
      });
      return next;
    });
  }

  async function confirmSchedule(scheduledAt) {
    const invoiceIds = [...selectedInvoiceIds];
    const response = await scheduleBulkInvoices(invoiceIds, scheduledAt);
    setScheduleMessage(`${response.scheduledCount || invoiceIds.length} invoices scheduled for ${formatDateTime(response.scheduled_at || scheduledAt)}.`);
    setSelectedInvoiceIds(new Set());
    setIsScheduleModalOpen(false);
    await onScheduleInvoices();
  }

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
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setIsScheduleModalOpen(true)}
              disabled={selectedCount === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#C77DFF]/30 px-5 py-3 text-sm font-semibold text-[#f0dcff] hover:bg-[#C77DFF]/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CalendarClock size={17} />
              Schedule Invoice
            </button>
            <button
              type="button"
              onClick={onCreateClick}
              className="neon-button inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold"
            >
              <Plus size={17} />
              Create Single Invoice
            </button>
          </div>
        }
      >
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-3">
            <ErrorBanner message={error} />
            {scheduleMessage ? (
              <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                {scheduleMessage}
              </div>
            ) : null}
          </div>
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
            selectedInvoiceIds={selectedInvoiceIds}
            onToggleInvoice={toggleInvoice}
            onToggleAll={toggleAllInvoices}
            onView={onViewInvoice}
            onSend={onSendInvoice}
            onScheduleInvoice={(invoiceId) => {
              setSelectedInvoiceIds(new Set([invoiceId]));
              setIsScheduleModalOpen(true);
            }}
          />
        )}
      </SectionShell>

      {isScheduleModalOpen ? (
        <ScheduleInvoiceModal
          selectedCount={selectedCount}
          onCancel={() => setIsScheduleModalOpen(false)}
          onConfirm={confirmSchedule}
        />
      ) : null}
    </div>
  );
}

function getFileExtension(fileName) {
  const match = fileName.toLowerCase().match(/\.[^.]+$/);
  return match ? match[0] : "";
}

function getUploadFilePath(file) {
  return String(file.webkitRelativePath || file.name || "");
}

function validateExcelFile(file) {
  const uploadPath = getUploadFilePath(file);
  const extension = getFileExtension(uploadPath);

  // File type validation happens before parsing so non-Excel files are never read into import rows.
  if (!allowedExcelExtensions.includes(extension) || !allowedExcelMimeTypes.includes(file.type)) {
    throw new Error(excelFileTypeError);
  }

  if (!uploadPath.toLowerCase().includes("invoice")) {
    throw new Error(invoiceFileNameError);
  }
}

async function parseSpreadsheetFile(file) {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      return [];
    }

    return XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
      defval: "",
      raw: false
    });
  }

  throw new Error(excelFileTypeError);
}

function BulkUploadView({ onProcessed }) {
  const [rows, setRows] = useState([]);
  const [validatedRows, setValidatedRows] = useState([]);
  const [selectedRowIndices, setSelectedRowIndices] = useState(new Set());
  const [fileMetadata, setFileMetadata] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [scheduleDate, setScheduleDate] = useState(toDateInputValue(new Date(Date.now() + 60 * 60 * 1000)));
  const [scheduleTime, setScheduleTime] = useState(toTimeInputValue(new Date(Date.now() + 60 * 60 * 1000)));
  const [sendMode, setSendMode] = useState("now");

  const validRows = validatedRows.filter((row) => row.is_valid);
  const invalidRows = validatedRows.filter((row) => !row.is_valid);
  const selectedCount = selectedRowIndices.size;

  function toggleRow(index, checked) {
    setSelectedRowIndices((prev) => {
      const next = new Set(prev);
      if (checked) next.add(index);
      else next.delete(index);
      return next;
    });
  }

  function toggleAllRows(checked) {
    if (checked) {
      const allValidIndices = new Set();
      (validatedRows.length ? validatedRows : rows).forEach((row, i) => {
        if (!validatedRows.length || row.is_valid) allValidIndices.add(i);
      });
      setSelectedRowIndices(allValidIndices);
    } else {
      setSelectedRowIndices(new Set());
    }
  }

  async function validateRows(importRows, uploadedFileMetadata) {
    setError("");
    setMessage("");
    setIsProcessing(true);

    try {
      const response = await validateBulkInvoiceRows(importRows, uploadedFileMetadata);
      setValidatedRows(response.rows || []);
      setMessage(`${response.validCount || 0} rows ready, ${response.invalidCount || 0} rows need attention.`);
      const allValid = new Set();
      (response.rows || []).forEach((row, i) => { if (row.is_valid) allValid.add(i); });
      setSelectedRowIndices(allValid);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleFile(file) {
    setError("");
    setMessage("");
    setRows([]);
    setValidatedRows([]);
    setSelectedRowIndices(new Set());
    setFileMetadata(null);

    if (!file) {
      return;
    }

    try {
      validateExcelFile(file);
      const uploadedFileMetadata = {
        name: file.name,
        path: getUploadFilePath(file),
        type: file.type
      };
      const parsedRows = await parseSpreadsheetFile(file);
      setRows(parsedRows);
      setFileMetadata(uploadedFileMetadata);
      await validateRows(parsedRows, uploadedFileMetadata);
    } catch (fileError) {
      setError(fileError.message);
    }
  }

  async function processRows() {
    setError("");
    setMessage("");
    setIsProcessing(true);

    try {
      const rowsToProcess = rows.filter((_, i) => selectedRowIndices.has(i));
      if (rowsToProcess.length === 0) {
        setError("Select at least one row to process.");
        setIsProcessing(false);
        return;
      }

      const response = await processBulkInvoiceRows(rowsToProcess, fileMetadata);
      const createdIds = (response.invoices || []).map((inv) => inv.invoice_id);

      if (sendMode === "schedule" && createdIds.length > 0) {
        const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`);
        if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
          setError("Choose a future date and time for scheduling.");
          setIsProcessing(false);
          return;
        }
        await scheduleBulkInvoices(createdIds, scheduledAt.toISOString());
        setMessage(`${createdIds.length} invoices created and scheduled to send at ${formatDateTime(scheduledAt.toISOString())}.`);
      } else {
        await Promise.all(createdIds.map((invoiceId) => sendInvoice(invoiceId)));
        setMessage(`${response.createdCount || createdIds.length} invoices created and sent.`);
      }

      setRows([]);
      setValidatedRows([]);
      setSelectedRowIndices(new Set());
      setFileMetadata(null);
      await onProcessed();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsProcessing(false);
    }
  }

  const displayRows = validatedRows.length ? validatedRows : rows;
  const allValidSelected = validRows.length > 0 && validRows.every((_, i) => {
    const actualIndex = validatedRows.indexOf(validRows[i]);
    return selectedRowIndices.has(actualIndex);
  });

  return (
    <SectionShell
      eyebrow="Bulk Upload"
      title="Mass Invoice Import"
      description={`Template columns: ${invoiceTemplateHeaders.join(", ")}.`}
      action={
        <div className="flex flex-col items-end gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={processRows}
            disabled={selectedCount === 0 || invalidRows.length > 0 || isProcessing}
            className="neon-button inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sendMode === "schedule" ? <CalendarClock size={16} /> : <Send size={16} />}
            {isProcessing ? "Processing..." : sendMode === "schedule" ? `Schedule ${selectedCount} Invoices` : `Send ${selectedCount} Invoices`}
          </button>
        </div>
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
          <span className="mt-3 text-sm font-semibold text-white">Drop Excel invoice file here or choose a file</span>
          <span className="mt-1 text-xs text-[#d8c6e8]/65">Only XLS and XLSX invoice templates are supported.</span>
          <input
            type="file"
            accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
        </label>

        {/* Send Mode Selector */}
        {validRows.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-sm font-semibold text-white">Send Options</p>
            <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="sendMode" value="now" checked={sendMode === "now"} onChange={() => setSendMode("now")} className="accent-[#C77DFF]" />
                <span className="text-sm text-[#f0dcff]">Send immediately</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="sendMode" value="schedule" checked={sendMode === "schedule"} onChange={() => setSendMode("schedule")} className="accent-[#C77DFF]" />
                <span className="text-sm text-[#f0dcff]">Schedule for later</span>
              </label>
              {sendMode === "schedule" && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={scheduleDate}
                    min={toDateInputValue(new Date())}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="rounded-lg border border-white/10 bg-[#120022]/90 px-3 py-2 text-sm text-white outline-none focus:border-[#C77DFF]"
                  />
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="rounded-lg border border-white/10 bg-[#120022]/90 px-3 py-2 text-sm text-white outline-none focus:border-[#C77DFF]"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-[1060px] w-full text-left text-sm">
            <thead className="bg-white/[0.06] text-xs uppercase tracking-wide text-[#d8c6e8]/70">
              <tr>
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allValidSelected && validRows.length > 0}
                    onChange={(e) => toggleAllRows(e.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-[#120022] accent-[#C77DFF]"
                    aria-label="Select all valid rows"
                  />
                </th>
                <th className="px-4 py-3">Row</th>
                <th className="px-4 py-3">Invoice Number</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Invoice Date</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Validation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {displayRows.map((row, index) => (
                <tr key={`${row.row_number || index}-${row.invoice_number || index}`} className={`text-[#f7edff] transition ${selectedRowIndices.has(index) ? "bg-[#C77DFF]/5" : "hover:bg-white/[0.03]"}`}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedRowIndices.has(index)}
                      onChange={(e) => toggleRow(index, e.target.checked)}
                      disabled={validatedRows.length > 0 && !row.is_valid}
                      className="h-4 w-4 rounded border-white/20 bg-[#120022] accent-[#C77DFF] disabled:opacity-30"
                      aria-label={`Select row ${index + 1}`}
                    />
                  </td>
                  <td className="px-4 py-3">{row.row_number || index + 1}</td>
                  <td className="px-4 py-3 font-semibold text-white">{row.invoice_number || row["Invoice Number"]}</td>
                  <td className="px-4 py-3">{row.customer_name || row["Customer Name"]}</td>
                  <td className="px-4 py-3">{row.issue_date || row["Invoice Date"]}</td>
                  <td className="px-4 py-3">{row.due_date || row["Due Date"]}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(row.amount || row.Amount)}</td>
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
                  <td colSpan="8" className="px-4 py-10 text-center text-[#d8c6e8]/70">
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

function RiskBadge({ level }) {
  const styles = {
    Low: "border-emerald-400/30 bg-emerald-500/15 text-emerald-200",
    Medium: "border-amber-400/30 bg-amber-500/15 text-amber-100",
    High: "border-rose-400/30 bg-rose-500/15 text-rose-100"
  };

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[level] || styles.Low}`}>
      {level || "Low"}
    </span>
  );
}

function FraudDetectionView() {
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    vendor: "",
    customer: "",
    riskLevel: "",
    minScore: "",
    maxScore: ""
  });
  const [dashboard, setDashboard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReviewing, setIsReviewing] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadFraudDashboard(nextFilters = filters) {
    setError("");
    setIsLoading(true);

    try {
      const response = await fetchFraudDashboard(nextFilters);
      setDashboard(response);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadFraudDashboard();
  }, []);

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  async function applyFilters(event) {
    event.preventDefault();
    await loadFraudDashboard(filters);
  }

  async function reviewInvoice(invoice, decision) {
    setError("");
    setMessage("");
    setIsReviewing(`${decision}-${invoice.invoice_id}`);

    try {
      await reviewFraudInvoice(invoice.invoice_id, decision, `${decision} from fraud dashboard`);
      setMessage(`${invoice.invoiceId} marked ${decision.toLowerCase()} for fraud review.`);
      await loadFraudDashboard(filters);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsReviewing("");
    }
  }

  async function reassessInvoice(invoice) {
    setError("");
    setMessage("");
    setIsReviewing(`Reassess-${invoice.invoice_id}`);

    try {
      await reassessFraudInvoice(invoice.invoice_id);
      setMessage(`${invoice.invoiceId} reassessed.`);
      await loadFraudDashboard(filters);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsReviewing("");
    }
  }

  const summary = dashboard?.summary || {};
  const invoices = dashboard?.invoices || [];

  return (
    <div className="space-y-6">
      <ErrorBanner message={error} />
      {message ? (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {message}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-5">
        <MetricCard label="Flagged" value={summary.flaggedCount || 0} accent="text-rose-200" />
        <MetricCard label="High Risk" value={summary.highCount || 0} accent="text-rose-200" />
        <MetricCard label="Medium Risk" value={summary.mediumCount || 0} accent="text-amber-100" />
        <MetricCard label="Low Risk" value={summary.lowCount || 0} accent="text-emerald-200" />
        <MetricCard label="Avg Score" value={summary.averageScore || 0} accent="text-white" />
      </section>

      <SectionShell
        eyebrow="Fraud Detection"
        title="Risk Monitoring"
        description="Rule-based scoring is persisted with indicators so historical data is ready for future ML training."
      >
        <form onSubmit={applyFilters} className="grid gap-3 lg:grid-cols-7">
          <input type="date" value={filters.from} onChange={(e) => updateFilter("from", e.target.value)} className="rounded-lg border border-white/10 bg-[#120022]/90 px-3 py-2 text-sm text-white outline-none focus:border-[#C77DFF]" />
          <input type="date" value={filters.to} onChange={(e) => updateFilter("to", e.target.value)} className="rounded-lg border border-white/10 bg-[#120022]/90 px-3 py-2 text-sm text-white outline-none focus:border-[#C77DFF]" />
          <input type="text" value={filters.vendor} onChange={(e) => updateFilter("vendor", e.target.value)} placeholder="Vendor" className="rounded-lg border border-white/10 bg-[#120022]/90 px-3 py-2 text-sm text-white outline-none placeholder:text-[#d8c6e8]/45 focus:border-[#C77DFF]" />
          <input type="text" value={filters.customer} onChange={(e) => updateFilter("customer", e.target.value)} placeholder="Customer" className="rounded-lg border border-white/10 bg-[#120022]/90 px-3 py-2 text-sm text-white outline-none placeholder:text-[#d8c6e8]/45 focus:border-[#C77DFF]" />
          <select value={filters.riskLevel} onChange={(e) => updateFilter("riskLevel", e.target.value)} className="rounded-lg border border-white/10 bg-[#120022]/90 px-3 py-2 text-sm text-white outline-none focus:border-[#C77DFF]">
            <option value="">All risk</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <input type="number" min="0" max="100" value={filters.minScore} onChange={(e) => updateFilter("minScore", e.target.value)} placeholder="Min score" className="rounded-lg border border-white/10 bg-[#120022]/90 px-3 py-2 text-sm text-white outline-none placeholder:text-[#d8c6e8]/45 focus:border-[#C77DFF]" />
          <button type="submit" className="neon-button px-4 py-2 text-sm font-semibold">Filter</button>
        </form>

        {isLoading ? (
          <LoadingPanel label="Loading fraud dashboard..." />
        ) : (
          <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_280px]">
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="min-w-[1080px] w-full text-left text-sm">
                <thead className="bg-white/[0.06] text-xs uppercase tracking-wide text-[#d8c6e8]/70">
                  <tr>
                    <th className="px-4 py-3">Invoice</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Vendor</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Risk</th>
                    <th className="px-4 py-3">Indicators</th>
                    <th className="px-4 py-3">Review</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {invoices.map((invoice) => (
                    <tr key={invoice.invoice_id} className="text-[#f7edff]">
                      <td className="px-4 py-4">
                        <p className="font-semibold text-white">{invoice.invoiceId}</p>
                        <p className="text-xs text-[#d8c6e8]/60">{formatDate(invoice.issue_date)}</p>
                      </td>
                      <td className="px-4 py-4">{invoice.customer_name}</td>
                      <td className="px-4 py-4">{invoice.vendor_name || "-"}</td>
                      <td className="px-4 py-4 text-right font-semibold">{formatCurrency(invoice.total_amount)}</td>
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <RiskBadge level={invoice.risk_level} />
                          <p className="text-xs text-[#d8c6e8]/65">Score {invoice.risk_score}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="max-w-xs space-y-1">
                          {(invoice.indicators || []).slice(0, 3).map((indicator) => (
                            <p key={indicator.indicator_code} className="text-xs text-[#d8c6e8]">{indicator.indicator_label}</p>
                          ))}
                          {invoice.indicators?.length > 3 ? (
                            <p className="text-xs text-[#C77DFF]">+{invoice.indicators.length - 3} more</p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4">{invoice.review_status}</td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => reviewInvoice(invoice, "Approved")} disabled={Boolean(isReviewing)} className="rounded-lg border border-emerald-400/30 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/10 disabled:opacity-50">
                            {isReviewing === `Approved-${invoice.invoice_id}` ? "..." : "Approve"}
                          </button>
                          <button type="button" onClick={() => reviewInvoice(invoice, "Rejected")} disabled={Boolean(isReviewing)} className="rounded-lg border border-rose-400/30 px-3 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-500/10 disabled:opacity-50">
                            {isReviewing === `Rejected-${invoice.invoice_id}` ? "..." : "Reject"}
                          </button>
                          <button type="button" onClick={() => reassessInvoice(invoice)} disabled={Boolean(isReviewing)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-[#d8c6e8] hover:bg-white/10 disabled:opacity-50">
                            {isReviewing === `Reassess-${invoice.invoice_id}` ? "..." : "Reassess"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {invoices.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-4 py-10 text-center text-[#d8c6e8]/70">No fraud assessments match the current filters.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <h3 className="text-sm font-semibold text-white">Risk Categories</h3>
                <div className="mt-4 space-y-3">
                  {(dashboard?.riskDistribution || []).map((item) => (
                    <div key={item.risk_level} className="flex items-center justify-between text-sm">
                      <RiskBadge level={item.risk_level} />
                      <span className="font-semibold text-white">{item.invoice_count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <h3 className="text-sm font-semibold text-white">Recent Trend</h3>
                <div className="mt-4 space-y-3">
                  {(dashboard?.trends || []).slice(0, 8).map((trend) => (
                    <div key={trend.assessment_date} className="grid grid-cols-[1fr_56px_56px] gap-2 text-xs text-[#d8c6e8]">
                      <span>{trend.assessment_date}</span>
                      <span className="text-right">{trend.assessed_count} total</span>
                      <span className="text-right text-rose-200">{trend.high_count} high</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </SectionShell>
    </div>
  );
}

function ReportsView() {
  const [reports, setReports] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("charts");

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

  const fs = reports?.financialStatement;

  return (
    <div className="space-y-6">
      <ErrorBanner message={error} />

      {/* Summary Metrics */}
      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Total Revenue" value={formatCurrency(reports?.summary?.total_revenue)} />
        <MetricCard label="Paid Revenue" value={formatCurrency(reports?.summary?.paid_revenue)} accent="text-emerald-200" />
        <MetricCard label="Outstanding" value={formatCurrency(reports?.summary?.outstanding_revenue)} accent="text-rose-200" />
        <MetricCard label="Invoices" value={reports?.summary?.invoice_count || 0} accent="text-blue-200" />
      </section>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-white/10 pb-1">
        <button
          type="button"
          onClick={() => setActiveTab("charts")}
          className={`rounded-t-lg px-5 py-2.5 text-sm font-semibold transition ${activeTab === "charts" ? "border-b-2 border-[#C77DFF] bg-white/[0.06] text-white" : "text-[#d8c6e8]/70 hover:bg-white/[0.04] hover:text-white"}`}
        >
          <span className="flex items-center gap-2">
            <FileBarChart size={16} />
            Charts & Analytics
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("accounting")}
          className={`rounded-t-lg px-5 py-2.5 text-sm font-semibold transition ${activeTab === "accounting" ? "border-b-2 border-[#C77DFF] bg-white/[0.06] text-white" : "text-[#d8c6e8]/70 hover:bg-white/[0.04] hover:text-white"}`}
        >
          <span className="flex items-center gap-2">
            <Banknote size={16} />
            Financial Statements
          </span>
        </button>
      </div>

      {/* Charts Tab */}
      {activeTab === "charts" && (
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
      )}

      {/* Accounting Tab */}
      {activeTab === "accounting" && fs && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Income Statement */}
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-[#C77DFF]">Income Statement</h3>
              <div className="mt-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-[#d8c6e8]/75">Gross Revenue</span>
                  <span className="font-semibold text-white">{formatCurrency(fs.incomeStatement.grossRevenue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#d8c6e8]/75">Collections (Paid)</span>
                  <span className="font-semibold text-emerald-200">{formatCurrency(fs.incomeStatement.collections)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#d8c6e8]/75">Outstanding</span>
                  <span className="font-semibold text-amber-200">{formatCurrency(fs.incomeStatement.outstanding)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#d8c6e8]/75">Overdue</span>
                  <span className="font-semibold text-rose-200">{formatCurrency(fs.incomeStatement.overdue)}</span>
                </div>
                <div className="border-t border-white/10 pt-3 flex justify-between text-sm">
                  <span className="font-semibold text-white">Net Receivable</span>
                  <span className="font-semibold text-white">{formatCurrency(fs.incomeStatement.netReceivable)}</span>
                </div>
              </div>
            </div>

            {/* Cash Flow */}
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-[#C77DFF]">Cash Flow Summary</h3>
              <div className="mt-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-[#d8c6e8]/75">Total Inflow (Collected)</span>
                  <span className="font-semibold text-emerald-200">{formatCurrency(fs.cashFlow.totalInflow)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#d8c6e8]/75">Pending Inflow</span>
                  <span className="font-semibold text-amber-200">{formatCurrency(fs.cashFlow.pendingInflow)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#d8c6e8]/75">Overdue Amount</span>
                  <span className="font-semibold text-rose-200">{formatCurrency(fs.cashFlow.overdueAmount)}</span>
                </div>
                <div className="border-t border-white/10 pt-3 flex justify-between text-sm">
                  <span className="text-[#d8c6e8]/75">This Month Revenue</span>
                  <span className="font-semibold text-white">{formatCurrency(fs.cashFlow.thisMonthRevenue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#d8c6e8]/75">Last Month Revenue</span>
                  <span className="font-semibold text-white">{formatCurrency(fs.cashFlow.lastMonthRevenue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#d8c6e8]/75">Month-over-Month Growth</span>
                  <span className={`font-semibold ${Number(fs.cashFlow.monthOverMonthGrowth) >= 0 ? "text-emerald-200" : "text-rose-200"}`}>
                    {Number(fs.cashFlow.monthOverMonthGrowth) >= 0 ? "+" : ""}{fs.cashFlow.monthOverMonthGrowth}%
                  </span>
                </div>
              </div>
            </div>

            {/* Financial Ratios */}
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-[#C77DFF]">Financial Ratios</h3>
              <div className="mt-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-[#d8c6e8]/75">Collection Rate</span>
                  <span className="font-semibold text-white">{fs.ratios.collectionRate}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#d8c6e8]/75">Avg Invoice Value</span>
                  <span className="font-semibold text-white">{formatCurrency(fs.ratios.avgInvoiceValue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#d8c6e8]/75">Revenue per Customer</span>
                  <span className="font-semibold text-white">{formatCurrency(fs.ratios.revenuePerCustomer)}</span>
                </div>
                <div className="border-t border-white/10 pt-3 flex justify-between text-sm">
                  <span className="text-[#d8c6e8]/75">Total Customers</span>
                  <span className="font-semibold text-white">{fs.ratios.totalCustomers}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#d8c6e8]/75">Paid Invoices</span>
                  <span className="font-semibold text-emerald-200">{fs.ratios.paidInvoiceCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#d8c6e8]/75">Overdue Invoices</span>
                  <span className="font-semibold text-rose-200">{fs.ratios.overdueInvoiceCount}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
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
  const [globalSearch, setGlobalSearch] = useState("");
  const [notifications, setNotifications] = useState([]);

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

    if (location.pathname.endsWith("/fraud")) {
      return "fraud";
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

    // Generate notifications from invoice data
    const allInvoices = invoiceResponse.invoices || [];
    let fraudResponse = null;
    try {
      fraudResponse = await fetchFraudDashboard({ riskLevel: "High" });
    } catch {
      fraudResponse = null;
    }
    const newNotifications = [];
    const overdueInvoices = allInvoices.filter((inv) => inv.status === "Overdue");
    const scheduledInvoices = allInvoices.filter((inv) => inv.status === "Scheduled");
    const recentPaid = allInvoices.filter((inv) => inv.status === "Paid").slice(0, 3);
    const highRiskCount = fraudResponse?.summary?.highCount || 0;

    if (highRiskCount > 0) {
      newNotifications.push({
        id: "fraud-high-risk",
        title: `${highRiskCount} high-risk invoice${highRiskCount > 1 ? "s" : ""} detected`,
        description: "Fraud review is required before payment processing.",
        time: "Immediate review",
        read: false
      });
    }

    if (overdueInvoices.length > 0) {
      newNotifications.push({
        id: "overdue-alert",
        title: `${overdueInvoices.length} invoice${overdueInvoices.length > 1 ? "s" : ""} overdue`,
        description: `Total overdue: ${formatCurrency(overdueInvoices.reduce((s, i) => s + Number(i.total_amount), 0))}`,
        time: "Action required",
        read: false
      });
    }

    if (scheduledInvoices.length > 0) {
      newNotifications.push({
        id: "scheduled-info",
        title: `${scheduledInvoices.length} invoice${scheduledInvoices.length > 1 ? "s" : ""} scheduled`,
        description: "Invoices will be sent automatically at the scheduled time.",
        time: "Pending",
        read: false
      });
    }

    recentPaid.forEach((inv) => {
      newNotifications.push({
        id: `paid-${inv.invoice_id}`,
        title: `Payment received: ${inv.invoiceId}`,
        description: `${inv.customer_name} - ${formatCurrency(inv.total_amount)}`,
        time: formatDate(inv.issue_date),
        read: true
      });
    });

    const draftCount = allInvoices.filter((inv) => inv.status === "Draft").length;
    if (draftCount > 0) {
      newNotifications.push({
        id: "draft-reminder",
        title: `${draftCount} draft invoice${draftCount > 1 ? "s" : ""} pending`,
        description: "Review and send when ready.",
        time: "Reminder",
        read: true
      });
    }

    setNotifications(newNotifications);
  }

  function handleGlobalSearch(query) {
    setGlobalSearch(query);
    if (query.trim()) {
      // Navigate to invoices view and apply search via URL
      if (!location.pathname.endsWith("/invoices")) {
        navigate("/dashboard/invoicing/finance/invoices");
      }
    }
  }

  function handleMarkNotificationRead(notifId) {
    setNotifications((current) =>
      current.map((n) => n.id === notifId ? { ...n, read: true } : n)
    );
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

  async function handleSendInvoice(invoiceId) {
    setError("");
    try {
      await sendInvoice(invoiceId);
      await loadWorkspaceData();
    } catch (requestError) {
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

    if (activeView === "fraud") {
      return <FraudDetectionView />;
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
        globalSearch={globalSearch}
        onClearCustomerFilter={() => setSearchParams({})}
        onCreateClick={() => setIsCreating(true)}
        onViewInvoice={setSelectedInvoice}
        onSendInvoice={handleSendInvoice}
        onScheduleInvoices={loadWorkspaceData}
      />
    );
  }
export default function FinanceInvoicingPage() {
  const session = getStoredSession();

  return (
    <DashboardLayout
      pageTitle="Automated Invoicing System - Finance Invoice Management"
      user={session?.user}
      sidebarSections={financeSidebarSections}
      searchPlaceholder="Search invoices, customers, payments..."
      onSearch={handleGlobalSearch}
      notifications={notifications}
      onMarkNotificationRead={handleMarkNotificationRead}
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
    >
      <div className="neon-glass neon-border min-h-[calc(100vh-8rem)] rounded-2xl border-dashed p-8">
        <p className="text-sm text-[#d8c6e8]">
          This page is reserved for module development.
        </p>
      </div>
    </DashboardLayout>
  );
}
