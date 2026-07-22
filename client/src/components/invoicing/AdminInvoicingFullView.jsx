import { ArrowLeft, Loader2, RefreshCw, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

export const ADMIN_INVOICING_BASE = "/dashboard/invoicing/admin";

export function displayValue(value) {
  return value === null || value === undefined || value === "" ? "\u2014" : value;
}

export function FullViewStatus({ value }) {
  const label = displayValue(value);
  const normalized = String(value || "").trim().toLowerCase();
  const className = ["successful", "success", "sent", "paid", "completed", "verified", "delivered", "accepted"].includes(normalized)
    ? "bg-[#FFF6F2] text-emerald-700"
    : ["failed", "rejected", "refunded", "chargeback", "bounced", "error"].includes(normalized)
      ? "bg-[#FDD9CD] text-rose-700"
      : ["partial success", "processing", "validated"].includes(normalized)
        ? "bg-[#FFF6F2] text-[#2D7C83]"
        : "bg-[#FDD9CD] text-amber-700";

  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${className}`}>{label}</span>;
}

export function ActiveFilters({ filters, labels = {} }) {
  const active = Object.entries(filters || {}).filter(([, value]) => value !== "" && value !== null && value !== undefined);
  if (!active.length) return <p className="text-xs text-[#7b6660]">No filters applied</p>;

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
      <span className="text-xs font-bold text-[#6f5b55]">Filtered by:</span>
      {active.map(([key, value]) => (
        <span key={key} className="inline-flex items-center gap-1 rounded-full border border-[#f0d2ca] bg-[#fff8f5] px-2.5 py-1 text-xs text-[#6f5b55]">
          {labels[key] || key}: {String(value)}
        </span>
      ))}
    </div>
  );
}

export function FullViewLoading({ label = "Loading records..." }) {
  return (
    <div className="space-y-3 p-5" role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-sm font-semibold text-[#6f5b55]"><Loader2 size={18} className="animate-spin" /> {label}</div>
      {[0, 1, 2, 3, 4].map((row) => <div key={row} className="h-11 animate-pulse rounded-md bg-[#fff8f5]" />)}
    </div>
  );
}

export function FullViewError({ message, onRetry, backTo, backLabel }) {
  const navigate = useNavigate();
  return (
    <div className="rounded-lg border border-[#FDD9CD] bg-[#FDD9CD] p-5 text-sm text-rose-800" role="alert">
      <p className="font-bold">{message || "The records could not be loaded."}</p>
      <p className="mt-1">Try again or return to the previous Invoicing page.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onRetry} className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 font-bold"><RefreshCw size={15} /> Retry</button>
        <button type="button" onClick={() => navigate(backTo)} className="inline-flex items-center gap-2 rounded-lg border border-[#FDD9CD] bg-white px-3 py-2 font-bold"><ArrowLeft size={15} /> {backLabel}</button>
      </div>
    </div>
  );
}

export function FullViewEmpty({ message, onClear, hasFilters }) {
  return (
    <div className="px-5 py-16 text-center text-sm text-[#7b6660]">
      <p>{message}</p>
      {hasFilters && onClear ? <button type="button" onClick={onClear} className="mt-3 inline-flex items-center gap-2 font-bold text-[#F38978]"><X size={15} /> Clear Filters</button> : null}
    </div>
  );
}

export default function AdminInvoicingFullView({
  title,
  description,
  backTo,
  backLabel,
  icon: Icon,
  count,
  countLabel = "records",
  actions,
  children
}) {
  const navigate = useNavigate();
  const titleRef = useRef(null);

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
    document.title = `${title} - Automated Invoicing System`;
  }, [title]);

  return (
    <main className="min-h-screen bg-[#fff8f5] p-4 text-[#251E1F] sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-[1700px] space-y-5">
        <header className="border-b border-[#f0d2ca] pb-5">
          <button type="button" onClick={() => navigate(backTo)} className="mb-4 inline-flex items-center gap-2 rounded-lg border border-[#f0d2ca] bg-white px-4 py-2 text-sm font-bold text-[#6f4f47] hover:border-[#F38978] hover:text-[#F38978] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F38978]">
            <ArrowLeft size={17} /> {backLabel}
          </button>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              {Icon ? <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F38978]/15 text-[#c55245]"><Icon size={20} aria-hidden="true" /></span> : null}
              <div>
                <h1 ref={titleRef} tabIndex="-1" className="text-2xl font-bold outline-none sm:text-3xl">{title}</h1>
                <p className="mt-1 max-w-3xl text-sm text-[#7b6660]">{description}</p>
                {count !== undefined && count !== null ? <p className="mt-2 text-sm font-semibold text-[#514440]">{new Intl.NumberFormat("en-SG").format(Number(count || 0))} {countLabel}</p> : null}
              </div>
            </div>
            {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}
