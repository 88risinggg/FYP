import {
  LayoutDashboard,
  Users,
  Settings,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { getStoredSession } from "../../services/sessionService.js";

const pageTitle = "Automated Payroll System – Admin Payroll Dashboard";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const payrollSidebarSections = [
  {
    label: "ADMIN",
    items: [
      {
        label: "Dashboard",
        icon: LayoutDashboard,
        path: "/dashboard/payroll/admin",
        end: true
      },
      {
        label: "Payslips Approval",
        icon: CheckCircle2,
        path: "/dashboard/payroll/admin/payslips-approval"
      },
      {
        label: "Staff Management",
        icon: Users,
        path: "/dashboard/payroll/admin/staff-management"
      },
      {
        label: "System Settings",
        icon: Settings,
        path: "/dashboard/payroll/admin/settings"
      }
    ]
  }
];

const routeHeadings = {
  "/dashboard/payroll/admin": "Dashboard",
  "/dashboard/payroll/admin/payslips-approval": "Payslips Final Approval",
  "/dashboard/payroll/admin/staff-management": "Staff Management",
  "/dashboard/payroll/admin/settings": "System Settings"
};

function getAuthHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function PayslipsApprovalView() {
  const session = getStoredSession();
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [actionInProgress, setActionInProgress] = useState(null);
  const [rejectingPayslipId, setRejectingPayslipId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const fetchPayslips = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch(`${API_BASE_URL}/api/hr/payslips`, {
        headers: {
          ...getAuthHeaders(session?.token)
        }
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Failed to load payslips");
      }

      const data = await response.json();
      // Filter to only show admin_pending payslips (awaiting final approval)
      const filtered = data.filter(p => p.status === "admin_pending");
      setPayslips(filtered);
    } catch (err) {
      setError(err.message || "Failed to load payslips");
      setPayslips([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (payslipId) => {
    try {
      setActionInProgress(payslipId);
      setError("");
      
      const response = await fetch(`${API_BASE_URL}/api/payroll/payslips/${payslipId}/admin-approve`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(session?.token),
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Failed to approve payslip");
      }

      setSuccessMessage("Payslip approved and sent to staff");
      await fetchPayslips();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(err.message || "Failed to approve payslip");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReject = async (payslipId) => {
    if (!rejectReason.trim()) {
      setError("Please enter a rejection reason");
      return;
    }

    try {
      setActionInProgress(payslipId);
      setError("");
      
      const response = await fetch(`${API_BASE_URL}/api/payroll/payslips/${payslipId}/admin-reject`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(session?.token),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ reason: rejectReason })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Failed to reject payslip");
      }

      setSuccessMessage("Payslip rejected successfully");
      setRejectingPayslipId(null);
      setRejectReason("");
      await fetchPayslips();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(err.message || "Failed to reject payslip");
    } finally {
      setActionInProgress(null);
    }
  };

  useEffect(() => {
    fetchPayslips();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);

  return (
    <div className="space-y-5">
      <div className="neon-glass neon-border rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Payslips Pending Final Approval</h3>
            <p className="mt-1 text-sm text-[#d8c6e8]">
              Review payslips approved by Finance. Final approval will send them to staff.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchPayslips}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="neon-glass neon-border rounded-2xl border-red-500/40 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="neon-glass neon-border rounded-2xl border-emerald-500/40 p-4 text-sm text-emerald-200">
          {successMessage}
        </div>
      )}

      <div className="neon-glass neon-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center gap-3 p-6 text-[#d8c6e8]">
            <Loader2 className="animate-spin" size={18} />
            Loading payslips...
          </div>
        ) : payslips.length === 0 ? (
          <div className="p-6 text-center">
            <div className="inline-block rounded-full bg-emerald-500/10 p-3 mb-3">
              <CheckCircle2 className="text-emerald-300" size={24} />
            </div>
            <p className="text-sm text-[#d8c6e8]">No payslips pending final approval</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/5 text-[#d8c6e8]">
                <tr>
                  <th className="px-4 py-3 font-medium">Payslip ID</th>
                  <th className="px-4 py-3 font-medium">Staff Name</th>
                  <th className="px-4 py-3 font-medium">Period</th>
                  <th className="px-4 py-3 font-medium">Gross</th>
                  <th className="px-4 py-3 font-medium">Net Pay</th>
                  <th className="px-4 py-3 font-medium">Finance Approved By</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payslips.map((payslip) => (
                  <tr key={payslip.payslip_id} className="border-b border-white/5 text-white">
                    <td className="px-4 py-3 text-[#d8c6e8] text-xs">{payslip.payslip_id}</td>
                    <td className="px-4 py-3">{payslip.staff_name}</td>
                    <td className="px-4 py-3 text-[#d8c6e8]">
                      {payslip.period_month} {payslip.period_year}
                    </td>
                    <td className="px-4 py-3 text-[#d8c6e8]">
                      ${payslip.gross_salary?.toFixed(2) || "0.00"}
                    </td>
                    <td className="px-4 py-3 text-emerald-300">
                      ${payslip.net_pay?.toFixed(2) || "0.00"}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#d8c6e8]">
                      {payslip.finance_approved_by || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleApprove(payslip.payslip_id)}
                          disabled={actionInProgress === payslip.payslip_id}
                          className="rounded-lg bg-cyan-500/20 px-3 py-1 text-xs text-cyan-300 hover:bg-cyan-500/30 disabled:opacity-50"
                        >
                          {actionInProgress === payslip.payslip_id ? (
                            <Loader2 className="animate-spin inline" size={12} />
                          ) : (
                            "Send"
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectingPayslipId(payslip.payslip_id)}
                          disabled={actionInProgress === payslip.payslip_id}
                          className="rounded-lg bg-red-500/20 px-3 py-1 text-xs text-red-300 hover:bg-red-500/30 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rejection Modal */}
      {rejectingPayslipId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="neon-glass neon-border rounded-2xl w-full max-w-md p-6 m-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="text-red-300" size={20} />
              <h3 className="text-lg font-semibold text-white">Reject Payslip</h3>
            </div>
            <p className="text-sm text-[#d8c6e8] mb-4">
              Please provide a reason for rejecting this payslip.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-white/30 text-sm"
              rows={4}
            />
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => handleReject(rejectingPayslipId)}
                disabled={actionInProgress === rejectingPayslipId}
                className="flex-1 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-500/30 disabled:opacity-50"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => {
                  setRejectingPayslipId(null);
                  setRejectReason("");
                }}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPayrollPage() {
  const session = getStoredSession();
  const location = useLocation();
  const heading = routeHeadings[location.pathname] || "Dashboard";

  // Show payslips approval view for the specific route
  if (location.pathname === "/dashboard/payroll/admin/payslips-approval") {
    return (
      <DashboardLayout
        pageTitle={pageTitle}
        user={session?.user}
        sidebarSections={payrollSidebarSections}
        sidebarTitle="Automated Invoicing & Payroll System"
        searchPlaceholder="Search payroll, staff, approvals..."
      >
        <section>
          <PayslipsApprovalView />
        </section>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      pageTitle={pageTitle}
      user={session?.user}
      sidebarSections={payrollSidebarSections}
      sidebarTitle="Automated Invoicing & Payroll System"
      searchPlaceholder="Search payroll, staff, approvals..."
    >
      <section>
        <h2 className="text-2xl font-semibold text-white">{heading}</h2>
        <div className="neon-glass neon-border mt-6 min-h-[calc(100vh-12rem)] rounded-2xl border-dashed p-8">
          <p className="text-sm text-[#d8c6e8]">
            This page is reserved for module development.
          </p>
        </div>
      </section>
    </DashboardLayout>
  );
}
