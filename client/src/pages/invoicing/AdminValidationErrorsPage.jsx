import { AlertCircle, ArrowLeft, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { fetchInvoiceValidationErrors } from "../../services/adminDashboardService.js";

const summaryPath = "/dashboard/invoicing/admin/dashboard/validation-summary";

const statusStyles = {
  Pending: "bg-amber-50 text-amber-700",
  Validated: "bg-blue-50 text-blue-700",
  Successful: "bg-emerald-50 text-emerald-700",
  Failed: "bg-rose-50 text-rose-700"
};

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

export default function AdminValidationErrorsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      setData(await fetchInvoiceValidationErrors());
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

  if (loading) {
    return <div className="rounded-xl border border-[#f0d2ca] bg-white p-8 text-center text-[#514440]">Loading validation errors...</div>;
  }

  const errors = data?.errors || [];

  return (
    <section
      className="-m-4 min-h-[calc(100vh-5rem)] p-4 text-[#251E1F] sm:-m-6 sm:p-6"
      style={{ backgroundImage: "linear-gradient(90deg, #FDD9CD 0%, #fff8f5 15%, #fffaf8 58%, #FDD9CD 100%)" }}
    >
      <div className="mx-auto max-w-[1600px] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#f0d2ca] pb-5">
          <div>
            <Link to={summaryPath} className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-[#F38978] hover:text-[#d96858]">
              <ArrowLeft size={16} /> Back to Validation Summary
            </Link>
            <h2 className="text-2xl font-bold">All Invoice Validation Errors</h2>
            <p className="mt-1 text-sm text-[#6f5b55]">
              {errors.length} recorded {errors.length === 1 ? "error" : "errors"} across invoice uploads.
            </p>
          </div>
          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-[#ead3cc] bg-white px-4 py-2 text-sm font-bold hover:border-[#F38978] disabled:opacity-60"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}

        <section className="rounded-xl border border-[#f0d2ca] bg-white/95 p-5 shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
          <div className="mb-4 flex items-center gap-2">
            <AlertCircle size={18} className="text-[#F38978]" />
            <h3 className="text-[15px] font-bold">Validation Error Records</h3>
          </div>

          {!errors.length ? (
            <div className="rounded-lg border border-dashed border-[#f0c9bf] bg-[#fff8f5] px-4 py-8 text-center text-sm text-[#7b6660]">
              No invoice validation errors have been recorded.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-y border-[#f0d2ca] bg-[#fff8f5] text-xs uppercase text-[#7b6660]">
                    <th className="px-3 py-3">File name</th>
                    <th className="px-3 py-3">Row</th>
                    <th className="px-3 py-3">Invoice #</th>
                    <th className="px-3 py-3">Field</th>
                    <th className="px-3 py-3">Error</th>
                    <th className="px-3 py-3">Uploaded by</th>
                    <th className="px-3 py-3">Uploaded at</th>
                    <th className="px-3 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {errors.map((item) => (
                    <tr key={item.validationErrorId} className="border-b border-[#f4ded7] align-top hover:bg-[#fff8f5]">
                      <td className="max-w-56 truncate px-3 py-3 font-bold" title={item.fileName}>{item.fileName}</td>
                      <td className="px-3 py-3 font-bold">{item.rowNumber ?? "File"}</td>
                      <td className="px-3 py-3 text-[#514440]">{item.invoiceNumber || "-"}</td>
                      <td className="px-3 py-3 text-[#514440]">{item.fieldName}</td>
                      <td className="min-w-72 px-3 py-3 text-rose-700">{item.errorMessage}</td>
                      <td className="px-3 py-3 text-[#514440]">{item.uploaderEmail}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-[#514440]">{formatDateTime(item.uploadedAt)}</td>
                      <td className="px-3 py-3"><StatusBadge status={item.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
