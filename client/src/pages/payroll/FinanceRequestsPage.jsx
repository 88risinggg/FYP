/**
 * EVALUATION HEADER
 * FEATURE: PAYROLL - SHARED
 * PURPOSE: Implements the Finance Requests Page screen and its page-level interactions.
 * LAYER: Frontend page - renders a complete screen and coordinates its user interactions.
 * FIND RELATED CODE: Trace its imports for UI components and frontend services used by this screen.
 */
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  FileImage,
  FileText,
  Filter,
  HandCoins,
  Landmark,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  UserRound,
  WalletCards,
  X,
  XCircle,
} from "lucide-react";
import {
  getPayrollRequestAttachment,
  listPayrollRequests,
  releasePayrollRequestToTreasury,
  reviewPayrollRequest,
} from "../../services/payrollRequestService.js";

const TYPE_META = {
  reimbursement: {
    label: "Claims & reimbursements",
    short: "Reimbursement",
    icon: WalletCards,
    tone: "bg-blue-50 text-blue-700",
  },
  loan: {
    label: "Employee loans",
    short: "Loan",
    icon: Landmark,
    tone: "bg-purple-50 text-purple-700",
  },
  salary_advance: {
    label: "Salary advances",
    short: "Salary advance",
    icon: HandCoins,
    tone: "bg-amber-50 text-amber-700",
  },
};
const STATUS_META = {
  pending_hr: ["Awaiting HR", "bg-slate-100 text-slate-700", 1],
  hr_approved: ["Awaiting Finance", "bg-amber-50 text-amber-700", 2],
  hr_rejected: ["HR rejected", "bg-red-50 text-red-700", 2],
  finance_approved: ["Finance approved", "bg-emerald-100 text-emerald-800", 3],
  finance_rejected: ["Finance rejected", "bg-red-50 text-red-700", 3],
  returned_to_hr: ["Returned to HR", "bg-orange-50 text-orange-700", 2],
  queued_for_payroll: ["Queued for payroll", "bg-blue-50 text-blue-700", 4],
  payroll_approved: ["Queued for payroll", "bg-blue-50 text-blue-700", 4],
  released: ["Released", "bg-emerald-50 text-emerald-700", 4],
  included: ["Included in payroll", "bg-emerald-50 text-emerald-700", 5],
  completed: ["Completed", "bg-emerald-50 text-emerald-700", 5],
  failed: ["Failed", "bg-red-50 text-red-700", 4],
};
const FILTER_TABS = [
  ["all", "All requests"],
  ["reimbursement", "Claims"],
  ["loan", "Loans"],
  ["salary_advance", "Advances"],
];
const MAIN_STATUS_GROUPS = [
  ["awaiting", "Awaiting review"],
  ["approved", "Approved"],
  ["processing", "Processing / queued"],
  ["completed", "Completed"],
  ["attention", "Returned / rejected / failed"],
];
function mainStatus(status) {
  if (["pending_hr", "hr_approved"].includes(status)) return "awaiting";
  if (status === "finance_approved") return "approved";
  if (["queued_for_payroll", "payroll_approved"].includes(status))
    return "processing";
  if (["released", "included", "completed"].includes(status))
    return "completed";
  if (
    ["hr_rejected", "finance_rejected", "returned_to_hr", "failed"].includes(
      status,
    )
  )
    return "attention";
  return "awaiting";
}

const money = (value) =>
  new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" }).format(
    Number(value || 0),
  );
const dateTime = (value) =>
  value
    ? new Intl.DateTimeFormat("en-SG", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Singapore",
      }).format(new Date(value))
    : "Not recorded";
const statusMeta = (status) =>
  STATUS_META[status] || [
    String(status || "Unknown").replaceAll("_", " "),
    "bg-slate-100 text-slate-700",
    1,
  ];
const fileSize = (bytes) =>
  bytes
    ? bytes < 1024 * 1024
      ? `${Math.ceil(bytes / 1024)} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : "Size unavailable";

function ProgressModal({ state, onClose }) {
  if (!state.open) return null;
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#251E1F]/45 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-live="polite"
        className="w-full max-w-md rounded-3xl border border-[#f0d2ca] bg-white p-7 shadow-2xl"
      >
        <div className="flex items-center gap-3">
          <span
            className={`flex h-11 w-11 items-center justify-center rounded-full ${state.error ? "bg-red-50 text-red-600" : state.running ? "bg-[#2D7C83]/10 text-[#2D7C83]" : "bg-emerald-50 text-emerald-600"}`}
          >
            {state.running ? (
              <Loader2 className="motion-safe:animate-spin" />
            ) : state.error ? (
              <XCircle />
            ) : (
              <CheckCircle2 />
            )}
          </span>
          <div>
            <h3 className="font-semibold text-[#251E1F]">{state.title}</h3>
            <p className="mt-0.5 text-sm text-[#7b6660]">{state.phase}</p>
          </div>
        </div>
        <div className="mt-6">
          <div className="mb-2 flex justify-between text-xs font-semibold">
            <span>Progress</span>
            <span>{state.progress}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[#f0d2ca]">
            <span
              className={`block h-full rounded-full transition-all duration-500 motion-reduce:transition-none ${state.error ? "bg-red-500" : "bg-gradient-to-r from-[#2D7C83] to-emerald-500"}`}
              style={{ width: `${state.progress}%` }}
            />
          </div>
        </div>
        {!state.running ? (
          <button
            type="button"
            onClick={onClose}
            className="mt-6 w-full rounded-xl border border-[#f0d2ca] px-4 py-2.5 text-sm font-semibold"
          >
            Close
          </button>
        ) : (
          <p className="mt-4 text-center text-xs text-[#7b6660]">
            Keep this window open while the result is saved.
          </p>
        )}
      </section>
    </div>
  );
}

function EvidencePreview({ request, file, onClose, onError }) {
  const [state, setState] = useState({
    loading: true,
    url: "",
    type: "",
    error: "",
  });
  useEffect(() => {
    let active = true;
    let url = "";
    getPayrollRequestAttachment(request.id, file.id)
      .then(({ blob, contentType }) => {
        if (!active) return;
        url = URL.createObjectURL(blob);
        setState({ loading: false, url, type: contentType, error: "" });
      })
      .catch((error) => {
        if (active) {
          setState({ loading: false, url: "", type: "", error: error.message });
          onError(error.message);
        }
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file.id, onError, request.id]);
  const isImage =
    state.type.startsWith("image/") || /\.(png|jpe?g)$/i.test(file.name);
  return (
    <div
      className="fixed inset-0 z-[105] flex items-center justify-center bg-[#251E1F]/60 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="evidence-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="claim-document-enter flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between gap-4 border-b border-[#f0d2ca] p-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#F38978]">
              Supporting document
            </p>
            <h3
              id="evidence-title"
              className="truncate font-semibold text-[#251E1F]"
            >
              {file.name}
            </h3>
            <p className="text-xs text-[#7b6660]">
              {fileSize(file.size)} · Submitted with {request.id}
            </p>
          </div>
          <div className="flex gap-2">
            {state.url ? (
              <>
                <a
                  href={state.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-[#f0d2ca] px-3 py-2 text-sm font-semibold"
                >
                  <Eye size={16} />
                  Open
                </a>
                <a
                  href={state.url}
                  download={file.name}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#2D7C83] px-3 py-2 text-sm font-semibold text-white"
                >
                  <Download size={16} />
                  Download
                </a>
              </>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close document preview"
              className="rounded-xl border border-[#f0d2ca] p-2"
            >
              <X size={19} />
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 bg-[#f7f3f1] p-3">
          {state.loading ? (
            <div className="flex h-full flex-col items-center justify-center text-[#2D7C83]">
              <Loader2 size={32} className="motion-safe:animate-spin" />
              <p className="mt-3 text-sm font-semibold">
                Loading authenticated document…
              </p>
            </div>
          ) : state.error ? (
            <div className="flex h-full flex-col items-center justify-center text-red-600">
              <AlertCircle size={34} />
              <p className="mt-3 font-semibold">Document preview unavailable</p>
              <p className="mt-1 text-sm">{state.error}</p>
            </div>
          ) : isImage ? (
            <div className="flex h-full items-center justify-center overflow-auto">
              <img
                src={state.url}
                alt={file.name}
                className="max-h-full max-w-full rounded-lg object-contain shadow-lg"
              />
            </div>
          ) : (
            <iframe
              title={file.name}
              src={state.url}
              className="h-full w-full rounded-lg bg-white"
            />
          )}
        </div>
      </section>
    </div>
  );
}

function WorkflowTimeline({ request }) {
  const current = statusMeta(request.status)[2];
  const rejected = ["hr_rejected", "finance_rejected", "failed"].includes(request.status);
  const returned = request.status === "returned_to_hr";
  const stages = [
    [
      "Submitted",
      request.submittedAt,
      "Staff uploaded the request and supporting evidence.",
    ],
    [
      "HR review",
      request.hrDecision?.at,
      request.hrDecision?.comments ||
        (current >= 2 ? "Reviewed by HR." : "Awaiting HR review."),
    ],
    [
      "Finance review",
      request.financeDecision?.at,
      request.financeDecision?.comments ||
        (current >= 3
          ? "Reviewed by Finance."
          : "Finance verifies HR-approved terms and evidence."),
    ],
    [
      request.requestType === "reimbursement"
        ? "Payroll inclusion"
        : "Payment release",
      request.payroll?.payrollId || request.disbursement?.reference,
      request.requestType === "reimbursement"
        ? request.payroll?.status ||
          "Included in the next eligible payroll run."
        : request.disbursement?.reference || "Awaiting confirmed disbursement.",
    ],
    [
      "Completion status",
      current >= 5
        ? request.payroll?.payrollId || request.disbursement?.reference
        : null,
      rejected
        ? statusMeta(request.status)[0]
        : "Completed after payroll inclusion or confirmed release.",
    ],
  ];
  const stageState = (index, at) => {
    if (index === 0) return "completed";
    if (index === 1) {
      if (request.status === "hr_rejected") return "rejected";
      if (returned) return "returned";
      if (request.status === "pending_hr") return "active";
      return "completed";
    }
    if (index === 2) {
      if (request.status === "finance_rejected") return "rejected";
      if (request.status === "hr_approved") return "active";
      if (current > 2 && !returned && request.status !== "hr_rejected") return "completed";
      return "upcoming";
    }
    if (index === 3) {
      if (request.status === "failed") return "rejected";
      if (["released", "included", "completed"].includes(request.status) || Boolean(at)) return "completed";
      if (["finance_approved", "queued_for_payroll", "payroll_approved"].includes(request.status)) return "active";
      return "upcoming";
    }
    if (["included", "completed"].includes(request.status)) return "completed";
    if (rejected) return "rejected";
    if (returned) return "returned";
    return "upcoming";
  };
  const markerClass = {
    completed: "bg-emerald-500",
    active: "bg-[#F38978] motion-safe:animate-pulse",
    rejected: "bg-red-500 motion-safe:animate-[financeClaimResultPop_.35s_ease_both]",
    returned: "bg-orange-500 motion-safe:animate-pulse",
    upcoming: "bg-[#d9cbc7]",
  };
  const lineClass = {
    completed: "bg-emerald-300",
    active: "bg-[#f0d2ca]",
    rejected: "bg-red-300",
    returned: "bg-orange-300",
    upcoming: "bg-[#f0d2ca]",
  };
  return (
    <ol className="space-y-0">
      {stages.map(([label, at, detail], index) => {
        const state = stageState(index, at);
        return (
          <li key={label} className="relative flex gap-3 pb-5 last:pb-0">
            {index < stages.length - 1 ? (
              <span
                className={`absolute left-[9px] top-5 h-full w-px transition-colors duration-300 motion-reduce:transition-none ${lineClass[state]}`}
              />
            ) : null}
            <span
              className={`relative mt-0.5 h-5 w-5 shrink-0 rounded-full border-4 border-white transition-colors duration-300 motion-reduce:transition-none ${markerClass[state]}`}
            />
            <div>
              <div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-[#251E1F]">{label}</strong>{state === "rejected" ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">Stopped</span> : state === "returned" ? <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-700">Returned</span> : null}</div>
              <p className="mt-0.5 text-xs leading-5 text-[#7b6660]">
                {detail}
              </p>
              {at && typeof at === "string" && at.includes("T") ? (
                <p className={`mt-1 text-[11px] font-semibold ${state === "rejected" ? "text-red-600" : state === "returned" ? "text-orange-600" : "text-[#2D7C83]"}`}>
                  {dateTime(at)}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function RequestDrawer({ request, onClose, onUpdated, onError }) {
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");
  const [previewFile, setPreviewFile] = useState(null);
  const [progress, setProgress] = useState({ open: false });
  const [activeAction, setActiveAction] = useState("");
  const [fieldError, setFieldError] = useState("");
  const meta = TYPE_META[request.requestType] || TYPE_META.reimbursement;
  const TypeIcon = meta.icon;
  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = before;
    };
  }, []);
  const perform = async (action) => {
    if (activeAction) return;
    if (["reject", "return"].includes(action) && !note.trim()) {
      setFieldError("note");
      window.setTimeout(() => setFieldError(""), 650);
      return onError(
        "Enter a clear reason before returning or rejecting this request.",
      );
    }
    if (action === "release-manual" && !reference.trim()) {
      setFieldError("reference");
      window.setTimeout(() => setFieldError(""), 650);
      return onError(
        "Enter the external payment reference before confirming release.",
      );
    }
    setActiveAction(action);
    let progressValue = 8;
    setProgress({
      open: true,
      running: true,
      progress: progressValue,
      title:
        action === "approve"
          ? "Confirm Finance review"
          : action === "return"
            ? "Return request to HR"
            : action === "reject"
              ? "Reject request"
              : "Confirm manual release",
      phase: "Validating request evidence and workflow…",
    });
    const timer = window.setInterval(() => {
      progressValue = Math.min(90, progressValue + 7);
      setProgress((current) => ({
        ...current,
        progress: progressValue,
        phase:
          progressValue > 55
            ? "Saving the outcome and notifying Staff…"
            : current.phase,
      }));
    }, 220);
    try {
      const result = await reviewPayrollRequest(request.id, "finance", action, {
        reason: note,
        paymentReference: reference,
      });
      window.clearInterval(timer);
      setProgress({
        open: true,
        running: false,
        progress: 100,
        title: "Request updated",
        phase: "The decision was saved and the employee was notified.",
      });
      setNote("");
      setReference("");
      onUpdated(result);
    } catch (error) {
      window.clearInterval(timer);
      setProgress({
        open: true,
        running: false,
        progress: 0,
        error: true,
        title: "Action could not be completed",
        phase: error.message,
      });
    } finally {
      setActiveAction("");
    }
  };
  const releaseTreasury = async () => {
    if (activeAction) return;
    setActiveAction("treasury");
    setProgress({
      open: true,
      running: true,
      progress: 20,
      title: "Release through Modern Treasury",
      phase: "Submitting an idempotent payment order…",
    });
    try {
      const result = await releasePayrollRequestToTreasury(request.id);
      setProgress({
        open: true,
        running: false,
        progress: 100,
        title: "Payment submitted",
        phase:
          "The provider reference was saved and the employee was notified.",
      });
      onUpdated(result);
    } catch (error) {
      setProgress({
        open: true,
        running: false,
        progress: 0,
        error: true,
        title: "Treasury release failed",
        phase: error.message,
      });
    } finally {
      setActiveAction("");
    }
  };
  return (
    <>
      <div
        className="fixed inset-0 z-[80] flex justify-end bg-[#251E1F]/40 backdrop-blur-[2px]"
        onMouseDown={onClose}
      >
        <aside
          role="dialog"
          aria-modal="true"
          aria-labelledby="request-title"
          onMouseDown={(event) => event.stopPropagation()}
          className="claim-drawer-enter h-full w-full max-w-5xl overflow-y-auto bg-[#fffdfc] shadow-2xl"
        >
          <header className="sticky top-0 z-10 flex items-start justify-between border-b border-[#f0d2ca] bg-white/95 p-5 backdrop-blur">
            <div className="flex min-w-0 items-start gap-3">
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${meta.tone}`}
              >
                <TypeIcon size={21} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#F38978]">
                  {meta.short} · {request.id}
                </p>
                <h2
                  id="request-title"
                  className="mt-1 truncate text-xl font-semibold text-[#251E1F]"
                >
                  {request.purpose}
                </h2>
                <p className="mt-1 text-sm text-[#7b6660]">
                  Submitted by {request.staffName} on{" "}
                  {dateTime(request.submittedAt)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close request details"
              className="rounded-xl border border-[#f0d2ca] p-2"
            >
              <X size={20} />
            </button>
          </header>
          <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(19rem,.75fr)]">
            <main className="space-y-5">
              <section className="grid gap-3 sm:grid-cols-3">
                {[
                  ["Requested amount", money(request.amount), Banknote],
                  [
                    "Supporting files",
                    request.attachments?.length || 0,
                    FileText,
                  ],
                  [
                    "Current status",
                    statusMeta(request.status)[0],
                    ShieldCheck,
                  ],
                ].map(([label, value, Icon]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-[#f0d2ca] bg-white p-4"
                  >
                    <Icon size={18} className="text-[#F38978]" />
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[#7b6660]">
                      {label}
                    </p>
                    <strong className="mt-1 block text-[#251E1F]">
                      {value}
                    </strong>
                  </div>
                ))}
              </section>
              <section className="rounded-2xl border border-[#f0d2ca] bg-white p-5">
                <h3 className="font-semibold text-[#251E1F]">
                  Request details
                </h3>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-[#7b6660]">
                      Employee
                    </dt>
                    <dd className="mt-1 font-semibold">{request.staffName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-[#7b6660]">
                      Request type
                    </dt>
                    <dd className="mt-1 font-semibold">{meta.short}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-[#7b6660]">
                      Purpose
                    </dt>
                    <dd className="mt-1 font-semibold">{request.purpose}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-[#7b6660]">
                      Amount
                    </dt>
                    <dd className="mt-1 font-semibold text-emerald-700">
                      {money(request.amount)}
                    </dd>
                  </div>
                  {request.requestType === "loan" ? (
                    <>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-[#7b6660]">
                          Repayment period
                        </dt>
                        <dd className="mt-1 font-semibold">
                          {request.approvedTerms?.repaymentMonths ||
                            "Not recorded"}{" "}
                          month(s)
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-[#7b6660]">
                          Monthly recovery
                        </dt>
                        <dd className="mt-1 font-semibold">
                          {request.approvedTerms?.monthlyInstallment
                            ? money(request.approvedTerms.monthlyInstallment)
                            : "Calculated after approval"}
                        </dd>
                      </div>
                    </>
                  ) : null}
                </dl>
                <div className="mt-5 rounded-xl bg-[#fff8f5] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#F38978]">
                    Employee explanation
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#534647]">
                    {request.description || "No description provided."}
                  </p>
                </div>
              </section>
              <section className="rounded-2xl border border-[#f0d2ca] bg-white p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-[#251E1F]">
                      Supporting documents
                    </h3>
                    <p className="mt-1 text-xs text-[#7b6660]">
                      Preview every submitted file before confirming the
                      request.
                    </p>
                  </div>
                  <span className="rounded-full bg-[#2D7C83]/10 px-3 py-1 text-xs font-semibold text-[#2D7C83]">
                    {request.attachments?.length || 0} file(s)
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {request.attachments?.map((file) => {
                    const ImageIcon = file.mimeType?.startsWith("image/")
                      ? FileImage
                      : FileText;
                    return (
                      <button
                        type="button"
                        key={file.id}
                        onClick={() => setPreviewFile(file)}
                        className="group flex items-center gap-3 rounded-xl border border-[#f0d2ca] p-3 text-left transition hover:border-[#2D7C83]/40 hover:bg-[#2D7C83]/5"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#fff8f5] text-[#F38978]">
                          <ImageIcon size={19} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <strong className="block truncate text-sm text-[#251E1F]">
                            {file.name}
                          </strong>
                          <small className="text-[#7b6660]">
                            {fileSize(file.size)} · Click to preview
                          </small>
                        </span>
                        <Eye
                          size={17}
                          className="text-[#2D7C83] opacity-60 group-hover:opacity-100"
                        />
                      </button>
                    );
                  })}
                </div>
                {!request.attachments?.length ? (
                  <div className="claim-empty-evidence relative mt-4 overflow-hidden rounded-xl border border-dashed border-red-200 bg-red-50 p-5 text-center text-sm text-red-700">
                    <span className="claim-empty-evidence__icon mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white text-red-500"><AlertCircle size={20}/></span>
                    <strong className="block">Supporting documents unavailable</strong>
                    <span className="mt-1 block">Do not approve this request until the source record and required evidence are corrected.</span>
                  </div>
                ) : null}
              </section>
              <section className="rounded-2xl border border-[#f0d2ca] bg-white p-5">
                <h3 className="font-semibold text-[#251E1F]">
                  Payroll and payment impact
                </h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {request.requestType === "reimbursement" ? (
                    <>
                      <div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-800">
                        <strong>Non-CPF reimbursement</strong>
                        <p className="mt-1">
                          Approval queues this amount for the next newly created
                          payroll run. Existing runs remain unchanged.
                        </p>
                      </div>
                      <div className="rounded-xl bg-[#fff8f5] p-4 text-sm">
                        <strong>Inclusion status</strong>
                        <p className="mt-1 text-[#7b6660]">
                          {request.payroll?.status || "Not queued"}
                          {request.payroll?.year
                            ? ` · ${request.payroll.month}/${request.payroll.year}`
                            : ""}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="rounded-xl bg-purple-50 p-4 text-sm text-purple-800">
                        <strong>Separate disbursement</strong>
                        <p className="mt-1">
                          Finance releases the approved amount separately.
                          Payroll recovery begins only after confirmed release.
                        </p>
                      </div>
                      <div className="rounded-xl bg-[#fff8f5] p-4 text-sm">
                        <strong>Payment reference</strong>
                        <p className="mt-1 break-all text-[#7b6660]">
                          {request.disbursement?.reference || "Not released"}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </section>
            </main>
            <aside className="space-y-5">
              <section className="rounded-2xl border border-[#f0d2ca] bg-white p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-[#251E1F]">
                    Request progress
                  </h3>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta(request.status)[1]}`}
                  >
                    {statusMeta(request.status)[0]}
                  </span>
                </div>
                <div className="mt-5">
                  <WorkflowTimeline request={request} />
                </div>
              </section>
              {request.status === "hr_approved" ? (
                <section className="rounded-2xl border border-[#F38978]/30 bg-white p-5 shadow-lg shadow-[#F38978]/5">
                  <h3 className="font-semibold text-[#251E1F]">
                    Finance decision
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-[#7b6660]">
                    Confirm the exact HR-approved request. To change terms,
                    return it to HR with a reason.
                  </p>
                  <label className="mt-4 block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[#7b6660]">
                      Review note / required reason
                    </span>
                    <textarea
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      rows={4}
                      placeholder="Add a review note. A reason is required for return or rejection."
                      className={`mt-2 w-full resize-none rounded-xl border p-3 text-sm outline-none focus:border-[#F38978] ${fieldError === "note" ? "claim-field-error border-red-400 bg-red-50" : "border-[#f0d2ca]"}`}
                    />
                  </label>
                  <div className="mt-4 grid gap-2">
                    <button
                      type="button"
                      disabled={
                        !request.attachments?.length || Boolean(activeAction)
                      }
                      onClick={() => perform("approve")}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {activeAction === "approve" ? (
                        <Loader2
                          size={17}
                          className="motion-safe:animate-spin"
                        />
                      ) : (
                        <CheckCircle2 size={17} />
                      )}
                      {activeAction === "approve"
                        ? "Confirming request…"
                        : "Confirm request"}
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(activeAction)}
                      onClick={() => perform("return")}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white"
                    >
                      {activeAction === "return" ? (
                        <Loader2
                          size={17}
                          className="motion-safe:animate-spin"
                        />
                      ) : (
                        <RotateCcw size={17} />
                      )}
                      {activeAction === "return"
                        ? "Returning to HR…"
                        : "Return to HR"}
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(activeAction)}
                      onClick={() => perform("reject")}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
                    >
                      {activeAction === "reject" ? (
                        <Loader2
                          size={17}
                          className="motion-safe:animate-spin"
                        />
                      ) : (
                        <XCircle size={17} />
                      )}
                      {activeAction === "reject"
                        ? "Rejecting request…"
                        : "Reject request"}
                    </button>
                  </div>
                </section>
              ) : null}
              {request.status === "finance_approved" &&
              request.requestType !== "reimbursement" ? (
                <section className="rounded-2xl border border-[#2D7C83]/30 bg-white p-5">
                  <h3 className="font-semibold text-[#251E1F]">
                    Release approved funds
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-[#7b6660]">
                    Use Modern Treasury or record an audited external settlement
                    reference.
                  </p>
                  <button
                    type="button"
                    disabled={Boolean(activeAction)}
                    onClick={releaseTreasury}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2D7C83] px-4 py-3 text-sm font-semibold text-white"
                  >
                    {activeAction === "treasury" ? (
                      <Loader2 size={17} className="motion-safe:animate-spin" />
                    ) : (
                      <Banknote size={17} />
                    )}
                    {activeAction === "treasury"
                      ? "Submitting payment…"
                      : "Release through Modern Treasury"}
                  </button>
                  <div className="my-4 flex items-center gap-3 text-xs text-[#7b6660]">
                    <span className="h-px flex-1 bg-[#f0d2ca]" />
                    or manual confirmation
                    <span className="h-px flex-1 bg-[#f0d2ca]" />
                  </div>
                  <label>
                    <span className="text-xs font-semibold uppercase tracking-wide text-[#7b6660]">
                      External payment reference
                    </span>
                    <input
                      value={reference}
                      onChange={(event) => setReference(event.target.value)}
                      placeholder="e.g. BANK-2026-00124"
                      className={`mt-2 w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${fieldError === "reference" ? "claim-field-error border-red-400 bg-red-50" : "border-[#f0d2ca]"}`}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={Boolean(activeAction)}
                    onClick={() => perform("release-manual")}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"
                  >
                    {activeAction === "release-manual" ? (
                      <Loader2 size={17} className="motion-safe:animate-spin" />
                    ) : (
                      <CheckCircle2 size={17} />
                    )}
                    {activeAction === "release-manual"
                      ? "Saving release…"
                      : "Confirm manual release"}
                  </button>
                </section>
              ) : null}
              {!["hr_approved", "finance_approved"].includes(request.status) ? (
                <section className="rounded-2xl border border-[#f0d2ca] bg-[#fff8f5] p-4 text-sm text-[#7b6660]">
                  <strong className="text-[#251E1F]">Request status</strong>
                  <p className="mt-1">
                    No Finance action is currently required for this request.
                  </p>
                </section>
              ) : null}
            </aside>
          </div>
        </aside>
      </div>
      <ProgressModal
        state={progress}
        onClose={() => setProgress({ open: false })}
      />
      {previewFile ? (
        <EvidencePreview
          request={request}
          file={previewFile}
          onClose={() => setPreviewFile(null)}
          onError={onError}
        />
      ) : null}
    </>
  );
}

export default function FinanceRequestsPage() {
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [statusGroup, setStatusGroup] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const load = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const result = await listPayrollRequests();
      setItems(result);
      setError("");
      setLastUpdated(new Date());
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };
  useEffect(() => {
    load();
    const interval = window.setInterval(() => load({ silent: true }), 15000);
    return () => window.clearInterval(interval);
  }, []);
  const filtered = useMemo(
    () =>
      items.filter(
        (item) =>
          (tab === "all" || item.requestType === tab) &&
          (!statusGroup || mainStatus(item.status) === statusGroup) &&
          (!status || item.status === status) &&
          (!query.trim() ||
            `${item.id} ${item.staffName} ${item.purpose} ${item.description}`
              .toLowerCase()
              .includes(query.trim().toLowerCase())),
      ),
    [items, query, status, statusGroup, tab],
  );
  const selected = items.find((item) => item.id === selectedId) || null;
  const stats = {
    finance: items.filter((item) => item.status === "hr_approved").length,
    release: items.filter((item) => item.status === "finance_approved").length,
    payroll: items.filter((item) =>
      ["payroll_approved", "queued_for_payroll"].includes(item.status),
    ).length,
    issues: items.filter((item) =>
      ["returned_to_hr", "failed"].includes(item.status),
    ).length,
  };
  const updateItem = (result) => {
    setItems((current) =>
      current.map((item) => (item.id === result.id ? result : item)),
    );
    setSelectedId(result.id);
    load({ silent: true });
  };
  return (
    <div className="finance-claims-page space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#F38978]">
            Finance verification
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-[#251E1F]">
            Claim Requests
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-[#7b6660]">
            Verify HR-approved reimbursements, loans, and salary advances
            against their supporting documents before payroll inclusion or
            payment release.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#7b6660]">
          <span className="h-2 w-2 rounded-full bg-emerald-500 motion-safe:animate-pulse" />
          <span>
            Live queue{lastUpdated ? ` · updated ${dateTime(lastUpdated)}` : ""}
          </span>
        </div>
      </header>
      {error ? (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <span className="flex gap-2">
            <AlertCircle size={18} className="shrink-0" />
            {error}
          </span>
          <button type="button" onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      ) : null}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [
            "Awaiting Finance",
            stats.finance,
            Clock3,
            "Review evidence and confirm",
          ],
          [
            "Ready for release",
            stats.release,
            Banknote,
            "Loans and advances approved",
          ],
          [
            "Queued for payroll",
            stats.payroll,
            WalletCards,
            "Next newly created run",
          ],
          ["Needs attention", stats.issues, AlertCircle, "Returned or failed"],
        ].map(([label, value, Icon, detail], index) => (
          <article key={label} className="app-panel rounded-2xl p-4">
            <div className="flex items-start justify-between">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${index === 0 ? "bg-amber-50 text-amber-700" : index === 1 ? "bg-blue-50 text-blue-700" : index === 2 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
              >
                <Icon size={19} />
              </span>
              <strong className="text-2xl text-[#251E1F]">{value}</strong>
            </div>
            <p className="mt-3 text-sm font-semibold text-[#251E1F]">{label}</p>
            <p className="mt-1 text-xs text-[#7b6660]">{detail}</p>
          </article>
        ))}
      </section>
      <section className="app-panel rounded-2xl p-5">
        <div className="flex flex-col gap-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {FILTER_TABS.map(([key, label]) => (
              <button
                type="button"
                key={key}
                onClick={() => setTab(key)}
                className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition ${tab === key ? "bg-[#F38978] text-white shadow-lg shadow-[#F38978]/20" : "border border-[#f0d2ca] bg-white text-[#7b6660] hover:bg-[#fff8f5]"}`}
              >
                {label}
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-xs ${tab === key ? "bg-white/20" : "bg-[#fff8f5]"}`}
                >
                  {
                    items.filter(
                      (item) => key === "all" || item.requestType === key,
                    ).length
                  }
                </span>
              </button>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_14rem_16rem_auto]">
            <label className="flex items-center gap-2 rounded-xl border border-[#f0d2ca] bg-white px-3">
              <Search size={17} className="text-[#F38978]" />
              <span className="sr-only">Search requests</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search employee, purpose, description, or request ID"
                className="w-full py-2.5 text-sm outline-none"
              />
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-[#f0d2ca] bg-white px-3">
              <ShieldCheck size={16} className="text-[#F38978]" />
              <span className="sr-only">Main status filter</span>
              <select
                value={statusGroup}
                onChange={(event) => {
                  setStatusGroup(event.target.value);
                  setStatus("");
                }}
                className="w-full bg-transparent py-2.5 text-sm font-semibold outline-none"
              >
                <option value="">All main statuses</option>
                {MAIN_STATUS_GROUPS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label} (
                    {
                      items.filter((item) => mainStatus(item.status) === value)
                        .length
                    }
                    )
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-[#f0d2ca] bg-white px-3">
              <Filter size={16} className="text-[#F38978]" />
              <span className="sr-only">Outcome filter</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="w-full bg-transparent py-2.5 text-sm font-semibold outline-none"
              >
                <option value="">All workflow outcomes</option>
                {Object.entries(STATUS_META)
                  .filter(
                    ([value]) =>
                      !statusGroup || mainStatus(value) === statusGroup,
                  )
                  .map(([value, meta]) => (
                    <option key={value} value={value}>
                      {meta[0]}
                    </option>
                  ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => load()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#f0d2ca] bg-white px-4 py-2.5 text-sm font-semibold"
            >
              <RefreshCw
                size={16}
                className={loading ? "motion-safe:animate-spin" : ""}
              />
              Refresh
            </button>
          </div>
          <div className="flex items-center justify-between text-xs text-[#7b6660]">
            <span>
              {filtered.length} of {items.length} request(s)
            </span>
            {query || status || statusGroup || tab !== "all" ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setStatus("");
                  setStatusGroup("");
                  setTab("all");
                }}
                className="font-semibold text-[#F38978]"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </div>
      </section>
      {loading ? (
        <div className="app-panel flex min-h-72 flex-col items-center justify-center rounded-2xl text-[#2D7C83]">
          <Loader2 size={30} className="motion-safe:animate-spin" />
          <p className="mt-3 text-sm font-semibold">
            Loading payroll requests…
          </p>
        </div>
      ) : filtered.length ? (
        <section className="app-panel overflow-hidden rounded-2xl">
          <div className="hidden overflow-x-auto lg:block">
            <table className="min-w-[68rem] w-full text-left text-sm">
              <thead className="bg-[#fff8f5] text-xs uppercase tracking-wide text-[#7b6660]">
                <tr>
                  <th className="px-5 py-4">Request</th>
                  <th>Employee</th>
                  <th>Purpose</th>
                  <th>Evidence</th>
                  <th>Amount</th>
                  <th>Outcome</th>
                  <th className="pr-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0d2ca]">
                {filtered.map((item) => {
                  const meta =
                    TYPE_META[item.requestType] || TYPE_META.reimbursement;
                  const Icon = meta.icon;
                  return (
                    <tr
                      key={item.id}
                      className={`transition hover:bg-[#fff8f5]/70 ${item.status === "hr_approved" ? "border-l-4 border-l-amber-400" : "border-l-4 border-l-transparent"}`}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex h-9 w-9 items-center justify-center rounded-lg ${meta.tone}`}
                          >
                            <Icon size={17} />
                          </span>
                          <div>
                            <strong className="text-[#251E1F]">
                              {meta.short}
                            </strong>
                            <small className="mt-0.5 block font-mono text-[#7b6660]">
                              {item.id}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <strong className="text-[#251E1F]">
                          {item.staffName}
                        </strong>
                        <small className="mt-1 block text-[#7b6660]">
                          {dateTime(item.submittedAt)}
                        </small>
                      </td>
                      <td className="max-w-64">
                        <strong className="block truncate text-[#251E1F]">
                          {item.purpose}
                        </strong>
                        <small className="mt-1 block truncate text-[#7b6660]">
                          {item.description}
                        </small>
                      </td>
                      <td>
                        <span
                          className={`inline-flex items-center gap-1.5 font-semibold ${item.attachments?.length ? "text-[#2D7C83]" : "text-red-600"}`}
                        >
                          <FileText size={15} />
                          {item.attachments?.length || 0} file(s)
                        </span>
                      </td>
                      <td className="font-semibold text-[#251E1F]">
                        {money(item.amount)}
                      </td>
                      <td>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta(item.status)[1]}`}
                        >
                          {statusMeta(item.status)[0]}
                        </span>
                      </td>
                      <td className="pr-5 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedId(item.id)}
                          className="inline-flex items-center gap-2 rounded-xl border border-[#f0d2ca] bg-white px-3 py-2 text-xs font-semibold text-[#251E1F]"
                        >
                          <Eye size={15} />
                          {item.status === "hr_approved"
                            ? "Review"
                            : "View details"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 p-3 lg:hidden">
            {filtered.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className="rounded-xl border border-[#f0d2ca] bg-white p-4 text-left"
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${statusMeta(item.status)[1]}`}
                    >
                      {statusMeta(item.status)[0]}
                    </span>
                    <strong className="mt-3 block text-[#251E1F]">
                      {item.staffName}
                    </strong>
                    <p className="mt-1 text-sm text-[#7b6660]">
                      {item.purpose}
                    </p>
                  </div>
                  <strong>{money(item.amount)}</strong>
                </div>
                <div className="mt-4 flex justify-between border-t border-[#f0d2ca] pt-3 text-xs text-[#7b6660]">
                  <span>{TYPE_META[item.requestType]?.short}</span>
                  <span>{item.attachments?.length || 0} document(s)</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <div className="app-panel flex min-h-64 flex-col items-center justify-center rounded-2xl p-8 text-center">
          <Search size={30} className="text-[#d5b6ae]" />
          <h3 className="mt-3 font-semibold text-[#251E1F]">
            No requests match these filters
          </h3>
          <p className="mt-1 text-sm text-[#7b6660]">
            Clear the filters or wait for a new HR-approved request.
          </p>
        </div>
      )}
      {selected ? (
        <RequestDrawer
          request={selected}
          onClose={() => setSelectedId("")}
          onUpdated={updateItem}
          onError={setError}
        />
      ) : null}
    </div>
  );
}
