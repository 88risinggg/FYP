import { useState, useEffect } from "react";
import DashboardShell from "../components/DashboardShell.jsx";

export default function FinanceDashboard() {
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [approvalStatus, setApprovalStatus] = useState({});

  useEffect(() => {
    fetchPendingPayslips();
  }, []);

  const fetchPendingPayslips = async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:4001/api/finance/payslips/pending", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to fetch payslips");
      const data = await response.json();
      setPayslips(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const approvePayslip = async (payslipId) => {
    setApprovalStatus((prev) => ({ ...prev, [payslipId]: "approving" }));
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`http://localhost:4001/api/finance/payslips/${payslipId}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to approve payslip");
      setPayslips((prev) => prev.map((p) => (p.id === payslipId ? { ...p, approval_status: "approved" } : p)));
      setApprovalStatus((prev) => ({ ...prev, [payslipId]: "approved" }));
    } catch (err) {
      setError(err.message);
      setApprovalStatus((prev) => ({ ...prev, [payslipId]: "error" }));
    }
  };

  const rejectPayslip = async (payslipId) => {
    setApprovalStatus((prev) => ({ ...prev, [payslipId]: "rejecting" }));
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`http://localhost:4001/api/finance/payslips/${payslipId}/reject`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to reject payslip");
      setPayslips((prev) => prev.map((p) => (p.id === payslipId ? { ...p, approval_status: "rejected" } : p)));
      setApprovalStatus((prev) => ({ ...prev, [payslipId]: "rejected" }));
    } catch (err) {
      setError(err.message);
      setApprovalStatus((prev) => ({ ...prev, [payslipId]: "error" }));
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
      sent: "bg-blue-100 text-blue-800"
    };
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${styles[status] || "bg-gray-100"}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const pendingPayslips = payslips.filter((payslip) => payslip.approval_status === "pending");
  const approvedPayslips = payslips.filter((payslip) => payslip.approval_status === "approved");
  const rejectedPayslips = payslips.filter((payslip) => payslip.approval_status === "rejected");

  return (
    <DashboardShell role="Finance" title="Finance Dashboard">
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-6">Payslip Approval Queue</h2>

        {error && <div className="bg-red-100 text-red-800 p-4 rounded mb-4">{error}</div>}

        <div className="grid gap-4 mb-6 sm:grid-cols-3">
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <p className="text-sm font-semibold text-yellow-900">Pending Approval</p>
            <p className="mt-2 text-3xl font-bold text-yellow-950">{pendingPayslips.length}</p>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-semibold text-green-900">Approved</p>
            <p className="mt-2 text-3xl font-bold text-green-950">{approvedPayslips.length}</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-900">Rejected</p>
            <p className="mt-2 text-3xl font-bold text-red-950">{rejectedPayslips.length}</p>
          </div>
        </div>

        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-5">
          <h3 className="text-lg font-semibold text-blue-950">Finance approval guidance</h3>
          <p className="mt-2 text-sm text-blue-900">
            Review the pending payslips below, then approve or reject them manually. HR can only send payslips after Finance approves them.
          </p>
        </div>

        {loading ? (
          <p className="text-center text-gray-500">Loading payslips...</p>
        ) : pendingPayslips.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
            <p className="text-slate-700 font-semibold">No payslips are waiting for approval right now.</p>
            <p className="mt-2 text-sm text-slate-500">
              Once HR uploads payroll data and generates payslips, they will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border p-3 text-left">Staff ID</th>
                  <th className="border p-3 text-left">Staff Name</th>
                  <th className="border p-3 text-left">Month</th>
                  <th className="border p-3 text-right">Amount</th>
                  <th className="border p-3 text-center">Status</th>
                  <th className="border p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingPayslips.map((payslip) => (
                  <tr key={payslip.id} className="hover:bg-gray-50">
                    <td className="border p-3">{payslip.staff_id}</td>
                    <td className="border p-3">{payslip.staff_name}</td>
                    <td className="border p-3">{payslip.payroll_month}</td>
                    <td className="border p-3 text-right font-semibold">${Number(payslip.net_pay || 0).toFixed(2)}</td>
                    <td className="border p-3 text-center">{getStatusBadge(payslip.approval_status)}</td>
                    <td className="border p-3 text-center">
                      {payslip.approval_status === "pending" ? (
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => approvePayslip(payslip.id)}
                            disabled={approvalStatus[payslip.id] === "approving"}
                            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                          >
                            {approvalStatus[payslip.id] === "approving" ? "Approving..." : "Approve"}
                          </button>
                          <button
                            onClick={() => rejectPayslip(payslip.id)}
                            disabled={approvalStatus[payslip.id] === "rejecting"}
                            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                          >
                            {approvalStatus[payslip.id] === "rejecting" ? "Rejecting..." : "Reject"}
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {approvedPayslips.length > 0 && (
          <div className="mt-8 rounded-lg border border-green-200 bg-green-50 p-5">
            <h3 className="text-lg font-semibold text-green-950 mb-3">Approved payslips</h3>
            <p className="text-sm text-green-900">
              These have already been approved and are waiting for HR to send them.
            </p>
          </div>
        )}

        <div className="mt-8 pt-6 border-t">
          <h3 className="text-lg font-bold mb-4">Other Finance Features</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-gray-100 rounded">
              <h4 className="font-semibold">Invoices</h4>
              <p className="text-sm text-gray-600">Future invoice creation and approval</p>
            </div>
            <div className="p-4 bg-gray-100 rounded">
              <h4 className="font-semibold">Payments</h4>
              <p className="text-sm text-gray-600">Payment tracking and status</p>
            </div>
            <div className="p-4 bg-gray-100 rounded">
              <h4 className="font-semibold">Reports</h4>
              <p className="text-sm text-gray-600">Financial summaries and exports</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
