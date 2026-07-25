import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Search,
  TrendingUp,
  Upload,
  XCircle,
  Zap,
} from "lucide-react";

import {
  fetchSubscriptions,
  fetchSubscriptionDashboard,
  fetchSubscriptionById,
  fetchSubscriptionInvoices,
  fetchSubscriptionPayments,
  generateInvoiceNow,
  validateSubscriptionImport,
  confirmSubscriptionImport,
  getSubscriptionTemplateUrl,
  parseSubscriptionFile,
} from "../../services/subscriptionService.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ["Active", "Paused", "Cancelled", "Expired"];
const FREQUENCY_OPTIONS = ["Weekly", "Monthly", "Quarterly", "Yearly"];

const statusStyles = {
  Active: "border-emerald-400/30 bg-emerald-500/15 text-emerald-700",
  Paused: "border-amber-400/30 bg-amber-500/15 text-amber-700",
  Cancelled: "border-rose-400/30 bg-rose-500/15 text-rose-700",
  Expired: "border-slate-400/30 bg-slate-500/10 text-slate-600",
};

function formatCurrency(value) {
  return new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-SG", { year: "numeric", month: "short", day: "numeric" });
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function SubscriptionsView() {
  const location = useLocation();
  const path = location.pathname;

  // Determine sub-view from URL
  let subView = "list"; // Default to subscription list/table view
  let viewParam = null;

  if (path.includes("/subscriptions/import")) {
    subView = "import";
  } else if (path.includes("/subscriptions/dashboard")) {
    subView = "dashboard";
  } else {
    // Only match detail view if the path ends with /subscriptions/<digits>
    const detailMatch = path.match(/\/subscriptions\/(\d+)(?:\/|$)/);
    if (detailMatch) {
      subView = "detail";
      viewParam = detailMatch[1];
    }
  }

  switch (subView) {
    case "dashboard":
      return <SubscriptionDashboardPanel />;
    case "import":
      return <SubscriptionImportPanel />;
    case "detail":
      return <SubscriptionDetailPanel subscriptionId={viewParam} />;
    default:
      return <SubscriptionListPanel />;
  }
}

// ─── Dashboard Panel ──────────────────────────────────────────────────────────

function SubscriptionDashboardPanel() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchSubscriptionDashboard()
      .then((metricsData) => {
        setMetrics(metricsData);
      })
      .catch(() => setMetrics(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#F38978]" /></div>;
  }

  if (!metrics) {
    return <p className="p-6 text-sm text-red-600">Failed to load subscription dashboard.</p>;
  }

  const cards = [
    { label: "Active Subscriptions", value: metrics.active_count, icon: CheckCircle2, color: "text-emerald-600" },
    { label: "MRR", value: formatCurrency(metrics.mrr), icon: TrendingUp, color: "text-blue-600" },
    { label: "ARR", value: formatCurrency(metrics.arr), icon: TrendingUp, color: "text-indigo-600" },
    { label: "Upcoming Renewals (7d)", value: metrics.upcoming_renewals, icon: CalendarClock, color: "text-amber-600" },
    { label: "Overdue Invoices", value: metrics.overdue_invoices, icon: AlertCircle, color: "text-rose-600" },
    { label: "Cancelled", value: metrics.cancelled_count, icon: XCircle, color: "text-slate-500" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#251E1F]">Subscription Dashboard</h2>
          <p className="text-sm text-[#6f4f47]">Overview of recurring billing</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-[#f2d5cc]/60 bg-white/80 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <card.icon className={`h-5 w-5 ${card.color}`} />
              <span className="text-xs font-semibold uppercase tracking-wide text-[#6f4f47]">{card.label}</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-[#251E1F]">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Revenue by Plan */}
      {metrics.revenue_by_plan?.length > 0 && (
        <div className="rounded-xl border border-[#f2d5cc]/60 bg-white/80 p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[#6f4f47]">Revenue by Plan</h3>
          <div className="space-y-2">
            {metrics.revenue_by_plan.map((plan) => (
              <div key={plan.plan_name} className="flex items-center justify-between rounded-lg bg-[#fff8f5] px-4 py-2">
                <span className="text-sm font-medium text-[#251E1F]">{plan.plan_name}</span>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-[#6f4f47]">{plan.subscription_count} subs</span>
                  <span className="text-sm font-semibold text-[#251E1F]">{formatCurrency(plan.monthly_revenue)}/mo</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="flex items-center gap-6">
        <button
          onClick={() => navigate("/dashboard/invoicing/finance/subscriptions/list")}
          className="text-sm font-medium text-[#F38978] hover:underline"
        >
          View All Subscriptions →
        </button>
      </div>
    </div>
  );
}

// ─── Subscription List Panel ──────────────────────────────────────────────────

function SubscriptionListPanel() {
  const navigate = useNavigate();
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [freqFilter, setFreqFilter] = useState("");
  const [autoRenewFilter, setAutoRenewFilter] = useState("");

  const loadData = () => {
    setLoading(true);
    const filters = {};
    if (statusFilter) filters.status = statusFilter;
    if (freqFilter) filters.frequency = freqFilter;
    fetchSubscriptions(filters)
      .then((data) => setSubscriptions(data.subscriptions || []))
      .catch(() => setSubscriptions([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [statusFilter, freqFilter]);

  const filtered = useMemo(() => {
    let list = subscriptions;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.customer_name?.toLowerCase().includes(q) ||
          s.plan_name?.toLowerCase().includes(q) ||
          String(s.subscription_id).includes(q)
      );
    }
    if (autoRenewFilter === "yes") list = list.filter((s) => s.auto_renew);
    if (autoRenewFilter === "no") list = list.filter((s) => !s.auto_renew);
    return list;
  }, [subscriptions, search, autoRenewFilter]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#251E1F]">All Subscriptions</h2>
          <p className="text-sm text-[#6f4f47]">{filtered.length} subscription{filtered.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6f4f47]" />
          <input
            type="text"
            placeholder="Search customer, plan, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[#f2d5cc] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#F38978]/40"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-[#f2d5cc] bg-white px-3 py-2 text-sm" aria-label="Filter by status">
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={freqFilter} onChange={(e) => setFreqFilter(e.target.value)} className="rounded-lg border border-[#f2d5cc] bg-white px-3 py-2 text-sm" aria-label="Filter by frequency">
          <option value="">All Frequencies</option>
          {FREQUENCY_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={autoRenewFilter} onChange={(e) => setAutoRenewFilter(e.target.value)} className="rounded-lg border border-[#f2d5cc] bg-white px-3 py-2 text-sm" aria-label="Filter auto renew">
          <option value="">Auto Renew</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-[#F38978]" /></div>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-[#6f4f47]">No subscriptions found.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#f2d5cc]/60 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#f2d5cc]/40 bg-[#fff8f5]">
                <th className="px-3 py-3 text-left font-semibold text-[#6f4f47]">ID</th>
                <th className="px-3 py-3 text-left font-semibold text-[#6f4f47]">Customer</th>
                <th className="px-3 py-3 text-left font-semibold text-[#6f4f47]">Plan</th>
                <th className="px-3 py-3 text-right font-semibold text-[#6f4f47]">Amount</th>
                <th className="px-3 py-3 text-left font-semibold text-[#6f4f47]">Frequency</th>
                <th className="px-3 py-3 text-left font-semibold text-[#6f4f47]">Next Billing</th>
                <th className="px-3 py-3 text-center font-semibold text-[#6f4f47]">Invoices</th>
                <th className="px-3 py-3 text-center font-semibold text-[#6f4f47]">Auto Renew</th>
                <th className="px-3 py-3 text-left font-semibold text-[#6f4f47]">Status</th>
                <th className="px-3 py-3 text-right font-semibold text-[#6f4f47]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((sub) => (
                <tr key={sub.subscription_id} className="border-b border-[#f2d5cc]/20 hover:bg-[#fff3ee]/50 transition">
                  <td className="px-3 py-3 text-[#6f4f47]">#{sub.subscription_id}</td>
                  <td className="px-3 py-3 font-medium text-[#251E1F] cursor-pointer hover:text-[#F38978]" onClick={() => navigate(`/dashboard/invoicing/finance/subscriptions/${sub.subscription_id}`)}>
                    {sub.customer_name}
                  </td>
                  <td className="px-3 py-3 text-[#251E1F]">{sub.plan_name}</td>
                  <td className="px-3 py-3 text-right font-medium">{formatCurrency(sub.amount)}</td>
                  <td className="px-3 py-3 text-[#6f4f47]">{sub.billing_frequency}</td>
                  <td className="px-3 py-3 text-[#6f4f47]">{formatDate(sub.next_billing_date)}</td>
                  <td className="px-3 py-3 text-center">
                    <span className="inline-block rounded-full bg-[#EAF2FF] px-2 py-0.5 text-xs font-semibold text-[#3269A8]">{sub.invoice_count || 0}</span>
                  </td>
                  <td className="px-3 py-3 text-center">{sub.auto_renew ? "Yes" : "No"}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusStyles[sub.status] || ""}`}>{sub.status}</span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => navigate(`/dashboard/invoicing/finance/subscriptions/${sub.subscription_id}`)} title="View" className="rounded p-1 hover:bg-[#FDD9CD]/50"><FileText className="h-4 w-4 text-[#6f4f47]" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Subscription Detail Panel ────────────────────────────────────────────────

function SubscriptionDetailPanel({ subscriptionId }) {
  const navigate = useNavigate();
  const [sub, setSub] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [tab, setTab] = useState("invoices");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchSubscriptionById(subscriptionId),
      fetchSubscriptionInvoices(subscriptionId),
      fetchSubscriptionPayments(subscriptionId),
    ])
      .then(([subData, invData, payData]) => {
        setSub(subData.subscription || null);
        setInvoices(invData.invoices || []);
        setPayments(payData.payments || []);
      })
      .catch(() => setSub(null))
      .finally(() => setLoading(false));
  }, [subscriptionId]);

  if (loading) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-[#F38978]" /></div>;
  if (!sub) return <p className="p-6 text-sm text-red-600">Subscription not found.</p>;

  // Calculate how much has already been invoiced (exclude void/cancelled invoices)
  const totalInvoiced = invoices
    .filter((inv) => inv.status !== "Void" && inv.status !== "Cancelled")
    .reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
  const remainingBalance = Math.max(0, Number(sub.amount) - totalInvoiced);
  const fullyInvoiced = remainingBalance <= 0;

  const handleGenerateInvoice = async () => {
    const amount = invoiceAmount ? Number(invoiceAmount) : null;
    if (!amount || isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount greater than 0.");
      return;
    }
    if (amount > remainingBalance) {
      alert("Amount cannot exceed the remaining balance (" + formatCurrency(remainingBalance) + ").");
      return;
    }
    setGenerating(true);
    try {
      const result = await generateInvoiceNow(subscriptionId, amount);
      alert(result.message || "Invoice generated.");
      setShowGenerateForm(false);
      setInvoiceAmount("");
      // Refresh invoices
      const invData = await fetchSubscriptionInvoices(subscriptionId);
      setInvoices(invData.invoices || []);
      const updated = await fetchSubscriptionById(subscriptionId);
      setSub(updated.subscription);
    } catch (err) {
      alert(err.message || "Failed to generate invoice.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/dashboard/invoicing/finance/subscriptions/list")} className="rounded-lg p-1.5 hover:bg-[#FDD9CD]/50">
          <ArrowLeft className="h-5 w-5 text-[#6f4f47]" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-[#251E1F]">{sub.plan_name}</h2>
          <p className="text-sm text-[#6f4f47]">{sub.customer_name} &middot; #{sub.subscription_id}</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[sub.status] || ""}`}>{sub.status}</span>
      </div>

      {/* Subscription Info */}
      <div className="grid grid-cols-2 gap-4 rounded-xl border border-[#f2d5cc]/60 bg-white/80 p-5 shadow-sm sm:grid-cols-3 lg:grid-cols-4">
        <InfoCell label="Amount" value={formatCurrency(sub.amount)} />
        <InfoCell label="Frequency" value={sub.billing_frequency} />
        <InfoCell label="Start Date" value={formatDate(sub.start_date)} />
        <InfoCell label="Next Billing" value={formatDate(sub.next_billing_date)} />
        <InfoCell label="End Date" value={sub.end_date ? formatDate(sub.end_date) : "None"} />
        <InfoCell label="Auto Renew" value={sub.auto_renew ? "Yes" : "No"} />
        <InfoCell label="Auto Send" value={sub.auto_send ? "Yes" : "No"} />
        <InfoCell label="Created" value={formatDate(sub.created_at)} />
      </div>
      {sub.description && (
        <div className="rounded-xl border border-[#f2d5cc]/60 bg-white/80 px-5 py-3 shadow-sm">
          <p className="text-xs font-medium uppercase text-[#6f4f47]">Description</p>
          <p className="mt-1 text-sm text-[#251E1F]">{sub.description}</p>
        </div>
      )}

      {/* Billing Progress */}
      <div className="rounded-xl border border-[#f2d5cc]/60 bg-white/80 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase text-[#6f4f47]">Billing Progress</p>
          <p className="text-xs text-[#6f4f47]">{formatCurrency(totalInvoiced)} of {formatCurrency(sub.amount)}</p>
        </div>
        <div className="h-2 w-full rounded-full bg-[#f2d5cc]/40 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${fullyInvoiced ? "bg-emerald-500" : "bg-blue-500"}`}
            style={{ width: `${Math.min(100, (totalInvoiced / Number(sub.amount)) * 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-xs text-[#6f4f47]">Invoiced: {formatCurrency(totalInvoiced)}</p>
          <p className="text-xs font-medium text-[#251E1F]">Remaining: {formatCurrency(remainingBalance)}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        {sub.status === "Active" && !fullyInvoiced && !showGenerateForm && (
          <button onClick={() => { setInvoiceAmount(""); setShowGenerateForm(true); }} className="flex items-center gap-1.5 rounded-lg border border-blue-300 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50">
            <Zap className="h-3.5 w-3.5" /> Generate Invoice Now
          </button>
        )}
        {sub.status === "Active" && fullyInvoiced && (
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Fully invoiced — all partial invoices add up to {formatCurrency(sub.amount)}
          </p>
        )}
        {sub.status === "Active" && showGenerateForm && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-3">
            <p className="text-sm font-medium text-[#251E1F]">Generate partial invoice</p>
            <div className="flex items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#6f4f47]">Invoice Amount (SGD) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={remainingBalance}
                  value={invoiceAmount}
                  onChange={(e) => setInvoiceAmount(e.target.value)}
                  placeholder={`Max ${formatCurrency(remainingBalance)}`}
                  className="w-48 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300"
                />
                <p className="mt-1 text-xs text-[#6f4f47]">Remaining balance: {formatCurrency(remainingBalance)}</p>
              </div>
              <button
                onClick={handleGenerateInvoice}
                disabled={generating}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />} Generate
              </button>
              <button
                onClick={() => { setShowGenerateForm(false); setInvoiceAmount(""); }}
                className="rounded-lg border border-[#f2d5cc] px-3 py-2 text-sm font-medium text-[#6f4f47] hover:bg-[#fff3ee]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tabs: Invoices / Payments */}
      <div className="flex gap-1 border-b border-[#f2d5cc]/40">
        {["invoices", "payments"].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-semibold capitalize transition ${tab === t ? "border-b-2 border-[#F38978] text-[#F38978]" : "text-[#6f4f47] hover:text-[#F38978]"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "invoices" && (
        invoices.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#6f4f47]">No invoices generated yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#f2d5cc]/60 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#f2d5cc]/40 bg-[#fff8f5]">
                  <th className="px-4 py-2 text-left font-semibold text-[#6f4f47]">Invoice #</th>
                  <th className="px-4 py-2 text-left font-semibold text-[#6f4f47]">Issue Date</th>
                  <th className="px-4 py-2 text-left font-semibold text-[#6f4f47]">Due Date</th>
                  <th className="px-4 py-2 text-right font-semibold text-[#6f4f47]">Amount</th>
                  <th className="px-4 py-2 text-left font-semibold text-[#6f4f47]">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.invoice_id} className="border-b border-[#f2d5cc]/20 hover:bg-[#fff3ee]/50 cursor-pointer" onClick={() => navigate("/dashboard/invoicing/finance/invoices")}>
                    <td className="px-4 py-2 font-medium">{inv.invoiceId}</td>
                    <td className="px-4 py-2">{formatDate(inv.issue_date)}</td>
                    <td className="px-4 py-2">{formatDate(inv.due_date)}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(inv.total_amount)}</td>
                    <td className="px-4 py-2"><span className="rounded-full border px-2 py-0.5 text-xs font-semibold">{inv.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === "payments" && (
        payments.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#6f4f47]">No payments recorded yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#f2d5cc]/60 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#f2d5cc]/40 bg-[#fff8f5]">
                  <th className="px-4 py-2 text-left font-semibold text-[#6f4f47]">Invoice</th>
                  <th className="px-4 py-2 text-right font-semibold text-[#6f4f47]">Amount</th>
                  <th className="px-4 py-2 text-left font-semibold text-[#6f4f47]">Method</th>
                  <th className="px-4 py-2 text-left font-semibold text-[#6f4f47]">Status</th>
                  <th className="px-4 py-2 text-left font-semibold text-[#6f4f47]">Date</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((pay) => (
                  <tr key={pay.payment_id} className="border-b border-[#f2d5cc]/20 hover:bg-[#fff3ee]/50">
                    <td className="px-4 py-2 font-medium">{pay.invoiceId}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(pay.amount)}</td>
                    <td className="px-4 py-2">{pay.payment_method || "—"}</td>
                    <td className="px-4 py-2">{pay.status}</td>
                    <td className="px-4 py-2">{formatDate(pay.payment_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}

function InfoCell({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-[#6f4f47]">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-[#251E1F]">{value}</p>
    </div>
  );
}

// ─── Subscription Import Panel ────────────────────────────────────────────────
// Primary method for adding subscriptions. Finance uploads CSV/Excel from external systems.

function SubscriptionImportPanel() {
  const navigate = useNavigate();
  const [step, setStep] = useState("upload"); // upload | preview | result
  const [file, setFile] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [validationResult, setValidationResult] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setError("");
    parseFile(selectedFile);
  };

  const parseFile = async (selectedFile) => {
    setLoading(true);
    setError("");
    try {
      // Send file to server for parsing (same pattern as VanidayImportPage)
      const parseResult = await parseSubscriptionFile(selectedFile);
      const rows = parseResult.rows || [];

      if (!rows || rows.length === 0) {
        setError("The file contains no data rows.");
        setLoading(false);
        return;
      }

      setParsedRows(rows);
      // Validate
      const fileMetadata = {
        name: selectedFile.name,
        path: selectedFile.name,
        type: selectedFile.type,
      };
      const result = await validateSubscriptionImport(rows, fileMetadata);
      setValidationResult(result);
      setStep("preview");
    } catch (err) {
      setError(err.message || "Failed to parse file.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    setLoading(true);
    setError("");
    try {
      const fileMetadata = {
        name: file.name,
        path: file.name,
        type: file.type,
      };
      const result = await confirmSubscriptionImport(parsedRows, fileMetadata);
      setImportResult(result);
      setStep("result");
    } catch (err) {
      setError(err.message || "Failed to import subscriptions.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep("upload");
    setFile(null);
    setParsedRows([]);
    setValidationResult(null);
    setImportResult(null);
    setError("");
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/dashboard/invoicing/finance/subscriptions/list")} className="rounded-lg p-1.5 hover:bg-[#FDD9CD]/50">
          <ArrowLeft className="h-5 w-5 text-[#6f4f47]" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-[#251E1F]">Import Subscriptions</h2>
          <p className="text-sm text-[#6f4f47]">Upload subscription records from your external business system</p>
        </div>
        <a
          href={getSubscriptionTemplateUrl()}
          download
          className="flex items-center gap-1.5 rounded-lg border border-[#f2d5cc] px-3 py-2 text-sm font-medium text-[#6f4f47] hover:bg-[#fff3ee] transition"
        >
          <Download className="h-4 w-4" /> Download Template
        </a>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
        <span className={step === "upload" ? "text-[#F38978]" : "text-[#6f4f47]"}>1. Upload File</span>
        <span className="text-[#f2d5cc]">→</span>
        <span className={step === "preview" ? "text-[#F38978]" : "text-[#6f4f47]"}>2. Validate & Preview</span>
        <span className="text-[#f2d5cc]">→</span>
        <span className={step === "result" ? "text-[#F38978]" : "text-[#6f4f47]"}>3. Import Complete</span>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className="rounded-xl border-2 border-dashed border-[#f2d5cc] bg-[#fff8f5] p-10 text-center">
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-[#F38978]" />
              <p className="text-sm text-[#6f4f47]">Parsing and validating file...</p>
            </div>
          ) : (
            <>
              <FileSpreadsheet className="mx-auto h-12 w-12 text-[#F38978]/60" />
              <p className="mt-3 text-sm font-medium text-[#251E1F]">
                Drop your subscription file here or click to browse
              </p>
              <p className="mt-1 text-xs text-[#6f4f47]">
                Accepts .xlsx, .xls, or .csv files. File name must contain "subscription".
              </p>
              <label className="mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#F38978] px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-[#e0776a] transition">
                <Upload className="h-4 w-4" /> Choose File
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                  aria-label="Upload subscription file"
                />
              </label>
              <div className="mt-4 rounded-lg bg-white/80 p-4 text-left text-xs text-[#6f4f47]">
                <p className="font-semibold mb-1">Required columns:</p>
                <p>Customer Name, Plan Name, Amount, Billing Frequency, Start Date</p>
                <p className="font-semibold mt-2 mb-1">Optional columns:</p>
                <p>Description, Next Billing Date, End Date, Auto Renew, Auto Send</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 2: Preview / Validation */}
      {step === "preview" && validationResult && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="flex flex-wrap gap-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2">
              <p className="text-xs font-semibold text-emerald-700">Valid Rows</p>
              <p className="text-lg font-bold text-emerald-800">{validationResult.validCount}</p>
            </div>
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2">
              <p className="text-xs font-semibold text-rose-700">Invalid Rows</p>
              <p className="text-lg font-bold text-rose-800">{validationResult.invalidCount}</p>
            </div>
            <div className="rounded-lg border border-[#f2d5cc] bg-[#fff8f5] px-4 py-2">
              <p className="text-xs font-semibold text-[#6f4f47]">Total Rows</p>
              <p className="text-lg font-bold text-[#251E1F]">{validationResult.rows?.length || 0}</p>
            </div>
          </div>

          {/* File info */}
          <p className="text-xs text-[#6f4f47]">
            File: <span className="font-medium">{file?.name}</span>
          </p>

          {/* Validation table */}
          {validationResult.rows?.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-[#f2d5cc]/60 bg-white shadow-sm max-h-[400px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-[#f2d5cc]/40 bg-[#fff8f5]">
                    <th className="px-3 py-2 text-left font-semibold text-[#6f4f47]">Row</th>
                    <th className="px-3 py-2 text-left font-semibold text-[#6f4f47]">Customer</th>
                    <th className="px-3 py-2 text-left font-semibold text-[#6f4f47]">Plan</th>
                    <th className="px-3 py-2 text-right font-semibold text-[#6f4f47]">Amount</th>
                    <th className="px-3 py-2 text-left font-semibold text-[#6f4f47]">Frequency</th>
                    <th className="px-3 py-2 text-left font-semibold text-[#6f4f47]">Start Date</th>
                    <th className="px-3 py-2 text-left font-semibold text-[#6f4f47]">Status</th>
                    <th className="px-3 py-2 text-left font-semibold text-[#6f4f47]">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {validationResult.rows.map((row) => (
                    <tr key={row.row_number} className={`border-b border-[#f2d5cc]/20 ${row.is_valid ? "" : "bg-rose-50/50"}`}>
                      <td className="px-3 py-2">{row.row_number}</td>
                      <td className="px-3 py-2">{row.customer_name || "—"}</td>
                      <td className="px-3 py-2">{row.plan_name || "—"}</td>
                      <td className="px-3 py-2 text-right">{row.amount > 0 ? formatCurrency(row.amount) : "—"}</td>
                      <td className="px-3 py-2">{row.billing_frequency || "—"}</td>
                      <td className="px-3 py-2">{row.start_date || "—"}</td>
                      <td className="px-3 py-2">
                        {row.is_valid ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Valid</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-700"><XCircle className="h-3 w-3" /> Invalid</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-rose-600 max-w-[200px]">
                        {row.errors?.length > 0 && (
                          <ul className="list-disc pl-3 space-y-0.5">
                            {row.errors.map((err, idx) => <li key={idx}>{err}</li>)}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleReset}
              className="rounded-lg border border-[#f2d5cc] px-4 py-2 text-sm font-medium text-[#6f4f47] hover:bg-[#fff3ee]"
            >
              Upload Different File
            </button>
            {validationResult.validCount > 0 && (
              <button
                onClick={handleConfirmImport}
                disabled={loading}
                className="flex items-center gap-2 rounded-lg bg-[#F38978] px-5 py-2 text-sm font-semibold text-white shadow hover:bg-[#e0776a] disabled:opacity-50 transition"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm Import ({validationResult.validCount} subscription{validationResult.validCount !== 1 ? "s" : ""})
              </button>
            )}
          </div>

          {validationResult.invalidCount > 0 && validationResult.validCount > 0 && (
            <p className="text-xs text-amber-700">
              Note: {validationResult.invalidCount} invalid row{validationResult.invalidCount !== 1 ? "s" : ""} will be skipped during import.
            </p>
          )}
        </div>
      )}

      {/* Step 3: Import Result */}
      {step === "result" && importResult && (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
            <h3 className="mt-3 text-lg font-bold text-emerald-800">Import Successful</h3>
            <p className="mt-1 text-sm text-emerald-700">
              {importResult.createdCount} subscription{importResult.createdCount !== 1 ? "s" : ""} imported successfully.
              {importResult.skippedCount > 0 && ` ${importResult.skippedCount} row${importResult.skippedCount !== 1 ? "s" : ""} skipped.`}
            </p>
          </div>

          {/* Imported subscriptions summary */}
          {importResult.subscriptions?.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-[#f2d5cc]/60 bg-white shadow-sm">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#f2d5cc]/40 bg-[#fff8f5]">
                    <th className="px-3 py-2 text-left font-semibold text-[#6f4f47]">ID</th>
                    <th className="px-3 py-2 text-left font-semibold text-[#6f4f47]">Customer</th>
                    <th className="px-3 py-2 text-left font-semibold text-[#6f4f47]">Plan</th>
                    <th className="px-3 py-2 text-right font-semibold text-[#6f4f47]">Amount</th>
                    <th className="px-3 py-2 text-left font-semibold text-[#6f4f47]">Frequency</th>
                    <th className="px-3 py-2 text-left font-semibold text-[#6f4f47]">Next Billing</th>
                  </tr>
                </thead>
                <tbody>
                  {importResult.subscriptions.map((sub) => (
                    <tr key={sub.subscription_id} className="border-b border-[#f2d5cc]/20 hover:bg-[#fff3ee]/50">
                      <td className="px-3 py-2">#{sub.subscription_id}</td>
                      <td className="px-3 py-2">{sub.customer_name}</td>
                      <td className="px-3 py-2">{sub.plan_name}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(sub.amount)}</td>
                      <td className="px-3 py-2">{sub.billing_frequency}</td>
                      <td className="px-3 py-2">{sub.next_billing_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/dashboard/invoicing/finance/subscriptions/list")}
              className="rounded-lg bg-[#F38978] px-5 py-2 text-sm font-semibold text-white shadow hover:bg-[#e0776a] transition"
            >
              View All Subscriptions
            </button>
            <button
              onClick={handleReset}
              className="rounded-lg border border-[#f2d5cc] px-4 py-2 text-sm font-medium text-[#6f4f47] hover:bg-[#fff3ee]"
            >
              Import More
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
