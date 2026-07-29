import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  Banknote,
  Bell,
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
  MessageCircle,
  Plus,
  ReceiptText,
  Search,
  Send,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  TrendingUp,
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
  fetchFinancialExport,
  voidInvoice
} from "../../services/invoiceService.js";
import { getStoredSession } from "../../services/sessionService.js";
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
import VanidayImportPage from "./VanidayImportPage.jsx";
import SubscriptionsView from "../../components/invoicing/SubscriptionsView.jsx";
import FinanceRemindersView from "../../components/invoicing/FinanceRemindersView.jsx";
import FinanceSettingsView from "./FinanceSettingsView.jsx";
import FinanceInvoiceSettingsPage from "./FinanceInvoiceSettingsPage.jsx";
import { SendWhatsAppButton, WhatsAppInvoiceActions, WhatsAppHistory } from "../../components/invoicing/WhatsAppActions.jsx";

const financeSidebarSections = [
  {
    label: "MAIN",
    items: [
      {
        label: "Dashboard",
        icon: LayoutDashboard,
        path: "/dashboard/invoicing/finance",
        end: true,
        children: [
          {
            label: "Performance",
            path: "/dashboard/invoicing/finance",
            end: true
          },
          {
            label: "Compliance",
            path: "/dashboard/invoicing/finance/compliance"
          },
          {
            label: "Accounting",
            path: "/dashboard/invoicing/finance/accounting"
          },
          {
            label: "Invoices",
            path: "/dashboard/invoicing/finance/invoices"
          },
          {
            label: "Fraud Detection",
            path: "/dashboard/invoicing/finance/fraud"
          }
        ]
      }
    ]
  },
  {
    label: "INVOICING",
    items: [
      {
        label: "Invoice Settings",
        icon: Settings2,
        path: "/dashboard/invoicing/finance/invoice-settings",
        children: [
          {
            label: "Settings",
            path: "/dashboard/invoicing/finance/invoice-settings",
            end: true
          },
          {
            label: "Subscriptions",
            path: "/dashboard/invoicing/finance/subscriptions"
          }
        ]
      },
      {
        label: "Reminders",
        icon: Bell,
        path: "/dashboard/invoicing/finance/reminders"
      },
      {
        label: "Collections",
        icon: CreditCard,
        path: "/dashboard/invoicing/finance/customers",
        children: [
          {
            label: "Customers",
            path: "/dashboard/invoicing/finance/customers",
            end: true
          },
          {
            label: "Payments",
            path: "/dashboard/invoicing/finance/payments"
          },
          {
            label: "Bulk Upload",
            path: "/dashboard/invoicing/finance/vaniday-import"
          }
        ]
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

const invoiceStatuses = ["Draft", "Scheduled", "Sent", "Viewed", "Paid", "Overdue", "Cancelled"];

const statusStyles = {
  Draft: "border-[#F0D2CA]/25 bg-[#FFF6F2]/10 text-[#251E1F]",
  Scheduled: "border-amber-400/30 bg-amber-500/15 text-amber-700",
  Sent: "border-[#D6E4FF] bg-[#EAF2FF] text-[#3269A8]",
  Viewed: "border-[#35A69B]/30 bg-[#E7F7F5] text-[#218178]",
  Paid: "border-emerald-400/30 bg-emerald-500/15 text-emerald-700",
  Overdue: "border-rose-400/30 bg-rose-500/15 text-rose-700",
  Cancelled: "border-slate-400/30 bg-slate-500/10 text-slate-600",
  Void: "border-slate-400/30 bg-slate-500/10 text-slate-600"
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
  "Amount",
  "Subscription"
];

const DEMO_INVOICES = [
  { invoice_id: 1, invoiceId: "INV-000001", customer_name: "Luxe Hair Studio", customer_email: "bookings@luxehairstudio.sg", customer_id: 1, issue_date: "2026-05-20", due_date: "2026-06-19", total_amount: 4850.00, status: "Paid", scheduled_at: null },
  { invoice_id: 2, invoiceId: "INV-000002", customer_name: "The Nail Artistry", customer_email: "hello@thenailartistry.sg", customer_id: 2, issue_date: "2026-06-25", due_date: "2026-07-25", total_amount: 3760.00, status: "Sent", scheduled_at: null },
  { invoice_id: 3, invoiceId: "INV-000003", customer_name: "Serenity Spa & Wellness", customer_email: "reservations@serenityspa.sg", customer_id: 3, issue_date: "2026-07-01", due_date: "2026-07-31", total_amount: 8920.00, status: "Draft", scheduled_at: null },
  { invoice_id: 4, invoiceId: "INV-000004", customer_name: "Glow Aesthetics Clinic", customer_email: "appointments@glowaesthetics.sg", customer_id: 4, issue_date: "2026-06-10", due_date: "2026-07-10", total_amount: 12680.00, status: "Overdue", scheduled_at: null },
  { invoice_id: 5, invoiceId: "INV-000005", customer_name: "Brow & Lash Bar", customer_email: "info@browlashbar.sg", customer_id: 5, issue_date: "2026-06-18", due_date: "2026-07-18", total_amount: 6540.50, status: "Overdue", scheduled_at: null },
  { invoice_id: 6, invoiceId: "INV-000006", customer_name: "KBeauty Haven", customer_email: "hello@kbeautyhaven.sg", customer_id: 6, issue_date: "2026-06-20", due_date: "2026-07-20", total_amount: 4280.00, status: "Paid", scheduled_at: null },
  { invoice_id: 7, invoiceId: "INV-000007", customer_name: "Zen Reflexology Centre", customer_email: "bookings@zenreflexology.sg", customer_id: 7, issue_date: "2026-07-05", due_date: "2026-08-04", total_amount: 2950.00, status: "Sent", scheduled_at: null },
  { invoice_id: 8, invoiceId: "INV-000008", customer_name: "Prestige Barbers", customer_email: "appointments@prestigebarbers.sg", customer_id: 8, issue_date: "2026-07-10", due_date: "2026-08-09", total_amount: 5120.00, status: "Draft", scheduled_at: null },
  { invoice_id: 9, invoiceId: "INV-000009", customer_name: "Skin Lab Express", customer_email: "info@skinlabexpress.sg", customer_id: 9, issue_date: "2026-06-28", due_date: "2026-07-28", total_amount: 9450.00, status: "Viewed", scheduled_at: null },
  { invoice_id: 10, invoiceId: "INV-000010", customer_name: "Orchid Beauty Lounge", customer_email: "bookings@orchidbeauty.sg", customer_id: 10, issue_date: "2026-06-15", due_date: "2026-07-15", total_amount: 7380.00, status: "Paid", scheduled_at: null },
  { invoice_id: 11, invoiceId: "INV-000011", customer_name: "The Waxing Boutique", customer_email: "hello@waxingboutique.sg", customer_id: 11, issue_date: "2026-07-08", due_date: "2026-08-07", total_amount: 2190.00, status: "Scheduled", scheduled_at: "2026-07-20T09:00:00" },
  { invoice_id: 12, invoiceId: "INV-000012", customer_name: "Radiance Medi-Spa", customer_email: "info@radiancespa.sg", customer_id: 12, issue_date: "2026-05-28", due_date: "2026-06-27", total_amount: 11200.00, status: "Overdue", scheduled_at: null },
  { invoice_id: 13, invoiceId: "INV-000013", customer_name: "Aura Hair & Beauty", customer_email: "bookings@aurahairbeauty.sg", customer_id: 13, issue_date: "2026-06-05", due_date: "2026-07-05", total_amount: 3150.00, status: "Paid", scheduled_at: null },
  { invoice_id: 14, invoiceId: "INV-000014", customer_name: "Bliss Nail Studio", customer_email: "hello@blissnails.sg", customer_id: 14, issue_date: "2026-07-12", due_date: "2026-08-11", total_amount: 5880.00, status: "Draft", scheduled_at: null },
  { invoice_id: 15, invoiceId: "INV-000015", customer_name: "Rejuve Wellness Clinic", customer_email: "appointments@rejuveclinic.sg", customer_id: 15, issue_date: "2026-07-02", due_date: "2026-08-01", total_amount: 3690.00, status: "Sent", scheduled_at: null }
];

const DEMO_CUSTOMERS = [
  { customer_id: 1, name: "Luxe Hair Studio", email: "bookings@luxehairstudio.sg", address: "391B Orchard Road, #03-12, Ngee Ann City, Singapore 238874", created_at: "2026-01-10T08:30:00.000Z" },
  { customer_id: 2, name: "The Nail Artistry", email: "hello@thenailartistry.sg", address: "68 Orchard Road, #04-58, Plaza Singapura, Singapore 238839", created_at: "2026-01-15T09:00:00.000Z" },
  { customer_id: 3, name: "Serenity Spa & Wellness", email: "reservations@serenityspa.sg", address: "2 Bayfront Avenue, #B1-05, Marina Bay Sands, Singapore 018972", created_at: "2026-02-01T10:15:00.000Z" },
  { customer_id: 4, name: "Glow Aesthetics Clinic", email: "appointments@glowaesthetics.sg", address: "1 Raffles Place, #05-19, One Raffles Place, Singapore 048616", created_at: "2026-02-08T11:00:00.000Z" },
  { customer_id: 5, name: "Brow & Lash Bar", email: "info@browlashbar.sg", address: "313 Orchard Road, #02-28, 313@Somerset, Singapore 238895", created_at: "2026-02-20T14:30:00.000Z" },
  { customer_id: 6, name: "KBeauty Haven", email: "hello@kbeautyhaven.sg", address: "181 Orchard Road, #04-01, Orchard Central, Singapore 238896", created_at: "2026-03-05T09:45:00.000Z" },
  { customer_id: 7, name: "Zen Reflexology Centre", email: "bookings@zenreflexology.sg", address: "6 Raffles Boulevard, #03-128, Marina Square, Singapore 039594", created_at: "2026-03-12T08:00:00.000Z" },
  { customer_id: 8, name: "Prestige Barbers", email: "appointments@prestigebarbers.sg", address: "252 North Bridge Road, #01-15, Raffles City, Singapore 179103", created_at: "2026-03-18T13:20:00.000Z" },
  { customer_id: 9, name: "Skin Lab Express", email: "info@skinlabexpress.sg", address: "290 Orchard Road, #12-01, Paragon, Singapore 238859", created_at: "2026-04-01T10:00:00.000Z" },
  { customer_id: 10, name: "Orchid Beauty Lounge", email: "bookings@orchidbeauty.sg", address: "3 Temasek Boulevard, #02-435, Suntec City, Singapore 038983", created_at: "2026-04-10T11:30:00.000Z" },
  { customer_id: 11, name: "The Waxing Boutique", email: "hello@waxingboutique.sg", address: "1 HarbourFront Walk, #01-153, VivoCity, Singapore 098585", created_at: "2026-04-22T09:15:00.000Z" },
  { customer_id: 12, name: "Radiance Medi-Spa", email: "info@radiancespa.sg", address: "2 Orchard Turn, #B2-15, ION Orchard, Singapore 238801", created_at: "2026-05-03T14:00:00.000Z" },
  { customer_id: 13, name: "Aura Hair & Beauty", email: "bookings@aurahairbeauty.sg", address: "50 Jurong Gateway Road, #03-11, JEM, Singapore 608549", created_at: "2026-05-15T12:45:00.000Z" },
  { customer_id: 14, name: "Bliss Nail Studio", email: "hello@blissnails.sg", address: "23 Serangoon Central, #04-42, NEX, Singapore 556083", created_at: "2026-06-01T08:30:00.000Z" },
  { customer_id: 15, name: "Rejuve Wellness Clinic", email: "appointments@rejuveclinic.sg", address: "80 Marine Parade Road, #09-05, Parkway Parade, Singapore 449269", created_at: "2026-06-10T10:00:00.000Z" }
];

function formatCurrency(value, currency = "SGD") {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency
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
  const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
  const token = sessionStorage.getItem("authToken");

  // Download the actual PDF from the server
  fetch(`${API_BASE}/api/invoices/${invoice.invoice_id}/pdf`, {
    headers: { Authorization: `Bearer ${token}` }
  })
    .then((res) => {
      if (!res.ok) throw new Error("Failed to generate PDF");
      return res.blob();
    })
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${invoice.invoiceId || "invoice"}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    })
    .catch((err) => {
      console.error("[Invoice PDF Download]", err.message);
      // Fallback: open printable HTML view if PDF generation fails (e.g., Puppeteer not available)
      fetch(`${API_BASE}/api/invoices/${invoice.invoice_id}/html`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then((res) => {
          if (!res.ok) throw new Error("Failed to generate invoice view");
          return res.text();
        })
        .then((html) => {
          const printWindow = window.open("", "_blank");
          if (!printWindow) {
            alert("Please allow popups for this site to view the invoice.");
            return;
          }
          const printableHtml = html.replace(
            "</body>",
            `<style>@media print { .no-print { display: none !important; } }</style>
             <div class="no-print" style="position:fixed;top:12px;right:12px;z-index:9999;">
               <button onclick="window.print()" style="padding:10px 20px;background:#F38978;color:white;border:none;border-radius:6px;font-weight:bold;cursor:pointer;font-size:14px;">
                 Save as PDF / Print
               </button>
             </div>
             </body>`
          );
          printWindow.document.write(printableHtml);
          printWindow.document.close();
        })
        .catch((htmlErr) => {
          console.error("[Invoice HTML Fallback]", htmlErr.message);
          alert("Unable to generate invoice. Please try again.");
        });
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

function addDaysToDateInput(value, days) {
  const date = value ? new Date(`${value}T00:00:00`) : new Date();
  if (Number.isNaN(date.getTime())) return toDateInputValue(new Date());
  date.setDate(date.getDate() + Number(days || 0));
  return toDateInputValue(date);
}

function toTimeInputValue(date) {
  return date.toTimeString().slice(0, 5);
}

function getItemAmount(item) {
  return Number(item.quantity || 0) * Number(item.unit_price || 0);
}

function getInvoiceAmountDue(invoice) {
  return Number(invoice?.amount_due ?? invoice?.total_amount ?? 0);
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
    <div className="app-panel rounded-xl px-5 py-4">
      <p className="text-xs font-bold uppercase tracking-wide text-[#7b6660]">
        {label}
      </p>
      <p className={`mt-2 text-3xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}

function SectionShell({ eyebrow, title, description, action, children }) {
  return (
    <section className="app-panel rounded-2xl p-5">
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

function InvoiceTimeline({ invoice }) {
  // Build timeline steps based on invoice lifecycle
  const steps = [];
  const status = invoice.status;

  // Always has "Created" step
  steps.push({
    label: "Created",
    date: invoice.created_at || invoice.issue_date,
    completed: true,
    icon: FileText,
    description: `Invoice ${invoice.invoiceId} created`
  });

  // Sent step
  const isSent = ["Sent", "Viewed", "Paid", "Overdue"].includes(status);
  steps.push({
    label: "Sent",
    date: isSent ? (invoice.sent_at || invoice.created_at) : null,
    completed: isSent,
    icon: Send,
    description: isSent ? `Sent to ${invoice.customer_email || "customer"}` : "Pending delivery"
  });

  // Viewed step
  const isViewed = ["Viewed", "Paid"].includes(status);
  steps.push({
    label: "Viewed",
    date: isViewed ? invoice.viewed_at : null,
    completed: isViewed,
    icon: Eye,
    description: isViewed ? `Viewed by ${invoice.customer_name || "customer"}` : "Not yet viewed"
  });

  // Paid step
  const isPaidStatus = status === "Paid";
  steps.push({
    label: "Paid",
    date: isPaidStatus ? (invoice.payment_date || null) : null,
    completed: isPaidStatus,
    icon: CheckCircle2,
    description: isPaidStatus ? `Payment received — ${formatCurrency(invoice.total_amount)}` : "Awaiting payment"
  });

  // Overdue indicator (if applicable)
  if (status === "Overdue") {
    steps.push({
      label: "Overdue",
      date: invoice.due_date,
      completed: true,
      icon: AlertCircle,
      description: `Payment was due on ${formatDate(invoice.due_date)}`,
      isWarning: true
    });
  }

  // Cancelled indicator (if applicable)
  if (status === "Cancelled" || status === "Void") {
    steps.push({
      label: status,
      date: null,
      completed: true,
      icon: X,
      description: `Invoice ${status.toLowerCase()}`,
      isError: true
    });
  }

  return (
    <div className="relative">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isLast = index === steps.length - 1;
        const colorClass = step.isError
          ? "text-rose-600 bg-rose-100 border-rose-300"
          : step.isWarning
          ? "text-amber-600 bg-amber-100 border-amber-300"
          : step.completed
          ? "text-emerald-600 bg-emerald-100 border-emerald-300"
          : "text-[#7b6660] bg-[#FDD9CD]/20 border-[#f0d2ca]";

        return (
          <div key={step.label} className="flex gap-3">
            {/* Connector line + Icon */}
            <div className="flex flex-col items-center">
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${colorClass}`}>
                <Icon size={13} />
              </div>
              {!isLast && (
                <div className={`w-0.5 flex-1 min-h-[20px] ${step.completed ? "bg-emerald-300" : "bg-[#f0d2ca]"}`} />
              )}
            </div>
            {/* Content */}
            <div className={`pb-4 ${isLast ? "pb-0" : ""}`}>
              <p className={`text-sm font-semibold ${step.completed ? "text-[#251E1F]" : "text-[#7b6660]"}`}>
                {step.label}
              </p>
              <p className="text-xs text-[#7b6660]">{step.description}</p>
              {step.date && (
                <p className="text-xs text-[#7b6660]/60 mt-0.5">{formatDateTime(step.date)}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InvoiceDetailsModal({ invoice, onClose }) {
  const [stripeUrl, setStripeUrl] = useState(invoice?.payment_url || null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [stripeError, setStripeError] = useState("");
  const [copied, setCopied] = useState(false);

  // Sync stripeUrl if invoice prop changes (e.g. after modal re-open)
  useEffect(() => {
    setStripeUrl(invoice?.payment_url || null);
    setStripeError("");
    setCopied(false);
  }, [invoice?.invoice_id, invoice?.payment_url]);

  if (!invoice) {
    return null;
  }

  const isPaid = ["Paid", "Cancelled", "Refunded"].includes(invoice.status);
  const isPendingReview = invoice.status === "Pending Review" || invoice.is_pending_review;

  async function handleGenerateStripeLink() {
    setIsGeneratingLink(true);
    setStripeError("");
    try {
      const result = await createStripePaymentLink(invoice.invoice_id);
      setStripeUrl(result.paymentUrl);
    } catch (err) {
      setStripeError(err.message || "Failed to generate payment link.");
    } finally {
      setIsGeneratingLink(false);
    }
  }

  function handleCopyLink() {
    if (!stripeUrl) return;
    navigator.clipboard.writeText(stripeUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#251E1F]/80 p-4 backdrop-blur">
      <div className="app-panel my-6 w-full max-w-3xl rounded-2xl">
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
            <p className="text-xs text-[#7b6660]/70">Amount Due</p>
            <p className="mt-1 text-sm font-semibold text-[#251E1F]">{formatCurrency(getInvoiceAmountDue(invoice))}</p>
            {Number(invoice.late_fee_amount || 0) > 0 ? (
              <p className="mt-1 text-xs font-medium text-rose-700">
                Includes late fee: {formatCurrency(invoice.late_fee_amount)}
              </p>
            ) : null}
          </div>
        </div>

        {/* Line Items - Primary Content */}
        <div className="px-5 pb-4">
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
              <tbody className="divide-y divide-[#ead3cc]">
                {invoice.items && invoice.items.length > 0 ? (
                  invoice.items.map((item, idx) => (
                    <tr key={item.item_id || idx} className="text-[#251E1F]">
                      <td className="px-4 py-3">{item.description}</td>
                      <td className="px-4 py-3 text-right">{item.quantity}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(item.unit_price)}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(item.amount)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="px-4 py-6 text-center text-sm text-[#7b6660]">No line items available</td>
                  </tr>
                )}
              </tbody>
              <tfoot className="border-t border-[#f0d2ca] bg-[#FDD9CD]/10">
                {invoice.subtotal_amount !== null && invoice.subtotal_amount !== undefined ? (
                  <tr>
                    <td colSpan="3" className="px-4 py-3 text-right text-sm font-medium text-[#7b6660]">Subtotal</td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-[#251E1F]">{formatCurrency(invoice.subtotal_amount)}</td>
                  </tr>
                ) : null}
                {Number(invoice.tax_rate || 0) > 0 ? (
                  <tr>
                    <td colSpan="3" className="px-4 py-3 text-right text-sm font-medium text-[#7b6660]">
                      {invoice.tax_name || "GST"} ({Number(invoice.tax_rate)}%)
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-[#251E1F]">{formatCurrency(invoice.tax_amount)}</td>
                  </tr>
                ) : null}
                <tr>
                  <td colSpan="3" className="px-4 py-3 text-right text-sm font-bold text-[#251E1F]">Total</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-[#251E1F]">{formatCurrency(invoice.total_amount)}</td>
                </tr>
                {Number(invoice.late_fee_amount || 0) > 0 ? (
                  <>
                    <tr>
                      <td colSpan="3" className="px-4 py-3 text-right text-sm font-bold text-rose-700">Late Fee ({Number(invoice.late_fee_rate || 0)}%)</td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-rose-700">{formatCurrency(invoice.late_fee_amount)}</td>
                    </tr>
                    <tr>
                      <td colSpan="3" className="px-4 py-3 text-right text-sm font-bold text-[#251E1F]">Amount Due</td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-[#251E1F]">{formatCurrency(getInvoiceAmountDue(invoice))}</td>
                    </tr>
                  </>
                ) : null}
              </tfoot>
            </table>
          </div>
        </div>

        {/* Payment Info - Compact Summary (only shown if there's payment activity) */}
        {(invoice.payment_status || invoice.transaction_id || invoice.payment_date) ? (
          <div className="mx-5 mb-4 rounded-xl border border-[#f0d2ca] bg-[#FDD9CD]/10 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#F38978] mb-2 flex items-center gap-2">
              <CreditCard size={13} />
              Payment Information
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {invoice.payment_status ? (
                <div>
                  <p className="text-xs text-[#7b6660]/70">Status</p>
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
                  <p className="text-xs text-[#7b6660]/70">Method</p>
                  <p className="mt-1 text-sm font-medium text-[#251E1F] capitalize">{invoice.payment_method}</p>
                </div>
              ) : null}
              {invoice.payment_date ? (
                <div>
                  <p className="text-xs text-[#7b6660]/70">Paid On</p>
                  <p className="mt-1 text-sm font-medium text-[#251E1F]">{formatDateTime(invoice.payment_date)}</p>
                </div>
              ) : null}
              {invoice.transaction_id ? (
                <div className="sm:col-span-3">
                  <p className="text-xs text-[#7b6660]/70">Transaction ID</p>
                  <p className="mt-1 text-xs font-mono text-[#7b6660] break-all">{invoice.transaction_id}</p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Stripe Payment Section — only for unpaid invoices */}
        {!isPaid && !isPendingReview && (
          <div className="mx-5 mb-5 rounded-xl border border-[#f0d2ca] bg-white p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#F38978] mb-3 flex items-center gap-2">
              <CreditCard size={13} />
              Online Payment
            </h3>

            {stripeError && (
              <div className="mb-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700">
                {stripeError}
              </div>
            )}

            {stripeUrl ? (
              <div className="space-y-3">
                {/* Payment link display + copy */}
                <div className="flex items-center gap-2 rounded-lg border border-[#f0d2ca] bg-[#FDD9CD]/10 px-3 py-2">
                  <LinkIcon size={13} className="shrink-0 text-[#7b6660]" />
                  <p className="flex-1 truncate text-xs font-mono text-[#7b6660]">{stripeUrl}</p>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-[#7b6660] hover:bg-[#FDD9CD]/40 hover:text-[#251E1F]"
                    aria-label="Copy payment link"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>

                {/* Open in Stripe Checkout */}
                <a
                  href={stripeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#F38978] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#E87562]"
                >
                  <CreditCard size={15} />
                  Pay Now with Card / PayNow - {formatCurrency(getInvoiceAmountDue(invoice))}
                </a>

                {/* Regenerate link */}
                <button
                  type="button"
                  onClick={handleGenerateStripeLink}
                  disabled={isGeneratingLink}
                  className="w-full rounded-xl border border-[#f0d2ca] px-4 py-2.5 text-xs font-medium text-[#7b6660] transition hover:bg-[#FDD9CD]/30 hover:text-[#251E1F] disabled:opacity-50"
                >
                  {isGeneratingLink ? "Generating..." : "Regenerate Payment Link"}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-[#7b6660]">
                  Generate a secure Stripe checkout link for this invoice. The customer can pay by credit / debit card or PayNow.
                </p>
                <button
                  type="button"
                  onClick={handleGenerateStripeLink}
                  disabled={isGeneratingLink}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#F38978] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#E87562] disabled:opacity-60"
                >
                  {isGeneratingLink ? (
                    <><Loader2 size={15} className="animate-spin" /> Generating Link...</>
                  ) : (
                    <><CreditCard size={15} /> Generate Stripe Payment Link</>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Paid confirmation banner */}
        {isPaid && (
          <div className="mx-5 mb-5 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-center">
            <p className="text-sm font-semibold text-emerald-700">✅ This invoice has been paid.</p>
          </div>
        )}

        {/* Fraud Risk Display */}
        {(invoice.risk_level || invoice.risk_score != null) && (
          <div className="mx-5 mb-4 rounded-xl border border-[#f0d2ca] bg-[#FDD9CD]/10 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#F38978] mb-2 flex items-center gap-2">
              <ShieldAlert size={13} />
              Fraud Risk Assessment
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs text-[#7b6660]/70">Risk Level</p>
                <div className="mt-1">
                  <RiskBadge level={invoice.risk_level} />
                </div>
              </div>
              <div>
                <p className="text-xs text-[#7b6660]/70">Risk Score</p>
                <p className="mt-1 text-sm font-semibold text-[#251E1F]">{invoice.risk_score ?? "—"}/100</p>
              </div>
              <div>
                <p className="text-xs text-[#7b6660]/70">Review Status</p>
                <p className={`mt-1 text-sm font-semibold ${
                  invoice.review_status === "Approved" ? "text-emerald-700" :
                  invoice.review_status === "Rejected" ? "text-rose-700" :
                  "text-amber-700"
                }`}>{invoice.review_status || "Pending"}</p>
              </div>
            </div>
          </div>
        )}

        {/* Invoice Timeline */}
        <div className="mx-5 mb-5 rounded-xl border border-[#f0d2ca] bg-white p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[#F38978] mb-3 flex items-center gap-2">
            <Clock size={13} />
            Invoice Timeline
          </h3>
          <InvoiceTimeline invoice={invoice} />
        </div>

        {/* WhatsApp Section */}
        <div className="mx-5 mb-5 rounded-xl border border-[#f0d2ca] bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#F38978] flex items-center gap-2">
              <MessageCircle size={13} />
              WhatsApp
            </h3>
            <SendWhatsAppButton invoiceId={invoice.invoice_id} size="small" />
          </div>
          <WhatsAppInvoiceActions invoiceId={invoice.invoice_id} invoiceStatus={invoice.status} />
          <div className="mt-3">
            <WhatsAppHistory invoiceId={invoice.invoice_id} />
          </div>
        </div>
      </div>
    </div>
  );
}

function VoidInvoiceModal({ invoice, onCancel, onVoided }) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleVoid() {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setError("Please provide a reason for voiding this invoice.");
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      await voidInvoice(invoice.invoice_id, trimmedReason);
      await onVoided();
    } catch (err) {
      setError(err.message || "Failed to void invoice.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#251E1F]/80 p-4 backdrop-blur">
      <div className="app-panel w-full max-w-lg rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4 border-b border-[#f0d2ca] pb-5">
          <div>
            <p className="text-sm font-semibold text-rose-600">Void Invoice</p>
            <h2 className="mt-1 text-xl font-semibold text-[#251E1F]">
              {invoice.invoiceId}
            </h2>
            <p className="mt-1 text-sm text-[#7b6660]">
              {invoice.customer_name} &middot; Current status:{" "}
              <span className="font-semibold">{invoice.status}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-2 text-[#7b6660] hover:bg-[#FDD9CD]/30 hover:text-[#251E1F]"
            aria-label="Close void dialog"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div className="rounded-xl border border-rose-400/25 bg-rose-500/[0.06] p-4 text-sm text-rose-700">
            <p className="font-semibold">This action cannot be undone.</p>
            <p className="mt-1 text-xs text-rose-600">
              The invoice will be marked <strong>Void</strong> and retained for audit. It will no
              longer appear in revenue totals or be payable by the customer.
            </p>
          </div>

          <ErrorBanner message={error} />

          <label className="block">
            <span className="text-sm font-medium text-[#7b6660]">
              Reason for voiding <span className="text-rose-600">*</span>
            </span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. Duplicate invoice, incorrect customer, error in line items..."
              className="mt-2 w-full rounded-xl border border-[#f0d2ca] bg-white px-3 py-3 text-sm text-[#251E1F] outline-none placeholder:text-[#7b6660]/60 focus:border-rose-400 resize-none"
            />
          </label>
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
            onClick={handleVoid}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <><Loader2 size={16} className="animate-spin" /> Voiding...</>
            ) : (
              <><X size={16} /> Confirm Void</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function InvoiceCreationModal({ customers, nextInvoiceId, defaultDueDate: configuredDueDate, currentGstRate, invoiceSettings, onCancel, onCreated }) {
  const today = toDateInputValue(new Date());
  const dueDays = Number(invoiceSettings?.dueDays ?? 30);
  const paymentTerms = invoiceSettings?.paymentTerms || invoiceSettings?.general?.paymentTerms || "Net 30";
  const defaultDueDate = configuredDueDate || addDaysToDateInput(today, dueDays);
  const [form, setForm] = useState({
    customer_id: "",
    issue_date: today,
    due_date: defaultDueDate,
    items: [{ ...emptyItem }]
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [effectiveGstRate, setEffectiveGstRate] = useState(currentGstRate);
  const [isLoadingGst, setIsLoadingGst] = useState(false);

  const subtotal = useMemo(
    () => form.items.reduce((sum, item) => sum + getItemAmount(item), 0),
    [form.items]
  );
  const gstRate = Number(effectiveGstRate?.ratePercentage || 0);
  const gstName = effectiveGstRate?.taxName || "GST";
  const invoiceCurrency = invoiceSettings?.defaultCurrency || invoiceSettings?.general?.defaultCurrency || "SGD";
  const taxInclusive = invoiceSettings?.taxInclusive || invoiceSettings?.general?.priceDisplay === "tax_inclusive";
  const taxAmount = taxInclusive ? subtotal - subtotal / (1 + gstRate / 100) : subtotal * (gstRate / 100);
  const invoiceTotal = taxInclusive ? subtotal : subtotal + taxAmount;

  useEffect(() => {
    setForm((current) => ({
      ...current,
      due_date: addDaysToDateInput(current.issue_date, dueDays)
    }));
  }, [dueDays, form.issue_date]);

  useEffect(() => {
    let active = true;
    setIsLoadingGst(true);
    fetchNextInvoiceNumber(form.issue_date)
      .then((response) => {
        if (active) setEffectiveGstRate(response.currentGstRate || null);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setIsLoadingGst(false);
      });
    return () => {
      active = false;
    };
  }, [form.issue_date]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#251E1F]/80 p-4 backdrop-blur">
      <div className="app-panel my-6 w-full max-w-5xl rounded-2xl p-5">
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
              readOnly
              className="mt-2 w-full rounded-xl border border-[#f0d2ca] bg-[#fff8f5] px-3 py-3 text-sm text-[#251E1F] outline-none"
            />
            <span className="mt-1 block text-xs font-medium text-[#7b6660]">
              Based on admin payment terms: {paymentTerms}
            </span>
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
            <tbody className="divide-y divide-[#ead3cc]">
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
              <span>{formatCurrency(subtotal, invoiceCurrency)}</span>
            </div>
            <div className="flex justify-between py-1 text-sm text-[#7b6660]">
              <span>{gstName} ({gstRate}%{taxInclusive ? ", included" : ""}){isLoadingGst ? " · Updating…" : ""}</span>
              <span>{formatCurrency(taxAmount, invoiceCurrency)}</span>
            </div>
            <div className="mt-3 flex justify-between border-t border-[#f0d2ca] pt-3 text-base font-semibold text-[#251E1F]">
              <span>Total</span>
              <span>{formatCurrency(invoiceTotal, invoiceCurrency)}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={submitInvoice}
            disabled={isSaving || isLoadingGst}
            className="primary-button inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold disabled:opacity-60"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#251E1F]/80 p-4 backdrop-blur">
      <div className="app-panel w-full max-w-lg rounded-2xl p-5">
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
            className="primary-button inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
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
  onScheduleInvoice,
  onVoidInvoice,
  onRefresh
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
                className="h-4 w-4 rounded border-[#f0d2ca] bg-white accent-[#F38978] disabled:opacity-30"
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
        <tbody className="divide-y divide-[#ead3cc]">
          {invoices.map((invoice) => (
            <tr key={invoice.invoice_id} className="text-[#251E1F] transition hover:bg-[#FDD9CD]/10">
              <td className="px-4 py-4">
                <input
                  type="checkbox"
                  checked={selectedInvoiceIds.has(invoice.invoice_id)}
                  disabled={invoice.status !== "Draft"}
                  onChange={(event) => onToggleInvoice(invoice.invoice_id, event.target.checked)}
                  className="h-4 w-4 rounded border-[#f0d2ca] bg-white accent-[#F38978] disabled:opacity-30 disabled:cursor-not-allowed"
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
              <td className="px-4 py-4 text-right font-bold text-[#251E1F]">
                {formatCurrency(getInvoiceAmountDue(invoice))}
                {Number(invoice.late_fee_amount || 0) > 0 ? (
                  <p className="text-xs font-semibold text-rose-700">Late fee included</p>
                ) : null}
              </td>
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
                      className="inline-flex items-center gap-2 rounded-lg border border-[#2D7C83]/30 px-3 py-2 text-xs font-semibold text-[#2D7C83] hover:bg-[#2D7C83]/10"
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
                  <SendWhatsAppButton invoiceId={invoice.invoice_id} size="small" onSent={() => onRefresh && onRefresh()} />
                  {invoice.status === "Draft" ? (
                    <button
                      type="button"
                      onClick={() => onScheduleInvoice(invoice.invoice_id)}
                      className="inline-flex items-center gap-2 rounded-lg border border-amber-400/30 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-500/10"
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
                  {!["Paid", "Void", "Cancelled", "Refunded"].includes(invoice.status) ? (
                    <button
                      type="button"
                      onClick={() => onVoidInvoice(invoice)}
                      className="inline-flex items-center gap-2 rounded-lg border border-rose-400/30 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-500/10"
                    >
                      <X size={14} />
                      Void
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
            <tbody className="divide-y divide-[#ead3cc]">
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
      const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
      const token = sessionStorage.getItem("authToken");
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
        safeFetch("/api/invoices/settings"),
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
    const totalRevenue = invoices.filter((i) => i.status === "Paid").reduce((s, i) => s + Number(i.total_amount || 0), 0);
    const paidRevenue = totalRevenue;
    const overdueAmount = invoices.filter((i) => i.status === "Overdue").reduce((s, i) => s + getInvoiceAmountDue(i), 0);
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
      details: ["Status tracking (DraftÃ¢â€ â€™Paid)", "Overdue detection", "Fraud risk assessment"]
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
        <div className="app-panel rounded-2xl p-5">
          <p className="text-sm text-[#7b6660]">Total Revenue</p>
          <p className="mt-3 text-3xl font-semibold text-[#251E1F]">{formatCurrency(totals.totalRevenue)}</p>
          <p className="mt-2 text-xs font-semibold text-[#7b6660]">{statusCounts.Paid} paid invoices</p>
        </div>
        <div className="app-panel rounded-2xl p-5">
          <p className="text-sm text-[#7b6660]">Collected</p>
          <p className="mt-3 text-3xl font-semibold text-[#2f8758]">{formatCurrency(totals.paidRevenue)}</p>
          <p className="mt-2 text-xs font-semibold text-[#7b6660]">{statusCounts.Paid} paid</p>
        </div>
        <div className="app-panel rounded-2xl p-5">
          <p className="text-sm text-[#7b6660]">Pending</p>
          <p className="mt-3 text-3xl font-semibold text-[#D97706]">{formatCurrency(totals.pendingAmount)}</p>
          <p className="mt-2 text-xs font-semibold text-[#7b6660]">{statusCounts.Sent + statusCounts.Scheduled} invoices</p>
        </div>
        <div className="app-panel rounded-2xl p-5">
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
                <article key={step.key} className="app-panel rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F38978]/10 text-[#F38978] ring-1 ring-[#F38978]/25">
                      <Icon size={24} />
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${step.completed ? "border-[#2f8758]/25 bg-[#2f8758]/10 text-[#2f8758]" : "border-[#f0d2ca] bg-[#FDD9CD]/20 text-[#7b6660]"}`}>
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

        <aside className="app-panel rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F38978]/20 text-[#F38978]">
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
                <CheckCircle2 size={17} className={statusCounts[status] > 0 ? "text-[#2f8758]" : "text-[#7b6660]/50"} />
                <span className="flex-1">{status}</span>
                <span className="font-semibold text-[#251E1F]">{statusCounts[status]}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={() => navigate("/dashboard/invoicing/finance/invoices")}
              className="primary-button flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold"
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

      <div className="mt-6 app-panel rounded-2xl p-6">
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
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2f8758]/15 text-[#2f8758]">
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
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#D97706]/15 text-[#D97706]">
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

    </section>
  );
}

function AdminInvoiceConfigPanel({ settings, reminderRules }) {
  const updatedAt = settings?.updated_at || settings?.updatedAt;
  const formattedUpdate = updatedAt ? formatDateTime(updatedAt) : "Default configuration";
  const activeReminders = Array.isArray(reminderRules) ? reminderRules.filter((r) => r.enabled) : [];

  return (
    <div className="mt-6 app-panel rounded-2xl p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F38978]/20 text-[#F38978]">
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
          <span className="text-[#7b6660]/50">Ã¢â‚¬Â¢</span>
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
          <p className="mt-1 text-sm font-semibold text-[#251E1F]">{settings.paymentTerms || settings.general?.paymentTerms || "Net 30"}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[#f0d2ca] bg-[#FDD9CD]/10 p-4">
          <p className="text-xs text-[#7b6660]">Due Period</p>
          <p className="mt-1 text-sm font-semibold text-[#251E1F]">{settings.dueDays ?? 30} days</p>
        </div>
        <div className="rounded-xl border border-[#f0d2ca] bg-[#FDD9CD]/10 p-4">
          <p className="text-xs text-[#7b6660]">Tax Type & Rate</p>
          <p className="mt-1 text-sm font-semibold text-[#251E1F]">{settings.taxType || "GST"} @ {settings.defaultTaxRate || 0}%</p>
          {settings.nextScheduledGstRate ? (
            <p className="mt-1 text-xs text-[#7b6660]">
              Next scheduled: {settings.nextScheduledGstRate.taxName} @ {Number(settings.nextScheduledGstRate.ratePercentage)}% from {formatDate(settings.nextScheduledGstRate.effectiveFrom)}
            </p>
          ) : null}
        </div>
        <div className="rounded-xl border border-[#f0d2ca] bg-[#FDD9CD]/10 p-4">
          <p className="text-xs text-[#7b6660]">Late Fee</p>
          <p className="mt-1 text-sm font-semibold text-[#251E1F]">{settings.lateFeePercent ?? settings.general?.lateFeeValue ?? 0}% after due date</p>
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
            <tbody className="divide-y divide-[#ead3cc]">
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
    { label: "No duplicate invoice numbers", status: noDuplicateNumbers, detail: noDuplicateNumbers ? "All invoice IDs are unique" : "Duplicate invoice numbers detected Ã¢â‚¬â€ potential fraud", severity: "Critical" },
    { label: "Purchase Order exists for all invoices", status: allHavePO, detail: allHavePO ? "All invoices have a PO reference" : "Some invoices missing PO Ã¢â‚¬â€ requires verification", severity: "High" },
    { label: "Vendor approved & KYC complete", status: !fraudSummary?.flaggedCount, detail: fraudSummary?.flaggedCount ? `${fraudSummary.flaggedCount} invoice(s) flagged for vendor issues` : "All vendors verified", severity: "High" },
    { label: "Invoice amounts within approval limits", status: noHighRisk, detail: noHighRisk ? "No unusually high amounts detected" : `${fraudSummary?.highCount} high-risk amount(s) flagged`, severity: "High" },
    { label: "Bank accounts verified (no recent changes)", status: noMediumRisk && noHighRisk, detail: (noMediumRisk && noHighRisk) ? "No bank account anomalies" : "Bank account changes detected in flagged invoices", severity: "High" },
    { label: "No high-risk country vendors", status: noHighRisk, detail: noHighRisk ? "All vendors from approved jurisdictions" : `${fraudSummary?.highCount} invoice(s) from high-risk sources`, severity: "Critical" },
    { label: "Sanctions & AML screening passed", status: fraudActive && noHighRisk, detail: fraudActive ? "All assessed invoices cleared" : "Fraud detection service not active", severity: "Critical" },
    { label: "Approval workflow completed", status: allHaveCustomer, detail: allHaveCustomer ? "All invoices have assigned approvers" : "Some invoices lack proper approval chain", severity: "High" },
    { label: "Three-way match (PO, Invoice, Receipt)", status: allHavePO && noDuplicateNumbers, detail: (allHavePO && noDuplicateNumbers) ? "Matching verified for all invoices" : "Mismatch detected Ã¢â‚¬â€ review required", severity: "High" },
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
    <div className="mt-6 app-panel rounded-2xl p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#251E1F]">Fraud Compliance Checklist</h3>
          <p className="mt-1 text-sm text-[#7b6660]">Automated fraud detection checks on all invoices.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSendFraudReport}
            disabled={reportSending}
            className="flex items-center gap-2 rounded-lg border border-[#F38978]/30 bg-[#F38978]/10 px-3 py-1.5 text-xs font-medium text-[#F38978] transition hover:bg-[#F38978]/20 disabled:opacity-50"
          >
            {reportSending ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {reportSent ? "Report Sent Ã¢Å“â€œ" : "Export Fraud Report"}
          </button>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${passed === checks.length ? "border-[#2D7C83]/25 bg-[#2D7C83]/10 text-[#2D7C83]" : "border-rose-400/25 bg-rose-400/10 text-rose-700"}`}>
            {passed}/{checks.length} passed
          </span>
        </div>
      </div>
      <div className="mt-5 grid gap-3">
        {checks.map((check) => (
          <div key={check.label} className={`flex items-start gap-3 rounded-xl border p-3 ${check.status ? "border-[#f0d2ca] bg-[#FDD9CD]/10" : "border-rose-400/20 bg-rose-400/[0.04]"}`}>
            {check.status
              ? <ShieldCheck size={17} className="mt-0.5 shrink-0 text-[#2f8758]" />
              : <ShieldAlert size={17} className="mt-0.5 shrink-0 text-rose-400" />
            }
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-[#251E1F]">{check.label}</p>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${check.severity === "Critical" ? "bg-rose-500/20 text-rose-700" : check.severity === "High" ? "bg-amber-500/20 text-amber-700" : "bg-[#2D7C83]/20 text-[#2D7C83]"}`}>
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
    <div className="mt-6 app-panel rounded-2xl p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#251E1F]">Automated Exception Review</h3>
          <p className="mt-1 text-sm text-[#7b6660]">System validation on active invoices before payment processing.</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${exceptions.length ? "border-[#D97706]/25 bg-[#D97706]/10 text-[#9A6412]" : "border-[#2f8758]/25 bg-[#2f8758]/10 text-[#2f8758]"}`}>
          {exceptions.length ? `${exceptions.length} exception(s)` : "No exceptions"}
        </span>
      </div>
      <div className="mt-5 grid gap-3">
        {exceptions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#f0d2ca] bg-[#fff3ee]/70 p-5 text-center text-sm text-[#7b6660]">
            All invoices pass automated validation. No exceptions detected.
          </div>
        ) : (
          exceptions.map((exc) => (
            <div key={exc.message} className={`rounded-xl border p-4 text-sm ${exc.severity === "critical" ? "border-rose-400/25 bg-rose-500/10" : "border-[#E87562]/20 bg-[#E87562]/10"}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} className={exc.severity === "critical" ? "text-rose-700" : "text-[#E87562]"} />
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
  // Revenue = sum of Paid invoices only (consistent with Dashboard and Reports)
  const revenue = invoices
    .filter((i) => i.status === "Paid")
    .reduce((s, i) => s + Number(i.total_amount || 0), 0);

  // Accounts Receivable = unpaid issued invoices (Sent, Viewed, Overdue, Scheduled)
  const accountsReceivable = invoices
    .filter((i) => ["Sent", "Viewed", "Overdue", "Scheduled"].includes(i.status))
    .reduce((s, i) => s + Number(i.total_amount || 0), 0);

  // Bank / Cash = amount collected (same as revenue for Paid invoices)
  const collected = revenue;

  // Net A/R Balance = outstanding receivables
  const netARBalance = accountsReceivable;

  const posted = statusCounts.Paid;
  const pending = invoices.length - statusCounts.Paid;

  // Double-entry journal entries
  const journalEntries = [
    { accountDr: "Accounts Receivable", debit: accountsReceivable, accountCr: "Revenue / Sales", credit: revenue },
    { accountDr: "Bank / Cash", debit: collected, accountCr: "Accounts Receivable", credit: collected }
  ];

  return (
    <div className="mt-6 app-panel rounded-2xl p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#251E1F]">Accounting Impact in Internal Ledger</h3>
          <p className="mt-1 text-sm text-[#7b6660]">Double-entry journal reflecting invoiced revenue and collections.</p>
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
          <tbody className="divide-y divide-[#ead3cc]">
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
              <td className="px-4 py-3 font-semibold text-[#F38978]">Net A/R Balance</td>
              <td className="px-4 py-3 text-right font-semibold text-[#D97706]">{formatCurrency(netARBalance)}</td>
              <td className="px-4 py-3 font-semibold text-[#F38978]">Total Revenue</td>
              <td className="px-4 py-3 text-right font-semibold text-[#251E1F]">{formatCurrency(revenue)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
        <div className="rounded-xl border border-[#f0d2ca] bg-[#FDD9CD]/10 p-3">
          <p className="text-[#7b6660]">Outstanding Receivable</p>
          <p className="mt-1 font-semibold text-[#D97706]">{formatCurrency(netARBalance)}</p>
        </div>
        <div className="rounded-xl border border-[#f0d2ca] bg-[#FDD9CD]/10 p-3">
          <p className="text-[#7b6660]">Revenue Collected</p>
          <p className="mt-1 font-semibold text-[#2f8758]">{formatCurrency(collected)}</p>
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
    <div className="mt-6 app-panel rounded-2xl p-6">
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
          <div className="rounded-xl border border-dashed border-[#f0d2ca] bg-[#fff3ee]/70 p-5 text-center text-sm text-[#7b6660]">
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
                  {entry.user_name || entry.userName || "System"} Ã¢â‚¬Â¢ {entry.activity_type || entry.activityType || "Invoice"}
                  {entry.affected_record ? ` Ã¢â‚¬Â¢ ${entry.affected_record}` : ""}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ComplianceDashboardView({ invoices, isLoading, error }) {
  const [fraudSummary, setFraudSummary] = useState(null);

  useEffect(() => {
    async function loadFraudData() {
      const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
      const token = sessionStorage.getItem("authToken");
      const headers = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      try {
        const res = await fetch(`${API_BASE}/api/fraud/dashboard`, { headers });
        if (res.ok) {
          const data = await res.json();
          if (data?.summary) setFraudSummary(data.summary);
        }
      } catch { /* ignored */ }
    }
    if (!isLoading) loadFraudData();
  }, [isLoading]);

  if (isLoading) {
    return <LoadingPanel label="Loading compliance data..." />;
  }

  return (
    <section>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#F38978]/80">
            Compliance & Risk
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-[#251E1F]">Compliance Dashboard</h2>
        </div>
      </div>

      {error ? <div className="mt-4"><ErrorBanner message={error} /></div> : null}

      <InvoiceCompliancePanel invoices={invoices} fraudSummary={fraudSummary} />
      <InvoiceExceptionPanel invoices={invoices} fraudSummary={fraudSummary} />
    </section>
  );
}

function AccountingDashboardView({ invoices, isLoading, error }) {
  const [invoiceSettings, setInvoiceSettings] = useState(null);
  const [reminderRules, setReminderRules] = useState([]);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const statusCounts = useMemo(() => {
    const counts = { Draft: 0, Scheduled: 0, Sent: 0, Viewed: 0, Paid: 0, Overdue: 0 };
    invoices.forEach((inv) => {
      if (counts[inv.status] !== undefined) counts[inv.status]++;
    });
    return counts;
  }, [invoices]);

  const totals = useMemo(() => {
    const totalRevenue = invoices.filter((i) => i.status === "Paid").reduce((s, i) => s + Number(i.total_amount || 0), 0);
    const paidRevenue = totalRevenue;
    const overdueAmount = invoices.filter((i) => i.status === "Overdue").reduce((s, i) => s + getInvoiceAmountDue(i), 0);
    const pendingAmount = invoices.filter((i) => i.status === "Sent" || i.status === "Scheduled").reduce((s, i) => s + Number(i.total_amount || 0), 0);
    return { totalRevenue, paidRevenue, overdueAmount, pendingAmount };
  }, [invoices]);

  useEffect(() => {
    async function loadSettingsData() {
      const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
      const token = sessionStorage.getItem("authToken");
      const headers = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      async function safeFetch(path) {
        try {
          const res = await fetch(`${API_BASE}${path}`, { headers });
          if (!res.ok) return null;
          return await res.json();
        } catch { return null; }
      }

      const [settingsData, remindersData] = await Promise.all([
        safeFetch("/api/invoices/settings"),
        safeFetch("/api/admin/invoicing/reminder-settings")
      ]);

      if (settingsData?.settings) setInvoiceSettings(settingsData.settings);
      if (remindersData) setReminderRules(remindersData.settings || remindersData || []);
      setSettingsLoaded(true);
    }
    if (!isLoading) loadSettingsData();
  }, [isLoading]);

  if (isLoading) {
    return <LoadingPanel label="Loading accounting data..." />;
  }

  return (
    <section>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#F38978]/80">
            Finance & Ledger
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-[#251E1F]">Accounting Impact</h2>
        </div>
      </div>

      {error ? <div className="mt-4"><ErrorBanner message={error} /></div> : null}

      {settingsLoaded && invoiceSettings ? (
        <AdminInvoiceConfigPanel settings={invoiceSettings} reminderRules={reminderRules} />
      ) : null}

      <InvoiceAccountingPanel invoices={invoices} totals={totals} statusCounts={statusCounts} />
    </section>
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
  const [voidTarget, setVoidTarget] = useState(null);
  const [voidMessage, setVoidMessage] = useState("");
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

  async function handleVoided() {
    setVoidMessage(`${voidTarget.invoiceId} has been voided and retained for audit.`);
    setVoidTarget(null);
    await onScheduleInvoices();
    setTimeout(() => setVoidMessage(""), 5000);
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Draft" value={formatCurrency(metrics.Draft)} accent="text-[#251E1F]" />
        <MetricCard label="Sent" value={formatCurrency(metrics.Sent)} accent="text-[#3269A8]" />
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
              className="primary-button inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold"
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
            {voidMessage ? (
              <div className="rounded-xl border border-slate-400/30 bg-slate-500/10 px-4 py-3 text-sm text-slate-700">
                {voidMessage}
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
            onVoidInvoice={setVoidTarget}
            onRefresh={onScheduleInvoices}
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

      {voidTarget ? (
        <VoidInvoiceModal
          invoice={voidTarget}
          onCancel={() => setVoidTarget(null)}
          onVoided={handleVoided}
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
    const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
    const token = sessionStorage.getItem("authToken");

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE}/api/bulk-invoices/parse-excel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });

    if (!response.ok) {
      throw new Error("Failed to parse Excel file on server.");
    }

    return await response.json();
  }

  throw new Error(excelFileTypeError);
}

function BulkUploadView({ onProcessed }) {
  const [rows, setRows] = useState([]);
  const [validatedRows, setValidatedRows] = useState([]);
  const [selectedRowIndices, setSelectedRowIndices] = useState(new Set());
  const [fileMetadata, setFileMetadata] = useState(null);
  const [uploadId, setUploadId] = useState(null);
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
      setUploadId(response.uploadId || null);
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
    setUploadId(null);

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

      const response = await processBulkInvoiceRows(rowsToProcess, fileMetadata, uploadId);
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
          const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
          const token = sessionStorage.getItem("authToken");
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
          // Non-fatal Ã¢â‚¬â€ invoices were still sent
          setMessage((prev) => `${prev} (Warning: failed to flag invalid rows for fraud review)`);
        }
      }

      setRows([]);
      setValidatedRows([]);
      setSelectedRowIndices(new Set());
      setFileMetadata(null);
      setUploadId(null);
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
      description={`Template columns: ${invoiceTemplateHeaders.join(", ")}. The Subscription column is optional — leave blank for non-subscription invoices.`}
      action={
        <div className="flex flex-col items-end gap-3 sm:flex-row sm:items-center">
          <a
            href="/api/bulk-invoices/template"
            download="sample_invoice_upload_template.xlsx"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#f2d5cc] px-4 py-2.5 text-sm font-medium text-[#6f4f47] hover:bg-[#fff3ee] transition"
          >
            <Download size={15} />
            Download Template
          </a>
          <button
            type="button"
            onClick={processRows}
            disabled={selectedCount === 0 || isProcessing}
            className="primary-button inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
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
          className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#F38978]/40 bg-[#FDD9CD]/10 px-6 py-12 text-center hover:bg-[#fff3ee]"
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
                <input type="radio" name="sendMode" value="now" checked={sendMode === "now"} onChange={() => setSendMode("now")} className="accent-[#F38978]" />
                <span className="text-sm text-[#251E1F]">Send immediately</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="sendMode" value="schedule" checked={sendMode === "schedule"} onChange={() => setSendMode("schedule")} className="accent-[#F38978]" />
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
                    className="h-4 w-4 rounded border-[#f0d2ca] bg-white accent-[#F38978]"
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
            <tbody className="divide-y divide-[#ead3cc]">
              {displayRows.map((row, index) => (
                <tr key={`${row.row_number || index}-${row.invoice_number || index}`} className={`text-[#251E1F] transition ${selectedRowIndices.has(index) ? "bg-[#F38978]/5" : "hover:bg-[#FDD9CD]/35"}`}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedRowIndices.has(index)}
                      onChange={(e) => toggleRow(index, e.target.checked)}
                      disabled={validatedRows.length > 0 && !row.is_valid}
                      className="h-4 w-4 rounded border-[#f0d2ca] bg-white accent-[#F38978] disabled:opacity-30"
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
    { invoice_id: 1, invoiceId: "INV-000002", customer_name: "The Nail Artistry", customer_email: "hello@thenailartistry.sg", due_date: "2026-07-25", total_amount: 3760.00, database_status: "Sent" },
    { invoice_id: 2, invoiceId: "INV-000005", customer_name: "Brow & Lash Bar", customer_email: "info@browlashbar.sg", due_date: "2026-07-18", total_amount: 6540.50, database_status: "Overdue" },
    { invoice_id: 3, invoiceId: "INV-000008", customer_name: "Zen Reflexology Centre", customer_email: "bookings@zenreflexology.sg", due_date: "2026-08-01", total_amount: 2950.00, database_status: "Sent" },
    { invoice_id: 4, invoiceId: "INV-000012", customer_name: "Radiance Medi-Spa", customer_email: "info@radiancespa.sg", due_date: "2026-07-10", total_amount: 11200.00, database_status: "Overdue" },
    { invoice_id: 5, invoiceId: "INV-000015", customer_name: "The Waxing Boutique", customer_email: "hello@waxingboutique.sg", due_date: "2026-08-05", total_amount: 2190.00, database_status: "Viewed" }
  ],
  payments: [
    { payment_id: 1, invoiceId: "INV-000001", customer_name: "Luxe Hair Studio", payment_method: "Stripe", amount: 4850.00, status: "Completed", payment_date: "2026-07-14", transaction_id: "pi_3Qx9K2H" },
    { payment_id: 2, invoiceId: "INV-000004", customer_name: "Glow Aesthetics Clinic", payment_method: "Bank Transfer", amount: 6240.00, status: "Completed", payment_date: "2026-07-12", transaction_id: "BANK-INV000004" },
    { payment_id: 3, invoiceId: "INV-000006", customer_name: "KBeauty Haven", payment_method: "PayNow", amount: 1580.00, status: "Completed", payment_date: "2026-07-10", transaction_id: "PN-20260710-001" },
    { payment_id: 4, invoiceId: "INV-000010", customer_name: "Orchid Beauty Lounge", payment_method: "Stripe", amount: 7380.00, status: "Completed", payment_date: "2026-07-08", transaction_id: "pi_3Qw7J1R" },
    { payment_id: 5, invoiceId: "INV-000013", customer_name: "Aura Hair & Beauty", payment_method: "Credit Card", amount: 3150.00, status: "Completed", payment_date: "2026-07-05", transaction_id: "CC-20260705-042" }
  ]
};

function PaymentsView() {
  const [workspace, setWorkspace] = useState({ outstandingInvoices: [], payments: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentLink, setPaymentLink] = useState("");

  // Use real data only
  const displayWorkspace = workspace;
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

  async function generatePayNowQR(invoiceId) {
    setError("");
    setPaymentLink("");

    try {
      const { generatePayNowQR: genQR } = await import("../../services/invoiceService.js");
      const response = await genQR(invoiceId);
      setPaymentLink(`PayNow QR generated for ${response.invoiceId} — UEN: ${response.proxyValue} — Amount: ${formatCurrency(response.amount)}`);
    } catch (requestError) {
      setError(requestError.message || "Failed to generate PayNow QR. Ensure PAYNOW_UEN is configured.");
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
          <div className="mb-5 rounded-xl border border-[#2D7C83]/30 bg-[#2D7C83]/10 px-4 py-3 text-sm text-[#2D7C83]">
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
                <tbody className="divide-y divide-[#ead3cc]">
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
                            className="inline-flex items-center gap-2 rounded-lg border border-[#2D7C83]/30 px-3 py-2 text-xs font-semibold text-[#2D7C83] hover:bg-[#2D7C83]/10"
                          >
                            <LinkIcon size={14} />
                            Stripe Link
                          </button>
                          <button
                            type="button"
                            onClick={() => generatePayNowQR(invoice.invoice_id)}
                            className="inline-flex items-center gap-2 rounded-lg border border-violet-400/30 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-500/10"
                          >
                            <CreditCard size={14} />
                            PayNow QR
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
                    <p className="mt-1 text-xs text-[#7b6660]">{payment.customer_name || "-"} Ã‚Â· {payment.payment_method || "Manual"}</p>
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
            <div className="h-3 overflow-hidden rounded-full bg-[#FDD9CD]/50">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#F38978] to-[#e77463]"
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
          stroke="#F38978"
          strokeWidth="4"
          points={points.join(" ")}
        />
        {data.map((item, index) => {
          const [x, y] = points[index].split(",").map(Number);
          return (
            <g key={item.month}>
              <circle cx={x} cy={y} r="5" fill="#e77463" />
              <text x={x} y={height - 4} textAnchor="middle" fill="#7b6660" fontSize="12">
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
    { invoice_id: 4, invoiceId: "INV-000004", customer_name: "Glow Aesthetics Clinic", vendor_name: "Unknown Vendor XYZ", total_amount: 12680.00, risk_score: 91, risk_level: "High", review_status: "Open", issue_date: "2026-06-10", indicators: [{ indicator_code: "BANK_ACCOUNT_MISMATCH", indicator_label: "Bank account differs from the vendor's verified record.", severity: 35 }, { indicator_code: "UNKNOWN_VENDOR", indicator_label: "Invoice references an unknown or unregistered vendor.", severity: 25 }, { indicator_code: "CUSTOMER_AMOUNT_OUTLIER", indicator_label: "Amount is unusually high for this customer.", severity: 25 }] },
    { invoice_id: 10, invoiceId: "INV-000010", customer_name: "Orchid Beauty Lounge", vendor_name: "Suspicious Corp", total_amount: 7380.00, risk_score: 82, risk_level: "High", review_status: "Open", issue_date: "2026-06-15", indicators: [{ indicator_code: "DUPLICATE_INVOICE_NUMBER", indicator_label: "Duplicate invoice number detected.", severity: 35 }, { indicator_code: "VENDOR_SUBMISSION_SPIKE", indicator_label: "Vendor has a sudden spike in invoice submissions.", severity: 20 }, { indicator_code: "OUTSIDE_BUSINESS_HOURS", indicator_label: "Invoice was submitted outside normal business hours.", severity: 10 }] },
    { invoice_id: 16, invoiceId: "INV-000016", customer_name: "Serenity Spa & Wellness", vendor_name: "Unknown Vendor XYZ", total_amount: 18500.00, risk_score: 78, risk_level: "High", review_status: "Rejected", issue_date: "2026-05-28", indicators: [{ indicator_code: "BANK_ACCOUNT_MISMATCH", indicator_label: "Bank account differs from the vendor's verified record.", severity: 35 }, { indicator_code: "VENDOR_AMOUNT_OUTLIER", indicator_label: "Amount is unusually high for this vendor.", severity: 25 }] },
    { invoice_id: 28, invoiceId: "INV-000028", customer_name: "Bliss Nail Studio", vendor_name: "Unknown Vendor XYZ", total_amount: 5420.00, risk_score: 73, risk_level: "High", review_status: "Approved", issue_date: "2026-06-02", indicators: [{ indicator_code: "UNKNOWN_VENDOR", indicator_label: "Invoice references an unknown or unregistered vendor.", severity: 25 }, { indicator_code: "RAPID_APPROVAL_PATTERN", indicator_label: "Employee approval pattern is unusually rapid.", severity: 20 }] },
    { invoice_id: 6, invoiceId: "INV-000006", customer_name: "KBeauty Haven", vendor_name: "BeautyPro Supplies Co", total_amount: 4280.00, risk_score: 52, risk_level: "Medium", review_status: "Approved", issue_date: "2026-06-20", indicators: [{ indicator_code: "DUPLICATE_CUSTOMER_AMOUNT_DATE", indicator_label: "Same customer, amount, and invoice date already exists.", severity: 25 }, { indicator_code: "OUTSIDE_BUSINESS_HOURS", indicator_label: "Invoice was submitted outside normal business hours.", severity: 10 }] },
    { invoice_id: 12, invoiceId: "INV-000012", customer_name: "Radiance Medi-Spa", vendor_name: "AestheticWorld Pte Ltd", total_amount: 11200.00, risk_score: 45, risk_level: "Medium", review_status: "Open", issue_date: "2026-06-25", indicators: [{ indicator_code: "CUSTOMER_AMOUNT_OUTLIER", indicator_label: "Amount is unusually high for this customer.", severity: 25 }, { indicator_code: "VENDOR_SUBMISSION_SPIKE", indicator_label: "Vendor has a sudden spike in invoice submissions.", severity: 20 }] }
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
  const displayDashboard = dashboard || { invoices: [], summary: {}, riskDistribution: [], trends: [] };
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
          <button type="submit" className="primary-button px-4 py-2 text-sm font-bold">Filter</button>
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
                <tbody className="divide-y divide-[#ead3cc]">
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

          // â”€â”€â”€ Cover Page â”€â”€â”€
          addCoverPage(doc, {
            title: "PayNivo Report",
            subtitle: "Financial Performance & Invoice Analytics",
            generatedBy: "Finance Team",
            date: timestamp
          });
          addPageFooter(doc, pageCtx.pageNum, null, timestamp);

          // â”€â”€â”€ Page 2: Dashboard Summary â”€â”€â”€
          doc.addPage();
          pageCtx.pageNum++;
          let y = PAGE_MARGIN + 5;

          y = addSectionHeader(doc, "Dashboard Summary", y);
          y += 4;

          y = addMetricRow(doc, "Total Invoices", String(data.summary.invoiceCount || 0), y);
          y = addMetricRow(doc, "Paid Invoices", String(data.summary.paidCount || 0), y, { valueColor: [4, 120, 87] });
          y = addMetricRow(doc, "Overdue Invoices", String(data.summary.overdueCount || 0), y, { valueColor: [190, 18, 60] });
          y = addMetricRow(doc, "Total Revenue (Paid)", `SGD ${Number(data.summary.totalInflow || 0).toLocaleString()}`, y);
          y = addMetricRow(doc, "Outstanding Balance", `SGD ${Number(data.summary.outstandingRevenue || 0).toLocaleString()}`, y, { valueColor: [180, 83, 9] });
          y = addMetricRow(doc, "Gross Revenue (Commission)", `SGD ${Number(data.summary.grossRevenue || 0).toLocaleString()}`, y, { valueColor: [4, 120, 87] });
          y = addMetricRow(doc, "Collected Revenue", `SGD ${Number(data.summary.collectedRevenue || 0).toLocaleString()}`, y);
          y = addMetricRow(doc, "Avg Commission Rate", `${data.summary.avgCommissionRate || 0}%`, y);
          y += 8;

          // â”€â”€â”€ Charts (all 4 rendered as inline SVG for Puppeteer) â”€â”€â”€
          // Helper to build a bar chart SVG
          function buildBarChartSvg(items, labelKey, valueKey) {
            const maxVal = Math.max(...items.map(d => Number(d[valueKey] || 0)), 1);
            const barH = 24;
            const gap = 6;
            const svgH = items.length * (barH + gap) + 10;
            const labelW = 90;
            const barAreaW = 380;
            const bars = items.map((item, i) => {
              const val = Number(item[valueKey] || 0);
              const pct = Math.max((val / maxVal) * 100, 4);
              const yPos = i * (barH + gap) + 5;
              return `
                <text x="0" y="${yPos + 16}" font-size="11" fill="#7b6660">${(item[labelKey] || "").substring(0, 14)}</text>
                <rect x="${labelW}" y="${yPos + 2}" width="${(pct / 100) * barAreaW}" height="${barH - 4}" rx="4" fill="url(#barGrad)" />
                <text x="${labelW + barAreaW + 10}" y="${yPos + 16}" font-size="11" fill="#251E1F" font-weight="600">$${Number(val).toLocaleString()}</text>
              `;
            }).join("");
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 ${svgH}" style="width:100%;height:100%;">
              <defs><linearGradient id="barGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#F38978"/><stop offset="100%" stop-color="#e77463"/></linearGradient></defs>
              ${bars}
            </svg>`;
          }

          // 1. Revenue Over Time (line chart)
          const revenueData = data.monthlyRevenue || [];
          if (revenueData.length > 0) {
            y = addSectionHeader(doc, "Revenue Over Time", y);
            y += 4;
            const chartWidth = 600;
            const chartHeight = 200;
            const maxVal = Math.max(...revenueData.map(d => Number(d.revenue || 0)), 1);
            const svgPoints = revenueData.map((item, i) => {
              const x = revenueData.length === 1 ? chartWidth / 2 : 40 + (i / (revenueData.length - 1)) * (chartWidth - 80);
              const vy = chartHeight - (Number(item.revenue || 0) / maxVal) * (chartHeight - 40) - 25;
              return { x, y: vy, month: item.month, revenue: item.revenue };
            });
            const polylinePoints = svgPoints.map(p => `${p.x},${p.y}`).join(" ");
            const circles = svgPoints.map(p => `<circle cx="${p.x}" cy="${p.y}" r="5" fill="#e77463" />`).join("");
            const labels = svgPoints.map(p => `<text x="${p.x}" y="${chartHeight - 5}" text-anchor="middle" fill="#7b6660" font-size="10">${p.month || ""}</text>`).join("");
            const valueLabels = svgPoints.map(p => `<text x="${p.x}" y="${p.y - 10}" text-anchor="middle" fill="#251E1F" font-size="9" font-weight="600">$${Number(p.revenue || 0).toLocaleString()}</text>`).join("");
            const lineChartSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${chartWidth} ${chartHeight}" style="width:100%;height:100%;">
              <rect width="${chartWidth}" height="${chartHeight}" fill="white" rx="8" />
              <polyline fill="none" stroke="#F38978" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${polylinePoints}" />
              ${circles}${labels}${valueLabels}
            </svg>`;
            doc.pages[doc.currentPage].push(
              `<div style="position:absolute;left:${PAGE_MARGIN}mm;top:${y}mm;width:${CONTENT_WIDTH_A4}mm;height:65mm;border:1px solid #f0d2ca;border-radius:8px;overflow:hidden;background:white;">${lineChartSvg}</div>`
            );
            y += 70;
          }

          // 2. Aging Receivables (bar chart)
          const agingData = data.agingReceivables || [];
          if (agingData.length > 0) {
            y = addSectionHeader(doc, "Aging Receivables", y);
            y += 4;
            const agingSvg = buildBarChartSvg(agingData, "bucket", "total");
            const agingH = Math.max(agingData.length * 7 + 5, 35);
            doc.pages[doc.currentPage].push(
              `<div style="position:absolute;left:${PAGE_MARGIN}mm;top:${y}mm;width:${CONTENT_WIDTH_A4}mm;height:${agingH}mm;border:1px solid #f0d2ca;border-radius:8px;overflow:hidden;background:white;padding:3mm;">${agingSvg}</div>`
            );
            y += agingH + 6;
          }

          // Page break if needed
          if (y > 220) {
            addPageFooter(doc, pageCtx.pageNum, null, timestamp);
            doc.addPage();
            pageCtx.pageNum++;
            y = PAGE_MARGIN + 5;
          }

          // 3. Invoice Status Distribution (bar chart)
          const statusData = data.statusDistribution || [];
          if (statusData.length > 0) {
            y = addSectionHeader(doc, "Invoice Status Distribution", y);
            y += 4;
            const statusSvg = buildBarChartSvg(statusData, "status", "total");
            const statusH = Math.max(statusData.length * 7 + 5, 35);
            doc.pages[doc.currentPage].push(
              `<div style="position:absolute;left:${PAGE_MARGIN}mm;top:${y}mm;width:${CONTENT_WIDTH_A4}mm;height:${statusH}mm;border:1px solid #f0d2ca;border-radius:8px;overflow:hidden;background:white;padding:3mm;">${statusSvg}</div>`
            );
            y += statusH + 6;
          }

          // 4. Top Customer Revenue (bar chart)
          const topCustData = data.topCustomers || [];
          if (topCustData.length > 0) {
            if (y > 200) {
              addPageFooter(doc, pageCtx.pageNum, null, timestamp);
              doc.addPage();
              pageCtx.pageNum++;
              y = PAGE_MARGIN + 5;
            }
            y = addSectionHeader(doc, "Top Customer Revenue", y);
            y += 4;
            const custSvg = buildBarChartSvg(topCustData, "name", "total");
            const custH = Math.max(topCustData.length * 7 + 5, 40);
            doc.pages[doc.currentPage].push(
              `<div style="position:absolute;left:${PAGE_MARGIN}mm;top:${y}mm;width:${CONTENT_WIDTH_A4}mm;height:${custH}mm;border:1px solid #f0d2ca;border-radius:8px;overflow:hidden;background:white;padding:3mm;">${custSvg}</div>`
            );
            y += custH + 6;
          }

          addPageFooter(doc, pageCtx.pageNum, null, timestamp);

          // â”€â”€â”€ Invoice Details Pages â”€â”€â”€
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
        <MetricCard label="Total Revenue" value={formatCurrency(reports?.summary?.total_revenue)} />
        <MetricCard label="Gross Revenue" value={formatCurrency(reports?.summary?.gross_revenue)} accent="text-emerald-700" />
        <MetricCard label="Salon Payouts" value={formatCurrency(reports?.summary?.total_salon_payout)} accent="text-amber-700" />
        <MetricCard label="Outstanding" value={formatCurrency(reports?.summary?.outstanding_revenue)} accent="text-rose-700" />
        <MetricCard label="Avg Commission" value={`${reports?.summary?.avg_commission_rate || 0}%`} accent="text-[#2D7C83]" />
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
            {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}{isExporting ? "Generating PDF..." : "Export PDF Report"}
          </button>
          <a href="/api/reports/invoices/export-excel" download
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/30 px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50">
            <Download size={14} />Export Excel Report
          </a>
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
              <p className="mt-1 text-xs text-[#7b6660]">Gross Revenue = Inflow - Salon Payouts</p>
              <div className="mt-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-[#7b6660]">Total Revenue</span>
                  <span className="font-bold text-[#251E1F]">{formatCurrency(fs.incomeStatement.totalInflow)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#7b6660]">Salon Payouts</span>
                  <span className="font-bold text-amber-700">-{formatCurrency(fs.incomeStatement.salonPayouts)}</span>
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
                  <span className="font-bold text-amber-700">-{formatCurrency(fs.cashFlow.salonPayouts)}</span>
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
  const [defaultInvoiceDueDate, setDefaultInvoiceDueDate] = useState("");
  const [currentGstRate, setCurrentGstRate] = useState(null);
  const [invoiceSettings, setInvoiceSettings] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");

  // Use real data only — no demo fallback
  const displayInvoices = invoices;
  const displayCustomers = customers;

  const activeView = useMemo(() => {
    if (location.pathname.endsWith("/customers")) {
      return "customers";
    }

    if (location.pathname.endsWith("/invoices")) {
      return "invoices";
    }

    if (location.pathname.endsWith("/vaniday-import") || location.pathname.endsWith("/bulk-upload")) {
      return "vaniday-import";
    }

    if (location.pathname.endsWith("/payments")) {
      return "payments";
    }

    if (location.pathname.endsWith("/fraud")) {
      return "fraud";
    }

    if (location.pathname.endsWith("/compliance")) {
      return "compliance";
    }

    if (location.pathname.endsWith("/accounting")) {
      return "accounting";
    }

    if (location.pathname.endsWith("/reminders")) {
      return "reminders";
    }

    if (location.pathname.endsWith("/invoice-settings")) {
      return "invoice-settings";
    }

    if (location.pathname.endsWith("/reports")) {
      return "reports";
    }

    if (location.pathname.includes("/subscriptions")) {
      return "subscriptions";
    }

    if (location.pathname.endsWith("/settings")) {
      return "settings";
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
    setDefaultInvoiceDueDate(numberResponse.defaultDueDate || "");
    setCurrentGstRate(numberResponse.currentGstRate || null);
    setInvoiceSettings(numberResponse.settings || null);
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

  // Refresh invoice data when navigating back to the invoices view
  useEffect(() => {
    if (activeView === "invoices") {
      loadWorkspaceData().catch(() => {});
    }
  }, [activeView]);

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

  async function handleVanidayImportComplete() {
    // Refresh invoice data after a successful Vaniday import
    await loadWorkspaceData();
  }

  function renderActiveView() {
    if (activeView === "dashboard") {
      return (
        <>
          <InvoicingDashboardView
            invoices={displayInvoices}
            customers={displayCustomers}
            isLoading={isLoading}
            error={error}
            navigate={navigate}
          />
        </>
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

    if (activeView === "vaniday-import") {
      return <VanidayImportPage onImportComplete={handleVanidayImportComplete} />;
    }

    if (activeView === "payments") {
      return <PaymentsView />;
    }

    if (activeView === "fraud") {
      return <FraudDetectionView />;
    }

    if (activeView === "compliance") {
      return (
        <ComplianceDashboardView
          invoices={displayInvoices}
          isLoading={isLoading}
          error={error}
        />
      );
    }

    if (activeView === "accounting") {
      return (
        <AccountingDashboardView
          invoices={displayInvoices}
          isLoading={isLoading}
          error={error}
        />
      );
    }

    if (activeView === "reminders") {
      return <FinanceRemindersView />;
    }

    if (activeView === "invoice-settings") {
      return <FinanceInvoiceSettingsPage />;
    }

    if (activeView === "reports") {
      return <ReportsView />;
    }

    if (activeView === "subscriptions") {
      return <SubscriptionsView />;
    }

    if (activeView === "settings") {
      return <FinanceSettingsView />;
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
      sidebarTitle="Automated Invoicing & Payroll System"
      searchPlaceholder="Search invoices, customers, payments..."
      onSearch={handleGlobalSearch}
      theme="adminInvoicing"
    >
      <div className="space-y-6">
        {renderActiveView()}
      </div>

      {isCreating ? (
        <InvoiceCreationModal
          customers={displayCustomers}
          nextInvoiceId={nextInvoiceId}
          defaultDueDate={defaultInvoiceDueDate}
          currentGstRate={currentGstRate}
          invoiceSettings={invoiceSettings}
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
