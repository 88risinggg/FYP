import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileClock,
  FileWarning,
  RefreshCw,
  XCircle
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { fetchInvoiceValidationSummary } from "../../services/adminDashboardService.js";

const statusStyles = {
  Pending: "bg-amber-50 text-amber-700",
  Validated: "bg-blue-50 text-blue-700",
  Successful: "bg-emerald-50 text-emerald-700",
  "Partial Success": "bg-sky-50 text-sky-700",
  Failed: "bg-rose-50 text-rose-700"
};

const uploadHistoryPath = "/dashboard/invoicing/admin/dashboard/validation-summary/upload-history";

function formatCount(value) {
  return new Intl.NumberFormat("en-SG").format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Singapore"
  }).format(new Date(value));
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusStyles[status] || statusStyles.Pending}`}>
      {status || "Pending"}
    </span>
  );
}

function Panel({ title, icon: Icon, action, children, className = "" }) {
  return (
    <section className={`rounded-xl border border-[#f0d2ca] bg-white/95 p-5 shadow-[0_10px_28px_rgba(37,30,31,0.06)] ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Icon size={18} className="text-[#F38978]" />
          <h3 className="text-[15px] font-bold text-[#251E1F]">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyMessage({ children }) {
  return (
    <div className="rounded-lg border border-dashed border-[#f0c9bf] bg-[#fff8f5] px-4 py-6 text-center text-sm text-[#7b6660]">
      {children}
    </div>
  );
}

function ResultCard({ title, value, note, icon: Icon, tone, to }) {
  return (
    <Link
      to={to}
      className="group flex min-h-44 flex-col justify-between rounded-xl border border-[#f0d2ca] bg-white/95 p-5 shadow-[0_10px_28px_rgba(37,30,31,0.06)] transition hover:-translate-y-0.5 hover:border-[#F38978] focus:outline-none focus:ring-2 focus:ring-[#F38978]"
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-full ${tone}`}>
          <Icon size={20} />
        </span>
        <ArrowRight size={18} className="text-[#b99b93] transition group-hover:translate-x-0.5 group-hover:text-[#F38978]" />
      </div>
      <div>
        <p className="text-sm font-bold text-[#514440]">{title}</p>
        <p className="mt-2 text-3xl font-bold text-[#251E1F]">{formatCount(value)}</p>
        <p className="mt-2 text-xs text-[#7b6660]">{note}</p>
      </div>
    </Link>
  );
}

function ErrorReport({ upload }) {
  if (!upload) {
    return <EmptyMessage>No validation error report is available.</EmptyMessage>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-bold text-[#251E1F]">{upload.fileName}</p>
          <p className="mt-1 text-xs text-[#7b6660]">
            Uploaded by {upload.uploaderEmail} · {formatDateTime(upload.uploadedAt)}
          </p>
        </div>
        <StatusBadge status={upload.status} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          ["Total rows", upload.totalRows],
          ["Valid", upload.validRows],
          ["Invalid", upload.invalidRows]
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-[#fff8f5] px-2 py-3">
            <p className="text-lg font-bold text-[#251E1F]">{formatCount(value)}</p>
            <p className="mt-1 text-xs text-[#7b6660]">{label}</p>
          </div>
        ))}
      </div>
      {upload.errorMessage ? (
        <div className="flex gap-2 rounded-lg bg-rose-50 px-3 py-3 text-sm text-rose-700">
          <AlertCircle size={17} className="mt-0.5 shrink-0" />
          <span>{upload.errorMessage}</span>
        </div>
      ) : null}
      <Link
        to={`/dashboard/invoicing/admin/dashboard/validation-errors/${upload.uploadId}`}
        className="inline-flex items-center gap-2 text-sm font-bold text-[#F38978] hover:text-[#d96858]"
      >
        View Error Report <ArrowRight size={15} />
      </Link>
    </div>
  );
}

function ValidationErrors({ errors }) {
  if (!errors.length) {
    return <EmptyMessage>No row-level validation errors were recorded.</EmptyMessage>;
  }

  return (
    <div className="max-h-80 overflow-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="sticky top-0 bg-[#fff8f5] text-xs uppercase text-[#7b6660]">
          <tr>
            <th className="px-3 py-3">Row</th>
            <th className="px-3 py-3">Invoice #</th>
            <th className="px-3 py-3">Field</th>
            <th className="px-3 py-3">Error</th>
          </tr>
        </thead>
        <tbody>
          {errors.map((error) => (
            <tr key={error.validationErrorId} className="border-b border-[#f4ded7] align-top">
              <td className="px-3 py-3 font-bold text-[#251E1F]">{error.rowNumber ?? "File"}</td>
              <td className="px-3 py-3 text-[#514440]">{error.invoiceNumber || "-"}</td>
              <td className="px-3 py-3 text-[#514440]">{error.fieldName}</td>
              <td className="px-3 py-3 text-rose-700">{error.errorMessage}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UploadHistory({ uploads }) {
  if (!uploads.length) {
    return <EmptyMessage>No upload history is available.</EmptyMessage>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-y border-[#f0d2ca] bg-[#fff8f5] text-xs uppercase text-[#7b6660]">
            <th className="px-3 py-3">File name</th>
            <th className="px-3 py-3">Uploaded by</th>
            <th className="px-3 py-3">Uploaded at</th>
            <th className="px-3 py-3">Rows</th>
            <th className="px-3 py-3">Valid</th>
            <th className="px-3 py-3">Invalid</th>
            <th className="px-3 py-3">Created</th>
            <th className="px-3 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {uploads.map((upload) => (
            <tr key={upload.uploadId} className="border-b border-[#f4ded7] hover:bg-[#fff8f5]">
              <td className="max-w-64 truncate px-3 py-3 font-bold text-[#251E1F]" title={upload.fileName}>{upload.fileName}</td>
              <td className="px-3 py-3 text-[#514440]">{upload.uploaderEmail}</td>
              <td className="whitespace-nowrap px-3 py-3 text-[#514440]">{formatDateTime(upload.uploadedAt)}</td>
              <td className="px-3 py-3 text-[#514440]">{formatCount(upload.totalRows)}</td>
              <td className="px-3 py-3 font-semibold text-emerald-700">{formatCount(upload.validRows)}</td>
              <td className="px-3 py-3 font-semibold text-rose-700">{formatCount(upload.invalidRows)}</td>
              <td className="px-3 py-3 text-[#514440]">{formatCount(upload.createdInvoices)}</td>
              <td className="px-3 py-3"><StatusBadge status={upload.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminValidationSummaryPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      setData(await fetchInvoiceValidationSummary());
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!loading && window.location.hash === "#recent-uploads") {
      window.requestAnimationFrame(() => {
        document.getElementById("recent-uploads")?.scrollIntoView({ block: "start" });
      });
    }
  }, [loading]);

  if (loading) {
    return <div className="rounded-xl border border-[#f0d2ca] bg-white p-8 text-center text-[#514440]">Loading validation summary...</div>;
  }

  const summary = data?.summary || {};
  const recentUploads = data?.recentUploads || [];

  return (
    <section className="-m-4 min-h-[calc(100vh-5rem)] p-4 text-[#251E1F] sm:-m-6 sm:p-6"
      style={{ backgroundImage: "linear-gradient(90deg, #FDD9CD 0%, #fff8f5 15%, #fffaf8 58%, #FDD9CD 100%)" }}>
      <div className="mx-auto max-w-[1600px] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#f0d2ca] pb-5">
          <div>
            <h2 className="text-2xl font-bold">Invoice Validation Summary</h2>
            <p className="mt-1 text-sm text-[#6f5b55]">Monitor invoice upload results and investigate validation errors.</p>
          </div>
          <button type="button" onClick={() => load(true)} disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-[#ead3cc] bg-white px-4 py-2 text-sm font-bold hover:border-[#F38978] disabled:opacity-60">
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}

        <div className="grid gap-4 md:grid-cols-3">
          <ResultCard title="Total Uploads" value={summary.totalUploads} note="All recorded invoice upload batches" icon={FileClock} tone="bg-blue-50 text-blue-700" to={uploadHistoryPath} />
          <ResultCard title="Successful Uploads" value={summary.successfulUploads} note="Fully successful upload batches (all time)" icon={CheckCircle2} tone="bg-emerald-50 text-emerald-700" to={`${uploadHistoryPath}?status=Successful`} />
          <ResultCard title="Failed Uploads" value={summary.failedUploads} note="Failed validation or processing batches (all time)" icon={XCircle} tone="bg-rose-50 text-rose-700" to={`${uploadHistoryPath}?status=Failed`} />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="Latest Error Report" icon={FileWarning}>
            <ErrorReport upload={data?.latestErrorUpload} />
          </Panel>
          <Panel
            title="Validation Error List"
            icon={AlertCircle}
            action={(
              <Link
                to="/dashboard/invoicing/admin/dashboard/validation-errors"
                className="whitespace-nowrap text-xs font-bold text-[#F38978] hover:text-[#d96858]"
              >
                View all errors
              </Link>
            )}
          >
            <ValidationErrors errors={data?.validationErrors || []} />
          </Panel>
        </div>

        <div id="recent-uploads" className="scroll-mt-24">
          <Panel
            title="Recent Uploads"
            icon={Clock3}
            action={(
              <Link
                to={uploadHistoryPath}
                className="inline-flex items-center gap-2 rounded-lg border border-[#ead3cc] bg-white px-3 py-2 text-xs font-bold text-[#514440] hover:border-[#F38978] hover:text-[#F38978]"
              >
                View All Uploads <ArrowRight size={14} />
              </Link>
            )}
          >
            <p className="mb-4 text-xs text-[#7b6660]">Latest 5 recorded invoice upload batches, newest first.</p>
            <UploadHistory uploads={recentUploads} />
          </Panel>
        </div>
      </div>
    </section>
  );
}
