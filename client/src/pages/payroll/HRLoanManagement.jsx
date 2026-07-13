import { useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Filter,
  Landmark,
  X
} from "lucide-react";

import {
  getLoanRequests,
  getLoanRequestById,
  approveLoanRequest,
  rejectLoanRequest,
  markInstallmentPaid
} from "../../services/loanService.js";

const loanStatusStyles = {
  pending: "border-amber-300/30 bg-amber-300/10 text-amber-200",
  approved: "border-emerald-300/30 bg-emerald-300/10 text-emerald-200",
  rejected: "border-red-300/30 bg-red-300/10 text-red-200"
};

const statusLabels = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected"
};

const filterOptions = ["all", "pending", "approved", "rejected"];

function formatCurrency(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

const SkeletonBar = ({ width = "100%", height = "h-4" }) => (
  <div className={`${height} rounded-lg bg-white/80 animate-pulse`} style={{ width }} />
);

export default function HRLoanManagement() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedLoanId, setExpandedLoanId] = useState(null);
  const [installments, setInstallments] = useState({});
  const [loadingInstallments, setLoadingInstallments] = useState({});
  const [toast, setToast] = useState(null);

  // Action states
  const [hrComments, setHrComments] = useState({});
  const [approving, setApproving] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [payingInstallment, setPayingInstallment] = useState(null);

  useEffect(() => {
    fetchLoans();
  }, []);

  async function fetchLoans() {
    setLoading(true);
    try {
      const data = await getLoanRequests();
      setLoans(Array.isArray(data) ? data : []);
    } catch {
      setLoans([]);
      showToast("Failed to load loan requests.", "error");
    } finally {
      setLoading(false);
    }
  }

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  const filteredLoans = filterStatus === "all"
    ? loans
    : loans.filter((loan) => loan.status === filterStatus);

  async function toggleExpand(loanId) {
    if (expandedLoanId === loanId) {
      setExpandedLoanId(null);
      return;
    }

    setExpandedLoanId(loanId);

    if (!installments[loanId]) {
      setLoadingInstallments((prev) => ({ ...prev, [loanId]: true }));
      try {
        const detail = await getLoanRequestById(loanId);
        setInstallments((prev) => ({
          ...prev,
          [loanId]: detail.installments || []
        }));
      } catch {
        setInstallments((prev) => ({ ...prev, [loanId]: [] }));
      } finally {
        setLoadingInstallments((prev) => ({ ...prev, [loanId]: false }));
      }
    }
  }

  async function handleApprove(loanId) {
    setApproving(loanId);
    try {
      await approveLoanRequest(loanId, { hr_comments: hrComments[loanId] || "" });
      showToast("Loan request approved successfully.");
      setHrComments((prev) => ({ ...prev, [loanId]: "" }));
      setExpandedLoanId(null);
      setInstallments((prev) => {
        const updated = { ...prev };
        delete updated[loanId];
        return updated;
      });
      await fetchLoans();
    } catch (err) {
      const message = err?.message || "Failed to approve loan request.";
      showToast(message, "error");
    } finally {
      setApproving(null);
    }
  }

  async function handleReject(loanId) {
    setRejecting(loanId);
    try {
      await rejectLoanRequest(loanId, { hr_comments: hrComments[loanId] || "" });
      showToast("Loan request rejected.");
      setHrComments((prev) => ({ ...prev, [loanId]: "" }));
      setExpandedLoanId(null);
      await fetchLoans();
    } catch (err) {
      const message = err?.message || "Failed to reject loan request.";
      showToast(message, "error");
    } finally {
      setRejecting(null);
    }
  }

  async function handleMarkPaid(loanId, installmentId) {
    setPayingInstallment(installmentId);
    try {
      await markInstallmentPaid(loanId, installmentId);
      showToast("Installment marked as paid.");
      // Refresh installments for this loan
      const detail = await getLoanRequestById(loanId);
      setInstallments((prev) => ({
        ...prev,
        [loanId]: detail.installments || []
      }));
      await fetchLoans();
    } catch (err) {
      const message = err?.message || "Failed to mark installment as paid.";
      showToast(message, "error");
    } finally {
      setPayingInstallment(null);
    }
  }

  return (
    <section>
      <h2 className="text-2xl font-semibold text-[#251E1F]">Loan Management</h2>

      <div className="neon-glass neon-border mt-6 min-h-[calc(100vh-12rem)] rounded-2xl p-6">
        {/* Toast Notification */}
        {toast && (
          <div
            className={`fixed top-24 left-1/2 -translate-x-1/2 z-[70] w-full max-w-md rounded-xl border px-5 py-4 shadow-2xl backdrop-blur-sm animate-[slideDown_0.3s_ease-out] ${
              toast.type === "error"
                ? "border-red-400/30 bg-red-950/90 text-red-100"
                : "border-emerald-400/30 bg-emerald-950/90 text-emerald-100"
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  toast.type === "error"
                    ? "bg-red-500/20 text-red-300"
                    : "bg-emerald-500/20 text-emerald-300"
                }`}
              >
                {toast.type === "error" ? "✕" : "✓"}
              </span>
              <p className="text-sm font-medium">{toast.message}</p>
            </div>
          </div>
        )}

        {/* Status Filter */}
        <div className="mb-6 flex items-center gap-3">
          <Filter size={16} className="text-[#7b6660]/70" />
          <div className="flex gap-2">
            {filterOptions.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setFilterStatus(status)}
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                  filterStatus === status
                    ? "bg-[#2D7C83] text-[#251E1F]"
                    : "border border-[#f0d2ca] bg-white/80 text-[#251E1F]/60 hover:bg-[#FDD9CD]/45 hover:text-[#251E1F]"
                }`}
              >
                {status === "all" ? "All" : statusLabels[status]}
              </button>
            ))}
          </div>
        </div>

        {/* Loan Table */}
        {loading ? (
          <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-5">
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <SkeletonBar key={i} height="h-14" />
              ))}
            </div>
          </div>
        ) : filteredLoans.length === 0 ? (
          <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-5">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Landmark size={48} className="text-[#F38978]/30" />
              <p className="mt-4 text-sm text-[#7b6660]">No loan requests found</p>
              <p className="mt-1 text-xs text-[#251E1F]/30">
                {filterStatus === "all"
                  ? "No loan requests have been submitted yet."
                  : `No ${filterStatus} loan requests.`}
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-5">
            {/* Table Header */}
            <div className="hidden sm:grid sm:grid-cols-[1.5fr_1fr_0.8fr_0.8fr_1fr_0.5fr] gap-4 pb-3 border-b border-[#f0d2ca]">
              <span className="text-[#7b6660]/70 font-medium text-xs">Staff Name</span>
              <span className="text-[#7b6660]/70 font-medium text-xs">Amount</span>
              <span className="text-[#7b6660]/70 font-medium text-xs">Months</span>
              <span className="text-[#7b6660]/70 font-medium text-xs">Status</span>
              <span className="text-[#7b6660]/70 font-medium text-xs">Date</span>
              <span className="text-[#7b6660]/70 font-medium text-xs"></span>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-white/5">
              {filteredLoans.map((loan) => {
                const loanId = loan.loan_id;
                const isExpanded = expandedLoanId === loanId;

                return (
                  <div key={loanId} className="py-3">
                    {/* Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-[1.5fr_1fr_0.8fr_0.8fr_1fr_0.5fr] gap-2 sm:gap-4 items-center">
                      <span className="text-sm text-[#251E1F] font-medium">
                        {loan.staff_name || "Unknown"}
                      </span>
                      <span className="text-sm text-[#251E1F]">
                        {formatCurrency(loan.requested_amount)}
                      </span>
                      <span className="text-sm text-[#251E1F]/70">
                        {loan.repayment_months} month{loan.repayment_months > 1 ? "s" : ""}
                      </span>
                      <span>
                        <span
                          className={`rounded-full border px-3 py-0.5 text-xs font-semibold whitespace-nowrap ${
                            loanStatusStyles[loan.status] || "border-gray-300/30 bg-gray-300/10 text-gray-200"
                          }`}
                        >
                          {statusLabels[loan.status] || loan.status}
                        </span>
                      </span>
                      <span className="text-xs text-[#251E1F]/40">
                        {formatDate(loan.created_at)}
                      </span>
                      <span className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => toggleExpand(loanId)}
                          className="flex items-center gap-1 rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-1.5 text-xs text-[#251E1F] hover:bg-[#FDD9CD]/45"
                          aria-label={isExpanded ? "Collapse details" : "Expand details"}
                        >
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </span>
                    </div>

                    {/* Expanded Detail View */}
                    {isExpanded && (
                      <div className="mt-3 rounded-lg border border-[#f0d2ca] bg-black/20 p-4">
                        {/* Pending: Approve/Reject + Comments */}
                        {loan.status === "pending" && (
                          <div className="space-y-4">
                            <div>
                              <label className="block text-xs text-[#7b6660] mb-1">
                                HR Comments (optional)
                              </label>
                              <textarea
                                value={hrComments[loanId] || ""}
                                onChange={(e) =>
                                  setHrComments((prev) => ({
                                    ...prev,
                                    [loanId]: e.target.value
                                  }))
                                }
                                placeholder="Add comments for this loan request..."
                                rows={3}
                                className="w-full resize-none rounded-md border border-[#f0d2ca] px-3 py-2 text-[#251E1F] bg-transparent placeholder:text-[#251E1F]/20"
                                style={{ backgroundColor: "#fff3ee" }}
                              />
                            </div>
                            <div className="flex gap-3">
                              <button
                                type="button"
                                onClick={() => handleApprove(loanId)}
                                disabled={approving === loanId || rejecting === loanId}
                                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-[#251E1F] hover:brightness-110 disabled:opacity-60"
                              >
                                <Check size={16} />
                                {approving === loanId ? "Approving…" : "Approve"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReject(loanId)}
                                disabled={approving === loanId || rejecting === loanId}
                                className="flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-[#251E1F] hover:brightness-110 disabled:opacity-60"
                              >
                                <X size={16} />
                                {rejecting === loanId ? "Rejecting…" : "Reject"}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Approved: Installment Schedule */}
                        {loan.status === "approved" && (
                          <div>
                            <h4 className="text-sm font-semibold text-[#251E1F] mb-3">
                              Installment Schedule
                            </h4>
                            {loadingInstallments[loanId] ? (
                              <div className="space-y-2">
                                {[1, 2, 3].map((i) => (
                                  <SkeletonBar key={i} height="h-8" />
                                ))}
                              </div>
                            ) : (installments[loanId] || []).length === 0 ? (
                              <p className="text-xs text-[#251E1F]/40 text-center py-3">
                                No installments found.
                              </p>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-[#f0d2ca] text-left text-[#7b6660]/70">
                                      <th className="pb-2 pr-4 font-medium">#</th>
                                      <th className="pb-2 pr-4 font-medium">Amount</th>
                                      <th className="pb-2 pr-4 font-medium">Due Date</th>
                                      <th className="pb-2 pr-4 font-medium">Status</th>
                                      <th className="pb-2 font-medium">Action</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {installments[loanId].map((inst) => (
                                      <tr
                                        key={inst.installment_id}
                                        className="border-b border-[#f0d2ca] last:border-b-0"
                                      >
                                        <td className="py-2 pr-4 text-[#251E1F]/60">
                                          {inst.installment_number}
                                        </td>
                                        <td className="py-2 pr-4 text-[#251E1F]">
                                          {formatCurrency(inst.amount)}
                                        </td>
                                        <td className="py-2 pr-4 text-[#251E1F]/60">
                                          {formatDate(inst.due_date)}
                                        </td>
                                        <td className="py-2 pr-4">
                                          <span
                                            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                                              inst.status === "paid"
                                                ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
                                                : "border-amber-300/30 bg-amber-300/10 text-amber-200"
                                            }`}
                                          >
                                            {inst.status === "paid" ? "Paid" : "Unpaid"}
                                          </span>
                                        </td>
                                        <td className="py-2">
                                          {inst.status !== "paid" && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleMarkPaid(loanId, inst.installment_id)
                                              }
                                              disabled={payingInstallment === inst.installment_id}
                                              className="flex items-center gap-1 rounded-lg bg-[#2D7C83] px-3 py-1.5 text-xs font-semibold text-[#251E1F] hover:brightness-110 disabled:opacity-60"
                                            >
                                              <Check size={12} />
                                              {payingInstallment === inst.installment_id
                                                ? "Marking…"
                                                : "Mark as Paid"}
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Rejected: Show HR Comments */}
                        {loan.status === "rejected" && (
                          <div>
                            <h4 className="text-sm font-semibold text-[#251E1F] mb-2">
                              Rejection Details
                            </h4>
                            {loan.hr_comments ? (
                              <div className="rounded-lg border border-[#f0d2ca] bg-white/[0.02] px-3 py-2">
                                <p className="text-xs text-[#7b6660]/70">
                                  <span className="font-medium text-[#7b6660]">HR Comments:</span>{" "}
                                  {loan.hr_comments}
                                </p>
                              </div>
                            ) : (
                              <p className="text-xs text-[#251E1F]/40">No comments provided.</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
