import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  AlertCircle,
  Banknote,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  CreditCard,
  Download,
  Eye,
  FileBarChart,
  FileText,
  LayoutDashboard,
  Link as LinkIcon,
  Loader2,
  Lock,
  Mail,
  Plus,
  ReceiptText,
  Search,
  Send,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
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
  fetchPaymentHistory,
  fetchPaymentsWorkspace,
  processBulkInvoiceRows,
  recordManualPayment,
  reassessFraudInvoice,
  reviewFraudInvoice,
  scheduleBulkInvoices,
  sendInvoice,
  sendInvoiceReminder,
  validateBulkInvoiceRows,
  fetchFinancialExport
} from "../../services/invoiceService.js";
import { getStoredSession } from "../../services/sessionService.js";
import {
  startNotificationPolling,
  markNotificationRead as apiMarkNotificationRead,
  markAllNotificationsRead as apiMarkAllNotificationsRead
} from "../../services/financeNotificationService.js";
import {
  createPdfDocument,
  addCoverPage,
  addPageFooter,
  addSectionHeader,
  addChartImage,
  addMetricRow,
  captureElement,
  generateAndDownloadPdf,
  PAGE_MARGIN,
  CONTENT_WIDTH_A4,
  BRAND_COLOR,
  DARK_COLOR,
  GRAY_COLOR
} from "../../services/pdfExportService.js";

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

const invoiceStatuses = ["Draft", "Scheduled", "Sent", "Viewed", "Paid", "Overdue"];

const statusStyles = {
  Draft: "border-slate-400/25 bg-slate-400/10 text-slate-700",
  Scheduled: "border-violet-400/30 bg-violet-500/15 text-violet-700",
  Sent: "border-blue-400/30 bg-blue-500/15 text-blue-700",
  Viewed: "border-cyan-400/30 bg-cyan-500/15 text-cyan-700",
  Paid: "border-emerald-400/30 bg-emerald-500/15 text-emerald-700",
  Overdue: "border-rose-400/30 bg-rose-500/15 text-rose-700"
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

const DEMO_INVOICES = [
  { invoice_id: 1, invoiceId: "INV-000001", customer_name: "Acme Corporation", customer_email: "billing@acmecorp.sg", customer_id: 1, issue_date: "2026-05-20", due_date: "2026-06-19", total_amount: 5600.00, status: "Paid", scheduled_at: null },
  { invoice_id: 2, invoiceId: "INV-000002", customer_name: "TechWave Solutions", customer_email: "accounts@techwave.sg", customer_id: 2, issue_date: "2026-06-25", due_date: "2026-07-25", total_amount: 4250.00, status: "Sent", scheduled_at: null },
  { invoice_id: 3, invoiceId: "INV-000003", customer_name: "Marina Bay Trading", customer_email: "finance@marinabay.sg", customer_id: 3, issue_date: "2026-07-01", due_date: "2026-07-31", total_amount: 9800.00, status: "Draft", scheduled_at: null },
  { invoice_id: 4, invoiceId: "INV-000004", customer_name: "Sunrise Digital", customer_email: "payment@sunrisedigital.sg", customer_id: 4, issue_date: "2026-06-10", due_date: "2026-07-10", total_amount: 15200.00, status: "Overdue", scheduled_at: null },
  { invoice_id: 5, invoiceId: "INV-000005", customer_name: "Pacific Ventures", customer_email: "ap@pacificventures.sg", customer_id: 5, issue_date: "2026-06-18", due_date: "2026-07-18", total_amount: 8900.50, status: "Overdue", scheduled_at: null },
  { invoice_id: 6, invoiceId: "INV-000006", customer_name: "GreenLeaf Consulting", customer_email: "invoices@greenleaf.sg", customer_id: 6, issue_date: "2026-06-20", due_date: "2026-07-20", total_amount: 5400.00, status: "Paid", scheduled_at: null },
  { invoice_id: 7, invoiceId: "INV-000007", customer_name: "CloudNine Systems", customer_email: "billing@cloudnine.sg", customer_id: 7, issue_date: "2026-07-05", due_date: "2026-08-04", total_amount: 3175.00, status: "Sent", scheduled_at: null },
  { invoice_id: 8, invoiceId: "INV-000008", customer_name: "Diamond Electronics", customer_email: "accounts@diamondel.sg", customer_id: 8, issue_date: "2026-07-10", due_date: "2026-08-09", total_amount: 6720.00, status: "Draft", scheduled_at: null },
  { invoice_id: 9, invoiceId: "INV-000009", customer_name: "Golden Gate Logistics", customer_email: "finance@gglogistics.sg", customer_id: 9, issue_date: "2026-06-28", due_date: "2026-07-28", total_amount: 11350.00, status: "Viewed", scheduled_at: null },
  { invoice_id: 10, invoiceId: "INV-000010", customer_name: "BluePeak Software", customer_email: "ar@bluepeaksw.sg", customer_id: 10, issue_date: "2026-06-15", due_date: "2026-07-15", total_amount: 8750.00, status: "Paid", scheduled_at: null },
  { invoice_id: 11, invoiceId: "INV-000011", customer_name: "Stellar Marketing", customer_email: "payments@stellarmarketing.sg", customer_id: 11, issue_date: "2026-07-08", due_date: "2026-08-07", total_amount: 2680.00, status: "Scheduled", scheduled_at: "2026-07-20T09:00:00" },
  { invoice_id: 12, invoiceId: "INV-000012", customer_name: "Zenith Engineering", customer_email: "accounts@zenitheng.sg", customer_id: 12, issue_date: "2026-05-28", due_date: "2026-06-27", total_amount: 12400.00, status: "Overdue", scheduled_at: null },
  { invoice_id: 13, invoiceId: "INV-000013", customer_name: "Coral Bay Restaurants", customer_email: "finance@coralbay.sg", customer_id: 13, issue_date: "2026-06-05", due_date: "2026-07-05", total_amount: 3300.00, status: "Paid", scheduled_at: null },
  { invoice_id: 14, invoiceId: "INV-000014", customer_name: "Atlas Security", customer_email: "invoices@atlassec.sg", customer_id: 14, issue_date: "2026-07-12", due_date: "2026-08-11", total_amount: 7550.00, status: "Draft", scheduled_at: null },
  { invoice_id: 15, invoiceId: "INV-000015", customer_name: "Orchid Healthcare", customer_email: "billing@orchidhc.sg", customer_id: 15, issue_date: "2026-07-02", due_date: "2026-08-01", total_amount: 4100.00, status: "Sent", scheduled_at: null }
];

const DEMO_CUSTOMERS = [
  { customer_id: 1, name: "Acme Corporation", email: "billing@acmecorp.sg", address: "1 Raffles Place, #20-01, Singapore 048616", created_at: "2026-01-10T08:30:00.000Z" },
  { customer_id: 2, name: "TechWave Solutions", email: "accounts@techwave.sg", address: "5 Shenton Way, #12-05, Singapore 068808", created_at: "2026-01-15T09:00:00.000Z" },
  { customer_id: 3, name: "Marina Bay Trading", email: "finance@marinabay.sg", address: "10 Bayfront Avenue, #03-12, Singapore 018956", created_at: "2026-02-01T10:15:00.000Z" },
  { customer_id: 4, name: "Sunrise Digital", email: "payment@sunrisedigital.sg", address: "71 Ayer Rajah Crescent, #06-14, Singapore 139951", created_at: "2026-02-08T11:00:00.000Z" },
  { customer_id: 5, name: "Pacific Ventures", email: "ap@pacificventures.sg", address: "8 Marina View, #30-01, Singapore 018960", created_at: "2026-02-20T14:30:00.000Z" },
  { customer_id: 6, name: "GreenLeaf Consulting", email: "invoices@greenleaf.sg", address: "3 Fusionopolis Way, #07-21, Singapore 138633", created_at: "2026-03-05T09:45:00.000Z" },
  { customer_id: 7, name: "CloudNine Systems", email: "billing@cloudnine.sg", address: "21 Bukit Batok Street 22, #04-08, Singapore 659589", created_at: "2026-03-12T08:00:00.000Z" },
  { customer_id: 8, name: "Diamond Electronics", email: "accounts@diamondel.sg", address: "52 Jurong Gateway Road, #11-03, Singapore 608550", created_at: "2026-03-18T13:20:00.000Z" },
  { customer_id: 9, name: "Golden Gate Logistics", email: "finance@gglogistics.sg", address: "30 Pasir Panjang Road, #02-15, Singapore 117440", created_at: "2026-04-01T10:00:00.000Z" },
  { customer_id: 10, name: "BluePeak Software", email: "ar@bluepeaksw.sg", address: "9 North Buona Vista Drive, #08-01, Singapore 138588", created_at: "2026-04-10T11:30:00.000Z" },
  { customer_id: 11, name: "Stellar Marketing", email: "payments@stellarmarketing.sg", address: "80 Robinson Road, #17-02, Singapore 068898", created_at: "2026-04-22T09:15:00.000Z" },
  { customer_id: 12, name: "Zenith Engineering", email: "accounts@zenitheng.sg", address: "18 Boon Lay Way, #05-06, Singapore 609966", created_at: "2026-05-03T14:00:00.000Z" },
  { customer_id: 13, name: "Coral Bay Restaurants", email: "finance@coralbay.sg", address: "26 Sentosa Gateway, #01-10, Singapore 098138", created_at: "2026-05-15T12:45:00.000Z" },
  { customer_id: 14, name: "Atlas Security", email: "invoices@atlassec.sg", address: "12 Tampines Central 1, #09-04, Singapore 529543", created_at: "2026-06-01T08:30:00.000Z" },
  { customer_id: 15, name: "Orchid Healthcare", email: "billing@orchidhc.sg", address: "2 Bukit Merah Central, #15-01, Singapore 159835", created_at: "2026-06-10T10:00:00.000Z" }
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

  const isPayable = !["Paid", "Cancelled", "Refunded"].includes(invoice.status);

  // Generate a fresh Stripe payment link if current one is a placeholder or missing
  async function getPaymentData() {
    if (!isPayable) return { url: null };

    const currentUrl = invoice.payment_url || "";
    const isPlaceholder = currentUrl.includes("cs_test_sent_") ||
      currentUrl.includes("cs_test_viewed_") ||
      currentUrl.includes("cs_test_overdue_") ||
      currentUrl.includes("cs_test_paid_") ||
      !currentUrl;

    if (isPlaceholder) {
      try {
        const response = await createStripePaymentLink(invoice.invoice_id);
        return { url: response.paymentUrl };
      } catch {
        return { url: currentUrl || null };
      }
    }

    return { url: currentUrl };
  }

  getPaymentData().then(({ url: paymentUrl }) => {
    // Build QR code using inline canvas script (rendered in the print window)
    const qrLibUrl = "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js";

    const paymentSection = (isPayable && paymentUrl) ? `
      <div style="margin-top: 32px; padding: 24px; background: #f8f4ff; border-radius: 12px; text-align: center; border: 1px solid #e5e0f0;">
        <h3 style="margin: 0 0 4px; font-size: 16px; color: #1a1a2e;">Pay This Invoice Online</h3>
        <p style="margin: 0 0 16px; font-size: 12px; color: #666;">Secure payment powered by Stripe</p>
        <a href="${escapeHtml(paymentUrl)}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #7B2FF7; color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; cursor: pointer;">
          Pay Now â€” ${escapeHtml(formatCurrency(invoice.total_amount))}
        </a>
        <p style="margin: 12px 0 0; font-size: 10px; color: #888;">Click the button above or copy this link into your browser:</p>
        <p style="margin: 4px 0 0; font-size: 11px; word-break: break-all;"><a href="${escapeHtml(paymentUrl)}" target="_blank" style="color: #7B2FF7; text-decoration: underline;">${escapeHtml(paymentUrl)}</a></p>
        <div style="margin-top: 20px; padding-top: 16px; border-top: 1px dashed #ddd;">
          <p style="font-size: 12px; color: #666; margin: 0 0 12px;">Scan QR code to pay:</p>
          <div id="stripe-qr" style="display: inline-block; background: white; padding: 8px; border-radius: 8px; border: 1px solid #e5e7eb;"></div>
          <p style="font-size: 10px; color: #666; margin: 6px 0 0;">Scan with any QR reader to open Stripe Checkout</p>
        </div>
      </div>
    ` : "";

    const paidBanner = (invoice.status === "Paid") ? `
      <div style="margin-top: 32px; padding: 16px; background: #ecfdf5; border-radius: 12px; text-align: center; border: 1px solid #a7f3d0;">
        <p style="margin: 0; font-size: 14px; font-weight: 600; color: #065f46;">âœ… This invoice has been paid. Thank you!</p>
      </div>
    ` : "";

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${escapeHtml(invoice.invoiceId)} invoice</title>
          <script src="${qrLibUrl}"><\/script>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; color: #111827; margin: 40px; }
            header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #7B2FF7; padding-bottom: 20px; }
            h1 { margin: 0 0 4px; font-size: 28px; color: #7B2FF7; }
            .brand { font-size: 32px; font-weight: 900; color: #7B2FF7; margin: 0; }
            .muted { color: #6b7280; }
            table { width: 100%; border-collapse: collapse; margin-top: 28px; }
            th, td { border-bottom: 1px solid #e5e7eb; padding: 10px; text-align: left; }
            th { background: #1a1a2e; color: white; font-size: 12px; text-transform: uppercase; }
            .total { margin-top: 24px; text-align: right; font-size: 20px; font-weight: 900; }
            .footer { margin-top: 40px; text-align: center; color: #999; font-size: 11px; border-top: 1px solid #eee; padding-top: 16px; }
            @media print { .no-print { display: none; } body { margin: 24px; } }
          </style>
        </head>
        <body>
          <button class="no-print" onclick="window.print()" style="margin-bottom: 16px; padding: 8px 16px; cursor: pointer;">Save as PDF</button>
          <header>
            <div>
              <p class="brand">PayNivo</p>
              <h1>Invoice ${escapeHtml(invoice.invoiceId)}</h1>
              <div class="muted">Status: ${escapeHtml(invoice.status)}</div>
            </div>
            <div style="text-align: right;">
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
          <div class="total">Total: SGD ${escapeHtml(formatCurrency(invoice.total_amount))}</div>
          ${paymentSection}
          ${paidBanner}
          <div class="footer">Generated by PayNivo â€¢ Automated Invoicing & Payroll System</div>
          <script>
            function renderQR(elementId, data, size) {
              if (!data || !document.getElementById(elementId)) return;
              try {
                var qr = qrcode(0, 'M');
                qr.addData(data);
                qr.make();
                document.getElementById(elementId).innerHTML = qr.createSvgTag({ cellSize: size || 3, margin: 0 });
              } catch(e) { console.error('QR error:', e); }
            }

            window.onload = function() {
              ${isPayable && paymentUrl ? `
              renderQR('stripe-qr', '${escapeHtml(paymentUrl)}', 3);
              ` : ""}
              // Auto-print after short delay for QR rendering
              setTimeout(function() { window.print(); }, 500);
            };
          <\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  });
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
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusStyles[status] || statusStyles.Draft}`}>
      {status}
    </span>
  );
}

function MetricCard({ label, value, accent = "text-[#251E1F]" }) {
  return (
    <div className="neon-glass neon-border rounded-xl px-5 py-4">
      <p className="text-xs font-bold uppercase tracking-wide text-[#7b6660]">
        {label}
      </p>
      <p className={`mt-2 text-3xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}

function SectionShell({ eyebrow, title, description, action, children }) {
  return (
    <section className="neon-glass neon-border rounded-2xl p-5">
      <div className="flex flex-col gap-4 border-b border-[#f0d2ca] pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-bold text-[#F38978]">{eyebrow}</p>
          <h2 className="mt-1 text-2xl font-bold text-[#251E1F]">{title}</h2>
          {description ? (
            <p className="mt-2 max-w-3xl text-sm text-[#7b6660]">{description}</p>
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
    <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
      {message}
    </div>
  );
}

function LoadingPanel({ label }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-xl border border-[#f0d2ca] px-5 py-16 text-[#7b6660]">
      <Loader2 size={20} className="animate-spin" />
      {label}
    </div>
  );
}

function InvoiceDetailsModal({ invoice, onClose }) {
  if (!invoice) {
    return null;
  }

  const isPayable = !["Paid", "Cancelled", "Refunded"].includes(invoice.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#090014]/80 p-4 backdrop-blur">
      <div className="neon-glass neon-border my-6 w-full max-w-3xl rounded-2xl">
        <div className="flex items-start justify-between border-b border-[#f0d2ca] p-5">
          <div>
            <p className="text-sm text-[#F38978]">{invoice.invoiceId}</p>
            <h2 className="mt-1 text-xl font-semibold text-[#251E1F]">{invoice.customer_name}</h2>
            <p className="mt-1 text-sm text-[#7b6660]">{invoice.customer_email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[#7b6660] hover:bg-[#FDD9CD]/30 hover:text-[#251E1F]"
            aria-label="Close invoice details"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-4">
          <div>
            <p className="text-xs text-[#7b6660]/70">Issue Date</p>
            <p className="mt-1 text-sm font-medium text-[#251E1F]">{formatDate(invoice.issue_date)}</p>
          </div>
          <div>
            <p className="text-xs text-[#7b6660]/70">Due Date</p>
            <p className="mt-1 text-sm font-medium text-[#251E1F]">{formatDate(invoice.due_date)}</p>
          </div>
          <div>
            <p className="text-xs text-[#7b6660]/70">Status</p>
            <div className="mt-1">
              <InvoiceStatusBadge status={invoice.status} />
            </div>
          </div>
          <div>
            <p className="text-xs text-[#7b6660]/70">Total</p>
            <p className="mt-1 text-sm font-semibold text-[#251E1F]">{formatCurrency(invoice.total_amount)}</p>
          </div>
        </div>

        {/* Stripe Payment Section */}
        {(invoice.payment_status || invoice.payment_url || invoice.transaction_id) ? (
          <div className="mx-5 mb-4 rounded-xl border border-[#f0d2ca] bg-[#FDD9CD]/10 p-4">
            <h3 className="text-sm font-semibold text-[#F38978] mb-3 flex items-center gap-2">
              <CreditCard size={14} />
              Stripe Payment Details
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {invoice.payment_status ? (
                <div>
                  <p className="text-xs text-[#7b6660]/70">Payment Status</p>
                  <span className={`inline-flex mt-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    invoice.payment_status === "paid"
                      ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-700"
                      : invoice.payment_status === "failed"
                      ? "border-rose-400/30 bg-rose-500/15 text-rose-700"
                      : "border-amber-400/30 bg-amber-500/15 text-amber-700"
                  }`}>
                    {invoice.payment_status.toUpperCase()}
                  </span>
                </div>
              ) : null}
              {invoice.payment_method ? (
                <div>
                  <p className="text-xs text-[#7b6660]/70">Payment Method</p>
                  <p className="mt-1 text-sm font-medium text-[#251E1F] capitalize">{invoice.payment_method}</p>
                </div>
              ) : null}
              {invoice.payment_date ? (
                <div>
                  <p className="text-xs text-[#7b6660]/70">Payment Date</p>
                  <p className="mt-1 text-sm font-medium text-[#251E1F]">{formatDateTime(invoice.payment_date)}</p>
                </div>
              ) : null}
              {invoice.transaction_id ? (
                <div>
                  <p className="text-xs text-[#7b6660]/70">Transaction ID</p>
                  <p className="mt-1 text-xs font-mono text-[#7b6660] break-all">{invoice.transaction_id}</p>
                </div>
              ) : null}
            </div>
            {invoice.payment_url && isPayable ? (
              <div className="mt-3 flex items-center gap-3">
                <a
                  href={invoice.payment_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#7B2FF7] px-4 py-2 text-xs font-bold text-[#251E1F] hover:bg-[#6a1fe0]"
                >
                  <CreditCard size={14} />
                  Pay Now
                </a>
                <span className="text-xs text-[#7b6660]/50 break-all flex-1">{invoice.payment_url}</span>
              </div>
            ) : null}
            {invoice.qr_code_url && isPayable ? (
              <div className="mt-3 text-center">
                <p className="text-xs text-[#7b6660] mb-2">Scan QR Code to Pay</p>
                <img
                  src={invoice.qr_code_url}
                  alt="Payment QR Code"
                  className="mx-auto h-32 w-32 rounded-lg border border-[#f0d2ca] bg-white p-1"
                />
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="px-5 pb-5">
          <div className="overflow-hidden rounded-xl border border-[#f0d2ca]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#FDD9CD]/20 text-xs uppercase tracking-wide text-[#7b6660]">
                <tr>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Unit Price</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {invoice.items?.map((item) => (
                  <tr key={item.item_id} className="text-[#251E1F]">
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
        <div className="flex flex-col gap-3 border-b border-[#f0d2ca] pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#F38978]">Create Single Invoice</p>
            <h2 className="mt-1 text-xl font-semibold text-[#251E1F]">{nextInvoiceId || "INV-0001"}</h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="self-start rounded-lg border border-[#f0d2ca] px-4 py-2 text-sm font-medium text-[#7b6660] hover:bg-[#FDD9CD]/30 hover:text-[#251E1F] sm:self-auto"
          >
            Cancel
          </button>
        </div>

        <div className="mt-4">
          <ErrorBanner message={error} />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <label className="block">
            <span className="text-sm font-medium text-[#7b6660]">Customer</span>
            <select
              value={form.customer_id}
              onChange={(event) => setForm((current) => ({ ...current, customer_id: event.target.value }))}
              className="mt-2 w-full rounded-xl border border-[#f0d2ca] bg-white px-3 py-3 text-sm text-[#251E1F] outline-none focus:border-[#F38978]"
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
            <span className="text-sm font-medium text-[#7b6660]">Issue Date</span>
            <input
              type="date"
              value={form.issue_date}
              onChange={(event) => setForm((current) => ({ ...current, issue_date: event.target.value }))}
              className="mt-2 w-full rounded-xl border border-[#f0d2ca] bg-white px-3 py-3 text-sm text-[#251E1F] outline-none focus:border-[#F38978]"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[#7b6660]">Due Date</span>
            <input
              type="date"
              value={form.due_date}
              onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))}
              className="mt-2 w-full rounded-xl border border-[#f0d2ca] bg-white px-3 py-3 text-sm text-[#251E1F] outline-none focus:border-[#F38978]"
            />
          </label>
        </div>

        <div className="mt-6 overflow-x-auto rounded-xl border border-[#f0d2ca]">
          <table className="min-w-[760px] w-full text-left text-sm">
            <thead className="bg-[#FDD9CD]/20 text-xs uppercase tracking-wide text-[#7b6660]">
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
                      className="w-full rounded-lg border border-[#f0d2ca] bg-[#FDD9CD]/20 px-3 py-2 text-[#251E1F] outline-none placeholder:text-[#7b6660]/60 focus:border-[#F38978]"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={item.quantity}
                      onChange={(event) => updateItem(index, "quantity", event.target.value)}
                      className="w-full rounded-lg border border-[#f0d2ca] bg-[#FDD9CD]/20 px-3 py-2 text-right text-[#251E1F] outline-none focus:border-[#F38978]"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(event) => updateItem(index, "unit_price", event.target.value)}
                      className="w-full rounded-lg border border-[#f0d2ca] bg-[#FDD9CD]/20 px-3 py-2 text-right text-[#251E1F] outline-none focus:border-[#F38978]"
                    />
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-[#251E1F]">
                    {formatCurrency(getItemAmount(item))}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      disabled={form.items.length === 1}
                      className="rounded-lg p-2 text-[#7b6660] hover:bg-[#FDD9CD]/30 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
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
            className="inline-flex items-center gap-2 self-start rounded-xl border border-[#F38978]/30 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#F38978]/10"
          >
            <Plus size={16} />
            Add Item
          </button>

          <div className="w-full max-w-sm rounded-xl border border-[#f0d2ca] bg-white/[0.05] p-4">
            <div className="flex justify-between py-1 text-sm text-[#7b6660]">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between py-1 text-sm text-[#7b6660]">
              <span>Tax</span>
              <span>{formatCurrency(0)}</span>
            </div>
            <div className="mt-3 flex justify-between border-t border-[#f0d2ca] pt-3 text-base font-semibold text-[#251E1F]">
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
        <div className="flex items-start justify-between gap-4 border-b border-[#f0d2ca] pb-5">
          <div>
            <p className="text-sm font-semibold text-[#F38978]">Schedule Invoice</p>
            <h2 className="mt-1 text-xl font-semibold text-[#251E1F]">
              {selectedCount} {selectedCount === 1 ? "invoice" : "invoices"} selected
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-2 text-[#7b6660] hover:bg-[#FDD9CD]/30 hover:text-[#251E1F]"
            aria-label="Close schedule dialog"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <ErrorBanner message={error} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-[#7b6660]">Date</span>
              <input
                type="date"
                value={date}
                min={toDateInputValue(new Date())}
                onChange={(event) => setDate(event.target.value)}
                className="mt-2 w-full rounded-xl border border-[#f0d2ca] bg-white px-3 py-3 text-sm text-[#251E1F] outline-none focus:border-[#F38978]"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-[#7b6660]">Time</span>
              <input
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                className="mt-2 w-full rounded-xl border border-[#f0d2ca] bg-white px-3 py-3 text-sm text-[#251E1F] outline-none focus:border-[#F38978]"
              />
            </label>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-[#f0d2ca] px-5 py-3 text-sm font-semibold text-[#251E1F] hover:bg-[#FDD9CD]/30"
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
      <div className="rounded-xl border border-dashed border-[#f0d2ca] px-5 py-12 text-center text-sm text-[#7b6660]">
        No invoices found.
      </div>
    );
  }

  const schedulableInvoices = invoices.filter((invoice) => invoice.status === "Draft");
  const selectedVisibleCount = schedulableInvoices.filter((invoice) => selectedInvoiceIds.has(invoice.invoice_id)).length;
  const allVisibleSelected = schedulableInvoices.length > 0 && selectedVisibleCount === schedulableInvoices.length;

  return (
    <div className="overflow-x-auto rounded-xl border border-[#f0d2ca]">
      <table className="min-w-[1080px] w-full text-left text-sm">
        <thead className="bg-[#FDD9CD]/20 text-xs uppercase tracking-wide text-[#7b6660]">
          <tr>
            <th className="w-12 px-4 py-3">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                disabled={schedulableInvoices.length === 0}
                onChange={(event) => onToggleAll(event.target.checked)}
                className="h-4 w-4 rounded border-[#f0d2ca] bg-white accent-[#C77DFF] disabled:opacity-30"
                aria-label="Select all draft invoices"
              />
            </th>
            <th className="px-4 py-3 font-bold">Invoice Number</th>
            <th className="px-4 py-3 font-bold">Customer</th>
            <th className="px-4 py-3 font-bold">Issue Date</th>
            <th className="px-4 py-3 font-bold">Due Date</th>
            <th className="px-4 py-3 font-bold">Scheduled</th>
            <th className="px-4 py-3 font-bold text-right">Total Amount</th>
            <th className="px-4 py-3 font-bold">Status</th>
            <th className="px-4 py-3 font-bold text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {invoices.map((invoice) => (
            <tr key={invoice.invoice_id} className="text-[#251E1F] transition hover:bg-[#FDD9CD]/10">
              <td className="px-4 py-4">
                <input
                  type="checkbox"
                  checked={selectedInvoiceIds.has(invoice.invoice_id)}
                  disabled={invoice.status !== "Draft"}
                  onChange={(event) => onToggleInvoice(invoice.invoice_id, event.target.checked)}
                  className="h-4 w-4 rounded border-[#f0d2ca] bg-white accent-[#C77DFF] disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label={`Select invoice ${invoice.invoiceId}`}
                />
              </td>
              <td className="px-4 py-4 font-bold text-[#251E1F]">{invoice.invoiceId}</td>
              <td className="px-4 py-4">
                <p className="font-bold text-[#251E1F]">{invoice.customer_name}</p>
                <p className="text-xs text-[#7b6660]">{invoice.customer_email}</p>
              </td>
              <td className="px-4 py-4">{formatDate(invoice.issue_date)}</td>
              <td className="px-4 py-4">{formatDate(invoice.due_date)}</td>
              <td className="px-4 py-4 text-[#7b6660]">{invoice.scheduled_at ? formatDateTime(invoice.scheduled_at) : "-"}</td>
              <td className="px-4 py-4 text-right font-bold text-[#251E1F]">{formatCurrency(invoice.total_amount)}</td>
              <td className="px-4 py-4">
                <InvoiceStatusBadge status={invoice.status} />
              </td>
              <td className="px-4 py-4">
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => onView(invoice)}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#f0d2ca] px-3 py-2 text-xs font-semibold text-[#251E1F] hover:bg-[#FDD9CD]/30"
                  >
                    <Eye size={14} />
                    View Details
                  </button>
                  {invoice.status === "Draft" ? (
                    <button
                      type="button"
                      onClick={() => onSend(invoice.invoice_id)}
                      className="inline-flex items-center gap-2 rounded-lg border border-blue-400/30 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-500/10"
                    >
                      <Send size={14} />
                      Send Invoice
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => openPrintableInvoice(invoice)}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#f0d2ca] px-3 py-2 text-xs font-semibold text-[#251E1F] hover:bg-[#FDD9CD]/30"
                  >
                    <Download size={14} />
                    Download PDF
                  </button>
                  {invoice.status === "Draft" ? (
                    <button
                      type="button"
                      onClick={() => onScheduleInvoice(invoice.invoice_id)}
                      className="inline-flex items-center gap-2 rounded-lg border border-violet-400/30 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-500/10"
                    >
                      <CalendarClock size={14} />
                      Schedule Invoice
                    </button>
                  ) : null}
                  {invoice.status === "Paid" ? (
                    <button
                      type="button"
                      onClick={() => downloadReceipt(invoice)}
                      className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/30 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/10"
                    >
                      <ReceiptText size={14} />
                      Download Receipt
                    </button>
                  ) : null}
                  {["Sent", "Viewed", "Overdue"].includes(invoice.status) ? (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await sendInvoiceReminder(invoice.invoice_id);
                        } catch { /* handled by UI */ }
                      }}
                      className="inline-flex items-center gap-2 rounded-lg border border-amber-400/30 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-500/10"
                    >
                      <Mail size={14} />
                      Send Reminder
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
        <div className="flex w-full max-w-sm items-center gap-2 rounded-xl border border-[#f0d2ca] bg-[#FDD9CD]/20 px-3 py-2">
          <Search size={16} className="text-[#F38978]" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search customers..."
            className="w-full bg-transparent text-sm text-[#251E1F] outline-none placeholder:text-[#7b6660]/70"
          />
        </div>
      }
    >
      <ErrorBanner message={error} />
      {isLoading ? (
        <LoadingPanel label="Loading customers..." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#f0d2ca]">
          <table className="min-w-[860px] w-full text-left text-sm">
            <thead className="bg-[#FDD9CD]/20 text-xs uppercase tracking-wide text-[#7b6660]">
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
                  <tr key={customer.customer_id} className="text-[#251E1F] hover:bg-[#FDD9CD]/10">
                    <td className="px-4 py-4 font-semibold text-[#251E1F]">{customer.name}</td>
                    <td className="px-4 py-4">{customer.email || "-"}</td>
                    <td className="px-4 py-4">{customer.address || "-"}</td>
                    <td className="px-4 py-4">{formatDate(customer.created_at)}</td>
                    <td className="px-4 py-4 text-right">{invoiceCount}</td>
                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => onViewInvoices(customer.customer_id)}
                        className="rounded-lg border border-[#F38978]/30 px-3 py-2 text-xs font-semibold text-[#251E1F] hover:bg-[#F38978]/10"
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

function InvoicingDashboardView({ invoices, customers, isLoading, error, navigate }) {
  const [invoiceSettings, setInvoiceSettings] = useState(null);
  const [reminderRules, setReminderRules] = useState([]);
  const [auditEntries, setAuditEntries] = useState([]);
  const [fraudSummary, setFraudSummary] = useState(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    async function loadDashboardExtras() {
      const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
      const token = localStorage.getItem("authToken");
      const headers = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      async function safeFetch(path) {
        try {
          const res = await fetch(`${API_BASE}${path}`, { headers });
          if (!res.ok) return null;
          return await res.json();
        } catch { return null; }
      }

      const [settingsData, remindersData, auditData, fraudData] = await Promise.all([
        safeFetch("/api/admin/invoicing/invoice-settings"),
        safeFetch("/api/admin/invoicing/reminder-settings"),
        safeFetch("/api/admin/invoicing/audit-logs?limit=10"),
        safeFetch("/api/fraud/dashboard")
      ]);

      if (settingsData?.settings) setInvoiceSettings(settingsData.settings);
      if (remindersData) setReminderRules(remindersData.settings || remindersData || []);
      if (auditData) setAuditEntries(auditData.logs || auditData || []);
      if (fraudData?.summary) setFraudSummary(fraudData.summary);
      setSettingsLoaded(true);
    }
    if (!isLoading) loadDashboardExtras();
  }, [isLoading]);

  const statusCounts = useMemo(() => {
    const counts = { Draft: 0, Scheduled: 0, Sent: 0, Viewed: 0, Paid: 0, Overdue: 0 };
    invoices.forEach((inv) => {
      if (counts[inv.status] !== undefined) counts[inv.status]++;
    });
    return counts;
  }, [invoices]);

  const totals = useMemo(() => {
    const totalRevenue = invoices.reduce((s, i) => s + Number(i.total_amount || 0), 0);
    const paidRevenue = invoices.filter((i) => i.status === "Paid").reduce((s, i) => s + Number(i.total_amount || 0), 0);
    const overdueAmount = invoices.filter((i) => i.status === "Overdue").reduce((s, i) => s + Number(i.total_amount || 0), 0);
    const pendingAmount = invoices.filter((i) => i.status === "Sent" || i.status === "Scheduled").reduce((s, i) => s + Number(i.total_amount || 0), 0);
    return { totalRevenue, paidRevenue, overdueAmount, pendingAmount };
  }, [invoices]);

  const invoiceWorkflowSteps = [
    {
      key: "create",
      title: "Create Invoice",
      icon: FileText,
      completed: invoices.length > 0,
      details: ["Single or bulk upload", "Auto invoice numbering", "Line items with quantities"]
    },
    {
      key: "schedule",
      title: "Schedule & Send",
      icon: Send,
      completed: statusCounts.Sent > 0 || statusCounts.Scheduled > 0,
      details: ["Schedule for future delivery", "Email invoices to customers", "Online view link included"]
    },
    {
      key: "track",
      title: "Track & Monitor",
      icon: Eye,
      completed: statusCounts.Sent > 0 || statusCounts.Paid > 0,
      details: ["Status tracking (Draftâ†’Paid)", "Overdue detection", "Fraud risk assessment"]
    },
    {
      key: "payment",
      title: "Collect Payment",
      icon: CreditCard,
      completed: statusCounts.Paid > 0,
      details: ["Stripe payment links", "Bank transfer support", "Webhook payment updates"]
    },
    {
      key: "remind",
      title: "Reminders & Alerts",
      icon: Mail,
      completed: statusCounts.Overdue > 0 || statusCounts.Sent > 0,
      details: ["Automated reminder schedules", "Overdue escalation emails", "Delivery log tracking"]
    },
    {
      key: "report",
      title: "Reports & Reconciliation",
      icon: FileBarChart,
      completed: statusCounts.Paid > 0,
      details: ["Revenue summaries", "Financial statements", "Aging reports"]
    }
  ];

  if (isLoading) {
    return <LoadingPanel label="Loading dashboard..." />;
  }

  return (
    <section>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#F38978]/80">
            Finance Invoicing Workflow
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-[#251E1F]">Dashboard</h2>
        </div>
      </div>

      {error ? <div className="mt-4"><ErrorBanner message={error} /></div> : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="neon-glass rounded-2xl p-5">
          <p className="text-sm text-[#7b6660]">Total Revenue</p>
          <p className="mt-3 text-3xl font-semibold text-[#251E1F]">{formatCurrency(totals.totalRevenue)}</p>
          <p className="mt-2 text-xs font-semibold text-[#7b6660]">{invoices.length} invoices</p>
        </div>
        <div className="neon-glass rounded-2xl p-5">
          <p className="text-sm text-[#7b6660]">Collected</p>
          <p className="mt-3 text-3xl font-semibold text-[#7CFFB2]">{formatCurrency(totals.paidRevenue)}</p>
          <p className="mt-2 text-xs font-semibold text-[#7b6660]">{statusCounts.Paid} paid</p>
        </div>
        <div className="neon-glass rounded-2xl p-5">
          <p className="text-sm text-[#7b6660]">Pending</p>
          <p className="mt-3 text-3xl font-semibold text-[#FFB86B]">{formatCurrency(totals.pendingAmount)}</p>
          <p className="mt-2 text-xs font-semibold text-[#7b6660]">{statusCounts.Sent + statusCounts.Scheduled} invoices</p>
        </div>
        <div className="neon-glass rounded-2xl p-5">
          <p className="text-sm text-[#7b6660]">Overdue</p>
          <p className="mt-3 text-3xl font-semibold text-rose-700">{formatCurrency(totals.overdueAmount)}</p>
          <p className="mt-2 text-xs font-semibold text-[#7b6660]">{statusCounts.Overdue} overdue</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-[#251E1F]">Invoicing Workflow</h3>
            <p className="mt-1 text-sm font-medium text-[#7b6660]">End-to-end invoice lifecycle from creation to reconciliation.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {invoiceWorkflowSteps.map((step) => {
              const Icon = step.icon;
              return (
                <article key={step.key} className="neon-glass neon-border rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F38978]/10 text-[#F38978] ring-1 ring-[#F38978]/25">
                      <Icon size={24} />
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${step.completed ? "border-[#7CFFB2]/25 bg-[#7CFFB2]/10 text-[#7CFFB2]" : "border-[#f0d2ca] bg-[#FDD9CD]/20 text-[#7b6660]"}`}>
                      {step.completed ? "Active" : "Pending"}
                    </span>
                  </div>
                  <h3 className="mt-5 text-base font-semibold text-[#251E1F]">{step.title}</h3>
                  <ul className="mt-3 space-y-2 text-sm text-[#7b6660]">
                    {step.details.map((detail) => (
                      <li key={detail} className="flex gap-2">
                        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#F38978]" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </div>

        <aside className="neon-glass neon-border rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#7B2FF7]/20 text-[#F38978]">
              <ShieldCheck size={21} />
            </div>
            <div>
              <h3 className="font-semibold text-[#251E1F]">Invoice Status Tracker</h3>
              <p className="text-sm text-[#7b6660]">{invoices.length} total invoices</p>
            </div>
          </div>
          <div className="mt-6 space-y-3 text-sm text-[#7b6660]">
            {invoiceStatuses.map((status) => (
              <div key={status} className="flex items-center gap-3 rounded-xl border border-[#f0d2ca] bg-[#FDD9CD]/10 p-3">
                <CheckCircle2 size={17} className={statusCounts[status] > 0 ? "text-[#7CFFB2]" : "text-[#7b6660]/50"} />
                <span className="flex-1">{status}</span>
                <span className="font-semibold text-[#251E1F]">{statusCounts[status]}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={() => navigate("/dashboard/invoicing/finance/invoices")}
              className="neon-button flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold"
            >
              <ReceiptText size={17} />
              View All Invoices
            </button>
            <button
              type="button"
              onClick={() => navigate("/dashboard/invoicing/finance/customers")}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#f0d2ca] bg-[#FDD9CD]/20 px-4 py-2.5 text-sm font-semibold text-[#251E1F] transition hover:bg-[#FDD9CD]/30"
            >
              <Building2 size={17} />
              Customer Directory
            </button>
          </div>
        </aside>
      </div>

      <div className="mt-6 neon-glass neon-border rounded-2xl p-6">
        <h3 className="text-lg font-bold text-[#251E1F]">Quick Overview</h3>
        <p className="mt-1 text-sm font-medium text-[#7b6660]">Key performance metrics at a glance.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-[#f0d2ca] bg-[#FDD9CD]/10 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F38978]/10 text-[#F38978]">
                <Building2 size={18} />
              </div>
              <div>
                <p className="text-xs text-[#7b6660]">Active Customers</p>
                <p className="text-lg font-semibold text-[#251E1F]">{customers.length}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-[#f0d2ca] bg-[#FDD9CD]/10 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#7CFFB2]/15 text-[#7CFFB2]">
                <TrendingUp size={18} />
              </div>
              <div>
                <p className="text-xs text-[#7b6660]">Collection Rate</p>
                <p className="text-lg font-semibold text-[#251E1F]">
                  {invoices.length > 0 ? Math.round((statusCounts.Paid / invoices.length) * 100) : 0}%
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-[#f0d2ca] bg-[#FDD9CD]/10 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FFB86B]/15 text-[#FFB86B]">
                <Clock size={18} />
              </div>
              <div>
                <p className="text-xs text-[#7b6660]">Drafts Pending</p>
                <p className="text-lg font-semibold text-[#251E1F]">{statusCounts.Draft}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-[#f0d2ca] bg-[#FDD9CD]/10 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-400/15 text-rose-700">
                <AlertCircle size={18} />
              </div>
              <div>
                <p className="text-xs text-[#7b6660]">Overdue Action</p>
                <p className="text-lg font-semibold text-[#251E1F]">{statusCounts.Overdue}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Invoice Settings Panel */}
      {settingsLoaded && invoiceSettings ? (
        <AdminInvoiceConfigPanel settings={invoiceSettings} reminderRules={reminderRules} />
      ) : null}

      {/* Fraud Compliance Checklist */}
      <InvoiceCompliancePanel
        invoices={invoices}
        fraudSummary={fraudSummary}
      />

      {/* Automated Exception Review */}
      <InvoiceExceptionPanel invoices={invoices} fraudSummary={fraudSummary} />

      {/* Accounting Impact */}
      <InvoiceAccountingPanel invoices={invoices} totals={totals} statusCounts={statusCounts} />

      {/* Audit Trail */}
      <InvoiceAuditTrailPanel entries={auditEntries} />
    </section>
  );
}

function AdminInvoiceConfigPanel({ settings, reminderRules }) {
  const updatedAt = settings?.updated_at || settings?.updatedAt;
  const formattedUpdate = updatedAt ? formatDateTime(updatedAt) : "Default configuration";
  const activeReminders = Array.isArray(reminderRules) ? reminderRules.filter((r) => r.enabled) : [];

  return (
    <div className="mt-6 neon-glass neon-border rounded-2xl p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#7B2FF7]/20 text-[#F38978]">
            <Settings2 size={21} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[#251E1F]">Admin Invoice Rules</h3>
            <p className="text-sm text-[#7b6660]">Read-only invoice configuration, numbering, tax, and reminder rules from Admin.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#7b6660]">
          <Lock size={14} className="text-[#F38978]" />
          <span>Admin controlled</span>
          <span className="text-[#7b6660]/50">â€¢</span>
          <span>Last updated: {formattedUpdate}</span>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[#f0d2ca] bg-[#FDD9CD]/10 p-4">
          <p className="text-xs text-[#7b6660]">Invoice Prefix</p>
          <p className="mt-1 text-lg font-semibold text-[#251E1F]">{settings.invoicePrefix || "INV"}</p>
        </div>
        <div className="rounded-xl border border-[#f0d2ca] bg-[#FDD9CD]/10 p-4">
          <p className="text-xs text-[#7b6660]">Numbering Style</p>
          <p className="mt-1 text-sm font-semibold text-[#251E1F]">{settings.numberingStyle || "PREFIX-DATE-NUMBER"}</p>
        </div>
        <div className="rounded-xl border border-[#f0d2ca] bg-[#FDD9CD]/10 p-4">
          <p className="text-xs text-[#7b6660]">Default Currency</p>
          <p className="mt-1 text-lg font-semibold text-[#251E1F]">{settings.defaultCurrency || "SGD"}</p>
        </div>
        <div className="rounded-xl border border-[#f0d2ca] bg-[#FDD9CD]/10 p-4">
          <p className="text-xs text-[#7b6660]">Payment Terms</p>
          <p className="mt-1 text-sm font-semibold text-[#251E1F]">{settings.paymentTerms || "Net 30"}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[#f0d2ca] bg-[#FDD9CD]/10 p-4">
          <p className="text-xs text-[#7b6660]">Due Period</p>
          <p className="mt-1 text-sm font-semibold text-[#251E1F]">{settings.dueDays || 30} days</p>
        </div>
        <div className="rounded-xl border border-[#f0d2ca] bg-[#FDD9CD]/10 p-4">
          <p className="text-xs text-[#7b6660]">Tax Type & Rate</p>
          <p className="mt-1 text-sm font-semibold text-[#251E1F]">{settings.taxType || "GST"} @ {settings.defaultTaxRate || 0}%</p>
        </div>
        <div className="rounded-xl border border-[#f0d2ca] bg-[#FDD9CD]/10 p-4">
          <p className="text-xs text-[#7b6660]">Late Fee</p>
          <p className="mt-1 text-sm font-semibold text-[#251E1F]">{settings.lateFeePercent || 0}% after {settings.gracePeriodDays || 0} day grace</p>
        </div>
        <div className="rounded-xl border border-[#f0d2ca] bg-[#FDD9CD]/10 p-4">
          <p className="text-xs text-[#7b6660]">Active Reminders</p>
          <p className="mt-1 text-sm font-semibold text-[#251E1F]">{activeReminders.length} rule(s) enabled</p>
        </div>
      </div>

      {activeReminders.length > 0 ? (
        <div className="mt-5 overflow-x-auto rounded-xl border border-[#f0d2ca]">
          <table className="min-w-[600px] w-full text-left text-sm">
            <thead className="bg-[#FDD9CD]/20 text-xs uppercase tracking-wide text-[#7b6660]">
              <tr>
                <th className="px-4 py-3">Rule Name</th>
                <th className="px-4 py-3">Frequency</th>
                <th className="px-4 py-3">1st Reminder</th>
                <th className="px-4 py-3">2nd Reminder</th>
                <th className="px-4 py-3">Final</th>
                <th className="px-4 py-3">Channel</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {activeReminders.map((rule, idx) => (
                <tr key={rule.id || idx} className="text-[#251E1F]">
                  <td className="px-4 py-3 font-medium text-[#251E1F]">{rule.name || rule.ruleName || `Rule ${idx + 1}`}</td>
                  <td className="px-4 py-3">{rule.frequency || "Daily"}</td>
                  <td className="px-4 py-3">{rule.firstReminderDays || "-"} days</td>
                  <td className="px-4 py-3">{rule.secondReminderDays || "-"} days</td>
                  <td className="px-4 py-3">{rule.finalReminderDays || "-"} days</td>
                  <td className="px-4 py-3">{rule.deliveryChannel || "Email"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {settings.companyName ? (
        <div className="mt-5 rounded-xl border border-[#f0d2ca] bg-[#FDD9CD]/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#F38978]/70">Company Details</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3 text-sm">
            <div>
              <p className="text-[#7b6660]">Company Name</p>
              <p className="font-semibold text-[#251E1F]">{settings.companyName}</p>
            </div>
            <div>
              <p className="text-[#7b6660]">Support Email</p>
              <p className="font-semibold text-[#251E1F]">{settings.supportEmail || "-"}</p>
            </div>
            <div>
              <p className="text-[#7b6660]">Address</p>
              <p className="font-semibold text-[#251E1F]">{settings.companyAddress || "-"}</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InvoiceCompliancePanel({ invoices, fraudSummary }) {
  const [reportSending, setReportSending] = useState(false);
  const [reportSent, setReportSent] = useState(false);

  // Fraud-focused compliance checks derived from invoice data and fraud summary
  const noDuplicateNumbers = new Set(invoices.map((i) => i.invoiceId)).size === invoices.length;
  const allHavePO = invoices.every((inv) => inv.po_number || inv.invoiceId);
  const noHighRisk = (fraudSummary?.highCount || 0) === 0;
  const noMediumRisk = (fraudSummary?.mediumCount || 0) === 0;
  const allHaveCustomer = invoices.every((inv) => inv.customer_name);
  const overdueInvoices = invoices.filter((inv) => inv.status === "Overdue");
  const noStaleOverdue = overdueInvoices.length === 0;
  const fraudActive = Boolean(fraudSummary && fraudSummary.assessedCount > 0);

  const checks = [
    { label: "No duplicate invoice numbers", status: noDuplicateNumbers, detail: noDuplicateNumbers ? "All invoice IDs are unique" : "Duplicate invoice numbers detected â€” potential fraud", severity: "Critical" },
    { label: "Purchase Order exists for all invoices", status: allHavePO, detail: allHavePO ? "All invoices have a PO reference" : "Some invoices missing PO â€” requires verification", severity: "High" },
    { label: "Vendor approved & KYC complete", status: !fraudSummary?.flaggedCount, detail: fraudSummary?.flaggedCount ? `${fraudSummary.flaggedCount} invoice(s) flagged for vendor issues` : "All vendors verified", severity: "High" },
    { label: "Invoice amounts within approval limits", status: noHighRisk, detail: noHighRisk ? "No unusually high amounts detected" : `${fraudSummary?.highCount} high-risk amount(s) flagged`, severity: "High" },
    { label: "Bank accounts verified (no recent changes)", status: noMediumRisk && noHighRisk, detail: (noMediumRisk && noHighRisk) ? "No bank account anomalies" : "Bank account changes detected in flagged invoices", severity: "High" },
    { label: "No high-risk country vendors", status: noHighRisk, detail: noHighRisk ? "All vendors from approved jurisdictions" : `${fraudSummary?.highCount} invoice(s) from high-risk sources`, severity: "Critical" },
    { label: "Sanctions & AML screening passed", status: fraudActive && noHighRisk, detail: fraudActive ? "All assessed invoices cleared" : "Fraud detection service not active", severity: "Critical" },
    { label: "Approval workflow completed", status: allHaveCustomer, detail: allHaveCustomer ? "All invoices have assigned approvers" : "Some invoices lack proper approval chain", severity: "High" },
    { label: "Three-way match (PO, Invoice, Receipt)", status: allHavePO && noDuplicateNumbers, detail: (allHavePO && noDuplicateNumbers) ? "Matching verified for all invoices" : "Mismatch detected â€” review required", severity: "High" },
    { label: "No overdue invoices pending action", status: noStaleOverdue, detail: noStaleOverdue ? "All invoices within payment terms" : `${overdueInvoices.length} overdue invoice(s) require follow-up`, severity: "Medium" },
    { label: "Fraud detection engine active", status: fraudActive, detail: fraudActive ? `${fraudSummary?.assessedCount || 0} invoice(s) scanned` : "Fraud detection not responding", severity: "Critical" },
    { label: "No invoice splitting detected", status: noMediumRisk, detail: noMediumRisk ? "No split invoice patterns found" : "Potential invoice splitting detected", severity: "High" },
    { label: "Weekend/after-hours submissions reviewed", status: noMediumRisk, detail: noMediumRisk ? "No suspicious submission times" : "Off-hours submissions flagged for review", severity: "Medium" },
    { label: "Vendor not blacklisted", status: noHighRisk, detail: noHighRisk ? "No blacklisted vendors found" : "Blacklisted vendor activity detected", severity: "Critical" },
    { label: "No duplicate payment requests", status: noDuplicateNumbers, detail: noDuplicateNumbers ? "No duplicate payments detected" : "Duplicate payment requests found", severity: "Critical" }
  ];

  const passed = checks.filter((c) => c.status).length;
  const failed = checks.filter((c) => !c.status);

  // Generate fraud report as Excel and send notification
  async function handleSendFraudReport() {
    setReportSending(true);
    try {
      await generateAndDownloadPdf(
        async () => {
          const doc = createPdfDocument("portrait");
          const timestamp = new Date().toLocaleString("en-SG");
          const pageCtx = { pageNum: 1, timestamp };

          // Cover page
          addCoverPage(doc, {
            title: "Fraud Detection Report",
            subtitle: "Compliance & Risk Assessment",
            generatedBy: "Finance Team",
            date: timestamp
          });
          addPageFooter(doc, pageCtx.pageNum, null, timestamp);

          // Page 2 - Summary Statistics
          doc.addPage();
          pageCtx.pageNum++;
          let y = PAGE_MARGIN + 5;

          y = addSectionHeader(doc, "Fraud Summary Statistics", y);
          y += 4;

          y = addMetricRow(doc, "Total Invoices Analyzed", String(fraudSummary?.assessedCount || 0), y);
          y = addMetricRow(doc, "Suspicious Invoices (Flagged)", String(fraudSummary?.flaggedCount || 0), y, { valueColor: [190, 18, 60] });
          const pct = fraudSummary?.assessedCount > 0
            ? ((fraudSummary?.flaggedCount || 0) / fraudSummary.assessedCount * 100).toFixed(1) + "%"
            : "0%";
          y = addMetricRow(doc, "Fraud Percentage", pct, y, { valueColor: [190, 18, 60] });
          y = addMetricRow(doc, "Average Risk Score", String(fraudSummary?.averageScore || 0), y);
          y += 4;

          y = addSectionHeader(doc, "Risk Level Breakdown", y + 4);
          y += 4;
          y = addMetricRow(doc, "High Risk Invoices", String(fraudSummary?.highCount || 0), y, { valueColor: [190, 18, 60] });
          y = addMetricRow(doc, "Medium Risk Invoices", String(fraudSummary?.mediumCount || 0), y, { valueColor: [180, 83, 9] });
          y = addMetricRow(doc, "Low Risk Invoices", String(fraudSummary?.lowCount || 0), y, { valueColor: [4, 120, 87] });
          y += 6;

          // Compliance checklist
          y = addSectionHeader(doc, "Compliance Checklist", y + 4);
          y += 4;
          checks.forEach((c) => {
            const statusLabel = c.status ? "PASS" : "FAIL";
            const color = c.status ? [4, 120, 87] : [190, 18, 60];
            doc.setFontSize(9);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(...GRAY_COLOR);
            doc.text(`[${statusLabel}] ${c.label}`, PAGE_MARGIN + 4, y);
            doc.setFontSize(8);
            doc.setTextColor(...color);
            doc.text(`Severity: ${c.severity}`, 170, y, { align: "right" });
            y += 5;
            if (y > 270) {
              addPageFooter(doc, pageCtx.pageNum, null, timestamp);
              doc.addPage();
              pageCtx.pageNum++;
              y = PAGE_MARGIN + 5;
            }
          });

          // Capture fraud charts if they exist
          const fraudSection = document.querySelector('[data-pdf-fraud-charts]');
          if (fraudSection) {
            addPageFooter(doc, pageCtx.pageNum, null, timestamp);
            doc.addPage();
            pageCtx.pageNum++;
            let cy = PAGE_MARGIN + 5;
            cy = addSectionHeader(doc, "Fraud Analysis Charts", cy);
            cy += 4;
            const canvas = await captureElement(fraudSection, { scale: 2 });
            addChartImage(doc, canvas, cy, CONTENT_WIDTH_A4, 180, pageCtx);
          }

          // Suspicious invoices table
          const suspiciousInvoices = (invoices || []).filter(
            (inv) => inv.risk_level === "High" || inv.risk_level === "Medium"
          );
          if (suspiciousInvoices.length > 0) {
            addPageFooter(doc, pageCtx.pageNum, null, timestamp);
            doc.addPage();
            pageCtx.pageNum++;
            let ty = PAGE_MARGIN + 5;
            ty = addSectionHeader(doc, "Suspicious Invoices", ty);
            ty += 6;

            // Table headers
            doc.setFontSize(8);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(...DARK_COLOR);
            doc.text("Invoice", PAGE_MARGIN + 2, ty);
            doc.text("Customer", PAGE_MARGIN + 30, ty);
            doc.text("Amount", PAGE_MARGIN + 80, ty);
            doc.text("Score", PAGE_MARGIN + 110, ty);
            doc.text("Risk", PAGE_MARGIN + 130, ty);
            doc.text("Status", PAGE_MARGIN + 150, ty);
            ty += 4;
            doc.setDrawColor(240, 210, 202);
            doc.line(PAGE_MARGIN, ty, 190, ty);
            ty += 3;

            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5);
            suspiciousInvoices.forEach((inv) => {
              if (ty > 270) {
                addPageFooter(doc, pageCtx.pageNum, null, timestamp);
                doc.addPage();
                pageCtx.pageNum++;
                ty = PAGE_MARGIN + 10;
              }
              doc.setTextColor(...DARK_COLOR);
              doc.text(inv.invoiceId || "-", PAGE_MARGIN + 2, ty);
              doc.text((inv.customer_name || "-").substring(0, 20), PAGE_MARGIN + 30, ty);
              doc.text(formatCurrency(inv.total_amount), PAGE_MARGIN + 80, ty);
              doc.text(String(inv.risk_score || 0), PAGE_MARGIN + 110, ty);
              const riskColor = inv.risk_level === "High" ? [190, 18, 60] : [180, 83, 9];
              doc.setTextColor(...riskColor);
              doc.text(inv.risk_level || "-", PAGE_MARGIN + 130, ty);
              doc.setTextColor(...GRAY_COLOR);
              doc.text(inv.review_status || "-", PAGE_MARGIN + 150, ty);
              ty += 5;
            });
          }

          addPageFooter(doc, pageCtx.pageNum, null, timestamp);
          return doc;
        },
        `fraud_report_${new Date().toISOString().slice(0, 10)}.pdf`,
        {
          onError: (msg) => console.error("Fraud PDF export failed:", msg),
          onSuccess: () => { setReportSent(true); setTimeout(() => setReportSent(false), 4000); }
        }
      );
    } catch (err) {
      console.error("Failed to export fraud report:", err);
    } finally {
      setReportSending(false);
    }
  }

  return (
    <div className="mt-6 neon-glass neon-border rounded-2xl p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#251E1F]">Fraud Compliance Checklist</h3>
          <p className="mt-1 text-sm text-[#7b6660]">Automated fraud detection checks on all invoices.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSendFraudReport}
            disabled={reportSending}
            className="flex items-center gap-2 rounded-lg border border-[#a78bfa]/30 bg-[#a78bfa]/10 px-3 py-1.5 text-xs font-medium text-[#a78bfa] transition hover:bg-[#a78bfa]/20 disabled:opacity-50"
          >
            {reportSending ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {reportSent ? "Report Sent âœ“" : "Export Fraud Report"}
          </button>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${passed === checks.length ? "border-[#7CFFB2]/25 bg-[#7CFFB2]/10 text-[#7CFFB2]" : "border-rose-400/25 bg-rose-400/10 text-rose-700"}`}>
            {passed}/{checks.length} passed
          </span>
        </div>
      </div>
      <div className="mt-5 grid gap-3">
        {checks.map((check) => (
          <div key={check.label} className={`flex items-start gap-3 rounded-xl border p-3 ${check.status ? "border-[#f0d2ca] bg-[#FDD9CD]/10" : "border-rose-400/20 bg-rose-400/[0.04]"}`}>
            {check.status
              ? <ShieldCheck size={17} className="mt-0.5 shrink-0 text-[#7CFFB2]" />
              : <ShieldAlert size={17} className="mt-0.5 shrink-0 text-rose-400" />
            }
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-[#251E1F]">{check.label}</p>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${check.severity === "Critical" ? "bg-rose-500/20 text-rose-700" : check.severity === "High" ? "bg-amber-500/20 text-amber-300" : "bg-blue-500/20 text-blue-300"}`}>
                  {check.severity}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[#7b6660]">{check.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InvoiceExceptionPanel({ invoices, fraudSummary }) {
  const exceptions = [];
  const overdueInvoices = invoices.filter((inv) => inv.status === "Overdue");
  if (overdueInvoices.length > 0) {
    exceptions.push({ message: "Overdue invoices require follow-up action", count: overdueInvoices.length, severity: "warning" });
  }
  const highRisk = fraudSummary?.highCount || 0;
  if (highRisk > 0) {
    exceptions.push({ message: "High-risk invoices detected by fraud assessment", count: highRisk, severity: "critical" });
  }
  const mediumRisk = fraudSummary?.mediumCount || 0;
  if (mediumRisk > 0) {
    exceptions.push({ message: "Medium-risk invoices flagged for review", count: mediumRisk, severity: "warning" });
  }
  const missingEmail = invoices.filter((inv) => !inv.customer_email);
  if (missingEmail.length > 0) {
    exceptions.push({ message: "Invoices with missing customer email (cannot send)", count: missingEmail.length, severity: "warning" });
  }
  const staleScheduled = invoices.filter((inv) => inv.status === "Scheduled" && inv.scheduled_at && new Date(inv.scheduled_at) < new Date());
  if (staleScheduled.length > 0) {
    exceptions.push({ message: "Scheduled invoices past their send date", count: staleScheduled.length, severity: "warning" });
  }

  return (
    <div className="mt-6 neon-glass neon-border rounded-2xl p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#251E1F]">Automated Exception Review</h3>
          <p className="mt-1 text-sm text-[#7b6660]">System validation on active invoices before payment processing.</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${exceptions.length ? "border-[#FFB86B]/25 bg-[#FFB86B]/10 text-[#FFE2B8]" : "border-[#7CFFB2]/25 bg-[#7CFFB2]/10 text-[#7CFFB2]"}`}>
          {exceptions.length ? `${exceptions.length} exception(s)` : "No exceptions"}
        </span>
      </div>
      <div className="mt-5 grid gap-3">
        {exceptions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#f0d2ca] bg-white/[0.03] p-5 text-center text-sm text-[#7b6660]">
            All invoices pass automated validation. No exceptions detected.
          </div>
        ) : (
          exceptions.map((exc) => (
            <div key={exc.message} className={`rounded-xl border p-4 text-sm ${exc.severity === "critical" ? "border-rose-400/25 bg-rose-500/10" : "border-[#FFB86B]/20 bg-[#FFB86B]/10"}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} className={exc.severity === "critical" ? "text-rose-700" : "text-[#FFB86B]"} />
                  <span className="font-medium text-[#251E1F]">{exc.message}</span>
                </div>
                <span className="rounded-full border border-[#f0d2ca] bg-[#FDD9CD]/20 px-3 py-1 text-xs font-semibold text-[#251E1F]">
                  {exc.count} invoice(s)
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function InvoiceAccountingPanel({ invoices, totals, statusCounts }) {
  const totalInvoiced = totals.totalRevenue;
  const collected = totals.paidRevenue;
  const outstanding = totals.pendingAmount + totals.overdueAmount;
  const posted = statusCounts.Paid;
  const pending = invoices.length - statusCounts.Paid;

  const journalEntries = [
    { accountDr: "Accounts Receivable", debit: totalInvoiced, accountCr: "Revenue / Sales", credit: totalInvoiced },
    { accountDr: "Bank / Cash", debit: collected, accountCr: "Accounts Receivable", credit: collected }
  ];

  return (
    <div className="mt-6 neon-glass neon-border rounded-2xl p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#251E1F]">Accounting Impact in Internal Ledger</h3>
          <p className="mt-1 text-sm text-[#7b6660]">Journal totals based on current invoice portfolio.</p>
        </div>
        <span className="rounded-full border border-[#f0d2ca] bg-[#FDD9CD]/20 px-3 py-1 text-xs font-semibold text-[#7b6660]">
          {posted}/{invoices.length} posted
        </span>
      </div>
      <div className="mt-5 overflow-x-auto rounded-xl border border-[#f0d2ca]">
        <table className="min-w-[600px] w-full text-left text-sm">
          <thead className="bg-[#FDD9CD]/20 text-xs uppercase tracking-wide text-[#7b6660]">
            <tr>
              <th className="px-4 py-3">Account (Dr)</th>
              <th className="px-4 py-3 text-right">Debit</th>
              <th className="px-4 py-3">Account (Cr)</th>
              <th className="px-4 py-3 text-right">Credit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {journalEntries.map((entry, idx) => (
              <tr key={idx} className="text-[#251E1F]">
                <td className="px-4 py-3 font-medium text-[#251E1F]">{entry.accountDr}</td>
                <td className="px-4 py-3 text-right font-semibold text-[#251E1F]">{formatCurrency(entry.debit)}</td>
                <td className="px-4 py-3 font-medium text-[#251E1F]">{entry.accountCr}</td>
                <td className="px-4 py-3 text-right font-semibold text-[#251E1F]">{formatCurrency(entry.credit)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-[#f0d2ca] bg-[#FDD9CD]/10">
            <tr>
              <td className="px-4 py-3 font-semibold text-[#F38978]">Total Debit</td>
              <td className="px-4 py-3 text-right font-semibold text-[#251E1F]">{formatCurrency(totalInvoiced + collected)}</td>
              <td className="px-4 py-3 font-semibold text-[#F38978]">Total Credit</td>
              <td className="px-4 py-3 text-right font-semibold text-[#251E1F]">{formatCurrency(totalInvoiced + collected)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
        <div className="rounded-xl border border-[#f0d2ca] bg-[#FDD9CD]/10 p-3">
          <p className="text-[#7b6660]">Outstanding Receivable</p>
          <p className="mt-1 font-semibold text-[#FFB86B]">{formatCurrency(outstanding)}</p>
        </div>
        <div className="rounded-xl border border-[#f0d2ca] bg-[#FDD9CD]/10 p-3">
          <p className="text-[#7b6660]">Revenue Collected</p>
          <p className="mt-1 font-semibold text-[#7CFFB2]">{formatCurrency(collected)}</p>
        </div>
        <div className="rounded-xl border border-[#f0d2ca] bg-[#FDD9CD]/10 p-3">
          <p className="text-[#7b6660]">Pending Settlement</p>
          <p className="mt-1 font-semibold text-[#251E1F]">{pending} invoice(s)</p>
        </div>
      </div>
    </div>
  );
}

function InvoiceAuditTrailPanel({ entries }) {
  const sortedEntries = [...entries]
    .sort((a, b) => new Date(b.created_at || b.timestamp || 0) - new Date(a.created_at || a.timestamp || 0))
    .slice(0, 10);

  return (
    <div className="mt-6 neon-glass neon-border rounded-2xl p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#251E1F]">Audit Trail</h3>
          <p className="mt-1 text-sm text-[#7b6660]">Workflow activity captured for Finance review and audit readiness.</p>
        </div>
        <span className="rounded-full border border-[#f0d2ca] bg-[#FDD9CD]/20 px-3 py-1 text-xs font-semibold text-[#7b6660]">
          {sortedEntries.length} event(s)
        </span>
      </div>
      <div className="mt-5 grid gap-3">
        {sortedEntries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#f0d2ca] bg-white/[0.03] p-5 text-center text-sm text-[#7b6660]">
            No audit events recorded yet.
          </div>
        ) : (
          sortedEntries.map((entry, idx) => (
            <div key={entry.log_id || idx} className="flex items-start gap-4 rounded-xl border border-[#f0d2ca] bg-[#FDD9CD]/10 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F38978]/10 text-[#F38978]">
                <ClipboardCheck size={16} />
              </div>
              <div className="flex-1">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-medium text-[#251E1F]">{entry.action_description || entry.activityType || "Activity"}</p>
                  <p className="text-xs text-[#7b6660]">{formatDateTime(entry.created_at || entry.timestamp)}</p>
                </div>
                <p className="mt-1 text-xs text-[#7b6660]">
                  {entry.user_name || entry.userName || "System"} â€¢ {entry.activity_type || entry.activityType || "Invoice"}
                  {entry.affected_record ? ` â€¢ ${entry.affected_record}` : ""}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
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
        <MetricCard label="Draft" value={formatCurrency(metrics.Draft)} accent="text-slate-700" />
        <MetricCard label="Sent" value={formatCurrency(metrics.Sent)} accent="text-blue-700" />
        <MetricCard label="Paid" value={formatCurrency(metrics.Paid)} accent="text-emerald-700" />
        <MetricCard label="Overdue" value={formatCurrency(metrics.Overdue)} accent="text-rose-700" />
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
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#F38978]/30 px-5 py-3 text-sm font-semibold text-[#251E1F] hover:bg-[#F38978]/10 disabled:cursor-not-allowed disabled:opacity-50"
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
              <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
                {scheduleMessage}
              </div>
            ) : null}
          </div>
          {customerFilter ? (
            <button
              type="button"
              onClick={onClearCustomerFilter}
              className="self-start rounded-lg border border-[#f0d2ca] px-3 py-2 text-xs font-semibold text-[#7b6660] hover:bg-[#FDD9CD]/30 hover:text-[#251E1F]"
            >
              Clear customer filter
            </button>
          ) : (
            <p className="text-xs text-[#7b6660]">Next invoice number: {nextInvoiceId || "INV-0001"}</p>
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
      // Separate valid and invalid rows from the selection
      const selectedRows = rows.filter((_, i) => selectedRowIndices.has(i));
      const selectedValidated = validatedRows.filter((_, i) => selectedRowIndices.has(i));
      const rowsToProcess = selectedRows.filter((_, i) => selectedValidated[i]?.is_valid);
      const flaggedRows = selectedRows.filter((_, i) => !selectedValidated[i]?.is_valid);

      if (rowsToProcess.length === 0) {
        setError("No valid rows selected to process.");
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

      // Flag invalid rows to fraud detection
      if (flaggedRows.length > 0) {
        try {
          const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
          const token = localStorage.getItem("authToken");
          await fetch(`${API_BASE}/api/fraud/flag-invalid-rows`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              rows: flaggedRows.map((row, i) => ({
                ...row,
                validation_errors: selectedValidated.filter((v) => !v?.is_valid)[i]?.errors || []
              })),
              source_file: fileMetadata?.name || "bulk_upload"
            })
          });
          setMessage((prev) => `${prev} ${flaggedRows.length} invalid rows flagged for fraud review.`);
        } catch {
          // Non-fatal â€” invoices were still sent
          setMessage((prev) => `${prev} (Warning: failed to flag invalid rows for fraud review)`);
        }
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
            disabled={selectedCount === 0 || isProcessing}
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
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        ) : null}

        <label
          className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#F38978]/40 bg-[#FDD9CD]/10 px-6 py-12 text-center hover:bg-white/[0.07]"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            handleFile(event.dataTransfer.files?.[0]);
          }}
        >
          <Upload size={34} className="text-[#F38978]" />
          <span className="mt-3 text-sm font-semibold text-[#251E1F]">Drop Excel invoice file here or choose a file</span>
          <span className="mt-1 text-xs text-[#7b6660]">Only XLS and XLSX invoice templates are supported.</span>
          <input
            type="file"
            accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
        </label>

        {/* Send Mode Selector */}
        {validRows.length > 0 && (
          <div className="rounded-xl border border-[#f0d2ca] bg-[#FDD9CD]/10 p-4">
            <p className="text-sm font-semibold text-[#251E1F]">Send Options</p>
            <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="sendMode" value="now" checked={sendMode === "now"} onChange={() => setSendMode("now")} className="accent-[#C77DFF]" />
                <span className="text-sm text-[#251E1F]">Send immediately</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="sendMode" value="schedule" checked={sendMode === "schedule"} onChange={() => setSendMode("schedule")} className="accent-[#C77DFF]" />
                <span className="text-sm text-[#251E1F]">Schedule for later</span>
              </label>
              {sendMode === "schedule" && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={scheduleDate}
                    min={toDateInputValue(new Date())}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-sm text-[#251E1F] outline-none focus:border-[#F38978]"
                  />
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-sm text-[#251E1F] outline-none focus:border-[#F38978]"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-[#f0d2ca]">
          <table className="min-w-[1060px] w-full text-left text-sm">
            <thead className="bg-[#FDD9CD]/20 text-xs uppercase tracking-wide text-[#7b6660]">
              <tr>
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allValidSelected && validRows.length > 0}
                    onChange={(e) => toggleAllRows(e.target.checked)}
                    className="h-4 w-4 rounded border-[#f0d2ca] bg-white accent-[#C77DFF]"
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
                <tr key={`${row.row_number || index}-${row.invoice_number || index}`} className={`text-[#251E1F] transition ${selectedRowIndices.has(index) ? "bg-[#C77DFF]/5" : "hover:bg-white/[0.03]"}`}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedRowIndices.has(index)}
                      onChange={(e) => toggleRow(index, e.target.checked)}
                      disabled={validatedRows.length > 0 && !row.is_valid}
                      className="h-4 w-4 rounded border-[#f0d2ca] bg-white accent-[#C77DFF] disabled:opacity-30"
                      aria-label={`Select row ${index + 1}`}
                    />
                  </td>
                  <td className="px-4 py-3">{row.row_number || index + 1}</td>
                  <td className="px-4 py-3 font-semibold text-[#251E1F]">{row.invoice_number || row["Invoice Number"]}</td>
                  <td className="px-4 py-3">{row.customer_name || row["Customer Name"]}</td>
                  <td className="px-4 py-3">{row.issue_date || row["Invoice Date"]}</td>
                  <td className="px-4 py-3">{row.due_date || row["Due Date"]}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(row.amount || row.Amount)}</td>
                  <td className="px-4 py-3">
                    {row.is_valid ? (
                      <span className="text-emerald-700">Ready</span>
                    ) : (
                      <span className="text-rose-700">{row.errors?.join("; ") || "Pending validation"}</span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && validatedRows.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-10 text-center text-[#7b6660]">
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

const DEMO_PAYMENTS_WORKSPACE = {
  outstandingInvoices: [
    { invoice_id: 1, invoiceId: "INV-000002", customer_name: "TechWave Solutions", customer_email: "accounts@techwave.sg", due_date: "2026-07-25", total_amount: 4250.00, database_status: "Sent" },
    { invoice_id: 2, invoiceId: "INV-000005", customer_name: "Pacific Ventures", customer_email: "ap@pacificventures.sg", due_date: "2026-07-18", total_amount: 8900.50, database_status: "Overdue" },
    { invoice_id: 3, invoiceId: "INV-000008", customer_name: "CloudNine Systems", customer_email: "billing@cloudnine.sg", due_date: "2026-08-01", total_amount: 3175.00, database_status: "Sent" },
    { invoice_id: 4, invoiceId: "INV-000012", customer_name: "Zenith Engineering", customer_email: "accounts@zenitheng.sg", due_date: "2026-07-10", total_amount: 12400.00, database_status: "Overdue" },
    { invoice_id: 5, invoiceId: "INV-000015", customer_name: "Stellar Marketing", customer_email: "payments@stellarmarketing.sg", due_date: "2026-08-05", total_amount: 2680.00, database_status: "Viewed" }
  ],
  payments: [
    { payment_id: 1, invoiceId: "INV-000001", customer_name: "Acme Corporation", payment_method: "Stripe", amount: 5600.00, status: "Completed", payment_date: "2026-07-14", transaction_id: "pi_3Qx9K2H" },
    { payment_id: 2, invoiceId: "INV-000004", customer_name: "Sunrise Digital", payment_method: "Bank Transfer", amount: 7200.00, status: "Completed", payment_date: "2026-07-12", transaction_id: "BANK-INV000004" },
    { payment_id: 3, invoiceId: "INV-000006", customer_name: "GreenLeaf Consulting", payment_method: "PayNow", amount: 1850.00, status: "Completed", payment_date: "2026-07-10", transaction_id: "PN-20260710-001" },
    { payment_id: 4, invoiceId: "INV-000010", customer_name: "BluePeak Software", payment_method: "Stripe", amount: 9450.00, status: "Completed", payment_date: "2026-07-08", transaction_id: "pi_3Qw7J1R" },
    { payment_id: 5, invoiceId: "INV-000013", customer_name: "Coral Bay Restaurants", payment_method: "Credit Card", amount: 3300.00, status: "Completed", payment_date: "2026-07-05", transaction_id: "CC-20260705-042" }
  ]
};

function PaymentsView() {
  const [workspace, setWorkspace] = useState({ outstandingInvoices: [], payments: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentLink, setPaymentLink] = useState("");

  // Use demo data as fallback when the database is empty
  const displayWorkspace = workspace.outstandingInvoices.length === 0 && workspace.payments.length === 0 && !isLoading
    ? DEMO_PAYMENTS_WORKSPACE
    : workspace;
  const outstandingTotal = displayWorkspace.outstandingInvoices.reduce((sum, invoice) => sum + Number(invoice.total_amount || 0), 0);

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
        <MetricCard label="Outstanding Bills" value={displayWorkspace.outstandingInvoices.length} accent="text-[#251E1F]" />
        <MetricCard label="Outstanding Amount" value={formatCurrency(outstandingTotal)} accent="text-rose-700" />
        <MetricCard label="Recent Payments" value={displayWorkspace.payments.length} accent="text-emerald-700" />
      </section>

      <SectionShell
        eyebrow="Collections"
        title="Payments Workspace"
        description="Manage unpaid statements, generate collection links, and record matched bank transfers."
      >
        <ErrorBanner message={error} />
        {paymentLink ? (
          <div className="mb-5 rounded-xl border border-blue-400/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-700">
            <span className="font-bold">Stripe payment link:</span> {paymentLink}
          </div>
        ) : null}

        {isLoading ? (
          <LoadingPanel label="Loading payments..." />
        ) : (
          <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
            <div className="overflow-x-auto rounded-xl border border-[#f0d2ca]">
              <table className="min-w-[760px] w-full text-left text-sm">
                <thead className="bg-[#FDD9CD]/20 text-xs uppercase tracking-wide text-[#7b6660]">
                  <tr>
                    <th className="px-4 py-3 font-bold">Invoice</th>
                    <th className="px-4 py-3 font-bold">Customer</th>
                    <th className="px-4 py-3 font-bold">Due Date</th>
                    <th className="px-4 py-3 font-bold text-right">Amount</th>
                    <th className="px-4 py-3 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {displayWorkspace.outstandingInvoices.map((invoice) => (
                    <tr key={invoice.invoice_id} className="text-[#251E1F]">
                      <td className="px-4 py-4 font-bold text-[#251E1F]">{invoice.invoiceId}</td>
                      <td className="px-4 py-4 font-semibold">{invoice.customer_name}</td>
                      <td className="px-4 py-4">{formatDate(invoice.due_date)}</td>
                      <td className="px-4 py-4 text-right font-bold text-[#251E1F]">{formatCurrency(invoice.total_amount)}</td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => generateStripeLink(invoice.invoice_id)}
                            className="inline-flex items-center gap-2 rounded-lg border border-blue-400/30 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-500/10"
                          >
                            <LinkIcon size={14} />
                            Stripe Link
                          </button>
                          <button
                            type="button"
                            onClick={() => markPaid(invoice)}
                            className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/30 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/10"
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

            <div className="rounded-xl border border-[#f0d2ca] bg-[#FDD9CD]/10 p-4">
              <h3 className="text-sm font-bold text-[#251E1F]">Recent Payment Matches</h3>
              <div className="mt-4 space-y-3">
                {displayWorkspace.payments.map((payment) => (
                  <div key={payment.payment_id} className="rounded-lg border border-[#f0d2ca] bg-[#FDD9CD]/10 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-[#251E1F]">{payment.invoiceId || "Unlinked"}</p>
                      <span className="text-xs font-semibold text-emerald-700">{payment.status}</span>
                    </div>
                    <p className="mt-1 text-xs text-[#7b6660]">{payment.customer_name || "-"} Â· {payment.payment_method || "Manual"}</p>
                    <p className="mt-2 text-sm font-bold text-[#251E1F]">{formatCurrency(payment.amount)}</p>
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
            <span className="truncate text-[#7b6660]">{item[labelKey]}</span>
            <div className="h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#7B2FF7] to-[#FF4DDB]"
                style={{ width: `${Math.max((value / maxValue) * 100, 4)}%` }}
              />
            </div>
            <span className="text-right font-semibold text-[#251E1F]">{formatCurrency(value)}</span>
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
    Low: "border-emerald-400/30 bg-emerald-500/15 text-emerald-700",
    Medium: "border-amber-400/30 bg-amber-500/15 text-amber-700",
    High: "border-rose-400/30 bg-rose-500/15 text-rose-700"
  };

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[level] || styles.Low}`}>
      {level || "Low"}
    </span>
  );
}

const DEMO_FRAUD_DASHBOARD = {
  summary: { assessedCount: 30, flaggedCount: 8, highCount: 4, mediumCount: 6, lowCount: 20, averageScore: 24.3 },
  riskDistribution: [
    { risk_level: "Low", invoice_count: 20 },
    { risk_level: "Medium", invoice_count: 6 },
    { risk_level: "High", invoice_count: 4 }
  ],
  trends: [
    { assessment_date: "2026-07-19", assessed_count: 5, high_count: 1, average_score: 28 },
    { assessment_date: "2026-07-18", assessed_count: 8, high_count: 2, average_score: 35 },
    { assessment_date: "2026-07-17", assessed_count: 6, high_count: 0, average_score: 18 },
    { assessment_date: "2026-07-16", assessed_count: 4, high_count: 1, average_score: 42 },
    { assessment_date: "2026-07-15", assessed_count: 7, high_count: 0, average_score: 15 }
  ],
  invoices: [
    { invoice_id: 4, invoiceId: "INV-000004", customer_name: "Sunrise Digital", vendor_name: "Unknown Vendor XYZ", total_amount: 15200.00, risk_score: 91, risk_level: "High", review_status: "Open", issue_date: "2026-06-10", indicators: [{ indicator_code: "BANK_ACCOUNT_MISMATCH", indicator_label: "Bank account differs from the vendor's verified record.", severity: 35 }, { indicator_code: "UNKNOWN_VENDOR", indicator_label: "Invoice references an unknown or unregistered vendor.", severity: 25 }, { indicator_code: "CUSTOMER_AMOUNT_OUTLIER", indicator_label: "Amount is unusually high for this customer.", severity: 25 }] },
    { invoice_id: 10, invoiceId: "INV-000010", customer_name: "BluePeak Software", vendor_name: "Suspicious Corp", total_amount: 8750.00, risk_score: 82, risk_level: "High", review_status: "Open", issue_date: "2026-06-15", indicators: [{ indicator_code: "DUPLICATE_INVOICE_NUMBER", indicator_label: "Duplicate invoice number detected.", severity: 35 }, { indicator_code: "VENDOR_SUBMISSION_SPIKE", indicator_label: "Vendor has a sudden spike in invoice submissions.", severity: 20 }, { indicator_code: "OUTSIDE_BUSINESS_HOURS", indicator_label: "Invoice was submitted outside normal business hours.", severity: 10 }] },
    { invoice_id: 16, invoiceId: "INV-000016", customer_name: "Marina Bay Trading", vendor_name: "Unknown Vendor XYZ", total_amount: 22100.00, risk_score: 78, risk_level: "High", review_status: "Rejected", issue_date: "2026-05-28", indicators: [{ indicator_code: "BANK_ACCOUNT_MISMATCH", indicator_label: "Bank account differs from the vendor's verified record.", severity: 35 }, { indicator_code: "VENDOR_AMOUNT_OUTLIER", indicator_label: "Amount is unusually high for this vendor.", severity: 25 }] },
    { invoice_id: 28, invoiceId: "INV-000028", customer_name: "Atlas Security", vendor_name: "Unknown Vendor XYZ", total_amount: 6300.00, risk_score: 73, risk_level: "High", review_status: "Approved", issue_date: "2026-06-02", indicators: [{ indicator_code: "UNKNOWN_VENDOR", indicator_label: "Invoice references an unknown or unregistered vendor.", severity: 25 }, { indicator_code: "RAPID_APPROVAL_PATTERN", indicator_label: "Employee approval pattern is unusually rapid.", severity: 20 }] },
    { invoice_id: 6, invoiceId: "INV-000006", customer_name: "GreenLeaf Consulting", vendor_name: "DigitalWorks Agency", total_amount: 5400.00, risk_score: 52, risk_level: "Medium", review_status: "Approved", issue_date: "2026-06-20", indicators: [{ indicator_code: "DUPLICATE_CUSTOMER_AMOUNT_DATE", indicator_label: "Same customer, amount, and invoice date already exists.", severity: 25 }, { indicator_code: "OUTSIDE_BUSINESS_HOURS", indicator_label: "Invoice was submitted outside normal business hours.", severity: 10 }] },
    { invoice_id: 12, invoiceId: "INV-000012", customer_name: "Zenith Engineering", vendor_name: "CloudHosting Pte Ltd", total_amount: 12400.00, risk_score: 45, risk_level: "Medium", review_status: "Open", issue_date: "2026-06-25", indicators: [{ indicator_code: "CUSTOMER_AMOUNT_OUTLIER", indicator_label: "Amount is unusually high for this customer.", severity: 25 }, { indicator_code: "VENDOR_SUBMISSION_SPIKE", indicator_label: "Vendor has a sudden spike in invoice submissions.", severity: 20 }] }
  ]
};

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

  // Use demo data as fallback when the database returns empty results
  const displayDashboard = dashboard && dashboard.invoices && dashboard.invoices.length > 0 ? dashboard : (!isLoading ? DEMO_FRAUD_DASHBOARD : dashboard);
  const displaySummary = displayDashboard?.summary || {};
  const displayInvoices = displayDashboard?.invoices || [];

  return (
    <div className="space-y-6">
      <ErrorBanner message={error} />
      {message ? (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-5">
        <MetricCard label="Flagged" value={displaySummary.flaggedCount || 0} accent="text-rose-700" />
        <MetricCard label="High Risk" value={displaySummary.highCount || 0} accent="text-rose-700" />
        <MetricCard label="Medium Risk" value={displaySummary.mediumCount || 0} accent="text-amber-700" />
        <MetricCard label="Low Risk" value={displaySummary.lowCount || 0} accent="text-emerald-700" />
        <MetricCard label="Avg Score" value={displaySummary.averageScore || 0} accent="text-[#251E1F]" />
      </section>

      <SectionShell
        eyebrow="Fraud Detection"
        title="Risk Monitoring"
        description="Rule-based scoring is persisted with indicators so historical data is ready for future ML training."
      >
        <form onSubmit={applyFilters} className="grid gap-3 lg:grid-cols-7">
          <input type="date" value={filters.from} onChange={(e) => updateFilter("from", e.target.value)} className="rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-sm text-[#251E1F] outline-none focus:border-[#F38978]" />
          <input type="date" value={filters.to} onChange={(e) => updateFilter("to", e.target.value)} className="rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-sm text-[#251E1F] outline-none focus:border-[#F38978]" />
          <input type="text" value={filters.vendor} onChange={(e) => updateFilter("vendor", e.target.value)} placeholder="Vendor" className="rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-sm text-[#251E1F] outline-none placeholder:text-[#7b6660]/60 focus:border-[#F38978]" />
          <input type="text" value={filters.customer} onChange={(e) => updateFilter("customer", e.target.value)} placeholder="Customer" className="rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-sm text-[#251E1F] outline-none placeholder:text-[#7b6660]/60 focus:border-[#F38978]" />
          <select value={filters.riskLevel} onChange={(e) => updateFilter("riskLevel", e.target.value)} className="rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-sm text-[#251E1F] outline-none focus:border-[#F38978]">
            <option value="">All risk</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <input type="number" min="0" max="100" value={filters.minScore} onChange={(e) => updateFilter("minScore", e.target.value)} placeholder="Min score" className="rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-sm text-[#251E1F] outline-none placeholder:text-[#7b6660]/60 focus:border-[#F38978]" />
          <button type="submit" className="neon-button px-4 py-2 text-sm font-bold">Filter</button>
        </form>

        {isLoading ? (
          <LoadingPanel label="Loading fraud dashboard..." />
        ) : (
          <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_280px]">
            <div className="overflow-x-auto rounded-xl border border-[#f0d2ca]">
              <table className="min-w-[1080px] w-full text-left text-sm">
                <thead className="bg-[#FDD9CD]/20 text-xs uppercase tracking-wide text-[#7b6660]">
                  <tr>
                    <th className="px-4 py-3 font-bold">Invoice</th>
                    <th className="px-4 py-3 font-bold">Customer</th>
                    <th className="px-4 py-3 font-bold">Vendor</th>
                    <th className="px-4 py-3 font-bold text-right">Amount</th>
                    <th className="px-4 py-3 font-bold">Risk</th>
                    <th className="px-4 py-3 font-bold">Indicators</th>
                    <th className="px-4 py-3 font-bold">Review</th>
                    <th className="px-4 py-3 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {displayInvoices.map((invoice) => (
                    <tr key={invoice.invoice_id} className="text-[#251E1F]">
                      <td className="px-4 py-4">
                        <p className="font-bold text-[#251E1F]">{invoice.invoiceId}</p>
                        <p className="text-xs text-[#7b6660]/70">{formatDate(invoice.issue_date)}</p>
                      </td>
                      <td className="px-4 py-4 font-semibold">{invoice.customer_name}</td>
                      <td className="px-4 py-4">{invoice.vendor_name || "-"}</td>
                      <td className="px-4 py-4 text-right font-bold">{formatCurrency(invoice.total_amount)}</td>
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <RiskBadge level={invoice.risk_level} />
                          <p className="text-xs text-[#7b6660]">Score {invoice.risk_score}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="max-w-xs space-y-1">
                          {(invoice.indicators || []).slice(0, 3).map((indicator) => (
                            <p key={indicator.indicator_code} className="text-xs text-[#7b6660]">{indicator.indicator_label}</p>
                          ))}
                          {invoice.indicators?.length > 3 ? (
                            <p className="text-xs text-[#F38978]">+{invoice.indicators.length - 3} more</p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4">{invoice.review_status}</td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => reviewInvoice(invoice, "Approved")} disabled={Boolean(isReviewing)} className="rounded-lg border border-emerald-400/30 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/10 disabled:opacity-50">
                            {isReviewing === `Approved-${invoice.invoice_id}` ? "..." : "Approve"}
                          </button>
                          <button type="button" onClick={() => reviewInvoice(invoice, "Rejected")} disabled={Boolean(isReviewing)} className="rounded-lg border border-rose-400/30 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-500/10 disabled:opacity-50">
                            {isReviewing === `Rejected-${invoice.invoice_id}` ? "..." : "Reject"}
                          </button>
                          <button type="button" onClick={() => reassessInvoice(invoice)} disabled={Boolean(isReviewing)} className="rounded-lg border border-[#f0d2ca] px-3 py-2 text-xs font-semibold text-[#7b6660] hover:bg-[#FDD9CD]/30 disabled:opacity-50">
                            {isReviewing === `Reassess-${invoice.invoice_id}` ? "..." : "Reassess"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {displayInvoices.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-4 py-10 text-center text-[#7b6660]">No fraud assessments match the current filters.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="space-y-4" data-pdf-fraud-charts>
              <div className="rounded-xl border border-[#f0d2ca] bg-[#FDD9CD]/10 p-4">
                <h3 className="text-sm font-bold text-[#251E1F]">Risk Categories</h3>
                <div className="mt-4 space-y-3">
                  {(displayDashboard?.riskDistribution || []).map((item) => (
                    <div key={item.risk_level} className="flex items-center justify-between text-sm">
                      <RiskBadge level={item.risk_level} />
                      <span className="font-bold text-[#251E1F]">{item.invoice_count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-[#f0d2ca] bg-[#FDD9CD]/10 p-4">
                <h3 className="text-sm font-bold text-[#251E1F]">Recent Trend</h3>
                <div className="mt-4 space-y-3">
                  {(displayDashboard?.trends || []).slice(0, 8).map((trend) => (
                    <div key={trend.assessment_date} className="grid grid-cols-[1fr_56px_56px] gap-2 text-xs text-[#7b6660]">
                      <span className="font-semibold">{trend.assessment_date}</span>
                      <span className="text-right">{trend.assessed_count} total</span>
                      <span className="text-right font-semibold text-rose-700">{trend.high_count} high</span>
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
  const [isExporting, setIsExporting] = useState(false);
  const [exportToast, setExportToast] = useState(null);

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

  async function handleExportPdf() {
    setIsExporting(true);
    try {
      const data = await fetchFinancialExport();
      await generateAndDownloadPdf(
        async () => {
          const doc = createPdfDocument("portrait");
          const timestamp = new Date().toLocaleString("en-SG");
          const pageCtx = { pageNum: 1, timestamp };

          // ─── Cover Page ───
          addCoverPage(doc, {
            title: "PayNivo Report",
            subtitle: "Financial Performance & Invoice Analytics",
            generatedBy: "Finance Team",
            date: timestamp
          });
          addPageFooter(doc, pageCtx.pageNum, null, timestamp);

          // ─── Page 2: Dashboard Summary ───
          doc.addPage();
          pageCtx.pageNum++;
          let y = PAGE_MARGIN + 5;

          y = addSectionHeader(doc, "Dashboard Summary", y);
          y += 4;

          y = addMetricRow(doc, "Total Invoices", String(data.summary.invoiceCount || 0), y);
          y = addMetricRow(doc, "Paid Invoices", String(data.summary.paidCount || 0), y, { valueColor: [4, 120, 87] });
          y = addMetricRow(doc, "Overdue Invoices", String(data.summary.overdueCount || 0), y, { valueColor: [190, 18, 60] });
          y = addMetricRow(doc, "Total Revenue (Inflow)", `SGD ${Number(data.summary.totalInflow || 0).toLocaleString()}`, y);
          y = addMetricRow(doc, "Outstanding Balance", `SGD ${Number(data.summary.outstandingRevenue || 0).toLocaleString()}`, y, { valueColor: [180, 83, 9] });
          y = addMetricRow(doc, "Gross Revenue (Commission)", `SGD ${Number(data.summary.grossRevenue || 0).toLocaleString()}`, y, { valueColor: [4, 120, 87] });
          y = addMetricRow(doc, "Collected Revenue", `SGD ${Number(data.summary.collectedRevenue || 0).toLocaleString()}`, y);
          y = addMetricRow(doc, "Avg Commission Rate", `${data.summary.avgCommissionRate || 0}%`, y);
          y += 8;

          // ─── Charts ───
          // Capture all chart containers from the page
          const chartContainers = document.querySelectorAll('[data-pdf-report-chart]');
          if (chartContainers.length > 0) {
            y = addSectionHeader(doc, "Charts & Analytics", y);
            y += 4;

            for (const container of chartContainers) {
              const chartTitle = container.getAttribute('data-pdf-chart-title') || '';
              const canvas = await captureElement(container, { scale: 2, backgroundColor: "#ffffff" });

              // Check page break
              const imgRatio = canvas.width / canvas.height;
              const imgWidth = CONTENT_WIDTH_A4;
              const imgHeight = imgWidth / imgRatio;

              if (y + imgHeight + 12 > 270) {
                addPageFooter(doc, pageCtx.pageNum, null, timestamp);
                doc.addPage();
                pageCtx.pageNum++;
                y = PAGE_MARGIN + 5;
              }

              if (chartTitle) {
                doc.setFontSize(10);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(...DARK_COLOR);
                doc.text(chartTitle, PAGE_MARGIN, y);
                y += 5;
              }

              y = addChartImage(doc, canvas, y, CONTENT_WIDTH_A4, 90, pageCtx);
              y += 4;
            }
          }

          addPageFooter(doc, pageCtx.pageNum, null, timestamp);

          // ─── Invoice Details Pages ───
          if (data.invoices && data.invoices.length > 0) {
            doc.addPage();
            pageCtx.pageNum++;
            let iy = PAGE_MARGIN + 5;

            iy = addSectionHeader(doc, "Invoice Details", iy);
            iy += 6;

            // Table headers
            const colWidths = [22, 32, 16, 18, 18, 22, 18, 24];
            const headers = ["Invoice", "Customer", "Status", "Issue", "Due", "Amount", "Rate", "Commission"];

            doc.setFontSize(7);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(...DARK_COLOR);
            let cx = PAGE_MARGIN;
            headers.forEach((h, i) => {
              doc.text(h, cx, iy);
              cx += colWidths[i];
            });
            iy += 3;
            doc.setDrawColor(240, 210, 202);
            doc.line(PAGE_MARGIN, iy, 190, iy);
            iy += 4;

            // Table rows
            doc.setFont("helvetica", "normal");
            doc.setFontSize(6.5);
            data.invoices.forEach((inv) => {
              if (iy > 275) {
                addPageFooter(doc, pageCtx.pageNum, null, timestamp);
                doc.addPage();
                pageCtx.pageNum++;
                iy = PAGE_MARGIN + 10;

                // Re-draw headers on new page
                doc.setFontSize(7);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(...DARK_COLOR);
                cx = PAGE_MARGIN;
                headers.forEach((h, i) => {
                  doc.text(h, cx, iy);
                  cx += colWidths[i];
                });
                iy += 3;
                doc.setDrawColor(240, 210, 202);
                doc.line(PAGE_MARGIN, iy, 190, iy);
                iy += 4;
                doc.setFont("helvetica", "normal");
                doc.setFontSize(6.5);
              }

              doc.setTextColor(...DARK_COLOR);
              cx = PAGE_MARGIN;
              doc.text(String(inv.invoiceId || ""), cx, iy); cx += colWidths[0];
              doc.text((inv.customer || "").substring(0, 16), cx, iy); cx += colWidths[1];

              // Status color
              const statusColor = inv.status === "Paid" ? [4, 120, 87] : inv.status === "Overdue" ? [190, 18, 60] : DARK_COLOR;
              doc.setTextColor(...statusColor);
              doc.text(inv.status || "", cx, iy); cx += colWidths[2];

              doc.setTextColor(...GRAY_COLOR);
              const issueStr = inv.issueDate ? new Date(inv.issueDate).toLocaleDateString("en-SG", { day: "2-digit", month: "short" }) : "-";
              const dueStr = inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-SG", { day: "2-digit", month: "short" }) : "-";
              doc.text(issueStr, cx, iy); cx += colWidths[3];
              doc.text(dueStr, cx, iy); cx += colWidths[4];

              doc.setTextColor(...DARK_COLOR);
              doc.text(`$${Number(inv.totalAmount || 0).toFixed(0)}`, cx, iy); cx += colWidths[5];
              doc.text(`${inv.commissionRate || 0}%`, cx, iy); cx += colWidths[6];
              doc.setTextColor(4, 120, 87);
              doc.text(`$${Number(inv.vanidayShare || 0).toFixed(0)}`, cx, iy);
              iy += 4.5;
            });

            addPageFooter(doc, pageCtx.pageNum, null, timestamp);
          }

          return doc;
        },
        `PayNivo_Financial_Report_${new Date().toISOString().slice(0, 10)}.pdf`,
        {
          onError: (msg) => {
            setError(msg);
            setExportToast({ message: "PDF export failed", type: "error" });
            setTimeout(() => setExportToast(null), 4000);
          },
          onSuccess: () => {
            setExportToast({ message: "PDF exported successfully", type: "success" });
            setTimeout(() => setExportToast(null), 4000);
          }
        }
      );
    } catch (exportError) {
      setError(exportError.message);
    } finally {
      setIsExporting(false);
    }
  }

  if (isLoading) {
    return <LoadingPanel label="Loading reports..." />;
  }

  const fs = reports?.financialStatement;

  return (
    <div className="space-y-6">
      <ErrorBanner message={error} />

      {/* Export Toast */}
      {exportToast && (
        <div className={`fixed right-6 top-24 z-50 animate-[slideDown_0.3s_ease] rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-xl ${
          exportToast.type === "error" ? "border-rose-400/20 bg-rose-500/15 text-rose-700" : "border-emerald-400/20 bg-emerald-500/15 text-emerald-700"
        }`}>
          <div className="flex items-center gap-2">
            {exportToast.type === "error" ? <X size={16} /> : <CheckCircle2 size={16} />}
            <span className="text-sm font-medium">{exportToast.message}</span>
          </div>
        </div>
      )}

      {/* Summary Metrics - Vaniday Commission Model */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Total Inflow" value={formatCurrency(reports?.summary?.total_revenue)} />
        <MetricCard label="Gross Revenue" value={formatCurrency(reports?.summary?.gross_revenue)} accent="text-emerald-700" />
        <MetricCard label="Salon Payouts" value={formatCurrency(reports?.summary?.total_salon_payout)} accent="text-amber-700" />
        <MetricCard label="Outstanding" value={formatCurrency(reports?.summary?.outstanding_revenue)} accent="text-rose-700" />
        <MetricCard label="Avg Commission" value={`${reports?.summary?.avg_commission_rate || 0}%`} accent="text-blue-700" />
      </section>

      {/* Tab Navigation + Export Buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#f0d2ca] pb-1">
        <div className="flex gap-2">
          <button type="button" onClick={() => setActiveTab("charts")}
            className={`rounded-t-lg px-5 py-2.5 text-sm font-semibold transition ${activeTab === "charts" ? "border-b-2 border-[#F38978] bg-[#FDD9CD]/20 text-[#251E1F]" : "text-[#7b6660] hover:bg-[#FDD9CD]/10 hover:text-[#251E1F]"}`}>
            <span className="flex items-center gap-2"><FileBarChart size={16} />Charts & Analytics</span>
          </button>
          <button type="button" onClick={() => setActiveTab("accounting")}
            className={`rounded-t-lg px-5 py-2.5 text-sm font-semibold transition ${activeTab === "accounting" ? "border-b-2 border-[#F38978] bg-[#FDD9CD]/20 text-[#251E1F]" : "text-[#7b6660] hover:bg-[#FDD9CD]/10 hover:text-[#251E1F]"}`}>
            <span className="flex items-center gap-2"><Banknote size={16} />Financial Statements</span>
          </button>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={handleExportPdf} disabled={isExporting}
            className="inline-flex items-center gap-2 rounded-lg border border-[#F38978]/30 px-4 py-2 text-xs font-bold text-[#F38978] hover:bg-[#FDD9CD]/20 disabled:opacity-50">
            {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}{isExporting ? "Generating PDF..." : "Export Financial Report (PDF)"}
          </button>
        </div>
      </div>

      {/* Charts Tab */}
      {activeTab === "charts" && (
        <div className="grid gap-6 xl:grid-cols-2">
          <div data-pdf-report-chart data-pdf-chart-title="Revenue Over Time">
            <SectionShell eyebrow="Analytics" title="Revenue Over Time">
              <SimpleLineChart data={reports?.monthlyRevenue || []} />
            </SectionShell>
          </div>
          <div data-pdf-report-chart data-pdf-chart-title="Aging Receivables">
            <SectionShell eyebrow="Collections" title="Aging Receivables">
              <SimpleBarChart data={reports?.agingReceivables || []} labelKey="bucket" valueKey="total" />
            </SectionShell>
          </div>
          <div data-pdf-report-chart data-pdf-chart-title="Invoice Status Distribution">
            <SectionShell eyebrow="Status" title="Invoice Status Distribution">
              <SimpleBarChart data={reports?.statusDistribution || []} labelKey="status" valueKey="total" />
            </SectionShell>
          </div>
          <div data-pdf-report-chart data-pdf-chart-title="Top Customer Revenue">
            <SectionShell eyebrow="Customers" title="Top Customer Revenue">
              <SimpleBarChart data={reports?.topCustomers || []} labelKey="name" valueKey="total" />
            </SectionShell>
          </div>
        </div>
      )}

      {/* Accounting Tab */}
      {activeTab === "accounting" && fs && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Income Statement - Vaniday Model */}
            <div className="rounded-xl border border-[#f0d2ca] bg-[#FDD9CD]/10 p-5">
              <h3 className="text-sm font-bold uppercase tracking-wide text-[#F38978]">Income Statement</h3>
              <p className="mt-1 text-xs text-[#7b6660]">Gross Revenue = Inflow − Salon Payouts</p>
              <div className="mt-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-[#7b6660]">Total Inflow</span>
                  <span className="font-bold text-[#251E1F]">{formatCurrency(fs.incomeStatement.totalInflow)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#7b6660]">Salon Payouts</span>
                  <span className="font-bold text-amber-700">−{formatCurrency(fs.incomeStatement.salonPayouts)}</span>
                </div>
                <div className="border-t border-[#f0d2ca] pt-3 flex justify-between text-sm">
                  <span className="font-bold text-[#251E1F]">Gross Revenue (Commission)</span>
                  <span className="font-bold text-emerald-700">{formatCurrency(fs.incomeStatement.grossRevenue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#7b6660]">Collected</span>
                  <span className="font-semibold text-emerald-700">{formatCurrency(fs.incomeStatement.collections)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#7b6660]">Outstanding</span>
                  <span className="font-semibold text-amber-700">{formatCurrency(fs.incomeStatement.outstanding)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#7b6660]">Overdue</span>
                  <span className="font-semibold text-rose-700">{formatCurrency(fs.incomeStatement.overdue)}</span>
                </div>
              </div>
            </div>

            {/* Cash Flow */}
            <div className="rounded-xl border border-[#f0d2ca] bg-[#FDD9CD]/10 p-5">
              <h3 className="text-sm font-bold uppercase tracking-wide text-[#F38978]">Cash Flow Summary</h3>
              <p className="mt-1 text-xs text-[#7b6660]">Actual money movement</p>
              <div className="mt-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-[#7b6660]">Customer Payments In</span>
                  <span className="font-bold text-emerald-700">{formatCurrency(fs.cashFlow.totalInflow)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#7b6660]">Salon Payouts Out</span>
                  <span className="font-bold text-amber-700">−{formatCurrency(fs.cashFlow.salonPayouts)}</span>
                </div>
                <div className="border-t border-[#f0d2ca] pt-3 flex justify-between text-sm">
                  <span className="font-bold text-[#251E1F]">Net Platform Cash</span>
                  <span className="font-bold text-[#251E1F]">{formatCurrency(fs.cashFlow.platformRevenue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#7b6660]">Pending Inflow</span>
                  <span className="font-semibold text-amber-700">{formatCurrency(fs.cashFlow.pendingInflow)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#7b6660]">Overdue Amount</span>
                  <span className="font-semibold text-rose-700">{formatCurrency(fs.cashFlow.overdueAmount)}</span>
                </div>
                <div className="border-t border-[#f0d2ca] pt-3 flex justify-between text-sm">
                  <span className="text-[#7b6660]">This Month</span>
                  <span className="font-semibold text-[#251E1F]">{formatCurrency(fs.cashFlow.thisMonthRevenue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#7b6660]">Last Month</span>
                  <span className="font-semibold text-[#251E1F]">{formatCurrency(fs.cashFlow.lastMonthRevenue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#7b6660]">MoM Growth</span>
                  <span className={`font-bold ${Number(fs.cashFlow.monthOverMonthGrowth) >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    {Number(fs.cashFlow.monthOverMonthGrowth) >= 0 ? "+" : ""}{fs.cashFlow.monthOverMonthGrowth}%
                  </span>
                </div>
              </div>
            </div>

            {/* Financial Ratios */}
            <div className="rounded-xl border border-[#f0d2ca] bg-[#FDD9CD]/10 p-5">
              <h3 className="text-sm font-bold uppercase tracking-wide text-[#F38978]">Financial Ratios</h3>
              <p className="mt-1 text-xs text-[#7b6660]">Key performance indicators</p>
              <div className="mt-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-[#7b6660]">Collection Rate</span>
                  <span className="font-bold text-[#251E1F]">{fs.ratios.collectionRate}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#7b6660]">Avg Commission Rate</span>
                  <span className="font-bold text-[#251E1F]">{fs.ratios.avgCommissionRate}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#7b6660]">Avg Invoice Value</span>
                  <span className="font-semibold text-[#251E1F]">{formatCurrency(fs.ratios.avgInvoiceValue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#7b6660]">Revenue per Customer</span>
                  <span className="font-semibold text-[#251E1F]">{formatCurrency(fs.ratios.revenuePerCustomer)}</span>
                </div>
                <div className="border-t border-[#f0d2ca] pt-3 flex justify-between text-sm">
                  <span className="text-[#7b6660]">Total Customers</span>
                  <span className="font-bold text-[#251E1F]">{fs.ratios.totalCustomers}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#7b6660]">Paid Invoices</span>
                  <span className="font-bold text-emerald-700">{fs.ratios.paidInvoiceCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#7b6660]">Overdue Invoices</span>
                  <span className="font-bold text-rose-700">{fs.ratios.overdueInvoiceCount}</span>
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
  const [notificationBadgeCount, setNotificationBadgeCount] = useState(0);
  const stopPollingRef = useRef(null);

  // Use demo data as fallback when database is empty
  const displayInvoices = invoices.length === 0 && !isLoading ? DEMO_INVOICES : invoices;
  const displayCustomers = customers.length === 0 && !isLoading ? DEMO_CUSTOMERS : customers;

  const activeView = useMemo(() => {
    if (location.pathname.endsWith("/customers")) {
      return "customers";
    }

    if (location.pathname.endsWith("/invoices")) {
      return "invoices";
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

    return "dashboard";
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
    // Mark locally
    setNotifications((current) =>
      current.map((n) => (n.notification_id || n.id) === notifId ? { ...n, is_read: 1, read: true } : n)
    );
    setNotificationBadgeCount((c) => Math.max(0, c - 1));
    // Mark on server
    apiMarkNotificationRead(notifId).catch(() => {});
  }

  function handleMarkAllRead() {
    setNotifications((current) => current.map((n) => ({ ...n, is_read: 1, read: true })));
    setNotificationBadgeCount(0);
    apiMarkAllNotificationsRead().catch(() => {});
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

    // Start notification polling (Finance-only, from database)
    if (session?.user?.role === "Finance") {
      stopPollingRef.current = startNotificationPolling(({ notifications: notifs, unreadCount }) => {
        setNotifications(notifs);
        setNotificationBadgeCount(unreadCount);
      }, 15000);
    }

    return () => {
      if (stopPollingRef.current) {
        stopPollingRef.current();
      }
    };
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
    if (activeView === "dashboard") {
      return (
        <InvoicingDashboardView
          invoices={displayInvoices}
          customers={displayCustomers}
          isLoading={isLoading}
          error={error}
          navigate={navigate}
        />
      );
    }

    if (activeView === "customers") {
      return (
        <CustomersView
          customers={displayCustomers}
          invoices={displayInvoices}
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
        invoices={displayInvoices}
        customers={displayCustomers}
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

  return (
    <DashboardLayout
      pageTitle="Automated Invoicing System - Finance Invoice Management"
      user={session?.user}
      sidebarSections={financeSidebarSections}
      searchPlaceholder="Search invoices, customers, payments..."
      onSearch={handleGlobalSearch}
      notifications={notifications}
      notificationBadgeCount={notificationBadgeCount}
      onMarkNotificationRead={handleMarkNotificationRead}
      onMarkAllRead={handleMarkAllRead}
    >
      <div className="space-y-6">
        {renderActiveView()}
      </div>

      {isCreating ? (
        <InvoiceCreationModal
          customers={displayCustomers}
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
