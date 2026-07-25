import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  FileText,
  Loader2,
  Pause,
  Play,
  Plus,
  Search,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";

import {
  fetchSubscriptions,
  fetchSubscriptionDashboard,
  fetchSubscriptionById,
  fetchSubscriptionInvoices,
  fetchSubscriptionPayments,
  createSubscription,
  generateInvoiceNow,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
} from "../../services/subscriptionService.js";
import { fetchCustomers } from "../../services/invoiceService.js";

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
  let subView = "list";
  let viewParam = null;

  if (path.includes("/subscriptions/create")) {
    subView = "create";
  } else if (path.includes("/subscriptions/dashboard")) {
    subView = "dashboard";
  } else {
    const detailMatch = path.match(/\/subscriptions\/(\d+)(?:\/|$)/);
    if (detailMatch) {
      subView = "detail";
      viewParam = detailMatch[1];
    }
  }

  switch (subView) {
    case "dashboard":
      return <SubscriptionDashboardPanel />;
    case "create":
      return <CreateSubscriptionPanel />;
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
      .then((metricsData) => setMetrics(metricsData))
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#251E1F]">Subscription Dashboard</h2>
          <p className="text-sm text-[#6f4f47]">Overview of recurring billing</p>
        </div>
      </div>

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

      <div className="flex items-center gap-6">
        <button onClick={() => navigate("/dashboard/invoicing/finance/subscriptions/list")} className="text-sm font-medium text-[#F38978] hover:underline">
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
  const [sortField, setSortField] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const pageSize = 10;

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
    // Sort
    list = [...list].sort((a, b) => {
      const aVal = a[sortField] ?? "";
      const bVal = b[sortField] ?? "";
      if (sortDir === "asc") return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });
    return list;
  }, [subscriptions, search, autoRenewFilter, sortField, sortDir]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (field) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#251E1F]">All Subscriptions</h2>
          <p className="text-sm text-[#6f4f47]">{filtered.length} subscription{filtered.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => navigate("/dashboard/invoicing/finance/subscriptions/create")}
          className="flex items-center gap-1.5 rounded-lg bg-[#F38978] px-4 py-2 text-sm font-semibold text-white shadow hover:bg-[#e0776a] transition"
        >
          <Plus className="h-4 w-4" /> Create Subscription
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6f4f47]" />
          <input type="text" placeholder="Search customer, plan, or ID..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-[#f2d5cc] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#F38978]/40" />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="rounded-lg border border-[#f2d5cc] bg-white px-3 py-2 text-sm" aria-label="Filter by status">
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={freqFilter} onChange={(e) => { setFreqFilter(e.target.value); setPage(1); }} className="rounded-lg border border-[#f2d5cc] bg-white px-3 py-2 text-sm" aria-label="Filter by frequency">
          <option value="">All Frequencies</option>
          {FREQUENCY_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={autoRenewFilter} onChange={(e) => { setAutoRenewFilter(e.target.value); setPage(1); }} className="rounded-lg border border-[#f2d5cc] bg-white px-3 py-2 text-sm" aria-label="Filter auto renew">
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
        <>
          <div className="overflow-x-auto rounded-xl border border-[#f2d5cc]/60 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#f2d5cc]/40 bg-[#fff8f5]">
                  <ThSort label="ID" field="subscription_id" current={sortField} dir={sortDir} onSort={handleSort} />
                  <ThSort label="Customer" field="customer_name" current={sortField} dir={sortDir} onSort={handleSort} />
                  <ThSort label="Plan" field="plan_name" current={sortField} dir={sortDir} onSort={handleSort} />
                  <ThSort label="Amount" field="amount" current={sortField} dir={sortDir} onSort={handleSort} align="right" />
                  <ThSort label="Frequency" field="billing_frequency" current={sortField} dir={sortDir} onSort={handleSort} />
                  <ThSort label="Next Billing" field="next_billing_date" current={sortField} dir={sortDir} onSort={handleSort} />
                  <th className="px-3 py-3 text-center font-semibold text-[#6f4f47]">Auto Renew</th>
                  <ThSort label="Status" field="status" current={sortField} dir={sortDir} onSort={handleSort} />
                  <th className="px-3 py-3 text-right font-semibold text-[#6f4f47]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((sub) => (
                  <tr key={sub.subscription_id} className="border-b border-[#f2d5cc]/20 hover:bg-[#fff3ee]/50 transition">
                    <td className="px-3 py-3 text-[#6f4f47]">#{sub.subscription_id}</td>
                    <td className="px-3 py-3 font-medium text-[#251E1F] cursor-pointer hover:text-[#F38978]" onClick={() => navigate(`/dashboard/invoicing/finance/subscriptions/${sub.subscription_id}`)}>
                      {sub.customer_name}
                    </td>
                    <td className="px-3 py-3 text-[#251E1F]">{sub.plan_name}</td>
                    <td className="px-3 py-3 text-right font-medium">{formatCurrency(sub.amount)}</td>
                    <td className="px-3 py-3 text-[#6f4f47]">{sub.billing_frequency}</td>
                    <td className="px-3 py-3 text-[#6f4f47]">{formatDate(sub.next_billing_date)}</td>
                    <td className="px-3 py-3 text-center">{sub.auto_renew ? "Yes" : "No"}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusStyles[sub.status] || ""}`}>{sub.status}</span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button onClick={() => navigate(`/dashboard/invoicing/finance/subscriptions/${sub.subscription_id}`)} title="View" className="rounded p-1 hover:bg-[#FDD9CD]/50"><FileText className="h-4 w-4 text-[#6f4f47]" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-[#6f4f47]">Page {page} of {totalPages}</p>
              <div className="flex gap-1">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border border-[#f2d5cc] px-3 py-1 text-xs disabled:opacity-40">Prev</button>
                <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="rounded border border-[#f2d5cc] px-3 py-1 text-xs disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ThSort({ label, field, current, dir, onSort, align }) {
  const active = current === field;
  return (
    <th className={`px-3 py-3 font-semibold text-[#6f4f47] cursor-pointer select-none hover:text-[#F38978] ${align === "right" ? "text-right" : "text-left"}`} onClick={() => onSort(field)}>
      {label} {active ? (dir === "asc" ? "↑" : "↓") : ""}
    </th>
  );
}

// ─── Create Subscription Panel ────────────────────────────────────────────────

function CreateSubscriptionPanel() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    customer_id: "",
    plan_name: "",
    description: "",
    amount: "",
    billing_frequency: "Monthly",
    start_date: today,
    end_date: "",
    auto_renew: true,
    auto_send: true,
  });

  useEffect(() => {
    fetchCustomers()
      .then((data) => setCustomers(data.customers || []))
      .catch(() => setCustomers([]));
  }, []);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const result = await createSubscription({
        customer_id: Number(form.customer_id),
        plan_name: form.plan_name.trim(),
        description: form.description.trim(),
        amount: Number(form.amount),
        billing_frequency: form.billing_frequency,
        start_date: form.start_date,
        end_date: form.end_date || null,
        auto_renew: form.auto_renew,
        auto_send: form.auto_send,
      });
      setSuccess(result.message || "Subscription created successfully.");
      setTimeout(() => navigate("/dashboard/invoicing/finance/subscriptions/list"), 1500);
    } catch (err) {
      setError(err.message || "Failed to create subscription.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/dashboard/invoicing/finance/subscriptions/list")} className="rounded-lg p-1.5 hover:bg-[#FDD9CD]/50">
          <ArrowLeft className="h-5 w-5 text-[#6f4f47]" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-[#251E1F]">Create Subscription</h2>
          <p className="text-sm text-[#6f4f47]">Set up a new recurring billing agreement</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="rounded-xl border border-[#f2d5cc]/60 bg-white/80 p-6 shadow-sm space-y-5">
        {/* Customer */}
        <div>
          <label className="mb-1 block text-sm font-semibold text-[#6f4f47]">Customer *</label>
          <select value={form.customer_id} onChange={(e) => handleChange("customer_id", e.target.value)} required
            className="w-full rounded-lg border border-[#f2d5cc] bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#F38978]/40">
            <option value="">Select a customer</option>
            {customers.map((c) => <option key={c.customer_id} value={c.customer_id}>{c.name}</option>)}
          </select>
        </div>

        {/* Plan Name + Amount */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold text-[#6f4f47]">Plan Name *</label>
            <input type="text" value={form.plan_name} onChange={(e) => handleChange("plan_name", e.target.value)} required placeholder="e.g. Premium Monthly"
              className="w-full rounded-lg border border-[#f2d5cc] bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#F38978]/40" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-[#6f4f47]">Amount (SGD) *</label>
            <input type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => handleChange("amount", e.target.value)} required placeholder="0.00"
              className="w-full rounded-lg border border-[#f2d5cc] bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#F38978]/40" />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="mb-1 block text-sm font-semibold text-[#6f4f47]">Description</label>
          <textarea value={form.description} onChange={(e) => handleChange("description", e.target.value)} rows={2} placeholder="Optional description of the subscription plan"
            className="w-full rounded-lg border border-[#f2d5cc] bg-white px-3 py-2.5 text-sm outline-none resize-none focus:ring-2 focus:ring-[#F38978]/40" />
        </div>

        {/* Billing Frequency + Dates */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-semibold text-[#6f4f47]">Billing Frequency *</label>
            <select value={form.billing_frequency} onChange={(e) => handleChange("billing_frequency", e.target.value)} required
              className="w-full rounded-lg border border-[#f2d5cc] bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#F38978]/40">
              {FREQUENCY_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-[#6f4f47]">Start Date *</label>
            <input type="date" value={form.start_date} onChange={(e) => handleChange("start_date", e.target.value)} required
              className="w-full rounded-lg border border-[#f2d5cc] bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#F38978]/40" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-[#6f4f47]">End Date (Optional)</label>
            <input type="date" value={form.end_date} onChange={(e) => handleChange("end_date", e.target.value)} min={form.start_date || ""}
              className="w-full rounded-lg border border-[#f2d5cc] bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#F38978]/40" />
          </div>
        </div>

        {/* Toggle options */}
        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.auto_renew} onChange={(e) => handleChange("auto_renew", e.target.checked)} className="h-4 w-4 rounded border-[#f2d5cc] accent-[#F38978]" />
            <span className="text-sm text-[#251E1F]">Auto Renew</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.auto_send} onChange={(e) => handleChange("auto_send", e.target.checked)} className="h-4 w-4 rounded border-[#f2d5cc] accent-[#F38978]" />
            <span className="text-sm text-[#251E1F]">Auto Send Email</span>
          </label>
        </div>

        {/* Info note */}
        <p className="text-xs text-[#6f4f47]">
          The system will automatically calculate the initial Next Billing Date based on the Start Date and Billing Frequency.
        </p>

        {/* Submit */}
        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-[#F38978] px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-[#e0776a] disabled:opacity-50 transition">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {loading ? "Creating..." : "Create Subscription"}
          </button>
          <button type="button" onClick={() => navigate("/dashboard/invoicing/finance/subscriptions/list")}
            className="rounded-lg border border-[#f2d5cc] px-4 py-2.5 text-sm font-medium text-[#6f4f47] hover:bg-[#fff3ee]">
            Cancel
          </button>
        </div>
      </form>
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
  const [actionLoading, setActionLoading] = useState(false);
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

  const totalInvoiced = invoices
    .filter((inv) => inv.status !== "Void" && inv.status !== "Cancelled")
    .reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
  const remainingBalance = Math.max(0, Number(sub.amount) - totalInvoiced);
  const fullyInvoiced = remainingBalance <= 0;

  const handleGenerateInvoice = async () => {
    const amount = invoiceAmount ? Number(invoiceAmount) : null;
    if (!amount || isNaN(amount) || amount <= 0) { alert("Please enter a valid amount."); return; }
    if (amount > remainingBalance) { alert("Amount cannot exceed remaining balance (" + formatCurrency(remainingBalance) + ")."); return; }
    setGenerating(true);
    try {
      const result = await generateInvoiceNow(subscriptionId, amount);
      alert(result.message || "Invoice generated.");
      setShowGenerateForm(false);
      setInvoiceAmount("");
      const invData = await fetchSubscriptionInvoices(subscriptionId);
      setInvoices(invData.invoices || []);
      const updated = await fetchSubscriptionById(subscriptionId);
      setSub(updated.subscription);
    } catch (err) { alert(err.message || "Failed to generate invoice."); }
    finally { setGenerating(false); }
  };

  const handlePause = async () => {
    if (!confirm("Pause this subscription?")) return;
    setActionLoading(true);
    try { await pauseSubscription(subscriptionId); const u = await fetchSubscriptionById(subscriptionId); setSub(u.subscription); }
    catch (err) { alert(err.message || "Failed."); }
    finally { setActionLoading(false); }
  };

  const handleResume = async () => {
    if (!confirm("Resume this subscription?")) return;
    setActionLoading(true);
    try { await resumeSubscription(subscriptionId); const u = await fetchSubscriptionById(subscriptionId); setSub(u.subscription); }
    catch (err) { alert(err.message || "Failed."); }
    finally { setActionLoading(false); }
  };

  const handleCancel = async () => {
    if (!confirm("Cancel this subscription permanently?")) return;
    setActionLoading(true);
    try { await cancelSubscription(subscriptionId); const u = await fetchSubscriptionById(subscriptionId); setSub(u.subscription); }
    catch (err) { alert(err.message || "Failed."); }
    finally { setActionLoading(false); }
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

      {/* General Information */}
      <div className="grid grid-cols-2 gap-4 rounded-xl border border-[#f2d5cc]/60 bg-white/80 p-5 shadow-sm sm:grid-cols-3 lg:grid-cols-4">
        <InfoCell label="Subscription ID" value={`#${sub.subscription_id}`} />
        <InfoCell label="Customer" value={sub.customer_name} />
        <InfoCell label="Amount" value={formatCurrency(sub.amount)} />
        <InfoCell label="Frequency" value={sub.billing_frequency} />
        <InfoCell label="Status" value={sub.status} />
        <InfoCell label="Start Date" value={formatDate(sub.start_date)} />
        <InfoCell label="Next Billing" value={formatDate(sub.next_billing_date)} />
        <InfoCell label="End Date" value={sub.end_date ? formatDate(sub.end_date) : "None"} />
        <InfoCell label="Auto Renew" value={sub.auto_renew ? "Yes" : "No"} />
        <InfoCell label="Auto Send Email" value={sub.auto_send ? "Yes" : "No"} />
        <InfoCell label="Created" value={formatDate(sub.created_at)} />
      </div>
      {sub.description && (
        <div className="rounded-xl border border-[#f2d5cc]/60 bg-white/80 px-5 py-3 shadow-sm">
          <p className="text-xs font-medium uppercase text-[#6f4f47]">Description</p>
          <p className="mt-1 text-sm text-[#251E1F]">{sub.description}</p>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {sub.status === "Active" && (
            <>
              <button onClick={handlePause} disabled={actionLoading} className="flex items-center gap-1.5 rounded-lg border border-amber-300 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50 transition">
                <Pause className="h-3.5 w-3.5" /> Pause
              </button>
              <button onClick={handleCancel} disabled={actionLoading} className="flex items-center gap-1.5 rounded-lg border border-rose-300 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50 transition">
                <XCircle className="h-3.5 w-3.5" /> Cancel
              </button>
            </>
          )}
          {sub.status === "Paused" && (
            <>
              <button onClick={handleResume} disabled={actionLoading} className="flex items-center gap-1.5 rounded-lg border border-emerald-300 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 transition">
                <Play className="h-3.5 w-3.5" /> Resume
              </button>
              <button onClick={handleCancel} disabled={actionLoading} className="flex items-center gap-1.5 rounded-lg border border-rose-300 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50 transition">
                <XCircle className="h-3.5 w-3.5" /> Cancel
              </button>
            </>
          )}
          {(sub.status === "Cancelled" || sub.status === "Expired") && (
            <p className="flex items-center gap-2 text-sm text-[#6f4f47]">
              <AlertCircle className="h-4 w-4" /> This subscription is {sub.status.toLowerCase()} and cannot be modified.
            </p>
          )}
        </div>

        {/* Generate Invoice Now */}
        {sub.status === "Active" && !fullyInvoiced && !showGenerateForm && (
          <button onClick={() => { setInvoiceAmount(""); setShowGenerateForm(true); }} className="flex items-center gap-1.5 rounded-lg border border-blue-300 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50">
            <Zap className="h-3.5 w-3.5" /> Generate Invoice Now
          </button>
        )}
        {sub.status === "Active" && fullyInvoiced && (
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Fully invoiced
          </p>
        )}
        {sub.status === "Active" && showGenerateForm && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-3">
            <p className="text-sm font-medium text-[#251E1F]">Generate invoice</p>
            <div className="flex items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#6f4f47]">Amount (SGD) *</label>
                <input type="number" step="0.01" min="0.01" max={remainingBalance} value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} placeholder={`Max ${formatCurrency(remainingBalance)}`}
                  className="w-48 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300" />
                <p className="mt-1 text-xs text-[#6f4f47]">Remaining: {formatCurrency(remainingBalance)}</p>
              </div>
              <button onClick={handleGenerateInvoice} disabled={generating} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-50 transition">
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />} Generate
              </button>
              <button onClick={() => { setShowGenerateForm(false); setInvoiceAmount(""); }} className="rounded-lg border border-[#f2d5cc] px-3 py-2 text-sm font-medium text-[#6f4f47] hover:bg-[#fff3ee]">Cancel</button>
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
