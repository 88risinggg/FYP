import { AlertCircle, ArrowRight, ChevronRight, Loader2, Maximize2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { fetchInvoicePerformance } from "../../services/adminDashboardService.js";

const basePath = "/dashboard/invoicing/admin";
const performancePath = `${basePath}/dashboard/invoice-performance`;
const invoiceListPath = `${basePath}/invoices`;
const statuses = ["Draft", "Sent", "Viewed", "Paid", "Overdue"];
const statusColors = {
  Draft: "#8f7d77",
  Sent: "#4f8fd8",
  Viewed: "#35a69b",
  Paid: "#3f8f62",
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
    return <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{state.customError}</p>;
  }
  if (state.loading && !state.data) {
    return <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-[#7b6660]"><Loader2 className="animate-spin" size={18} /> Loading...</div>;
  }
  if (state.error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
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

function DonutChart({ data, onSelect }) {
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
          <button key={item.status} type="button" onClick={() => onSelect(item.status)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-[#fff8f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F38978]">
            <span className="h-3 w-3 rounded-full" style={{ background: statusColors[item.status] }} />
            <span className="flex-1 text-sm font-semibold">{item.status}</span>
            <strong className="text-sm">{formatCount(item.count)}</strong>
            <span className="w-14 text-right text-xs text-[#7b6660]">{item.percentage.toFixed(1)}%</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const activitySeries = [
  { key: "createdCount", label: "Created", color: "#4F7DE8" },
  { key: "sentCount", label: "Sent", color: "#35A69B" },
  { key: "paidCount", label: "Paid", color: "#F38978" }
];

function ActivityChart({ points }) {
  const [active, setActive] = useState(null);
  if (!points.length) return <p className="py-16 text-center text-sm text-[#7b6660]">No invoice activity found for this range.</p>;
  const width = 760;
  const height = 270;
  const pad = { left: 46, right: 18, top: 20, bottom: 44 };
  const max = Math.max(1, ...points.flatMap((point) => activitySeries.map((series) => Number(point[series.key] || 0))));
  const coordinates = (key) => points.map((point, index) => ({
    x: points.length === 1 ? width / 2 : pad.left + index / (points.length - 1) * (width - pad.left - pad.right),
    y: pad.top + (1 - Number(point[key] || 0) / max) * (height - pad.top - pad.bottom),
    point
  }));

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4" aria-label="Invoice activity legend">
        {activitySeries.map((series) => <span key={series.key} className="flex items-center gap-2 text-xs font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: series.color }} />{series.label}</span>)}
      </div>
      <div className="relative overflow-x-auto" onMouseLeave={() => setActive(null)}>
        <svg viewBox={`0 0 ${width} ${height}`} className="min-h-[250px] min-w-[620px] w-full" role="img" aria-label="Created, sent, and paid invoice activity over time">
          {[0, .25, .5, .75, 1].map((ratio) => {
            const y = pad.top + (1 - ratio) * (height - pad.top - pad.bottom);
            return <g key={ratio}><line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#f3ddd6" /><text x={pad.left - 8} y={y + 4} textAnchor="end" className="fill-[#7b6660] text-[10px]">{formatCount(max * ratio)}</text></g>;
          })}
          {active !== null ? <line x1={coordinates("createdCount")[active].x} x2={coordinates("createdCount")[active].x} y1={pad.top} y2={height - pad.bottom} stroke="#c9b9b3" strokeDasharray="4 4" /> : null}
          {activitySeries.map((series) => {
            const coords = coordinates(series.key);
            return <g key={series.key}><polyline fill="none" stroke={series.color} strokeWidth="3" points={coords.map((point) => `${point.x},${point.y}`).join(" ")} />{coords.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="5" fill={series.color} stroke="white" strokeWidth="2" onMouseEnter={() => setActive(index)}><title>{`${point.point.period}: ${series.label} ${formatCount(point.point[series.key])}`}</title></circle>)}</g>;
          })}
          {points.map((point, index) => (index === 0 || index === points.length - 1 || index % Math.max(1, Math.ceil(points.length / 5)) === 0) ? <text key={point.bucketKey || index} x={coordinates("createdCount")[index].x} y={height - 15} textAnchor="middle" className="fill-[#7b6660] text-[10px]">{point.period}</text> : null)}
        </svg>
        {active !== null ? (
          <div className="pointer-events-none absolute right-3 top-3 rounded-lg border border-[#ead3cc] bg-white p-3 text-xs shadow-xl">
            <strong>{points[active].period}</strong>
            {activitySeries.map((series) => <p key={series.key} className="mt-1" style={{ color: series.color }}>{series.label}: {formatCount(points[active][series.key])}</p>)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ErrorAwareLink({ to, children }) {
  return <Link to={to} className="inline-flex items-center gap-2 text-sm font-bold text-[#F38978] hover:text-[#d86150] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F38978]">{children}<ChevronRight size={15} /></Link>;
}

export default function AdminInvoicePerformancePage() {
  const navigate = useNavigate();
  const statusState = usePerformanceSection("status", "all-time");
  const activityState = usePerformanceSection("activity", "last-30-days");
  const paidState = usePerformanceSection("paid-vs-overdue", "all-time");
  const changesState = usePerformanceSection("status-changes", "all-time");

  const invoiceTarget = useCallback((status, sourceState) => {
    const params = new URLSearchParams({ status: status.toLowerCase(), range: sourceState.range });
    if (sourceState.range === "custom") {
      params.set("startDate", sourceState.custom.startDate);
      params.set("endDate", sourceState.custom.endDate);
    }
    return `${invoiceListPath}?${params}`;
  }, []);
  const activityPoints = activityState.data?.invoiceActivityTrend || [];
  const paid = paidState.data?.paidVsOverdue || { paidAmount: 0, overdueAmount: 0 };
  const maxAmount = Math.max(1, Number(paid.paidAmount || 0), Number(paid.overdueAmount || 0));
  const recentChanges = (changesState.data?.recentStatusChanges || []).slice(0, 5);
  const detailsParams = useMemo(() => {
    const params = new URLSearchParams({ range: activityState.range, mode: "count" });
    if (activityState.range === "custom") {
      params.set("startDate", activityState.custom.startDate);
      params.set("endDate", activityState.custom.endDate);
    }
    return params.toString();
  }, [activityState.custom, activityState.range]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-3xl font-bold text-[#251E1F]">Invoice Performance</h1>
        <p className="mt-1 text-sm text-[#7b6660]">Track invoice health, payment value, and status movement.</p>
      </header>

      <div className="grid gap-5 xl:grid-cols-[47fr_53fr]">
        <Card title="Invoice Status" controls={<RangeControl state={statusState} label="Invoice Status" />}>
          <SectionState state={statusState} emptyMessage="No invoices found for this range.">
            <DonutChart data={statusState.data?.invoiceStatus} onSelect={(status) => navigate(invoiceTarget(status, statusState))} />
          </SectionState>
        </Card>

        <Card title="Invoice Activity Trend" controls={<div className="flex items-center gap-2"><Link to={`${performancePath}/activity-trend?${detailsParams}`} aria-label="Open Invoice Activity Trend full screen" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#f0d2ca] text-[#7b6660] hover:border-[#F38978] hover:text-[#F38978]"><Maximize2 size={16} /></Link><RangeControl state={activityState} label="Invoice Activity Trend" /></div>}>
          <SectionState state={activityState} emptyMessage="No invoice activity found for this range.">
            <ActivityChart points={activityPoints} />
            <div className="mt-3"><ErrorAwareLink to={`${performancePath}/activity-trend?${detailsParams}`}>View Details</ErrorAwareLink></div>
          </SectionState>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[38fr_62fr]">
        <Card title="Paid vs Overdue" controls={<RangeControl state={paidState} label="Paid vs Overdue" />}>
          <SectionState state={paidState} emptyMessage="No paid or overdue amounts found for this range.">
            <div className="space-y-6">
              {[["Paid Amount", paid.paidAmount, "#55A978", "paid"], ["Overdue Amount", paid.overdueAmount, "#F38978", "overdue"]].map(([label, amount, color, status]) => (
                <button key={label} type="button" onClick={() => navigate(invoiceTarget(status, paidState))} className="block w-full rounded-xl p-2 text-left transition hover:bg-[#fff8f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F38978]">
                  <div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold">{label}</span><strong>{formatCurrency(amount)}</strong></div>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#f5e8e3]"><div className="h-full rounded-full" style={{ width: `${Number(amount || 0) / maxAmount * 100}%`, background: color }} /></div>
                </button>
              ))}
            </div>
          </SectionState>
        </Card>

        <Card title="Recent Status Changes" controls={<RangeControl state={changesState} label="Recent Status Changes" />}>
          <SectionState state={changesState} emptyMessage="No status changes found for this range.">
            {recentChanges.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead><tr className="border-y border-[#f0d2ca] bg-[#fff8f5] text-xs uppercase text-[#7b6660]"><th className="px-3 py-3">Invoice #</th><th className="px-3 py-3">Status Change</th><th className="px-3 py-3">Changed On</th><th className="px-3 py-3 text-right">Amount</th></tr></thead>
                  <tbody>{recentChanges.map((change) => <tr key={change.id} className="border-b border-[#f5e8e3]"><td className="px-3 py-3">{change.invoiceId ? <Link to={`${invoiceListPath}?invoiceId=${encodeURIComponent(change.invoiceId)}`} className="font-bold text-[#F38978] hover:underline">{change.invoiceNo || "-"}</Link> : <span className="font-bold">{change.invoiceNo || "-"}</span>}</td><td className="px-3 py-3"><span className="inline-flex items-center gap-2"><span>{change.fromStatus}</span><ArrowRight size={14} className="text-[#F38978]" /><strong>{change.toStatus}</strong></span></td><td className="whitespace-nowrap px-3 py-3 text-[#7b6660]">{formatDateTime(change.changedOn)}</td><td className="whitespace-nowrap px-3 py-3 text-right font-semibold">{formatCurrency(change.amount)}</td></tr>)}</tbody>
                </table>
              </div>
            ) : <p className="rounded-xl border border-dashed border-[#f0c9bf] bg-[#fff8f5] p-8 text-center text-sm text-[#7b6660]">No status changes found for this range.</p>}
            <div className="mt-4"><ErrorAwareLink to={`${performancePath}/status-changes?range=${encodeURIComponent(changesState.range)}${changesState.range === "custom" ? `&startDate=${changesState.custom.startDate}&endDate=${changesState.custom.endDate}` : ""}`}>View All Status Changes</ErrorAwareLink></div>
          </SectionState>
        </Card>
      </div>
    </div>
  );
}
