import {
  ChevronLeft,
  ChevronRight,
  FileClock,
  FilterX,
  RefreshCw,
  Search
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import AdminInvoicingFullView, {
  ActiveFilters,
  FullViewEmpty,
  FullViewError,
  FullViewLoading
} from "../../components/invoicing/AdminInvoicingFullView.jsx";
import { fetchInvoiceUploadHistory } from "../../services/adminDashboardService.js";

const summaryPath = "/dashboard/invoicing/admin/dashboard/validation-summary#recent-uploads";

const statusStyles = {
  Pending: "bg-amber-50 text-amber-700",
  Successful: "bg-emerald-50 text-emerald-700",
  "Partial Success": "bg-sky-50 text-sky-700",
  Failed: "bg-rose-50 text-rose-700"
};

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

function formatDuration(milliseconds) {
  if (milliseconds === null || milliseconds === undefined) return "-";
  const seconds = Math.max(0, Math.round(Number(milliseconds) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${statusStyles[status] || statusStyles.Pending}`}>
      {status || "Pending"}
    </span>
  );
}

function filtersFromParams(searchParams) {
  return {
    startDate: searchParams.get("startDate") || "",
    endDate: searchParams.get("endDate") || "",
    status: searchParams.get("status") || "",
    uploadedBy: searchParams.get("uploadedBy") || "",
    fileName: searchParams.get("fileName") || "",
    batchId: searchParams.get("batchId") || "",
    sort: searchParams.get("sort") || "latest",
    page: Number(searchParams.get("page")) || 1,
    pageSize: 20
  };
}

export default function AdminInvoiceUploadHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilters = filtersFromParams(searchParams);
  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [data, setData] = useState({ uploads: [], uploaders: [], pagination: {} });
  const [expandedUploadId, setExpandedUploadId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load(nextFilters = appliedFilters, background = false) {
    if (background) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      setData(await fetchInvoiceUploadHistory(nextFilters));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load(appliedFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedFilters]);

  function applyFilters(event) {
    event?.preventDefault();
    const next = { ...filters, page: 1 };
    const query = {};
    Object.entries(next).forEach(([key, value]) => {
      if (value !== "" && value !== 1 && key !== "pageSize") query[key] = String(value);
    });
    setSearchParams(query, { replace: true });
    setFilters(next);
    setAppliedFilters(next);
  }

  function clearFilters() {
    const next = {
      startDate: "", endDate: "", status: "", uploadedBy: "", fileName: "",
      batchId: "", sort: "latest", page: 1, pageSize: 20
    };
    setSearchParams({}, { replace: true });
    setFilters(next);
    setAppliedFilters(next);
  }

  function changePage(page) {
    const next = { ...appliedFilters, page };
    const query = Object.fromEntries(
      Object.entries(next).filter(([key, value]) => value !== "" && value !== 1 && key !== "pageSize")
    );
    setSearchParams(query, { replace: true });
    setFilters(next);
    setAppliedFilters(next);
  }

  const uploads = data.uploads || [];
  const pagination = data.pagination || {};
  const dateError = filters.startDate && filters.endDate && filters.startDate > filters.endDate
    ? "End date must be on or after the start date."
    : "";
  const visibleFilters = {
    ...(appliedFilters.startDate ? { startDate: appliedFilters.startDate } : {}),
    ...(appliedFilters.endDate ? { endDate: appliedFilters.endDate } : {}),
    ...(appliedFilters.status ? { status: appliedFilters.status } : {}),
    ...(appliedFilters.uploadedBy ? { uploadedBy: appliedFilters.uploadedBy } : {}),
    ...(appliedFilters.fileName ? { fileName: appliedFilters.fileName } : {}),
    ...(appliedFilters.batchId ? { batchId: appliedFilters.batchId } : {}),
    ...(appliedFilters.sort !== "latest" ? { sort: appliedFilters.sort } : {})
  };

  return (
    <AdminInvoicingFullView
      title="Invoice Upload History"
      description="Review invoice file uploads, processing results and validation outcomes."
      backTo={summaryPath}
      backLabel="Back to Invoice Validation Summary"
      icon={FileClock}
      count={pagination.total || 0}
      countLabel={pagination.total === 1 ? "upload record" : "upload records"}
      actions={(
        <button type="button" onClick={() => load(appliedFilters, true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-lg border border-[#ead3cc] bg-white px-4 py-2 text-sm font-bold hover:border-[#F38978] disabled:opacity-60">
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      )}
    >
        <form onSubmit={applyFilters} className="rounded-xl border border-[#f0d2ca] bg-white/95 p-4 shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
            <input type="date" aria-label="Start date" value={filters.startDate} onChange={(event) => setFilters({ ...filters, startDate: event.target.value })} className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm" />
            <input type="date" aria-label="End date" value={filters.endDate} onChange={(event) => setFilters({ ...filters, endDate: event.target.value })} className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm" />
            <select aria-label="Upload status" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })} className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm">
              <option value="">All statuses</option>
              <option>Successful</option>
              <option>Partial Success</option>
              <option>Failed</option>
              <option>Pending</option>
            </select>
            <input list="invoice-uploaders" placeholder="Uploaded by" value={filters.uploadedBy} onChange={(event) => setFilters({ ...filters, uploadedBy: event.target.value })} className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm" />
            <datalist id="invoice-uploaders">{(data.uploaders || []).map((uploader) => <option key={uploader} value={uploader} />)}</datalist>
            <input placeholder="File name" value={filters.fileName} onChange={(event) => setFilters({ ...filters, fileName: event.target.value })} className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm" />
            <input placeholder="Upload batch ID" value={filters.batchId} onChange={(event) => setFilters({ ...filters, batchId: event.target.value })} className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm" />
            <select aria-label="Sort uploads" value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })} className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm">
              <option value="latest">Latest upload</option>
              <option value="oldest">Oldest upload</option>
              <option value="invalid-desc">Highest invalid rows</option>
              <option value="created-desc">Highest created invoices</option>
            </select>
            <div className="flex gap-2">
              <button type="submit" disabled={Boolean(dateError)} className="primary-button inline-flex flex-1 items-center justify-center gap-2 px-3 py-2 text-sm font-bold disabled:opacity-50"><Search size={15} /> Apply Filters</button>
              <button type="button" onClick={clearFilters} className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#ead3cc] px-3 py-2 text-sm font-bold text-[#7b6660] hover:text-[#F38978]"><FilterX size={16} /> Clear Filters</button>
            </div>
          </div>
          {dateError ? <p className="mt-3 text-sm font-semibold text-rose-700" role="alert">{dateError}</p> : <div className="mt-3"><ActiveFilters filters={visibleFilters} labels={{ startDate: "From", endDate: "To", status: "Status", uploadedBy: "Uploaded by", fileName: "File", batchId: "Batch", sort: "Sort" }} /></div>}
        </form>

        {error ? <FullViewError message="The invoice upload history could not be loaded." onRetry={() => load(appliedFilters)} backTo={summaryPath} backLabel="Back to Invoice Validation Summary" /> : null}

        {!error ? <section className="overflow-hidden rounded-xl border border-[#f0d2ca] bg-white/95 shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f0d2ca] px-5 py-4">
            <h3 className="font-bold">Upload batches</h3>
            <p className="text-sm text-[#7b6660]">{formatCount(pagination.total)} records</p>
          </div>
          {loading ? <FullViewLoading label="Loading invoice upload history..." /> : uploads.length === 0 ? <FullViewEmpty message="No upload records match the selected filters." hasFilters={Object.keys(visibleFilters).length > 0} onClear={clearFilters} /> : <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#fff8f5] text-xs uppercase text-[#7b6660]">
                <tr>
                  <th className="px-3 py-3">File Name</th><th className="px-3 py-3">Batch ID</th><th className="px-3 py-3">Uploaded By</th><th className="px-3 py-3">Uploaded At</th>
                  <th className="px-3 py-3">Total</th><th className="px-3 py-3">Valid</th><th className="px-3 py-3">Invalid</th><th className="px-3 py-3">Created</th>
                  <th className="px-3 py-3">Status</th><th className="px-3 py-3">Duration</th><th className="px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((upload) => (
                  <UploadRow key={upload.uploadId} upload={upload} expanded={expandedUploadId === upload.uploadId} onToggle={() => setExpandedUploadId(expandedUploadId === upload.uploadId ? null : upload.uploadId)} />
                ))}
              </tbody>
            </table>
          </div>}
          <div className="flex items-center justify-between gap-4 border-t border-[#f0d2ca] px-5 py-4">
            <p className="text-sm text-[#7b6660]">Page {pagination.page || 1} of {pagination.totalPages || 1}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => changePage((pagination.page || 1) - 1)} disabled={(pagination.page || 1) <= 1} className="inline-flex items-center gap-1 rounded-lg border border-[#ead3cc] px-3 py-2 text-sm font-bold disabled:opacity-40"><ChevronLeft size={15} /> Previous</button>
              <button type="button" onClick={() => changePage((pagination.page || 1) + 1)} disabled={(pagination.page || 1) >= (pagination.totalPages || 1)} className="inline-flex items-center gap-1 rounded-lg border border-[#ead3cc] px-3 py-2 text-sm font-bold disabled:opacity-40">Next <ChevronRight size={15} /></button>
            </div>
          </div>
        </section> : null}
    </AdminInvoicingFullView>
  );
}

function UploadRow({ upload, expanded, onToggle }) {
  return (
    <>
      <tr className="border-t border-[#f4ded7] align-top hover:bg-[#fff8f5]">
        <td className="max-w-56 truncate px-3 py-3 font-bold" title={upload.fileName}>{upload.fileName}</td>
        <td className="max-w-48 truncate px-3 py-3 font-mono text-xs" title={upload.uploadBatchId}>{upload.uploadBatchId}</td>
        <td className="px-3 py-3 text-[#514440]">{upload.uploaderEmail}</td>
        <td className="whitespace-nowrap px-3 py-3 text-[#514440]">{formatDateTime(upload.uploadedAt)}</td>
        <td className="px-3 py-3">{formatCount(upload.totalRows)}</td><td className="px-3 py-3 font-semibold text-emerald-700">{formatCount(upload.validRows)}</td>
        <td className="px-3 py-3 font-semibold text-rose-700">{formatCount(upload.invalidRows)}</td><td className="px-3 py-3">{formatCount(upload.createdInvoices)}</td>
        <td className="px-3 py-3"><StatusBadge status={upload.status} /></td><td className="whitespace-nowrap px-3 py-3">{formatDuration(upload.processingDurationMs)}</td>
        <td className="whitespace-nowrap px-3 py-3">
          <button type="button" onClick={onToggle} className="font-bold text-[#F38978] hover:text-[#d96858]">{expanded ? "Hide Details" : "View Details"}</button>
          {upload.invalidRows > 0 || upload.errorMessage ? <Link to={`/dashboard/invoicing/admin/dashboard/validation-errors/${upload.uploadId}`} className="ml-3 font-bold text-rose-600 hover:text-rose-700">View Error Report</Link> : null}
        </td>
      </tr>
      {expanded ? (
        <tr className="bg-[#fff8f5]"><td colSpan="11" className="px-4 py-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div><p className="text-xs font-bold uppercase text-[#7b6660]">File type</p><p className="mt-1 text-sm">{upload.fileType || "-"}</p></div>
            <div><p className="text-xs font-bold uppercase text-[#7b6660]">Completed at</p><p className="mt-1 text-sm">{formatDateTime(upload.completedAt)}</p></div>
            <div><p className="text-xs font-bold uppercase text-[#7b6660]">Processing message</p><p className="mt-1 text-sm">{upload.errorMessage || "No upload-level error recorded."}</p></div>
          </div>
        </td></tr>
      ) : null}
    </>
  );
}
