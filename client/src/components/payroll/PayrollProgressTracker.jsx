/**
 * EVALUATION HEADER
 * FEATURE: PAYROLL - SHARED
 * PURPOSE: Implements the reusable Payroll Progress Tracker interface component.
 * LAYER: Frontend component - provides reusable interface and interaction logic.
 * FIND RELATED CODE: Use Find All References to locate the pages that render this component.
 */
function getStageTone(status) {
  if (status === "completed") return { card: "border-emerald-200 bg-emerald-50", marker: "bg-emerald-600 text-white", detail: "text-emerald-700" };
  if (status === "failed" || status === "blocked") return { card: "border-red-300 bg-red-50", marker: "bg-red-500 text-white", detail: "text-red-700" };
  if (status === "current" || status === "processing") return { card: "border-[#F38978] bg-[#F38978]/10 shadow-lg shadow-[#F38978]/20", marker: "bg-[#F38978] text-white motion-safe:animate-pulse", detail: "font-semibold text-[#F38978]" };
  return { card: "border-[#f0d2ca] bg-white", marker: "bg-[#f0d2ca] text-[#7b6660]", detail: "text-[#7b6660]" };
}

function getMarker(status, index) {
  if (status === "completed") return "✓";
  if (status === "failed" || status === "blocked") return "!";
  return index + 1;
}

export default function PayrollProgressTracker({ ariaLabel = "Payroll run progress", title = "Payroll Run Progress", runId, badge, period, stages = [], onSelectStage, className = "" }) {
  return (
    <nav aria-label={ariaLabel} className={`payroll-progress app-panel min-w-0 max-w-full overflow-hidden rounded-2xl px-4 py-3 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0"><h3 className="text-sm font-semibold text-[#251E1F]">{title}</h3><p className="mt-0.5 break-all text-[11px] font-medium text-[#7b6660]">{runId || "Select a payroll run"}</p></div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">{badge}{period ? <span className="text-xs font-medium text-[#7b6660]">{period}</span> : null}</div>
      </div>
      <div className="payroll-progress__viewport mt-3" tabIndex="0" aria-label={`${title} stages`}>
        <ol className="payroll-progress__track">
          {stages.map((stage, index) => {
            const status = stage.status || "upcoming";
            const tone = getStageTone(status);
            const interactive = typeof onSelectStage === "function" && stage.path;
            const content = <><span className={`payroll-progress__marker relative flex shrink-0 items-center justify-center rounded-full text-xs font-bold ${tone.marker}`}>{status === "current" ? <span aria-hidden="true" className="absolute inset-0 rounded-full border-2 border-[#F38978] motion-safe:animate-ping" /> : null}<span className="relative">{getMarker(status, index)}</span></span><span className="min-w-0 flex-1"><strong className="payroll-progress__label block text-xs text-[#251E1F]">{stage.label}</strong><small className={`mt-0.5 block text-[11px] capitalize ${tone.detail}`}>{stage.detail || status}</small></span></>;
            return <li key={stage.key || stage.label} className="payroll-progress__item">{interactive ? <button type="button" onClick={() => onSelectStage(stage)} aria-label={`${stage.label}: ${stage.detail || status}`} className={`payroll-progress__card ${tone.card}`}>{content}</button> : <div className={`payroll-progress__card ${tone.card}`}>{content}</div>}{index < stages.length - 1 ? <span aria-hidden="true" className={`payroll-progress__connector ${status === "completed" ? "bg-emerald-200" : "bg-[#f0d2ca]"}`}><span className={`block h-full rounded-full transition-all duration-700 motion-reduce:transition-none ${status === "completed" ? "w-full bg-emerald-500" : status === "current" || status === "processing" ? "w-1/2 bg-[#F38978] motion-safe:animate-pulse" : "w-0"}`} /></span> : null}</li>;
          })}
        </ol>
      </div>
    </nav>
  );
}
