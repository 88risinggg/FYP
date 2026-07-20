import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  History,
  RotateCcw,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { fetchInvoicePerformance } from "../../services/adminDashboardService.js";

const performancePath = "/dashboard/invoicing/admin/dashboard/invoice-performance";
const ranges = [
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
const rangeValues = new Set(ranges.map(([value]) => value));
const countSeries = [
  { key: "createdCount", label: "Created", color: "#2563eb", dash: "" },
  { key: "sentCount", label: "Sent", color: "#0f9f8f", dash: "8 5" },
  { key: "paidCount", label: "Paid", color: "#e66f5c", dash: "3 4" }
];
const valueSeries = [
  { key: "invoicedAmount", label: "Invoiced Amount", color: "#2563eb", dash: "" },
  { key: "paidAmount", label: "Paid Amount", color: "#0f9f8f", dash: "8 5" },
  { key: "overdueAmount", label: "Overdue Amount", color: "#e66f5c", dash: "3 4" }
];

function isoDate(daysAgo = 0) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function number(value) {
  return new Intl.NumberFormat("en-SG").format(Number(value || 0));
}

function currency(value) {
  return new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" }).format(Number(value || 0));
}

function readablePeriod(point, grouping) {
  if (!point) return "";
  const source = String(point.bucketKey || point.fullDate || "");
  const date = new Date(source.length === 10 ? `${source}T00:00:00` : source);
  if (Number.isNaN(date.getTime())) return point.period || "Period";
  const day = (value) => new Intl.DateTimeFormat("en-SG", {
    weekday: "short", day: "numeric", month: "short", year: "numeric"
  }).format(value);

  if (grouping === "hour") {
    return new Intl.DateTimeFormat("en-SG", {
      weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit"
    }).format(date);
  }
  if (grouping === "week") {
    const end = new Date(date);
    end.setDate(end.getDate() + 6);
    return `${day(date)} - ${day(end)}`;
  }
  if (grouping === "month") {
    return new Intl.DateTimeFormat("en-SG", { month: "long", year: "numeric" }).format(date);
  }
  return day(date);
}

function defaultSize(range, pointCount) {
  if (pointCount <= 2) return pointCount;
  const preferred = {
    today: 12,
    "last-7-days": 7,
    "last-30-days": 14,
    "last-90-days": 5,
    "this-month": 14,
    "this-quarter": 5,
    "this-year": 6,
    "all-time": 12,
    custom: Math.min(30, Math.max(8, Math.ceil(pointCount / 3)))
  }[range] || 12;
  return Math.min(pointCount, Math.max(2, preferred));
}

function groupingFor(range, metadata) {
  if (metadata) return metadata;
  if (range === "today") return "hour";
  if (["last-90-days", "this-quarter"].includes(range)) return "week";
  if (["this-year", "all-time"].includes(range)) return "month";
  return "day";
}

function controlClass(disabled) {
  return `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 ${
    disabled
      ? "cursor-not-allowed border-[#eaded9] bg-[#f7f3f1] text-[#ad9e99]"
      : "border-[#f0d2ca] bg-white text-[#514440] hover:border-[#F38978] hover:text-[#251E1F]"
  }`;
}

function TrendChart({ data, mode, grouping, viewport, setViewport }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const [tip, setTip] = useState({ x: 0, y: 0 });
  const drag = useRef(null);
  const pointers = useRef(new Map());
  const pinch = useRef(null);
  const navigatorDrag = useRef(null);
  const navigatorRef = useRef(null);
  const width = 1100;
  const height = 430;
  const padding = { top: 25, right: 30, bottom: 52, left: 92 };
  const visible = data.slice(viewport.start, viewport.end);
  const series = mode === "count" ? countSeries : valueSeries;
  const max = Math.max(1, ...visible.flatMap((point) => series.map((item) => Number(point[item.key] || 0))));
  const xFor = (index) => visible.length <= 1
    ? (padding.left + width - padding.right) / 2
    : padding.left + index * (width - padding.left - padding.right) / (visible.length - 1);
  const yFor = (value) => padding.top + (1 - Number(value || 0) / max) * (height - padding.top - padding.bottom);
  const clampViewport = useCallback((start, end) => {
    const minimum = Math.min(2, data.length);
    const size = Math.max(minimum, Math.min(data.length, end - start));
    const nextStart = Math.max(0, Math.min(data.length - size, start));
    setViewport({ start: nextStart, end: nextStart + size });
  }, [data.length, setViewport]);

  function pointerIndex(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * width;
    return visible.reduce((nearest, _, index) => (
      Math.abs(xFor(index) - x) < Math.abs(xFor(nearest) - x) ? index : nearest
    ), 0);
  }

  function onPointerDown(event) {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const [first, second] = [...pointers.current.values()];
      pinch.current = {
        distance: Math.hypot(second.x - first.x, second.y - first.y),
        viewport: { ...viewport }
      };
      drag.current = null;
      return;
    }
    drag.current = { x: event.clientX, y: event.clientY, viewport: { ...viewport }, moved: false };
  }

  function onPointerMove(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (pointers.current.has(event.pointerId)) {
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    if (pointers.current.size === 2 && pinch.current) {
      const [first, second] = [...pointers.current.values()];
      const distance = Math.max(20, Math.hypot(second.x - first.x, second.y - first.y));
      const initialSize = pinch.current.viewport.end - pinch.current.viewport.start;
      const size = Math.max(2, Math.min(data.length, Math.round(initialSize * pinch.current.distance / distance)));
      const center = (pinch.current.viewport.start + pinch.current.viewport.end) / 2;
      clampViewport(Math.round(center - size / 2), Math.round(center + size / 2));
      return;
    }
    if (drag.current) {
      const dx = event.clientX - drag.current.x;
      const dy = event.clientY - drag.current.y;
      if (Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) {
        drag.current.moved = true;
        event.preventDefault();
        const size = drag.current.viewport.end - drag.current.viewport.start;
        const shift = Math.round((-dx / Math.max(rect.width, 1)) * size);
        clampViewport(drag.current.viewport.start + shift, drag.current.viewport.end + shift);
      }
    }
    const nearest = pointerIndex(event);
    setActiveIndex(nearest);
    setTip({
      x: Math.min(Math.max(event.clientX - rect.left + 14, 8), Math.max(rect.width - 225, 8)),
      y: Math.min(Math.max(event.clientY - rect.top + 14, 8), Math.max(rect.height - 170, 8))
    });
  }

  function endPointer(event) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    drag.current = null;
  }

  function onWheel(event) {
    if (!(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    const size = viewport.end - viewport.start;
    const nextSize = event.deltaY < 0 ? Math.max(2, size - Math.max(1, Math.ceil(size * 0.2))) : Math.min(data.length, size + Math.max(1, Math.ceil(size * 0.2)));
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(rect.width, 1)));
    const anchor = viewport.start + ratio * size;
    const start = Math.round(anchor - ratio * nextSize);
    clampViewport(start, start + nextSize);
  }

  function onNavigatorDown(event) {
    const rect = navigatorRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const index = ratio * data.length;
    const startDistance = Math.abs(index - viewport.start);
    const endDistance = Math.abs(index - viewport.end);
    const handleRange = Math.max(1, data.length * 0.025);
    const kind = startDistance <= handleRange ? "start" : endDistance <= handleRange ? "end" : index >= viewport.start && index <= viewport.end ? "move" : "jump";
    navigatorDrag.current = { kind, index, viewport: { ...viewport } };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    if (kind === "jump") {
      const size = viewport.end - viewport.start;
      clampViewport(Math.round(index - size / 2), Math.round(index + size / 2));
    }
  }

  function onNavigatorMove(event) {
    if (!navigatorDrag.current) return;
    const rect = navigatorRef.current.getBoundingClientRect();
    const index = Math.max(0, Math.min(data.length, ((event.clientX - rect.left) / rect.width) * data.length));
    const original = navigatorDrag.current.viewport;
    if (navigatorDrag.current.kind === "start") clampViewport(Math.round(index), original.end);
    if (navigatorDrag.current.kind === "end") clampViewport(original.start, Math.round(index));
    if (navigatorDrag.current.kind === "move") {
      const shift = Math.round(index - navigatorDrag.current.index);
      clampViewport(original.start + shift, original.end + shift);
    }
  }

  if (!data.length) {
    return <div className="rounded-xl border border-dashed border-[#f0c9bf] bg-[#fff8f5] px-5 py-16 text-center text-sm text-[#7b6660]">No invoice activity was found for this date range.</div>;
  }

  const active = activeIndex === null ? null : visible[activeIndex];
  const left = data.length ? viewport.start / data.length * 100 : 0;
  const selectedWidth = data.length ? (viewport.end - viewport.start) / data.length * 100 : 100;

  return (
    <div>
      <div className="relative select-none overflow-hidden rounded-xl border border-[#efd8d1] bg-white" onPointerLeave={() => setActiveIndex(null)}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="block min-h-[330px] w-full cursor-grab active:cursor-grabbing sm:min-h-[430px]"
          style={{ touchAction: "pan-y" }}
          role="img"
          aria-label={`Interactive invoice ${mode === "count" ? "count" : "value"} trend. Drag horizontally to navigate; use the controls for keyboard navigation.`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onWheel={onWheel}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
            const y = yFor(max * tick);
            return <g key={tick}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#f2ded8" />
              <text x={padding.left - 12} y={y + 4} textAnchor="end" className="fill-[#75625d] text-[12px]">
                {mode === "count" ? number(max * tick) : currency(max * tick)}
              </text>
            </g>;
          })}
          {series.map((item) => {
            const points = visible.map((point, index) => `${xFor(index)},${yFor(point[item.key])}`).join(" ");
            return <polyline key={item.key} fill="none" stroke={item.color} strokeWidth="3" strokeDasharray={item.dash} strokeLinejoin="round" strokeLinecap="round" points={points} />;
          })}
          {active ? <line x1={xFor(activeIndex)} x2={xFor(activeIndex)} y1={padding.top} y2={height - padding.bottom} stroke="#8ba8ec" strokeDasharray="5 4" /> : null}
          {visible.map((point, index) => (
            <g key={`${point.bucketKey}-${index}`}>
              {(index === 0 || index === visible.length - 1 || index % Math.max(1, Math.ceil(visible.length / 6)) === 0) ? (
                <text x={xFor(index)} y={height - 20} textAnchor="middle" className="fill-[#75625d] text-[11px]">{point.period}</text>
              ) : null}
              {activeIndex === index ? series.map((item) => <circle key={item.key} cx={xFor(index)} cy={yFor(point[item.key])} r="5" fill={item.color} stroke="white" strokeWidth="2" />) : null}
            </g>
          ))}
        </svg>
        {active ? <div className="pointer-events-none absolute z-20 w-[217px] rounded-lg border border-[#ead3cc] bg-white p-3 text-xs shadow-xl" style={{ left: tip.x, top: tip.y }}>
          <p className="font-bold text-[#251E1F]">{readablePeriod(active, grouping)}</p>
          <div className="mt-2 space-y-1.5">
            {series.map((item) => <p key={item.key} className="flex items-center justify-between gap-3 text-[#514440]"><span><span className="mr-2 inline-block h-0.5 w-4 align-middle" style={{ backgroundColor: item.color }} />{item.label}</span><strong className="text-[#251E1F]">{mode === "count" ? number(active[item.key]) : currency(active[item.key])}</strong></p>)}
          </div>
        </div> : null}
      </div>

      <div className="mt-4" aria-label="Visible date-range navigator">
        <div
          ref={navigatorRef}
          className="relative h-12 touch-none cursor-pointer rounded-lg border border-[#efd8d1] bg-[#fff8f5]"
          onPointerDown={onNavigatorDown}
          onPointerMove={onNavigatorMove}
          onPointerUp={() => { navigatorDrag.current = null; }}
          onPointerCancel={() => { navigatorDrag.current = null; }}
        >
          <div className="absolute inset-y-2 rounded-md border-2 border-[#F38978] bg-[#F38978]/15" style={{ left: `${left}%`, width: `${selectedWidth}%` }}>
            <span className="absolute inset-y-1 left-1 w-1 rounded bg-[#F38978]" />
            <span className="absolute inset-y-1 right-1 w-1 rounded bg-[#F38978]" />
          </div>
        </div>
        <div className="mt-1 flex justify-between text-xs font-semibold text-[#7b6660]"><span>{readablePeriod(data[0], grouping)}</span><span>{readablePeriod(data[data.length - 1], grouping)}</span></div>
      </div>
      <p className="mt-2 text-xs text-[#7b6660]">Drag or swipe the chart to move through time. Pinch, or hold Ctrl/Cmd while scrolling, to zoom.</p>
    </div>
  );
}

export default function AdminInvoiceActivityTrendPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRange = rangeValues.has(searchParams.get("range")) ? searchParams.get("range") : "last-90-days";
  const initialMode = ["value", "revenue"].includes(searchParams.get("mode")) ? "value" : "count";
  const [range, setRange] = useState(initialRange);
  const [mode, setMode] = useState(initialMode);
  const [custom, setCustom] = useState({
    startDate: searchParams.get("startDate") || isoDate(-89),
    endDate: searchParams.get("endDate") || isoDate()
  });
  const [data, setData] = useState([]);
  const [grouping, setGrouping] = useState(groupingFor(initialRange));
  const [viewport, setViewport] = useState({ start: 0, end: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestRef = useRef(null);
  const customError = range === "custom" && (!custom.startDate || !custom.endDate || custom.startDate > custom.endDate)
    ? "Choose a valid start and end date."
    : "";

  const filters = useMemo(() => (
    range === "custom"
      ? { ...custom, activityDetails: true, section: "activity" }
      : { activityDetails: true, section: "activity" }
  ), [range, custom]);

  const load = useCallback(async () => {
    if (customError) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError("");
    try {
      const response = await fetchInvoicePerformance(range, filters, { signal: controller.signal });
      if (controller.signal.aborted) return;
      const points = response.invoiceActivityTrend || [];
      setData(points);
      const nextGrouping = groupingFor(range, response.activityGrouping);
      setGrouping(nextGrouping);
      const size = defaultSize(range, points.length);
      setViewport({ start: Math.max(0, points.length - size), end: points.length });
    } catch (requestError) {
      if (!controller.signal.aborted) setError("Historical invoice activity could not be loaded. Your current chart data is still available.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [customError, filters, range]);

  useEffect(() => {
    load();
    return () => requestRef.current?.abort();
  }, [load]);

  function updateRange(nextRange) {
    setRange(nextRange);
    setSearchParams({ range: nextRange, mode, ...(nextRange === "custom" ? custom : {}) });
  }

  function updateMode(nextMode) {
    setMode(nextMode);
    setSearchParams({ range, mode: nextMode, ...(range === "custom" ? custom : {}) });
  }

  const size = viewport.end - viewport.start;
  const canEarlier = viewport.start > 0;
  const canLater = viewport.end < data.length;
  const canZoomIn = size > 2;
  const canZoomOut = size < data.length;
  const move = (direction) => {
    const amount = Math.max(1, Math.floor(size * 0.5));
    const start = Math.max(0, Math.min(data.length - size, viewport.start + direction * amount));
    setViewport({ start, end: start + size });
  };
  const zoom = (direction) => {
    const change = Math.max(1, Math.ceil(size * 0.25));
    const nextSize = direction < 0 ? Math.max(2, size - change) : Math.min(data.length, size + change);
    const center = (viewport.start + viewport.end) / 2;
    const start = Math.max(0, Math.min(data.length - nextSize, Math.round(center - nextSize / 2)));
    setViewport({ start, end: start + nextSize });
  };
  const reset = () => {
    const nextSize = defaultSize(range, data.length);
    setViewport({ start: Math.max(0, data.length - nextSize), end: data.length });
  };

  return (
    <main className="min-h-screen p-4 text-[#251E1F] sm:p-6" style={{ backgroundImage: "linear-gradient(90deg, #FDD9CD 0%, #fff8f5 15%, #fffaf8 58%, #FDD9CD 100%)" }}>
      <div className="mx-auto max-w-[1700px] space-y-4">
        <header className="flex flex-col gap-4 border-b border-[#f0d2ca] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link to={`${performancePath}?range=${range}`} className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-[#d86150] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"><ArrowLeft size={17} /> Back to Invoice Performance</Link>
            <h2 className="text-2xl font-bold">Invoice Activity Trend</h2>
            <p className="mt-1 text-sm text-[#6f5b55]">Explore real invoice, status-history, and payment activity within the selected date range.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="activity-range">Invoice activity date range</label>
            <select id="activity-range" value={range} onChange={(event) => updateRange(event.target.value)} className="min-h-11 rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[#F38978] focus:ring-2 focus:ring-[#2563eb]">{ranges.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <div className="inline-flex min-h-11 rounded-lg border border-[#f0d2ca] bg-[#fff8f5] p-1" aria-label="Trend measurement mode">
              {[["count", "Invoice Count"], ["value", "Invoice Value"]].map(([value, label]) => <button key={value} type="button" onClick={() => updateMode(value)} aria-pressed={mode === value} className={`rounded-md px-3 py-1.5 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] ${mode === value ? "bg-white text-[#2563eb] shadow-sm" : "text-[#7b6660]"}`}>{label}</button>)}
            </div>
          </div>
        </header>

        {range === "custom" ? <div className="flex flex-wrap gap-3 rounded-xl border border-[#f0d2ca] bg-white p-4">
          <label className="text-sm font-semibold">Start date <input type="date" value={custom.startDate} max={custom.endDate} onChange={(event) => setCustom((current) => ({ ...current, startDate: event.target.value }))} className="ml-2 min-h-11 rounded-lg border border-[#f0d2ca] px-3" /></label>
          <label className="text-sm font-semibold">End date <input type="date" value={custom.endDate} min={custom.startDate} max={isoDate()} onChange={(event) => setCustom((current) => ({ ...current, endDate: event.target.value }))} className="ml-2 min-h-11 rounded-lg border border-[#f0d2ca] px-3" /></label>
        </div> : null}

        {customError ? <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800" role="alert">{customError}</div> : null}

        <section className="rounded-xl border border-[#f0d2ca] bg-white/95 p-4 shadow-[0_10px_28px_rgba(37,30,31,0.06)] sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Chart legend">{(mode === "count" ? countSeries : valueSeries).map((item) => <span key={item.key} className="inline-flex items-center gap-2 text-sm font-bold text-[#514440]"><span className="h-0.5 w-6" style={{ backgroundColor: item.color }} />{item.label}</span>)}</div>
            {loading ? <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#7b6660]" role="status"><span className="h-4 w-4 animate-spin rounded-full border-2 border-[#F38978] border-t-transparent" /> Loading historical data...</span> : null}
          </div>

          {error ? <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#F38978]/30 bg-[#fff8f5] px-4 py-3 text-sm font-semibold text-[#a94738]" role="alert"><span>{error}</span><button type="button" onClick={load} className={controlClass(false)}>Retry</button></div> : null}

          <div className="mb-4 flex flex-wrap gap-2" aria-label="Chart navigation controls">
            <button type="button" disabled={!canEarlier} onClick={() => move(-1)} className={controlClass(!canEarlier)} aria-label="Move to earlier invoice periods"><ChevronLeft size={17} /> Earlier</button>
            <button type="button" disabled={!canLater} onClick={() => move(1)} className={controlClass(!canLater)} aria-label="Move to later invoice periods">Later <ChevronRight size={17} /></button>
            <button type="button" disabled={!canZoomIn} onClick={() => zoom(-1)} className={controlClass(!canZoomIn)} aria-label="Zoom in on invoice activity"><ZoomIn size={17} /> Zoom In</button>
            <button type="button" disabled={!canZoomOut} onClick={() => zoom(1)} className={controlClass(!canZoomOut)} aria-label="Zoom out from invoice activity"><ZoomOut size={17} /> Zoom Out</button>
            <button type="button" disabled={!data.length} onClick={reset} className={controlClass(!data.length)} aria-label="Reset chart to its default view"><RotateCcw size={17} /> Reset View</button>
            <button type="button" disabled={!canLater} onClick={() => setViewport({ start: Math.max(0, data.length - size), end: data.length })} className={controlClass(!canLater)} aria-label="Return chart to the latest invoice period"><History size={17} /> Return to Latest</button>
          </div>

          <TrendChart data={data} mode={mode} grouping={grouping} viewport={viewport} setViewport={setViewport} />
        </section>
      </div>
    </main>
  );
}
