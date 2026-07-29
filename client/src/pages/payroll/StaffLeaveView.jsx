/**
 * EVALUATION HEADER
 * FEATURE: PAYROLL - STAFF
 * PURPOSE: Implements the Staff Leave View screen and its page-level interactions.
 * LAYER: Frontend page - renders a complete screen and coordinates its user interactions.
 * FIND RELATED CODE: Trace its imports for UI components and frontend services used by this screen.
 */
import { useEffect, useState } from "react";
import { Calendar, FileText, Upload, X } from "lucide-react";
import {
  applyLeave,
  getMyBalance,
  getMyApplications,
  cancelLeave,
  getLeaveTypes
} from "../../services/leaveService.js";

const SkeletonBar = ({ width = "100%", height = "h-4" }) => (
  <div className={`${height} rounded-lg bg-white/80 animate-pulse`} style={{ width }} />
);

function Panel({ title, children }) {
  return (
    <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-5">
      <h3 className="mb-3 text-lg font-semibold text-[#251E1F]">{title}</h3>
      {children}
    </div>
  );
}

function LeaveStatusBadge({ status }) {
  const styles = {
    pending: "border-amber-300/30 bg-amber-300/10 text-amber-700",
    approved: "border-emerald-300/30 bg-emerald-300/10 text-emerald-700",
    rejected: "border-red-300/30 bg-red-300/10 text-red-700",
    cancelled: "border-[#F0D2CA]/30 bg-[#FFF6F2]/10 text-[#7B6660]"
  };

  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : "Unknown";

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap ${styles[status] || styles.cancelled}`}>
      {label}
    </span>
  );
}

export default function StaffLeaveView() {
  const [balances, setBalances] = useState([]);
  const [applications, setApplications] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Form state
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [balanceData, appData, typesData] = await Promise.all([
        getMyBalance(),
        getMyApplications(),
        getLeaveTypes()
      ]);
      setBalances(Array.isArray(balanceData) ? balanceData : []);
      setApplications(Array.isArray(appData) ? appData : []);
      setLeaveTypes(Array.isArray(typesData) ? typesData : []);
    } catch (err) {
      console.error("Failed to load leave data:", err);
      showToast("Failed to load leave data. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  }

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  // Determine if selected leave type requires attachment
  const selectedType = leaveTypes.find(t => String(t.id) === String(selectedTypeId));
  const requiresAttachment = selectedType?.requires_attachment === 1 || selectedType?.requires_attachment === true;

  async function handleApply(e) {
    e.preventDefault();

    if (!selectedTypeId || !startDate || !endDate || !reason.trim()) {
      showToast("Please fill in all required fields.", "error");
      return;
    }

    if (requiresAttachment && !attachment) {
      showToast("Attachment is required for this leave type.", "error");
      return;
    }

    setSubmitting(true);
    try {
      await applyLeave({
        leave_type_id: selectedTypeId,
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim(),
        attachment: attachment || undefined
      });
      showToast("Leave application submitted successfully.");
      // Reset form
      setSelectedTypeId("");
      setStartDate("");
      setEndDate("");
      setReason("");
      setAttachment(null);
      // Refresh data
      await fetchData();
    } catch (err) {
      const msg = err?.message || "Failed to submit leave application.";
      showToast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(applicationId) {
    if (!window.confirm("Are you sure you want to cancel this leave application?")) return;

    setCancellingId(applicationId);
    try {
      await cancelLeave(applicationId);
      showToast("Leave application cancelled successfully.");
      await fetchData();
    } catch (err) {
      const msg = err?.message || "Failed to cancel leave application.";
      showToast(msg, "error");
    } finally {
      setCancellingId(null);
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-SG", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Skeleton: Balance cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-xl border border-[#f0d2ca] bg-white/80 p-4 space-y-3">
              <SkeletonBar width="60%" height="h-3" />
              <SkeletonBar width="80%" height="h-5" />
              <SkeletonBar width="100%" height="h-2" />
            </div>
          ))}
        </div>
        {/* Skeleton: Form */}
        <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-5 space-y-3">
          <SkeletonBar width="30%" height="h-4" />
          <SkeletonBar width="100%" height="h-10" />
          <SkeletonBar width="100%" height="h-10" />
          <SkeletonBar width="100%" height="h-20" />
        </div>
        {/* Skeleton: Table */}
        <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-5 space-y-3">
          <SkeletonBar width="30%" height="h-4" />
          {[1, 2, 3].map(i => <SkeletonBar key={i} height="h-12" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[70] w-full max-w-md rounded-xl border px-5 py-4 shadow-2xl backdrop-blur-sm animate-[slideDown_0.3s_ease-out] ${
          toast.type === "error"
            ? "border-red-400/30 bg-[#FDD9CD] text-red-700"
            : "border-emerald-400/30 bg-[#FFF6F2] text-emerald-700"
        }`}>
          <div className="flex items-center gap-3">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              toast.type === "error" ? "bg-red-500/20 text-red-700" : "bg-emerald-500/20 text-emerald-700"
            }`}>
              {toast.type === "error" ? "✕" : "✓"}
            </span>
            <p className="text-sm font-medium">{toast.message}</p>
          </div>
        </div>
      )}

      {/* Leave Balance Cards */}
      <div>
        <h3 className="mb-3 text-lg font-semibold text-[#251E1F]">Leave Balances</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {balances.map((bal) => {
            const entitled = Number(bal.entitled || 0) + Number(bal.carried_forward || 0);
            const used = Number(bal.used || 0);
            const remaining = entitled - used;
            const progressPercent = entitled > 0 ? Math.min((used / entitled) * 100, 100) : 0;

            return (
              <div key={bal.leave_type_id || bal.id} className="rounded-xl border border-[#f0d2ca] bg-white/80 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar size={16} className="text-[#F38978]" />
                  <p className="text-sm font-medium text-[#251E1F]">{bal.leave_type || bal.leave_type_name || bal.name || "Leave"}</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center mb-3">
                  <div>
                    <p className="text-xs text-[#7b6660]">Entitled</p>
                    <p className="text-sm font-semibold text-[#251E1F]">{entitled}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#7b6660]">Used</p>
                    <p className="text-sm font-semibold text-amber-400">{used}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#7b6660]">Remaining</p>
                    <p className="text-sm font-semibold text-emerald-400">{remaining}</p>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="h-2 w-full rounded-full bg-white/80 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#F38978] to-[#F38978] transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="mt-1 text-right text-xs text-[#7b6660]/60">
                  {used}/{entitled} days used
                </p>
              </div>
            );
          })}
          {balances.length === 0 && (
            <p className="text-sm text-[#7b6660] col-span-full">No leave balance records found.</p>
          )}
        </div>
      </div>

      {/* Apply Leave Form */}
      <Panel title="Apply for Leave">
        <form onSubmit={handleApply} className="space-y-4">
          {/* Leave Type */}
          <div>
            <label className="block text-xs text-[#7b6660] mb-1">Leave Type</label>
            <select
              value={selectedTypeId}
              onChange={(e) => setSelectedTypeId(e.target.value)}
              className="w-full rounded-lg border border-[#f0d2ca] bg-white/80 px-4 py-2.5 text-sm text-[#251E1F] focus:border-[#F38978] focus:outline-none focus:ring-1 focus:ring-[#F38978]"
            >
              <option value="" className="bg-[#fff3ee]">Select leave type...</option>
              {leaveTypes.map(type => (
                <option key={type.id} value={type.id} className="bg-[#fff3ee]">
                  {type.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Pickers */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-[#7b6660] mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-[#f0d2ca] bg-white/80 px-4 py-2.5 text-sm text-[#251E1F] focus:border-[#F38978] focus:outline-none focus:ring-1 focus:ring-[#F38978]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#7b6660] mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-[#f0d2ca] bg-white/80 px-4 py-2.5 text-sm text-[#251E1F] focus:border-[#F38978] focus:outline-none focus:ring-1 focus:ring-[#F38978]"
              />
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs text-[#7b6660] mb-1">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Enter your reason for leave..."
              className="w-full rounded-lg border border-[#f0d2ca] bg-white/80 px-4 py-2.5 text-sm text-[#251E1F] placeholder:text-[#251E1F]/30 focus:border-[#F38978] focus:outline-none focus:ring-1 focus:ring-[#F38978] resize-none"
            />
          </div>

          {/* Conditional File Upload */}
          {requiresAttachment && (
            <div>
              <label className="block text-xs text-[#7b6660] mb-1">
                Attachment <span className="text-red-400">*</span> (Required for {selectedType?.name})
              </label>
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#f0d2ca] bg-white/80 px-4 py-2.5 text-sm text-[#7b6660] hover:bg-[#FDD9CD]/45 transition">
                  <Upload size={16} />
                  {attachment ? attachment.name : "Choose file..."}
                  <input
                    type="file"
                    onChange={(e) => setAttachment(e.target.files[0] || null)}
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png"
                  />
                </label>
                {attachment && (
                  <button
                    type="button"
                    onClick={() => setAttachment(null)}
                    className="rounded-full p-1 text-red-700 hover:bg-red-500/20 transition"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            onClick={(e) => { if (submitting) e.preventDefault(); }}
            className="inline-flex items-center gap-2 rounded-lg bg-[#F38978] px-6 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {submitting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Submitting...
              </>
            ) : (
              <>
                <FileText size={16} />
                Submit Application
              </>
            )}
          </button>
        </form>
      </Panel>

      {/* Leave History Table */}
      <Panel title="Leave History">
        {applications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Calendar size={40} className="text-[#F38978]/40" />
            <p className="mt-3 text-sm text-[#7b6660]">No leave applications found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#f0d2ca] text-left">
                  <th className="px-3 py-2 text-xs uppercase tracking-wide text-[#7b6660]">Leave Type</th>
                  <th className="px-3 py-2 text-xs uppercase tracking-wide text-[#7b6660]">Start Date</th>
                  <th className="px-3 py-2 text-xs uppercase tracking-wide text-[#7b6660]">End Date</th>
                  <th className="px-3 py-2 text-xs uppercase tracking-wide text-[#7b6660]">Days</th>
                  <th className="px-3 py-2 text-xs uppercase tracking-wide text-[#7b6660]">Status</th>
                  <th className="px-3 py-2 text-xs uppercase tracking-wide text-[#7b6660]">Action</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => (
                  <tr key={app.id} className="border-b border-[#f0d2ca] hover:bg-[#FDD9CD]/30 transition">
                    <td className="px-3 py-3 text-[#251E1F]">{app.leave_type_name || app.type_name || "—"}</td>
                    <td className="px-3 py-3 text-[#7b6660]">{formatDate(app.start_date)}</td>
                    <td className="px-3 py-3 text-[#7b6660]">{formatDate(app.end_date)}</td>
                    <td className="px-3 py-3 text-[#251E1F] font-medium">{app.total_days || "—"}</td>
                    <td className="px-3 py-3">
                      <LeaveStatusBadge status={app.status} />
                    </td>
                    <td className="px-3 py-3">
                      {app.status === "pending" && (
                        <button
                          type="button"
                          onClick={() => handleCancel(app.id)}
                          disabled={cancellingId === app.id}
                          className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-400/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          {cancellingId === app.id ? "Cancelling..." : "Cancel"}
                        </button>
                      )}
                      {app.status === "approved" && (
                        <span className="text-xs text-[#7b6660]/50 italic">Contact HR to cancel</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
