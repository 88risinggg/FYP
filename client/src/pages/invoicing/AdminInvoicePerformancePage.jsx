import {
  ChevronRight,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  MoreHorizontal,
  RefreshCw
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import {
  exportInvoicePerformance,
  fetchInvoicePerformance
} from "../../services/adminDashboardService.js";

const basePath = "/dashboard/invoicing/admin";
const invoiceListPath = `${basePath}/invoices`;
const approvedStatuses = ["Draft", "Sent", "Viewed", "Paid", "Overdue"];
const statusColors = {
  Draft: "#9b8b84",
  Sent: "#4F8FD8",
  Viewed: "#35A69B",
  Paid: "#4FB783",
  Overdue: "#F38978"
};
const statusBadgeClasses = {
  Draft: "bg-[#f2eee9] text-[#6f5b55]",
  Sent: "bg-[#eaf2ff] text-[#3269a8]",
  Viewed: "bg-[#e7f7f5] text-[#218178]",
  Paid: "bg-[#e9f7ef] text-[#2f8758]",
  Overdue: "bg-[#fff0eb] text-[#c94c3a]"
};
const rangeOptions = [
  { value: "today", label: "Today" },
  { value: "last-7-days", label: "Last 7 Days" },
  { value: "last-30-days", label: "Last 30 Days" },
  { value: "last-90-days", label: "Last 90 Days" },
  { value: "this-month", label: "This Month" },
  { value: "this-quarter", label: "This Quarter" },
  { value: "this-year", label: "This Year" },
  { value: "all-time", label: "All Time" },
  { value: "custom", label: "Custom Range" }
];

const widgetDefaultRanges = {
  status: "all-time",
  activity: "last-30-days",
  paidVsOverdue: "all-time",
  pdf: "all-time",
  excel: "all-time",
  statusChanges: "all-time"
};
function formatCount(value) {
  return new Intl.NumberFormat("en-SG").format(Number(value || 0));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD"
  }).format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-SG", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Singapore"
  }).format(new Date(value));
}

function formatFullDate(value) {
  if (!value) return "No invoice data";

  return new Intl.DateTimeFormat("en-SG", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Singapore"
  }).format(new Date(value));
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoDate(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function statusQuery(status) {
  return `${invoiceListPath}?status=${status.toLowerCase()}`;
}

function rangeLabel(value) {
  return rangeOptions.find((option) => option.value === value)?.label || "Last 30 Days";
}

function RangeSelect({ value, onChange, ariaLabel }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={ariaLabel}
      className="rounded-lg border border-[#f0d2ca] bg-white px-3 py-1.5 text-xs font-semibold text-[#251E1F] outline-none transition focus:border-[#F38978]"
    >
      {rangeOptions.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}

function Panel({ title, action, children, className = "" }) {
  return (
    <section className={`rounded-xl border border-[#f0d2ca] bg-white/95 p-5 shadow-[0_10px_28px_rgba(37,30,31,0.06)] ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h3 className="text-[15px] font-bold text-[#251E1F]">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ children = "No invoice performance data found for this date range." }) {
  return (
    <div className="rounded-xl border border-dashed border-[#f0c9bf] bg-[#fff8f5] px-5 py-8 text-center text-sm text-[#7b6660]">
      {children}
    </div>
  );
}

function StatusBadge({ status }) {
  const normalized = approvedStatuses.includes(status) ? status : "Draft";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusBadgeClasses[normalized]}`}>
      {normalized}
    </span>
  );
}

function DonutChart({ statuses, total, onStatusClick }) {
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center">
      <div className="relative mx-auto h-56 w-56">
        <svg viewBox="0 0 160 160" className="h-full w-full">
          <circle cx="80" cy="80" r={radius} fill="none" stroke="#f5e3dd" strokeWidth="20" />
          {statuses.map((item) => {
            const segment = total > 0 ? (Number(item.count || 0) / total) * circumference : 0;
            const dashOffset = -offset;
            offset += segment;

            return (
              <circle
                key={item.status}
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={statusColors[item.status]}
                strokeWidth="20"
                strokeDasharray={`${segment} ${circumference - segment}`}
                strokeDashoffset={dashOffset}
                strokeLinecap="butt"
                className={segment > 0 ? "cursor-pointer transition opacity-95 hover:opacity-75" : ""}
                transform="rotate(-90 80 80)"
                onClick={() => segment > 0 && onStatusClick(item.status)}
              >
                <title>{`${item.status}: ${formatCount(item.count)} (${item.percentage}%)`}</title>
              </circle>
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-bold text-[#251E1F]">{formatCount(total)}</span>
          <span className="mt-1 text-xs font-semibold text-[#7b6660]">Total Invoices</span>
        </div>
      </div>

      <div className="space-y-2">
        {statuses.map((item) => (
          <button
            key={item.status}
            type="button"
            onClick={() => onStatusClick(item.status)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-[#fff8f5]"
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: statusColors[item.status] }}
            />
            <span className="min-w-0 flex-1 text-sm font-semibold text-[#251E1F]">{item.status}</span>
            <span className="text-sm font-bold text-[#251E1F]">{formatCount(item.count)}</span>
            <span className="w-14 text-right text-xs font-semibold text-[#7b6660]">{item.percentage}%</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ActivityLineChart({ data, mode }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  if (!data.length) {
    return <EmptyState>No invoice data</EmptyState>;
  }

  const width = 760;
  const height = 260;
  const padding = { top: 18, right: 24, bottom: 42, left: 72 };
  const metricKey = mode === "revenue" ? "revenue" : "invoiceCount";
  const maxValue = Math.max(...data.map((item) => Number(item[metricKey] || 0)), 1);
  const points = data.map((item, index) => {
    const x = data.length === 1
      ? width / 2
      : padding.left + (index / (data.length - 1)) * (width - padding.left - padding.right);
    const y = padding.top + (1 - Number(item[metricKey] || 0) / maxValue) * (height - padding.top - padding.bottom);
    return { ...item, x, y };
  });
  const path = points.map((point) => `${point.x},${point.y}`).join(" ");
  const gridValues = [0, 0.25, 0.5, 0.75, 1];
  const activePoint = hoveredPoint === null ? null : points[hoveredPoint];

  function yAxisLabel(value) {
    return mode === "revenue" ? formatCurrency(value) : formatCount(value);
  }

  function handlePointerMove(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const pointerX = ((event.clientX - rect.left) / rect.width) * width;
    const nearestIndex = points.reduce((nearest, point, index) => {
      const nearestDistance = Math.abs(points[nearest].x - pointerX);
      const pointDistance = Math.abs(point.x - pointerX);
      return pointDistance < nearestDistance ? index : nearest;
    }, 0);
    const tooltipWidth = 190;
    const tooltipHeight = mode === "revenue" ? 112 : 88;
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;

    setHoveredPoint(nearestIndex);
    setTooltipPosition({
      x: Math.min(Math.max(localX + 14, 8), Math.max(rect.width - tooltipWidth, 8)),
      y: Math.min(Math.max(localY + 14, 8), Math.max(rect.height - tooltipHeight, 8))
    });
  }

  return (
    <div className="relative overflow-x-auto" onMouseLeave={() => setHoveredPoint(null)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="min-h-[260px] w-full min-w-[620px]"
        onMouseMove={handlePointerMove}
      >
        {gridValues.map((value) => {
          const y = padding.top + (1 - value) * (height - padding.top - padding.bottom);
          return (
            <g key={value}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#f3ddd6" />
              <text x={padding.left - 10} y={y + 4} textAnchor="end" className="fill-[#7b6660] text-[11px]">
                {yAxisLabel(maxValue * value)}
              </text>
            </g>
          );
        })}
        <polyline fill="none" stroke="#4F7DE8" strokeWidth="3" points={path} />
        {activePoint ? (
          <line
            x1={activePoint.x}
            x2={activePoint.x}
            y1={padding.top}
            y2={height - padding.bottom}
            stroke="#b9c9f5"
            strokeDasharray="4 4"
          />
        ) : null}
        {points.map((point, index) => (
          <g key={`${point.period}-${index}`}>
            <circle
              cx={point.x}
              cy={point.y}
              r={hoveredPoint === index ? "7" : "4.5"}
              fill="#2563eb"
              stroke="#fff"
              strokeWidth="2"
              className="transition-all duration-150"
            />
            {(index === 0 || index === points.length - 1 || index % Math.ceil(points.length / 5) === 0) ? (
              <text x={point.x} y={height - 16} textAnchor="middle" className="fill-[#7b6660] text-[11px]">
                {point.period}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
      {activePoint ? (
        <div
          className="pointer-events-none absolute z-20 rounded-lg border border-[#ead3cc] bg-white px-3 py-2 text-xs shadow-xl shadow-[#251E1F]/10 transition-opacity duration-150"
          style={{ left: tooltipPosition.x, top: tooltipPosition.y, width: 190 }}
        >
          {Number(activePoint.invoiceCount || 0) > 0 ? (
            <>
              <p className="font-bold text-[#251E1F]">{formatFullDate(activePoint.fullDate)}</p>
              {activePoint.time ? <p className="mt-1 text-[#7b6660]">{activePoint.time}</p> : null}
              <p className="mt-2 font-semibold text-[#251E1F]">
                Invoices: {formatCount(activePoint.invoiceCount)}
              </p>
              {mode === "revenue" ? (
                <p className="mt-1 font-semibold text-[#251E1F]">
                  Revenue: {formatCurrency(activePoint.revenue)}
                </p>
              ) : null}
            </>
          ) : (
            <p className="font-semibold text-[#7b6660]">No invoice data</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SummaryAction({ to, children }) {
  return (
    <Link
      to={to}
      className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-[#F38978] transition hover:text-[#d86150]"
    >
      {children}
      <ChevronRight size={14} />
    </Link>
  );
}

function TrendControls({ range, mode, onRangeChange, onModeChange }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <RangeSelect value={range} onChange={onRangeChange} ariaLabel="Invoice activity trend range" />
      <div className="inline-flex rounded-lg border border-[#f0d2ca] bg-[#fff8f5] p-1">
        {["count", "revenue"].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onModeChange(item)}
            className={`rounded-md px-3 py-1 text-xs font-bold transition ${
              mode === item
                ? "bg-white text-[#2563eb] shadow-sm"
                : "text-[#7b6660] hover:text-[#251E1F]"
            }`}
          >
            {item === "count" ? "Count" : "Revenue"}
          </button>
        ))}
      </div>
    </div>
  );
}

function PaidVsOverdueCard({ data, range, onRangeChange }) {
  const total = Number(data.paidAmount || 0) + Number(data.overdueAmount || 0);
  const paidWidth = total > 0 ? (Number(data.paidAmount || 0) / total) * 100 : 0;

  return (
    <Panel
      title="Paid vs Overdue"
      action={<RangeSelect value={range} onChange={onRangeChange} ariaLabel="Paid vs Overdue range" />}
    >
      <div className="space-y-4">
        <div>
          <div className="flex justify-between gap-3 text-sm">
            <span className="font-semibold text-[#251E1F]">Paid</span>
            <span className="text-[#7b6660]">{formatCount(data.paidCount)} invoices</span>
          </div>
          <p className="mt-1 text-lg font-bold text-[#251E1F]">{formatCurrency(data.paidAmount)}</p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#fff0eb]">
          <div className="h-full rounded-full bg-[#4FB783]" style={{ width: `${paidWidth}%` }} />
        </div>
        <div>
          <div className="flex justify-between gap-3 text-sm">
            <span className="font-semibold text-[#251E1F]">Overdue</span>
            <span className="text-[#7b6660]">{formatCount(data.overdueCount)} invoices</span>
          </div>
          <p className="mt-1 text-lg font-bold text-[#251E1F]">{formatCurrency(data.overdueAmount)}</p>
        </div>
      </div>
      <SummaryAction to={`${basePath}/reports?section=invoice-performance&compare=paid-overdue`}>
        View details
      </SummaryAction>
    </Panel>
  );
}

function GeneratedCard({ title, value, percent, label, icon: Icon, to, range, onRangeChange }) {
  return (
    <Panel
      title={title}
      action={<RangeSelect value={range} onChange={onRangeChange} ariaLabel={`${title} range`} />}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-3xl font-bold text-[#251E1F]">{formatCount(value)}</p>
          <p className="mt-1 text-sm font-semibold text-[#7b6660]">{label}</p>
          <p className="mt-3 text-sm text-[#7b6660]">{Number(percent || 0).toFixed(1)}% of total invoices</p>
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#F38978]/15 text-[#F38978]">
          <Icon size={21} />
        </span>
      </div>
      <SummaryAction to={to}>View report</SummaryAction>
    </Panel>
  );
}

function StatusChangeSummaryCard({ items, range, onRangeChange, onViewAll }) {
  return (
    <Panel
      title="Recent Status Changes"
      action={<RangeSelect value={range} onChange={onRangeChange} ariaLabel="Recent status changes range" />}
    >
      {items.length ? (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={`${item.from}-${item.to}`} className="flex items-center gap-2 rounded-lg bg-[#fff8f5] px-3 py-2 text-sm">
              <span className="font-semibold text-[#251E1F]">{item.from}</span>
              <ChevronRight size={14} className="text-[#F38978]" />
              <span className="min-w-0 flex-1 font-semibold text-[#251E1F]">{item.to}</span>
              <span className="font-bold text-[#251E1F]">{formatCount(item.count)}</span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState>No status movement records found.</EmptyState>
      )}
      <button
        type="button"
        onClick={onViewAll}
        className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-[#F38978] transition hover:text-[#d86150]"
      >
        View all
        <ChevronRight size={14} />
      </button>
    </Panel>
  );
}

function StatusChangeActionMenu({ change }) {
  const invoiceTarget = change.invoiceId
    ? `${invoiceListPath}/${change.invoiceId}`
    : `${invoiceListPath}?keyword=${encodeURIComponent(change.invoiceNo || "")}`;
  const historyTarget = change.invoiceId
    ? `${invoiceListPath}/${change.invoiceId}/status-history`
    : `${basePath}/audit-logs?activityType=Invoice&keyword=${encodeURIComponent(change.invoiceNo || "")}`;

  return (
    <details className="relative">
      <summary className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg border border-[#ead3cc] bg-white text-[#514440] transition hover:border-[#F38978] hover:text-[#F38978]">
        <MoreHorizontal size={16} />
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-52 rounded-lg border border-[#ead3cc] bg-white p-2 text-sm shadow-xl shadow-[#251E1F]/10">
        <Link className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-[#fff8f5]" to={invoiceTarget}>
          <Eye size={15} /> View Invoice
        </Link>
        <Link className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-[#fff8f5]" to={`${basePath}/audit-logs?activityType=Invoice&keyword=${encodeURIComponent(change.invoiceNo || change.invoiceId || "")}`}>
          <FileText size={15} /> View Audit Log
        </Link>
        <Link className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-[#fff8f5]" to={historyTarget}>
          <RefreshCw size={15} /> View Status History
        </Link>
      </div>
    </details>
  );
}

function StatusChangesTable({ changes }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-y border-[#f0d2ca] bg-[#fff8f5] text-xs uppercase text-[#7b6660]">
            <th className="px-4 py-3">Invoice #</th>
            <th className="px-4 py-3">Customer</th>
            <th className="px-4 py-3">From</th>
            <th className="px-4 py-3">To</th>
            <th className="px-4 py-3">Changed On</th>
            <th className="px-4 py-3">Amount</th>
            <th className="px-4 py-3">Changed By</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {changes.length ? changes.map((change) => (
            <tr key={change.id || `${change.invoiceNo}-${change.changedOn}`} className="border-b border-[#f4ded7] transition hover:bg-[#fff8f5]">
              <td className="whitespace-nowrap px-4 py-3 font-bold text-[#251E1F]">
                <Link to={change.invoiceId ? `${invoiceListPath}/${change.invoiceId}` : `${invoiceListPath}?keyword=${encodeURIComponent(change.invoiceNo || "")}`}>
                  {change.invoiceNo || "-"}
                </Link>
              </td>
              <td className="px-4 py-3 text-[#514440]">{change.customerName || "-"}</td>
              <td className="px-4 py-3"><StatusBadge status={change.fromStatus} /></td>
              <td className="px-4 py-3"><StatusBadge status={change.toStatus} /></td>
              <td className="whitespace-nowrap px-4 py-3 text-[#514440]">{formatDateTime(change.changedOn)}</td>
              <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#251E1F]">{formatCurrency(change.amount)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-[#514440]">{change.changedBy || "System"}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end">
                  <StatusChangeActionMenu change={change} />
                </div>
              </td>
            </tr>
          )) : (
            <tr>
              <td colSpan="8" className="px-4 py-10">
                <EmptyState>No status changes found for this date range.</EmptyState>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <section className="-m-4 min-h-[calc(100vh-5rem)] p-4 text-[#251E1F] sm:-m-6 sm:p-6">
      <div className="mx-auto max-w-[1600px] space-y-4">
        {[80, 330, 190, 360].map((height, index) => (
          <div
            key={height}
            className="animate-pulse rounded-xl border border-[#f0d2ca] bg-white/70"
            style={{ height: index === 2 ? undefined : height }}
          >
            {index === 2 ? <div className="grid gap-4 p-0 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-48 rounded-xl bg-white/70" />)}</div> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function AdminInvoicePerformancePage() {
  const navigate = useNavigate();
  const tableRef = useRef(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRange = rangeOptions.some((option) => option.value === searchParams.get("range"))
    ? searchParams.get("range")
    : "last-30-days";
  const [range, setRange] = useState(initialRange);
  const [customRange, setCustomRange] = useState({
    startDate: daysAgoDate(29),
    endDate: todayDate()
  });
  const [widgetRanges, setWidgetRanges] = useState(widgetDefaultRanges);
  const [trendMode, setTrendMode] = useState("count");
  const [performance, setPerformance] = useState(null);
  const [performanceByRange, setPerformanceByRange] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  function rangeFilters(selectedRange) {
    return selectedRange === "custom" ? customRange : {};
  }

  function rangeKey(selectedRange) {
    const filters = rangeFilters(selectedRange);
    return selectedRange === "custom"
      ? `${selectedRange}:${filters.startDate}:${filters.endDate}`
      : selectedRange;
  }

  async function loadPerformance(nextRange = range, isRefresh = false) {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const data = await fetchInvoicePerformance(nextRange, rangeFilters(nextRange));
      setPerformance(data);
      setPerformanceByRange((items) => ({
        ...items,
        [rangeKey(nextRange)]: data
      }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    async function loadInitialData() {
      setLoading(true);
      setError("");

      try {
        const rangesToLoad = [...new Set([initialRange, ...Object.values(widgetDefaultRanges)])];
        const responses = await Promise.all(
          rangesToLoad.map((item) => fetchInvoicePerformance(item, rangeFilters(item)))
        );
        const nextData = {};

        rangesToLoad.forEach((item, index) => {
          nextData[rangeKey(item)] = responses[index];
        });

        setPerformance(nextData[rangeKey(initialRange)] || responses[0]);
        setPerformanceByRange(nextData);
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleRangeChange(nextRange) {
    setRange(nextRange);
    setSearchParams({ range: nextRange });
    setWidgetRanges({
      status: nextRange,
      activity: nextRange,
      paidVsOverdue: nextRange,
      pdf: nextRange,
      excel: nextRange,
      statusChanges: nextRange
    });
    loadPerformance(nextRange, true);
  }

  function handleWidgetRangeChange(widget, nextRange) {
    setWidgetRanges((items) => ({
      ...items,
      [widget]: nextRange
    }));

    if (!performanceByRange[rangeKey(nextRange)]) {
      loadPerformance(nextRange, true);
    }
  }

  function updateCustomRange(field, value) {
    setCustomRange((items) => ({
      ...items,
      [field]: value
    }));
  }

  useEffect(() => {
    if (range === "custom" || Object.values(widgetRanges).includes("custom")) {
      loadPerformance("custom", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customRange.startDate, customRange.endDate]);

  async function handleExport() {
    setExporting(true);
    setError("");

    try {
      const blob = await exportInvoicePerformance(range, rangeFilters(range));
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `invoice-performance-${range}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setExporting(false);
    }
  }

  const selectedData = (widget) => performanceByRange[rangeKey(widgetRanges[widget])] || performance || {};
  const statusPerformance = selectedData("status");
  const activityPerformance = selectedData("activity");
  const paidPerformance = selectedData("paidVsOverdue");
  const pdfPerformance = selectedData("pdf");
  const excelPerformance = selectedData("excel");
  const statusChangesPerformance = selectedData("statusChanges");
  const invoiceStatus = statusPerformance?.invoiceStatus || {
    total: 0,
    statuses: approvedStatuses.map((status) => ({ status, count: 0, percentage: 0 }))
  };
  const statusData = useMemo(() => {
    const byStatus = (invoiceStatus.statuses || []).reduce((items, item) => {
      items[item.status] = item;
      return items;
    }, {});

    return approvedStatuses.map((status) => ({
      status,
      count: Number(byStatus[status]?.count || 0),
      percentage: Number(byStatus[status]?.percentage || 0)
    }));
  }, [invoiceStatus.statuses]);
  const hasAnyData = Number(invoiceStatus.total || 0) > 0 ||
    Number(paidPerformance?.paidVsOverdue?.paidCount || 0) > 0 ||
    Number(paidPerformance?.paidVsOverdue?.overdueCount || 0) > 0 ||
    (activityPerformance?.invoiceActivityTrend || activityPerformance?.revenueTrend || []).length > 0 ||
    (statusChangesPerformance?.recentStatusChanges || []).length > 0;
  const hasCustomSelection = range === "custom" || Object.values(widgetRanges).includes("custom");

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <section
      className="-m-4 min-h-[calc(100vh-5rem)] p-4 text-[#251E1F] sm:-m-6 sm:p-6"
      style={{
        backgroundImage:
          "linear-gradient(90deg, #FDD9CD 0%, #fff8f5 15%, #fffaf8 58%, #FDD9CD 100%)"
      }}
    >
      <div className="mx-auto max-w-[1600px] space-y-4">
        <div className="flex flex-col gap-4 border-b border-[#f0d2ca] bg-white/40 pb-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-normal text-[#251E1F]">Invoice Performance</h2>
            <p className="mt-1 text-sm text-[#6f5b55]">
              Track invoice health, revenue, and status movement.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              value={range}
              onChange={(event) => handleRangeChange(event.target.value)}
              className="rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-sm font-semibold text-[#251E1F] outline-none transition focus:border-[#F38978]"
            >
              {rangeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {hasCustomSelection ? (
              <>
                <input
                  type="date"
                  value={customRange.startDate}
                  onChange={(event) => updateCustomRange("startDate", event.target.value)}
                  className="rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-sm font-semibold text-[#251E1F] outline-none transition focus:border-[#F38978]"
                />
                <input
                  type="date"
                  value={customRange.endDate}
                  onChange={(event) => updateCustomRange("endDate", event.target.value)}
                  className="rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-sm font-semibold text-[#251E1F] outline-none transition focus:border-[#F38978]"
                />
              </>
            ) : null}
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="primary-button inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold disabled:cursor-wait disabled:opacity-70"
            >
              <Download size={16} />
              {exporting ? "Exporting" : "Export"}
            </button>
          </div>
        </div>

        {error ? (
          <div className="flex flex-col gap-3 rounded-xl border border-[#F38978]/30 bg-white px-4 py-3 text-sm font-semibold text-[#b64d3b] sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => loadPerformance(range, true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#f0d2ca] bg-[#fff8f5] px-3 py-2 text-[#251E1F] hover:bg-white"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              Retry
            </button>
          </div>
        ) : null}

        {!hasAnyData && !error ? <EmptyState /> : null}

        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <Panel
            title="Invoice Status"
            action={
              <RangeSelect
                value={widgetRanges.status}
                onChange={(nextRange) => handleWidgetRangeChange("status", nextRange)}
                ariaLabel="Invoice status range"
              />
            }
          >
            <DonutChart
              statuses={statusData}
              total={Number(invoiceStatus.total || 0)}
              onStatusClick={(status) => navigate(statusQuery(status))}
            />
          </Panel>

          <Panel
            title="Invoice Activity Trend"
            action={
              <TrendControls
                range={widgetRanges.activity}
                mode={trendMode}
                onRangeChange={(nextRange) => handleWidgetRangeChange("activity", nextRange)}
                onModeChange={setTrendMode}
              />
            }
          >
            <ActivityLineChart
              data={activityPerformance?.invoiceActivityTrend || activityPerformance?.revenueTrend || []}
              mode={trendMode}
            />
          </Panel>
        </div>

        <div className="grid gap-4 xl:grid-cols-4">
          <PaidVsOverdueCard
            data={paidPerformance?.paidVsOverdue || {}}
            range={widgetRanges.paidVsOverdue}
            onRangeChange={(nextRange) => handleWidgetRangeChange("paidVsOverdue", nextRange)}
          />
          <GeneratedCard
            title="PDF Generated"
            value={pdfPerformance?.documentGeneration?.pdfGenerated}
            percent={pdfPerformance?.documentGeneration?.pdfGeneratedPercentage}
            label="PDFs Generated"
            icon={FileText}
            to={`${basePath}/reports?section=document-generation&type=pdf`}
            range={widgetRanges.pdf}
            onRangeChange={(nextRange) => handleWidgetRangeChange("pdf", nextRange)}
          />
          <GeneratedCard
            title="Excel Generated"
            value={excelPerformance?.documentGeneration?.excelGenerated}
            percent={excelPerformance?.documentGeneration?.excelGeneratedPercentage}
            label="Excel Files Generated"
            icon={FileSpreadsheet}
            to={`${basePath}/reports?section=document-generation&type=excel`}
            range={widgetRanges.excel}
            onRangeChange={(nextRange) => handleWidgetRangeChange("excel", nextRange)}
          />
          <StatusChangeSummaryCard
            items={statusChangesPerformance?.recentStatusChangeSummary || []}
            range={widgetRanges.statusChanges}
            onRangeChange={(nextRange) => handleWidgetRangeChange("statusChanges", nextRange)}
            onViewAll={() => navigate(`${basePath}/audit-logs?activityType=Invoice&keyword=status`)}
          />
        </div>

        {performance?.notes?.length ? (
          <div className="rounded-xl border border-[#f0d2ca] bg-white/80 px-4 py-3 text-xs font-semibold text-[#7b6660]">
            {performance.notes.join(" ")}
          </div>
        ) : null}

        <div ref={tableRef}>
          <Panel
            title="Recent Status Changes"
            action={
              <Link
                to={`${basePath}/audit-logs?activityType=Invoice&keyword=status`}
                className="text-xs font-bold text-[#F38978]"
              >
                View all status changes
              </Link>
            }
          >
            <StatusChangesTable changes={statusChangesPerformance?.recentStatusChanges || []} />
          </Panel>
        </div>
      </div>
    </section>
  );
}
