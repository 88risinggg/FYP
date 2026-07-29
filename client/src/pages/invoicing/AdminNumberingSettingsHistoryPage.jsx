/**
 * EVALUATION HEADER
 * FEATURE: INVOICE - ADMIN
 * PURPOSE: Implements the Admin Numbering Settings History Page screen and its page-level interactions.
 * LAYER: Frontend page - renders a complete screen and coordinates its user interactions.
 * FIND RELATED CODE: Trace its imports for UI components and frontend services used by this screen.
 */
import { AlertCircle, ChevronLeft, ChevronRight, Clock3, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import AdminInvoicingFullView from "../../components/invoicing/AdminInvoicingFullView.jsx";
import { getNumberingSettingsHistory } from "../../services/adminInvoiceSettingsService.js";

const settingsPath = "/dashboard/invoicing/admin/invoice-settings/numbering";
const pageSize = 20;

function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Singapore"
  }).format(new Date(value));
}

function displayValue(value) {
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

export default function AdminNumberingSettingsHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(Math.max(1, Number(searchParams.get("page")) || 1));
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize,
    total: 0,
    totalPages: 1
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getNumberingSettingsHistory({ page, pageSize });
      setRecords(data.records || []);
      setPagination(data.pagination || {
        page,
        pageSize,
        total: 0,
        totalPages: 1
      });
      setSearchParams({ page: String(page) }, { replace: true });
    } catch (requestError) {
      setError(requestError?.message || "Unable to load numbering settings history.");
    } finally {
      setLoading(false);
    }
  }, [page, setSearchParams]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AdminInvoicingFullView
      title="Numbering Settings History"
      description="Review all invoice numbering setting changes, newest first."
      backTo={settingsPath}
      backLabel="Back to Numbering Settings"
      icon={Clock3}
      count={pagination.total}
      countLabel={pagination.total === 1 ? "numbering change" : "numbering changes"}
      actions={(
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-[#ead3cc] bg-white px-4 py-2 text-sm font-bold hover:border-[#F38978] disabled:opacity-60"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      )}
    >
      <section className="overflow-hidden rounded-2xl border border-[#f0d2ca] bg-white shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
        {error ? (
          <div className="m-5 rounded-xl border border-[#FDD9CD] bg-[#FDD9CD] p-4 text-sm text-red-700">
            <p className="flex items-center gap-2"><AlertCircle size={17} />{error}</p>
            <button type="button" onClick={load} className="mt-3 inline-flex items-center gap-2 font-bold">
              <RefreshCw size={15} /> Retry
            </button>
          </div>
        ) : loading && !records.length ? (
          <div className="flex min-h-72 items-center justify-center gap-2 text-[#7b6660]">
            <Loader2 size={20} className="animate-spin" /> Loading numbering settings history...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead>
                <tr className="border-y border-[#f0d2ca] bg-[#fff8f5] text-xs font-bold uppercase text-[#7b6660]">
                  <th className="px-4 py-3">Date &amp; Time</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Old Value</th>
                  <th className="px-4 py-3">New Value</th>
                  <th className="px-4 py-3">Changed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f5e2dc]">
                {!records.length ? (
                  <tr>
                    <td colSpan="5" className="px-4 py-14 text-center font-semibold text-[#7b6660]">
                      No numbering settings history found.
                    </td>
                  </tr>
                ) : records.map((record) => (
                  <tr key={record.id} className="align-top transition hover:bg-[#fff8f5]">
                    <td className="whitespace-nowrap px-4 py-3 font-semibold">{formatDateTime(record.createdAt)}</td>
                    <td className="px-4 py-3 font-semibold">{displayValue(record.action)}</td>
                    <td className="px-4 py-3 text-[#7b6660]">{displayValue(record.oldValue)}</td>
                    <td className="px-4 py-3 font-semibold">{displayValue(record.newValue)}</td>
                    <td className="px-4 py-3 text-[#7b6660]">{displayValue(record.changedBy || "System")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!error && records.length ? (
          <div className="flex items-center justify-between gap-4 border-t border-[#f0d2ca] px-5 py-4 text-sm">
            <span className="text-[#7b6660]">Showing {records.length} of {pagination.total} changes</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Previous page"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#f0d2ca] disabled:opacity-40"
              >
                <ChevronLeft size={17} />
              </button>
              <span>Page {pagination.page} of {pagination.totalPages}</span>
              <button
                type="button"
                aria-label="Next page"
                disabled={page >= pagination.totalPages || loading}
                onClick={() => setPage((current) => current + 1)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#f0d2ca] disabled:opacity-40"
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </AdminInvoicingFullView>
  );
}
