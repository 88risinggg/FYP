import { useEffect, useState } from "react";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  DollarSign,
  FileText,
  Landmark,
  LayoutDashboard,
  UserCog,
  Wallet
} from "lucide-react";

import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { getStoredSession } from "../../services/sessionService.js";
import {
  createLoanRequest,
  getLoanRequests,
  getLoanRequestById
} from "../../services/loanService.js";

const pageTitle = "Automated Payroll System – Staff Loan Portal";

const loanSidebarSections = [
  {
    label: null,
    items: [
      { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard/payroll/staff", end: true }
    ]
  },
  {
    label: "Pay",
    items: [
      { label: "Payslips", icon: FileText, path: "/dashboard/payroll/staff/payslips" },
      { label: "Payroll Info", icon: Wallet, path: "/dashboard/payroll/staff/payroll-info" },
      { label: "Advance Payment", icon: DollarSign, path: "/dashboard/payroll/staff/advance-payment" },
      { label: "Loans", icon: Landmark, path: "/dashboard/payroll/staff/loans" }
    ]
  },
  {
    label: "Leave",
    items: [
      { label: "Leave", icon: CalendarDays, path: "/dashboard/payroll/staff/leave" }
    ]
  },
  {
    label: "Account",
    items: [
      { label: "Profile", icon: UserCog, path: "/dashboard/payroll/staff/profile" },
      { label: "Notifications", icon: Bell, path: "/dashboard/payroll/staff/notifications" }
    ]
  }
];

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

/* ─── Shared Components ─── */
function Panel({ title, children }) {
  return (
    <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-5">
      <h3 className="mb-3 text-lg font-semibold text-[#251E1F]">{title}</h3>
      {children}
    </div>
  );
}

const SkeletonBar = ({ width = "100%", height = "h-4" }) => (
  <div className={`${height} rounded-lg bg-white/80 animate-pulse`} style={{ width }} />
);

export default function StaffLoanPage({ embedded = false }) {
  const session = getStoredSession();

  const content = (
    <div className="space-y-6">
      <LoanRequestForm />
      <LoanRequestList />
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <DashboardLayout
      pageTitle={pageTitle}
      user={session?.user}
      sidebarSections={loanSidebarSections}
      sidebarTitle="Automated Payroll System"
      searchPlaceholder="Search loans..."
      profilePath="/dashboard/payroll/staff/profile"
      notificationsPath="/dashboard/payroll/staff/notifications"
    >
      <section>
        <h2 className="text-2xl font-semibold text-[#251E1F]">Loans</h2>

        <div className="app-panel mt-6 min-h-[calc(100vh-12rem)] rounded-2xl p-6">
          {content}
        </div>
      </section>
    </DashboardLayout>
  );
}

/* ─── Loan Request Form ─── */
function LoanRequestForm() {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [repaymentMonths, setRepaymentMonths] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  function validate() {
    const newErrors = {};
    const numAmount = Number(amount);
    const numMonths = Number(repaymentMonths);

    if (!amount) {
      newErrors.amount = "Amount is required";
    } else if (isNaN(numAmount) || numAmount < 1) {
      newErrors.amount = "Minimum loan amount is $1.00";
    } else if (numAmount > 50000) {
      newErrors.amount = "Maximum loan amount is $50,000.00";
    }

    if (!reason?.trim()) {
      newErrors.reason = "Reason is required";
    } else if (reason.trim().length < 10) {
      newErrors.reason = "Please provide a more detailed reason (at least 10 characters)";
    }

    if (!repaymentMonths) {
      newErrors.repaymentMonths = "Repayment period is required";
    } else if (isNaN(numMonths) || numMonths < 1 || numMonths > 36) {
      newErrors.repaymentMonths = "Repayment period must be between 1 and 36 months";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;

    setSubmitting(true);
    try {
      await createLoanRequest({
        requested_amount: Number(amount),
        repayment_months: Number(repaymentMonths),
        reason: reason.trim()
      });

      showToast("Loan request submitted successfully");
      setAmount("");
      setReason("");
      setRepaymentMonths("");
      setErrors({});

      // Dispatch custom event so the list refreshes
      window.dispatchEvent(new Event("loan-request-created"));
    } catch (err) {
      console.error(err);
      const message = err?.message || "Failed to submit loan request. Please try again.";
      showToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[70] w-full max-w-md rounded-xl border px-5 py-4 shadow-2xl backdrop-blur-sm animate-[slideDown_0.3s_ease-out] ${
          toast.type === "error"
            ? "border-red-400/30 bg-red-950/90 text-red-100"
            : "border-emerald-400/30 bg-emerald-950/90 text-emerald-100"
        }`}>
          <div className="flex items-center gap-3">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              toast.type === "error" ? "bg-red-500/20 text-red-300" : "bg-emerald-500/20 text-emerald-300"
            }`}>
              {toast.type === "error" ? "✕" : "✓"}
            </span>
            <p className="text-sm font-medium">{toast.message}</p>
          </div>
        </div>
      )}

      <Panel title="Request a Loan">
        <div className="space-y-4">
          {/* Amount */}
          <div>
            <label className="block text-xs text-[#7b6660]">Loan Amount ($)</label>
            <input
              type="number"
              min="1"
              max="50000"
              step="0.01"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); if (errors.amount) setErrors(prev => ({ ...prev, amount: undefined })); }}
              placeholder="Enter amount (1 – 50,000)"
              className={`mt-1 w-full rounded-md border px-3 py-2 text-[#251E1F] bg-transparent placeholder:text-[#251E1F]/20 ${
                errors.amount ? "border-red-400/60" : "border-[#f0d2ca]"
              }`}
            />
            {errors.amount && <p className="mt-1 text-xs text-red-400">{errors.amount}</p>}
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs text-[#7b6660]">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => { setReason(e.target.value); if (errors.reason) setErrors(prev => ({ ...prev, reason: undefined })); }}
              placeholder="Explain the purpose of this loan..."
              rows={3}
              className={`mt-1 w-full resize-none rounded-md border px-3 py-2 text-[#251E1F] bg-transparent placeholder:text-[#251E1F]/20 ${
                errors.reason ? "border-red-400/60" : "border-[#f0d2ca]"
              }`}
            />
            {errors.reason && <p className="mt-1 text-xs text-red-400">{errors.reason}</p>}
          </div>

          {/* Repayment Months Dropdown */}
          <div>
            <label className="block text-xs text-[#7b6660]">Repayment Period (months)</label>
            <select
              value={repaymentMonths}
              onChange={(e) => { setRepaymentMonths(e.target.value); if (errors.repaymentMonths) setErrors(prev => ({ ...prev, repaymentMonths: undefined })); }}
              className={`mt-1 w-full rounded-md border px-3 py-2 text-[#251E1F] bg-transparent ${
                errors.repaymentMonths ? "border-red-400/60" : "border-[#f0d2ca]"
              } ${!repaymentMonths ? "text-[#251E1F]/20" : ""}`}
              style={{ backgroundColor: "#fff3ee" }}
            >
              <option value="" disabled>Select repayment period</option>
              {Array.from({ length: 36 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m} style={{ backgroundColor: "#fff3ee", color: "#fff" }}>
                  {m} {m === 1 ? "month" : "months"}
                </option>
              ))}
            </select>
            {errors.repaymentMonths && <p className="mt-1 text-xs text-red-400">{errors.repaymentMonths}</p>}
          </div>

          {/* Submit */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-lg bg-[#2D7C83] px-5 py-2.5 text-sm font-semibold text-[#251E1F] hover:brightness-110 disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Submit Loan Request"}
          </button>
        </div>
      </Panel>
    </>
  );
}

/* ─── Loan Request List ─── */
function LoanRequestList() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedLoanId, setExpandedLoanId] = useState(null);
  const [installments, setInstallments] = useState({});
  const [loadingInstallments, setLoadingInstallments] = useState({});

  useEffect(() => {
    fetchLoans();

    // Listen for new loan creation to refresh the list
    function handleRefresh() { fetchLoans(); }
    window.addEventListener("loan-request-created", handleRefresh);
    return () => window.removeEventListener("loan-request-created", handleRefresh);
  }, []);

  async function fetchLoans() {
    setLoading(true);
    try {
      const data = await getLoanRequests();
      setLoans(Array.isArray(data) ? data : []);
    } catch {
      setLoans([]);
    } finally {
      setLoading(false);
    }
  }

  async function toggleExpand(loanId) {
    if (expandedLoanId === loanId) {
      setExpandedLoanId(null);
      return;
    }

    setExpandedLoanId(loanId);

    // Fetch installments if not already loaded
    if (!installments[loanId]) {
      setLoadingInstallments(prev => ({ ...prev, [loanId]: true }));
      try {
        const detail = await getLoanRequestById(loanId);
        setInstallments(prev => ({
          ...prev,
          [loanId]: detail.installments || []
        }));
      } catch {
        setInstallments(prev => ({ ...prev, [loanId]: [] }));
      } finally {
        setLoadingInstallments(prev => ({ ...prev, [loanId]: false }));
      }
    }
  }

  if (loading) {
    return (
      <Panel title="Your Loan Requests">
        <div className="space-y-3">
          {[1, 2, 3].map(i => <SkeletonBar key={i} height="h-14" />)}
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Your Loan Requests">
      {loans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Landmark size={48} className="text-[#F38978]/30" />
          <p className="mt-4 text-sm text-[#7b6660]">No loan requests yet</p>
          <p className="mt-1 text-xs text-[#251E1F]/30">Submit a loan request above to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {loans.map((loan) => {
            const loanId = loan.loan_id;
            const isExpanded = expandedLoanId === loanId;
            const isApproved = loan.status === "approved";

            return (
              <div key={loanId} className="rounded-xl border border-[#f0d2ca] bg-black/10 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-semibold text-[#251E1F]">{formatCurrency(loan.requested_amount)}</p>
                      <span className={`rounded-full border px-3 py-0.5 text-xs font-semibold whitespace-nowrap ${loanStatusStyles[loan.status] || "border-gray-300/30 bg-gray-300/10 text-gray-200"}`}>
                        {statusLabels[loan.status] || loan.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#7b6660] line-clamp-1">{loan.reason || "—"}</p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#251E1F]/40">
                      <span>{loan.repayment_months} month{loan.repayment_months > 1 ? "s" : ""} repayment</span>
                      {isApproved && loan.outstanding_balance != null && (
                        <span className="text-amber-200">Outstanding: {formatCurrency(loan.outstanding_balance)}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <p className="text-xs text-[#251E1F]/30 whitespace-nowrap">{formatDate(loan.created_at)}</p>
                    {isApproved && (
                      <button
                        type="button"
                        onClick={() => toggleExpand(loanId)}
                        className="flex items-center gap-1 rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-1.5 text-xs text-[#251E1F] hover:bg-[#FDD9CD]/45"
                        aria-label={isExpanded ? "Collapse installments" : "Expand installments"}
                      >
                        Installments
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    )}
                  </div>
                </div>

                {/* HR Comments */}
                {loan.hr_comments && (
                  <div className="mt-2 rounded-lg border border-[#f0d2ca] bg-white/[0.02] px-3 py-2">
                    <p className="text-xs text-[#7b6660]/70"><span className="font-medium text-[#7b6660]">HR:</span> {loan.hr_comments}</p>
                  </div>
                )}

                {/* Expandable Installment Schedule */}
                {isApproved && isExpanded && (
                  <div className="mt-3 rounded-lg border border-[#f0d2ca] bg-black/20 p-3">
                    {loadingInstallments[loanId] ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map(i => <SkeletonBar key={i} height="h-8" />)}
                      </div>
                    ) : (installments[loanId] || []).length === 0 ? (
                      <p className="text-xs text-[#251E1F]/40 text-center py-3">No installments found.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-[#f0d2ca] text-left text-[#7b6660]/70">
                              <th className="pb-2 pr-4 font-medium">#</th>
                              <th className="pb-2 pr-4 font-medium">Amount</th>
                              <th className="pb-2 pr-4 font-medium">Due Date</th>
                              <th className="pb-2 font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {installments[loanId].map((inst) => (
                              <tr key={inst.installment_id} className="border-b border-[#f0d2ca] last:border-b-0">
                                <td className="py-2 pr-4 text-[#251E1F]/60">{inst.installment_number}</td>
                                <td className="py-2 pr-4 text-[#251E1F]">{formatCurrency(inst.amount)}</td>
                                <td className="py-2 pr-4 text-[#251E1F]/60">{formatDate(inst.due_date)}</td>
                                <td className="py-2">
                                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                                    inst.status === "paid"
                                      ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
                                      : "border-amber-300/30 bg-amber-300/10 text-amber-200"
                                  }`}>
                                    {inst.status === "paid" ? "Paid" : "Unpaid"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
