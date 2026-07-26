import { useEffect, useState } from "react";
import { Calendar, Check, X, Search, Settings, Clock, Filter, RefreshCw } from "lucide-react";
import {
  getPendingApplications,
  getAllApplications,
  updateLeaveStatus,
  getLeaveTypes,
  updateLeaveType,
  runCarryForward
} from "../../services/leaveService.js";

const SkeletonBar = ({ width = "100%", height = "h-4" }) => (
  <div className={`${height} rounded-lg bg-white/80 animate-pulse`} style={{ width }} />
);

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

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export default function HRLeaveManagement() {
  const [activeTab, setActiveTab] = useState("pending");
  const [pendingApps, setPendingApps] = useState([]);
  const [allApps, setAllApps] = useState([]);
  const [allAppsTotal, setAllAppsTotal] = useState(0);
  const [allAppsPage, setAllAppsPage] = useState(1);
  const PAGE_SIZE = 50;
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Action state for approve/reject
  const [actionId, setActionId] = useState(null);
  const [actionType, setActionType] = useState(null);
  const [actionComment, setActionComment] = useState("");
  const [processing, setProcessing] = useState(false);

  // Filters for All Applications tab
  const [filterName, setFilterName] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

  // Leave type config edit state
  const [editingType, setEditingType] = useState(null);
  const [editEntitlement, setEditEntitlement] = useState("");
  const [editCarryCap, setEditCarryCap] = useState("");
  const [editRequiresAttachment, setEditRequiresAttachment] = useState(false);
  const [savingType, setSavingType] = useState(false);

  // Carry-forward state
  const [carryForwardYear, setCarryForwardYear] = useState(String(new Date().getFullYear() - 1));
  const [showCarryForwardConfirm, setShowCarryForwardConfirm] = useState(false);
  const [carryForwardProcessing, setCarryForwardProcessing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [pendingData, allData, typesData] = await Promise.all([
        getPendingApplications(),
        getAllApplications({ page: allAppsPage, pageSize: PAGE_SIZE }),
        getLeaveTypes()
      ]);
      setPendingApps(Array.isArray(pendingData) ? pendingData : []);
      const appsArray = Array.isArray(allData) ? allData : (allData?.applications ?? []);
      setAllApps(appsArray);
      setAllAppsTotal(allData?.total ?? appsArray.length);
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

  async function handleAction(applicationId, status) {
    setProcessing(true);
    try {
      await updateLeaveStatus(applicationId, {
        status,
        hr_comment: actionComment.trim() || undefined
      });
      showToast(`Leave application ${status} successfully.`);
      setActionId(null);
      setActionType(null);
      setActionComment("");
      await fetchData();
    } catch (err) {
      const msg = err?.message || `Failed to ${status} leave application.`;
      showToast(msg, "error");
    } finally {
      setProcessing(false);
    }
  }

  function openAction(appId, type) {
    setActionId(appId);
    setActionType(type);
    setActionComment("");
  }

  function cancelAction() {
    setActionId(null);
    setActionType(null);
    setActionComment("");
  }

  async function handleSaveLeaveType(typeId) {
    setSavingType(true);
    try {
      await updateLeaveType(typeId, {
        default_entitlement: Number(editEntitlement),
        carry_forward_cap: Number(editCarryCap),
        requires_attachment: editRequiresAttachment
      });
      showToast("Leave type updated successfully.");
      setEditingType(null);
      const typesData = await getLeaveTypes();
      setLeaveTypes(Array.isArray(typesData) ? typesData : []);
    } catch (err) {
      const msg = err?.message || "Failed to update leave type.";
      showToast(msg, "error");
    } finally {
      setSavingType(false);
    }
  }

  function startEditType(type) {
    setEditingType(type.id);
    setEditEntitlement(String(type.default_entitlement || 0));
    setEditCarryCap(String(type.carry_forward_cap || 0));
    setEditRequiresAttachment(
      type.requires_attachment === 1 || type.requires_attachment === true
    );
  }

  async function handleRunCarryForward() {
    setCarryForwardProcessing(true);
    try {
      const result = await runCarryForward({ from_year: Number(carryForwardYear) });
      const count = result?.records_processed ?? result?.count ?? 0;
      showToast(`Carry-forward completed successfully. ${count} record(s) processed.`);
      setShowCarryForwardConfirm(false);
    } catch (err) {
      const msg = err?.message || "Failed to run carry-forward.";
      showToast(msg, "error");
      setShowCarryForwardConfirm(false);
    } finally {
      setCarryForwardProcessing(false);
    }
  }

  // Filter logic for All Applications
  const filteredApps = allApps.filter((app) => {
    if (filterName) {
      const name = (app.staff_name || app.name || "").toLowerCase();
      if (!name.includes(filterName.toLowerCase())) return false;
    }
    if (filterType) {
      const typeId = String(app.leave_type_id || "");
      if (typeId !== filterType) return false;
    }
    if (filterStatus && app.status !== filterStatus) return false;
    if (filterStartDate) {
      const appStart = new Date(app.start_date);
      if (appStart < new Date(filterStartDate)) return false;
    }
    if (filterEndDate) {
      const appEnd = new Date(app.end_date);
      if (appEnd > new Date(filterEndDate)) return false;
    }
    return true;
  });

  const tabs = [
    { id: "pending", label: "Pending Approvals", icon: Clock },
    { id: "all", label: "All Applications", icon: Filter },
    { id: "config", label: "Leave Configuration", icon: Settings }
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg bg-white/80 px-6 py-3">
              <SkeletonBar width="100px" height="h-4" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-5 space-y-3">
          <SkeletonBar width="30%" height="h-4" />
          {[1, 2, 3, 4].map((i) => (
            <SkeletonBar key={i} height="h-14" />
          ))}
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

      {/* Tab Navigation */}
      <div className="flex gap-1 rounded-xl border border-[#f0d2ca] bg-white/80 p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "bg-[#F38978] text-white shadow-lg"
                  : "text-[#7b6660] hover:bg-white/80 hover:text-[#251E1F]"
              }`}
            >
              <Icon size={16} />
              {tab.label}
              {tab.id === "pending" && pendingApps.length > 0 && (
                <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400/20 text-xs font-bold text-amber-700">
                  {pendingApps.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── Pending Approvals Tab ──────────────────────────────────── */}
      {activeTab === "pending" && (
        <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-5">
          <h3 className="mb-4 text-lg font-semibold text-[#251E1F]">Pending Leave Approvals</h3>
          {pendingApps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Check size={40} className="text-emerald-400/40" />
              <p className="mt-3 text-sm text-[#7b6660]">No pending leave applications.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingApps.map((app) => (
                <div
                  key={app.id}
                  className="rounded-lg border border-[#f0d2ca] bg-[#fff3ee]/50 p-4 transition hover:bg-[#FDD9CD]/45"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-[#251E1F]">
                        {app.staff_name || app.name || "Unknown Staff"}
                      </p>
                      <p className="text-xs text-[#7b6660]">
                        {app.department || app.department_name || "—"}
                      </p>
                      <div className="flex flex-wrap gap-3 mt-2">
                        <span className="text-xs text-[#7b6660]">
                          <span className="text-[#251E1F]/50">Type:</span>{" "}
                          {app.leave_type_name || app.type_name || "—"}
                        </span>
                        <span className="text-xs text-[#7b6660]">
                          <span className="text-[#251E1F]/50">Dates:</span>{" "}
                          {formatDate(app.start_date)} – {formatDate(app.end_date)}
                        </span>
                        <span className="text-xs text-[#7b6660]">
                          <span className="text-[#251E1F]/50">Days:</span>{" "}
                          <span className="font-semibold text-[#251E1F]">{app.total_days}</span>
                        </span>
                      </div>
                      {app.reason && (
                        <p className="mt-2 text-xs text-[#7b6660] italic">
                          "{app.reason}"
                        </p>
                      )}
                    </div>

                    {/* Action buttons */}
                    {actionId !== app.id ? (
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => openAction(app.id, "approved")}
                          className="flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/30 transition"
                        >
                          <Check size={14} />
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => openAction(app.id, "rejected")}
                          className="flex items-center gap-1.5 rounded-lg bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-500/30 transition"
                        >
                          <X size={14} />
                          Reject
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 shrink-0 min-w-[220px]">
                        <input
                          type="text"
                          value={actionComment}
                          onChange={(e) => setActionComment(e.target.value)}
                          placeholder="Optional comment..."
                          className="w-full rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2 text-xs text-[#251E1F] placeholder:text-[#251E1F]/30 focus:border-[#F38978] focus:outline-none focus:ring-1 focus:ring-[#F38978]"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={processing}
                            onClick={() => handleAction(app.id, actionType)}
                            className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${
                              actionType === "approved"
                                ? "bg-emerald-500/20 text-emerald-700 hover:bg-emerald-500/30"
                                : "bg-red-500/20 text-red-700 hover:bg-red-500/30"
                            }`}
                          >
                            {processing ? "Processing..." : `Confirm ${actionType === "approved" ? "Approve" : "Reject"}`}
                          </button>
                          <button
                            type="button"
                            onClick={cancelAction}
                            className="rounded-lg border border-[#f0d2ca] px-3 py-2 text-xs text-[#7b6660] hover:bg-white/80 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── All Applications Tab ──────────────────────────────────── */}
      {activeTab === "all" && (
        <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-5">
          <h3 className="mb-4 text-lg font-semibold text-[#251E1F]">All Staff Leave Applications</h3>

          {/* Filters */}
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="block text-xs text-[#7b6660] mb-1">Staff Name</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#251E1F]/30" />
                <input
                  type="text"
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  placeholder="Search name..."
                  className="w-full rounded-lg border border-[#f0d2ca] bg-white/80 pl-9 pr-4 py-2 text-sm text-[#251E1F] placeholder:text-[#251E1F]/30 focus:border-[#F38978] focus:outline-none focus:ring-1 focus:ring-[#F38978]"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-[#7b6660] mb-1">Leave Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full rounded-lg border border-[#f0d2ca] bg-white/80 px-4 py-2 text-sm text-[#251E1F] focus:border-[#F38978] focus:outline-none focus:ring-1 focus:ring-[#F38978]"
              >
                <option value="" className="bg-[#fff3ee]">All Types</option>
                {leaveTypes.map((type) => (
                  <option key={type.id} value={String(type.id)} className="bg-[#fff3ee]">
                    {type.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#7b6660] mb-1">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full rounded-lg border border-[#f0d2ca] bg-white/80 px-4 py-2 text-sm text-[#251E1F] focus:border-[#F38978] focus:outline-none focus:ring-1 focus:ring-[#F38978]"
              >
                <option value="" className="bg-[#fff3ee]">All Statuses</option>
                <option value="pending" className="bg-[#fff3ee]">Pending</option>
                <option value="approved" className="bg-[#fff3ee]">Approved</option>
                <option value="rejected" className="bg-[#fff3ee]">Rejected</option>
                <option value="cancelled" className="bg-[#fff3ee]">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-[#7b6660] mb-1">From Date</label>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="w-full rounded-lg border border-[#f0d2ca] bg-white/80 px-4 py-2 text-sm text-[#251E1F] focus:border-[#F38978] focus:outline-none focus:ring-1 focus:ring-[#F38978]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#7b6660] mb-1">To Date</label>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="w-full rounded-lg border border-[#f0d2ca] bg-white/80 px-4 py-2 text-sm text-[#251E1F] focus:border-[#F38978] focus:outline-none focus:ring-1 focus:ring-[#F38978]"
              />
            </div>
          </div>

          {/* Results count */}
          <p className="mb-3 text-xs text-[#7b6660]">
            Showing {filteredApps.length} of {allApps.length} applications
          </p>

          {/* Table */}
          {filteredApps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Calendar size={40} className="text-[#F38978]/40" />
              <p className="mt-3 text-sm text-[#7b6660]">No applications match the current filters.</p>
            </div>
          ) : (
            <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#f0d2ca] text-left">
                    <th className="px-3 py-2 text-xs uppercase tracking-wide text-[#7b6660]">Staff</th>
                    <th className="px-3 py-2 text-xs uppercase tracking-wide text-[#7b6660]">Department</th>
                    <th className="px-3 py-2 text-xs uppercase tracking-wide text-[#7b6660]">Leave Type</th>
                    <th className="px-3 py-2 text-xs uppercase tracking-wide text-[#7b6660]">Start Date</th>
                    <th className="px-3 py-2 text-xs uppercase tracking-wide text-[#7b6660]">End Date</th>
                    <th className="px-3 py-2 text-xs uppercase tracking-wide text-[#7b6660]">Days</th>
                    <th className="px-3 py-2 text-xs uppercase tracking-wide text-[#7b6660]">Status</th>
                    <th className="px-3 py-2 text-xs uppercase tracking-wide text-[#7b6660]">HR Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApps.map((app) => (
                    <tr key={app.id} className="border-b border-[#f0d2ca] hover:bg-[#FDD9CD]/30 transition">
                      <td className="px-3 py-3 text-[#251E1F] font-medium">
                        {app.staff_name || app.name || "—"}
                      </td>
                      <td className="px-3 py-3 text-[#7b6660]">
                        {app.department || app.department_name || "—"}
                      </td>
                      <td className="px-3 py-3 text-[#7b6660]">
                        {app.leave_type_name || app.type_name || "—"}
                      </td>
                      <td className="px-3 py-3 text-[#7b6660]">{formatDate(app.start_date)}</td>
                      <td className="px-3 py-3 text-[#7b6660]">{formatDate(app.end_date)}</td>
                      <td className="px-3 py-3 text-[#251E1F] font-medium">{app.total_days || "—"}</td>
                      <td className="px-3 py-3">
                        <LeaveStatusBadge status={app.status} />
                      </td>
                      <td className="px-3 py-3 text-[#7b6660] max-w-[200px] truncate" title={app.hr_comment || ""}>
                        {app.hr_comment || <span className="text-[#251E1F]/20">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {allAppsTotal > PAGE_SIZE && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-[#7b6660]">
                  Page {allAppsPage} of {Math.ceil(allAppsTotal / PAGE_SIZE)}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={allAppsPage === 1}
                    onClick={() => setAllAppsPage(p => p - 1)}
                    className="rounded-lg border border-[#f0d2ca] px-3 py-1.5 text-xs text-[#7b6660] hover:bg-white/80 disabled:opacity-40 transition"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={allAppsPage >= Math.ceil(allAppsTotal / PAGE_SIZE)}
                    onClick={() => setAllAppsPage(p => p + 1)}
                    className="rounded-lg border border-[#f0d2ca] px-3 py-1.5 text-xs text-[#7b6660] hover:bg-white/80 disabled:opacity-40 transition"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
            </>
          )}
        </div>
      )}

      {/* ─── Leave Configuration Tab ──────────────────────────────── */}
      {activeTab === "config" && (
        <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-5">
          <h3 className="mb-4 text-lg font-semibold text-[#251E1F]">Leave Type Configuration</h3>
          <p className="mb-4 text-xs text-[#7b6660]">
            Edit entitlement settings for each leave type. Changes apply to future balance records only.
          </p>

          <div className="space-y-3">
            {leaveTypes.map((type) => (
              <div
                key={type.id}
                className="rounded-lg border border-[#f0d2ca] bg-[#fff3ee]/50 p-4 transition hover:bg-[#FDD9CD]/45"
              >
                {editingType !== type.id ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#251E1F]">{type.name}</p>
                      <div className="flex flex-wrap gap-4 mt-1">
                        <span className="text-xs text-[#7b6660]">
                          <span className="text-[#251E1F]/50">Entitlement:</span>{" "}
                          {type.default_entitlement} days
                        </span>
                        <span className="text-xs text-[#7b6660]">
                          <span className="text-[#251E1F]/50">Carry-forward Cap:</span>{" "}
                          {type.carry_forward_cap || 0} days
                        </span>
                        <span className="text-xs text-[#7b6660]">
                          <span className="text-[#251E1F]/50">Requires Attachment:</span>{" "}
                          {type.requires_attachment === 1 || type.requires_attachment === true ? "Yes" : "No"}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => startEditType(type)}
                      className="rounded-lg border border-[#f0d2ca] px-4 py-2 text-xs font-medium text-[#7b6660] hover:bg-white/80 hover:text-[#251E1F] transition"
                    >
                      Edit
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-[#251E1F]">{type.name}</p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <label className="block text-xs text-[#7b6660] mb-1">
                          Default Entitlement (days)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editEntitlement}
                          onChange={(e) => setEditEntitlement(e.target.value)}
                          className="w-full rounded-lg border border-[#f0d2ca] bg-white/80 px-4 py-2.5 text-sm text-[#251E1F] focus:border-[#F38978] focus:outline-none focus:ring-1 focus:ring-[#F38978]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-[#7b6660] mb-1">
                          Carry-forward Cap (days)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editCarryCap}
                          onChange={(e) => setEditCarryCap(e.target.value)}
                          className="w-full rounded-lg border border-[#f0d2ca] bg-white/80 px-4 py-2.5 text-sm text-[#251E1F] focus:border-[#F38978] focus:outline-none focus:ring-1 focus:ring-[#F38978]"
                        />
                      </div>
                      <div className="flex items-center gap-3 pt-5">
                        <label className="relative inline-flex cursor-pointer items-center">
                          <input
                            type="checkbox"
                            checked={editRequiresAttachment}
                            onChange={(e) => setEditRequiresAttachment(e.target.checked)}
                            className="peer sr-only"
                          />
                          <div className="h-5 w-9 rounded-full bg-white/80 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white/60 after:transition-all peer-checked:bg-[#F38978] peer-checked:after:translate-x-full peer-checked:after:bg-white"></div>
                        </label>
                        <span className="text-xs text-[#7b6660]">Requires Attachment</span>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        disabled={savingType}
                        onClick={() => handleSaveLeaveType(type.id)}
                        className="rounded-lg bg-[#F38978] px-6 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50 transition"
                      >
                        {savingType ? "Saving..." : "Save Changes"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingType(null)}
                        className="rounded-lg border border-[#f0d2ca] px-4 py-2.5 text-sm text-[#7b6660] hover:bg-white/80 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {leaveTypes.length === 0 && (
              <p className="text-sm text-[#7b6660]">No leave types configured.</p>
            )}
          </div>

          {/* ─── Carry-Forward Execution ──────────────────────────────── */}
          <div className="mt-6 rounded-lg border border-[#f0d2ca] bg-[#fff3ee]/50 p-5">
            <div className="flex items-center gap-2 mb-3">
              <RefreshCw size={18} className="text-[#F38978]" />
              <h4 className="text-sm font-semibold text-[#251E1F]">Annual Leave Carry-Forward</h4>
            </div>
            <p className="mb-4 text-xs text-[#7b6660]">
              Transfer unused annual leave from a given year to the next, subject to each leave type's carry-forward cap. This operation is idempotent — running it multiple times produces the same result.
            </p>

            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-[#7b6660] mb-1">From Year</label>
                <input
                  type="number"
                  min="2020"
                  max="2099"
                  value={carryForwardYear}
                  onChange={(e) => setCarryForwardYear(e.target.value)}
                  className="w-32 rounded-lg border border-[#f0d2ca] bg-white/80 px-4 py-2.5 text-sm text-[#251E1F] focus:border-[#F38978] focus:outline-none focus:ring-1 focus:ring-[#F38978]"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowCarryForwardConfirm(true)}
                disabled={carryForwardProcessing || !carryForwardYear}
                className="flex items-center gap-2 rounded-lg bg-[#F38978] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50 transition"
              >
                <RefreshCw size={14} />
                Run Carry-Forward
              </button>
            </div>

            <p className="mt-2 text-xs text-[#251E1F]/40">
              Unused leave from {carryForwardYear || "—"} will be carried forward to {carryForwardYear ? Number(carryForwardYear) + 1 : "—"}.
            </p>
          </div>

          {/* Carry-Forward Confirmation Dialog */}
          {showCarryForwardConfirm && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#251E1F]/60 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-xl border border-[#f0d2ca] bg-white/95 p-6 shadow-2xl">
                <h4 className="text-lg font-semibold text-[#251E1F] mb-2">Confirm Carry-Forward</h4>
                <p className="text-sm text-[#7b6660] mb-4">
                  Are you sure you want to carry forward unused annual leave from <span className="font-semibold text-[#251E1F]">{carryForwardYear}</span> to <span className="font-semibold text-[#251E1F]">{Number(carryForwardYear) + 1}</span>?
                </p>
                <p className="text-xs text-[#251E1F]/40 mb-6">
                  This will update balance records for all eligible staff members. The operation is idempotent and safe to run multiple times.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowCarryForwardConfirm(false)}
                    disabled={carryForwardProcessing}
                    className="rounded-lg border border-[#f0d2ca] px-4 py-2.5 text-sm text-[#7b6660] hover:bg-white/80 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleRunCarryForward}
                    disabled={carryForwardProcessing}
                    className="flex items-center gap-2 rounded-lg bg-[#F38978] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50 transition"
                  >
                    {carryForwardProcessing ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Check size={14} />
                        Confirm
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
