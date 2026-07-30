/**
 * EVALUATION HEADER
 * FEATURE: INVOICE - ADMIN
 * PURPOSE: Implements the Admin Invoice Performance Page screen and its page-level interactions.
 * LAYER: Frontend page - renders a complete screen and coordinates its user interactions.
 * FIND RELATED CODE: Trace its imports for UI components and frontend services used by this screen.
 */
import { AlertCircle, ArrowRight, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { fetchInvoicePerformance } from "../../services/adminDashboardService.js";

const basePath = "/dashboard/invoicing/admin";
const performancePath = `${basePath}/dashboard/invoice-performance`;
const statuses = ["Draft", "Sent", "Viewed", "Paid", "Overdue"];
const statusColors = {
  Draft: "#7B6660",
  Sent: "#4f8fd8",
  Viewed: "#35a69b",
  Paid: "#2F8758",
  Overdue: "#c94c3a"
};
const rangeOptions = [
  ["today", "Today"],
  ["last-7-days", "Last 7 Days"],
  ["last-30-days", "Last 30 Days"],
  ["last-90-days", "Last 90 Days"],
  ["this-month", "This Month"],
  ["this-quarter", "This Quarter"],
  ["this-year", "This Year"],
  ["all-time", "All Time"],
  ["custom", "Custom Range"]
];

function isoDate(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCount(value) {
  return new Intl.NumberFormat("en-SG").format(Number(value || 0));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" }).format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Singapore"
  }).format(new Date(value));
}

function usePerformanceSection(section, initialRange) {
  const [range, setRange] = useState(initialRange);
  const [custom, setCustom] = useState({ startDate: isoDate(-29), endDate: isoDate() });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestRef = useRef(null);
  const customError = range === "custom" && (!custom.startDate || !custom.endDate || custom.startDate > custom.endDate)
    ? "Choose a valid start and end date."
    : "";

  const load = useCallback(async () => {
    if (customError) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError("");
    try {
      const filters = {
        section,
        ...(section === "status-changes" ? { pageSize: 5 } : {}),
        ...(section === "activity" ? { activityDetails: true } : {}),
        ...(range === "custom" ? custom : {})
      };
      const response = await fetchInvoicePerformance(range, filters, { signal: controller.signal });
      setData(response);
    } catch (requestError) {
      if (requestError?.name !== "AbortError") {
        setError(requestError?.message || "Unable to load this section.");
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [custom, customError, range, section]);

  useEffect(() => {
    load();
    return () => requestRef.current?.abort();
  }, [load]);

  return { range, setRange, custom, setCustom, data, loading, error, customError, retry: load };
}

function RangeControl({ state, label }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <select
        value={state.range}
        onChange={(event) => state.setRange(event.target.value)}
        aria-label={`${label} date range`}
        className="rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-xs font-semibold text-[#251E1F] outline-none focus:border-[#F38978] focus:ring-2 focus:ring-[#F38978]/20"
      >
        {rangeOptions.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select>
      {state.range === "custom" ? (
        <>
          <input
            type="date"
            value={state.custom.startDate}
            max={state.custom.endDate || undefined}
            onChange={(event) => state.setCustom((current) => ({ ...current, startDate: event.target.value }))}
            aria-label={`${label} start date`}
            className="rounded-lg border border-[#f0d2ca] px-2 py-1.5 text-xs outline-none focus:border-[#F38978]"
          />
          <input
            type="date"
            value={state.custom.endDate}
            min={state.custom.startDate || undefined}
            onChange={(event) => state.setCustom((current) => ({ ...current, endDate: event.target.value }))}
            aria-label={`${label} end date`}
            className="rounded-lg border border-[#f0d2ca] px-2 py-1.5 text-xs outline-none focus:border-[#F38978]"
          />
        </>
      ) : null}
    </div>
  );
}

function Card({ title, controls, children, className = "" }) {
  return (
    <section className={`rounded-2xl border border-[#f0d2ca] bg-white/95 p-5 shadow-[0_10px_28px_rgba(37,30,31,0.06)] ${className}`}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h2 className="text-lg font-bold text-[#251E1F]">{title}</h2>
        {controls}
      </div>
      {children}
    </section>
  );
}

function SectionState({ state, children, emptyMessage }) {
  if (state.customError) {
    return <p className="rounded-xl border border-[#FDD9CD] bg-[#FDD9CD] p-4 text-sm text-amber-800">{state.customError}</p>;
  }
  if (state.loading && !state.data) {
    return <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-[#7b6660]"><Loader2 className="animate-spin" size={18} /> Loading...</div>;
  }
  if (state.error) {
    return (
      <div className="rounded-xl border border-[#FDD9CD] bg-[#FDD9CD] p-4 text-sm text-red-700">
        <p className="flex items-center gap-2"><AlertCircle size={17} /> {state.error}</p>
        <button type="button" onClick={state.retry} className="mt-3 inline-flex items-center gap-2 font-bold hover:underline">
          <RefreshCw size={15} /> Retry
        </button>
      </div>
    );
  }
  if (!state.data) {
    return <p className="rounded-xl border border-dashed border-[#f0c9bf] bg-[#fff8f5] p-8 text-center text-sm text-[#7b6660]">{emptyMessage}</p>;
  }
  return <div className="relative">{state.loading ? <Loader2 className="absolute right-0 top-0 animate-spin text-[#F38978]" size={17} /> : null}{children}</div>;
}

function DonutChart({ data }) {
  const sourceValues = statuses.map((status, originalIndex) => ({
    status,
    count: Number(data?.statuses?.find((item) => item.status === status)?.count || 0),
    originalIndex
  }));
  const total = sourceValues.reduce((sum, item) => sum + item.count, 0);
  const percentageParts = sourceValues.map((item) => {
    const exactTenths = total > 0 ? item.count / total * 1000 : 0;
    return {
      status: item.status,
      tenths: Math.floor(exactTenths),
      remainder: exactTenths - Math.floor(exactTenths)
    };
  });
  let remainingTenths = total > 0
    ? 1000 - percentageParts.reduce((sum, item) => sum + item.tenths, 0)
    : 0;
  [...percentageParts]
    .sort((left, right) => right.remainder - left.remainder || statuses.indexOf(left.status) - statuses.indexOf(right.status))
    .forEach((item) => {
      if (remainingTenths <= 0) return;
      percentageParts.find((part) => part.status === item.status).tenths += 1;
      remainingTenths -= 1;
    });
  const values = sourceValues
    .map((item) => ({
      ...item,
      percentage: Number((percentageParts.find((part) => part.status === item.status).tenths / 10).toFixed(1))
    }))
    .sort((left, right) => right.count - left.count || left.originalIndex - right.originalIndex);
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="grid gap-5 lg:grid-cols-[230px_minmax(0,1fr)] lg:items-center">
      <div className="relative mx-auto h-56 w-56" aria-label={`Total invoices: ${total}`}>
        <svg viewBox="0 0 160 160" className="h-full w-full" role="img" aria-label="Invoice status distribution">
          <circle cx="80" cy="80" r={radius} fill="none" stroke="#f5e3dd" strokeWidth="20" />
          {values.map((item) => {
            const length = total > 0 ? Number(item.count || 0) / total * circumference : 0;
            const dashOffset = -offset;
            offset += length;
            return (
              <circle key={item.status} cx="80" cy="80" r={radius} fill="none" stroke={statusColors[item.status]}
                strokeWidth="20" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={dashOffset}
                strokeLinecap="butt" transform="rotate(-90 80 80)">
                <title>{`${item.status}: ${formatCount(item.count)} invoices (${item.percentage.toFixed(1)}%)`}</title>
              </circle>
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <strong className="text-2xl text-[#251E1F]">{formatCount(total)}</strong>
          <span className="text-xs font-semibold text-[#7b6660]">Total Invoices</span>
        </div>
      </div>
      <div className="space-y-1">
        {values.map((item) => (
          <div key={item.status} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left">
            <span className="h-3 w-3 rounded-full" style={{ background: statusColors[item.status] }} />
            <span className="flex-1 text-sm font-semibold">{item.status}</span>
            <strong className="text-sm">{formatCount(item.count)}</strong>
            <span className="w-14 text-right text-xs text-[#7b6660]">{item.percentage.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorAwareLink({ to, children }) {
  return <Link to={to} className="inline-flex items-center gap-2 text-sm font-bold text-[#F38978] hover:text-[#d86150] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F38978]">{children}<ChevronRight size={15} /></Link>;
}

function StatusChangeChart({ summary = [], changes = [] }) {
  const fallbackSummary = changes.reduce((items, change) => {
    const key = `${change.fromStatus} -> ${change.toStatus}`;
    const existing = items.find((item) => `${item.from} -> ${item.to}` === key);
    if (existing) existing.count += 1;
    else items.push({ from: change.fromStatus, to: change.toStatus, count: 1 });
    return items;
  }, []);
  const rows = (summary.length ? summary : fallbackSummary)
    .filter((item) => item.from && item.to && Number(item.count || 0) > 0)
    .slice(0, 5);
  const maxCount = Math.max(...rows.map((item) => Number(item.count || 0)), 1);

  if (!rows.length) return null;

  return (
    <div className="mb-4 space-y-3 rounded-xl border border-[#f0d2ca] bg-[#fff8f5] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-[#251E1F]">Finance Status Movement</p>
        <span className="text-xs font-semibold text-[#7b6660]">Based on Finance invoice actions</span>
      </div>
      <div className="space-y-3">
        {rows.map((item) => {
          const count = Number(item.count || 0);
          const width = Math.max(8, Math.round((count / maxCount) * 100));
          return (
            <div key={`${item.from}-${item.to}`} className="grid gap-1">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="inline-flex items-center gap-1 font-bold text-[#514440]">
                  {item.from}<ArrowRight size={12} className="text-[#F38978]" />{item.to}
                </span>
                <span className="font-bold text-[#251E1F]">{formatCount(count)}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-[#F38978]" style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminInvoicePerformancePage() {
  const statusState = usePerformanceSection("status", "all-time");
  const overdueState = usePerformanceSection("paid-vs-overdue", "all-time");
  const changesState = usePerformanceSection("status-changes", "all-time");

  const overdueSummary = overdueState.data?.paidVsOverdue || { overdueAmount: 0 };
  const recentChanges = (changesState.data?.recentStatusChanges || []).slice(0, 5);
  const statusChangeSummary = changesState.data?.recentStatusChangeSummary || [];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-3xl font-bold text-[#251E1F]">Invoice Performance</h1>
        <p className="mt-1 text-sm text-[#7b6660]">Track invoice health, payment value, and status movement.</p>
      </header>

      <div className="grid gap-5">
        <Card title="Invoice Status" controls={<RangeControl state={statusState} label="Invoice Status" />}>
          <SectionState state={statusState} emptyMessage="No invoices found for this range.">
            <DonutChart data={statusState.data?.invoiceStatus} />
          </SectionState>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[38fr_62fr]">
        <Card title="Overdue Amount" controls={<RangeControl state={overdueState} label="Overdue Amount" />}>
          <SectionState state={overdueState} emptyMessage="No overdue amounts found for this range.">
            <div className="block w-full rounded-xl p-2 text-left">
              <div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold">Outstanding overdue invoices</span><strong>{formatCurrency(overdueSummary.overdueAmount)}</strong></div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#FFF3EE]"><div className="h-full w-full rounded-full bg-[#F38978]" /></div>
            </div>
          </SectionState>
        </Card>

        <Card title="Recent Status Changes" controls={<RangeControl state={changesState} label="Recent Status Changes" />}>
          <SectionState state={changesState} emptyMessage="No status changes found for this range.">
            <StatusChangeChart summary={statusChangeSummary} changes={recentChanges} />
            <p className="mb-3 text-xs text-[#7b6660]">Latest 5 invoice status changes from Finance actions, newest first.</p>
            {recentChanges.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead><tr className="border-y border-[#f0d2ca] bg-[#fff8f5] text-xs uppercase text-[#7b6660]"><th className="px-3 py-3">Invoice #</th><th className="px-3 py-3">Status Change</th><th className="px-3 py-3">Changed On</th><th className="px-3 py-3 text-right">Amount</th></tr></thead>
                  <tbody>{recentChanges.map((change) => <tr key={change.id} className="border-b border-[#FFF3EE]"><td className="px-3 py-3 font-bold">{change.invoiceNo || "-"}</td><td className="px-3 py-3"><span className="inline-flex items-center gap-2"><span>{change.fromStatus}</span><ArrowRight size={14} className="text-[#F38978]" /><strong>{change.toStatus}</strong></span></td><td className="whitespace-nowrap px-3 py-3 text-[#7b6660]">{formatDateTime(change.changedOn)}</td><td className="whitespace-nowrap px-3 py-3 text-right font-semibold">{formatCurrency(change.amount)}</td></tr>)}</tbody>
                </table>
              </div>
            ) : <p className="rounded-xl border border-dashed border-[#f0c9bf] bg-[#fff8f5] p-8 text-center text-sm text-[#7b6660]">No status changes found for this range.</p>}
            <div className="mt-4"><ErrorAwareLink to={`${performancePath}/status-changes?range=${encodeURIComponent(changesState.range)}${changesState.range === "custom" ? `&startDate=${changesState.custom.startDate}&endDate=${changesState.custom.endDate}` : ""}`}>View All</ErrorAwareLink></div>
          </SectionState>
        </Card>
      </div>
    </div>
  );
}
