import { AlertCircle, ChevronLeft, ChevronRight, FilterX, RefreshCw, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, useParams, useSearchParams } from "react-router-dom";

import AdminInvoicingFullView, {
  ActiveFilters,
  displayValue,
  FullViewEmpty,
  FullViewError,
  FullViewLoading,
  FullViewStatus
} from "../../components/invoicing/AdminInvoicingFullView.jsx";
import { fetchInvoiceValidationErrors } from "../../services/adminDashboardService.js";

const summaryPath = "/dashboard/invoicing/admin/dashboard/validation-summary";

function formatDateTime(value) {
  if (!value) return "\u2014";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "\u2014";
  return new Intl.DateTimeFormat("en-SG", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Singapore" }).format(date);
}

function readFilters(params) {
  return {
    batchId: params.get("batchId") || "",
    fileName: params.get("fileName") || "",
    errorStatus: params.get("errorStatus") || "",
    errorCategory: params.get("errorCategory") || "",
    fieldName: params.get("fieldName") || "",
    keyword: params.get("keyword") || "",
    startDate: params.get("startDate") || "",
    endDate: params.get("endDate") || ""
  };
}

export default function AdminValidationErrorsPage() {
  const routeParams = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const legacyUploadId = searchParams.get("uploadId");
  const uploadId = routeParams.uploadId || legacyUploadId || "";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const [filters, setFilters] = useState(() => readFilters(searchParams));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const dateError = filters.startDate && filters.endDate && filters.startDate > filters.endDate
    ? "End date must be on or after the start date."
    : "";

  async function load() {
    setLoading(true);
    setError("");
    try {
      setData(await fetchInvoiceValidationErrors({ uploadId, page, pageSize: 20, ...Object.fromEntries(searchParams.entries()) }));
    } catch (requestError) {
      setError(requestError?.message || "Unable to load invoice validation errors.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [uploadId, searchParams.toString()]);

  function applyFilters(event) {
    event.preventDefault();
    if (dateError) return;
    const next = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value) next.set(key, value); });
    setSearchParams(next);
  }

  function clearFilters() {
    const next = readFilters(new URLSearchParams());
    setFilters(next);
    setSearchParams({});
  }

  function goToPage(nextPage) {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(nextPage));
    setSearchParams(next);
  }

  const errors = data?.errors || [];
  const pagination = data?.pagination || { page: 1, total: 0, totalPages: 1 };
  const upload = data?.upload;
  const appliedFilters = readFilters(searchParams);
  const hasFilters = Object.values(appliedFilters).some(Boolean);

  if (uploadId && !/^\d+$/.test(uploadId)) {
    return <Navigate to={summaryPath} replace />;
  }

  return (
    <AdminInvoicingFullView
      title={uploadId ? "Invoice Validation Error Report" : "Invoice Validation Errors"}
      description={uploadId ? "Review full upload context and row-level problems found during invoice file validation." : "Review row-level problems found across invoice file validation uploads."}
      backTo={summaryPath}
      backLabel="Back to Invoice Validation Summary"
      icon={AlertCircle}
      count={pagination.total}
      countLabel={pagination.total === 1 ? "validation error" : "validation errors"}
      actions={<button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-[#ead3cc] bg-white px-4 py-2 text-sm font-bold hover:border-[#F38978] disabled:opacity-60"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh</button>}
    >
      {upload ? (
        <section className="rounded-lg border border-[#f0d2ca] bg-white p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Context label="File Name" value={upload.fileName} />
            <Context label="Upload Batch" value={upload.uploadBatchId} />
            <Context label="Uploaded By" value={upload.uploaderEmail} />
            <Context label="Uploaded At" value={formatDateTime(upload.uploadedAt)} />
            <div><p className="text-xs font-bold uppercase text-[#7b6660]">Upload Status</p><div className="mt-1"><FullViewStatus value={upload.status} /></div></div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#f4ded7] pt-4 sm:grid-cols-4">
            <Context label="Total Rows" value={upload.totalRows} />
            <Context label="Valid Rows" value={upload.validRows} />
            <Context label="Invalid Rows" value={upload.invalidRows} />
            <Context label="Created Invoices" value={upload.createdInvoices} />
          </div>
          {data?.categorySummary?.length ? <div className="mt-4 flex flex-wrap gap-2 border-t border-[#F0D2CA] pt-4" aria-label="Error category summary">{data.categorySummary.map((item) => <span key={item.category} className="rounded-full bg-[#fff0eb] px-3 py-1 text-xs font-bold text-rose-700">{item.category}: {item.count}</span>)}</div> : null}
        </section>
      ) : null}

      {!uploadId ? (
        <form onSubmit={applyFilters} className="rounded-lg border border-[#f0d2ca] bg-white p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <input value={filters.batchId} onChange={(event) => setFilters({ ...filters, batchId: event.target.value })} aria-label="Upload batch" placeholder="Upload batch" className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm" />
            <input value={filters.fileName} onChange={(event) => setFilters({ ...filters, fileName: event.target.value })} aria-label="File name" placeholder="File name" className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm" />
            <select value={filters.errorStatus} onChange={(event) => setFilters({ ...filters, errorStatus: event.target.value })} aria-label="Error status" className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm"><option value="">All error statuses</option><option>Open</option><option>Resolved</option></select>
            <input value={filters.errorCategory} onChange={(event) => setFilters({ ...filters, errorCategory: event.target.value })} aria-label="Error category" placeholder="Error category" className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm" />
            <input value={filters.fieldName} onChange={(event) => setFilters({ ...filters, fieldName: event.target.value })} aria-label="Field name" placeholder="Field name" className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm" />
            <input value={filters.keyword} onChange={(event) => setFilters({ ...filters, keyword: event.target.value })} aria-label="Search validation errors" placeholder="Invoice, customer or message" className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm xl:col-span-2" />
            <input type="date" value={filters.startDate} max={filters.endDate || undefined} onChange={(event) => setFilters({ ...filters, startDate: event.target.value })} aria-label="Start date" className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm" />
            <input type="date" value={filters.endDate} min={filters.startDate || undefined} onChange={(event) => setFilters({ ...filters, endDate: event.target.value })} aria-label="End date" className="rounded-lg border border-[#ead3cc] px-3 py-2 text-sm" />
            <div className="flex gap-2"><button type="submit" disabled={Boolean(dateError)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#F38978] px-3 py-2 text-sm font-bold text-white disabled:opacity-50"><Search size={15} /> Apply Filters</button><button type="button" onClick={clearFilters} className="inline-flex items-center gap-2 rounded-lg border border-[#ead3cc] px-3 py-2 text-sm font-bold"><FilterX size={15} /> Clear</button></div>
          </div>
          <div className="mt-3">{dateError ? <p className="text-sm font-semibold text-rose-700" role="alert">{dateError}</p> : <ActiveFilters filters={Object.fromEntries(Object.entries(appliedFilters).filter(([, value]) => value))} labels={{ batchId: "Batch", fileName: "File", errorStatus: "Status", errorCategory: "Category", fieldName: "Field", keyword: "Search", startDate: "From", endDate: "To" }} />}</div>
        </form>
      ) : null}

      {error ? <FullViewError message="The validation error report could not be loaded." onRetry={load} backTo={summaryPath} backLabel="Back to Invoice Validation Summary" /> : (
        <section className="overflow-hidden rounded-lg border border-[#f0d2ca] bg-white">
          {loading ? <FullViewLoading label="Loading validation errors..." /> : !errors.length ? <FullViewEmpty message={uploadId ? "No validation errors were found for this upload." : "No validation errors match the selected filters."} hasFilters={hasFilters} onClear={clearFilters} /> : (
            <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="bg-[#fff8f5] text-xs uppercase text-[#7b6660]"><th className="px-3 py-3">File Name</th><th className="px-3 py-3">Upload Batch</th><th className="px-3 py-3">Row</th><th className="px-3 py-3">Invoice / Order</th><th className="px-3 py-3">Customer</th><th className="px-3 py-3">Field Name</th><th className="px-3 py-3">Invalid Value</th><th className="px-3 py-3">Error Message</th><th className="px-3 py-3">Error Status</th><th className="px-3 py-3">Resolved By</th><th className="px-3 py-3">Resolved At</th></tr></thead><tbody className="divide-y divide-[#F0D2CA]">{errors.map((item) => <tr key={item.validationErrorId} className="align-top hover:bg-[#fff8f5]"><td className="max-w-52 truncate px-3 py-3 font-bold" title={item.fileName}>{displayValue(item.fileName)}</td><td className="max-w-44 truncate px-3 py-3 font-mono text-xs" title={item.uploadBatchId}>{displayValue(item.uploadBatchId)}</td><td className="px-3 py-3">{displayValue(item.rowNumber)}</td><td className="px-3 py-3">{displayValue(item.invoiceNumber)}</td><td className="px-3 py-3">{displayValue(item.customerName)}</td><td className="px-3 py-3">{displayValue(item.fieldName)}</td><td className="max-w-48 truncate px-3 py-3" title={String(item.invalidValue ?? "")}>{displayValue(item.invalidValue)}</td><td className="min-w-72 px-3 py-3 text-rose-700">{displayValue(item.errorMessage)}</td><td className="px-3 py-3"><FullViewStatus value={item.errorStatus} /></td><td className="px-3 py-3">{displayValue(item.resolvedBy)}</td><td className="whitespace-nowrap px-3 py-3">{formatDateTime(item.resolvedAt)}</td></tr>)}</tbody></table></div>
          )}
          {!loading && errors.length ? <div className="flex items-center justify-between gap-4 border-t border-[#f0d2ca] px-5 py-4"><p className="text-sm text-[#7b6660]">Showing {errors.length} of {pagination.total} validation errors</p><div className="flex items-center gap-2"><button type="button" aria-label="Previous page" disabled={pagination.page <= 1} onClick={() => goToPage(pagination.page - 1)} className="rounded-lg border border-[#ead3cc] p-2 disabled:opacity-40"><ChevronLeft size={16} /></button><span className="text-sm">Page {pagination.page} of {pagination.totalPages}</span><button type="button" aria-label="Next page" disabled={pagination.page >= pagination.totalPages} onClick={() => goToPage(pagination.page + 1)} className="rounded-lg border border-[#ead3cc] p-2 disabled:opacity-40"><ChevronRight size={16} /></button></div></div> : null}
        </section>
      )}
    </AdminInvoicingFullView>
  );
}

function Context({ label, value }) {
  return <div className="min-w-0"><p className="text-xs font-bold uppercase text-[#7b6660]">{label}</p><p className="mt-1 truncate text-sm font-semibold" title={String(value ?? "")}>{displayValue(value)}</p></div>;
}
