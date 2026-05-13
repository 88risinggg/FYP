import { useState, useEffect } from "react";
import DashboardShell from "../components/DashboardShell.jsx";

export default function StaffDashboard() {
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchPayslips();
  }, []);

  const fetchPayslips = async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:4001/api/payroll/payslips", {
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

  const downloadPayslip = (fileUrl) => {
    window.open(`http://localhost:4001${fileUrl}`, "_blank");
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800"
    };
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${styles[status] || "bg-gray-100"}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <DashboardShell role="Staff" title="Staff Dashboard">
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-6">My Payslips</h2>

        {error && <div className="bg-red-100 text-red-800 p-4 rounded mb-4">{error}</div>}

        {loading ? (
          <p className="text-center text-gray-500">Loading payslips...</p>
        ) : payslips.length === 0 ? (
          <p className="text-center text-gray-500">No payslips available yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border p-3 text-left">Month</th>
                  <th className="border p-3 text-right">Net Pay</th>
                  <th className="border p-3 text-center">Status</th>
                  <th className="border p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {payslips.map((payslip) => (
                  <tr key={payslip.id} className="hover:bg-gray-50">
                    <td className="border p-3">{payslip.payroll_month}</td>
                    <td className="border p-3 text-right font-semibold">${payslip.net_pay || 0}</td>
                    <td className="border p-3 text-center">{getStatusBadge(payslip.approval_status)}</td>
                    <td className="border p-3 text-center">
                      {payslip.approval_status === "approved" ? (
                        <button
                          onClick={() => downloadPayslip(payslip.fileUrl)}
                          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                          Download PDF
                        </button>
                      ) : (
                        <span className="text-gray-500 text-sm">
                          {payslip.approval_status === "pending" ? "Awaiting approval" : "Not available"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-8 pt-6 border-t">
          <h3 className="text-lg font-bold mb-4">Staff Features</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-gray-100 rounded">
              <h4 className="font-semibold">My Profile</h4>
              <p className="text-sm text-gray-600">View personal and employment details</p>
            </div>
            <div className="p-4 bg-gray-100 rounded">
              <h4 className="font-semibold">Payslips</h4>
              <p className="text-sm text-gray-600">Download and view payslip PDFs</p>
            </div>
            <div className="p-4 bg-gray-100 rounded">
              <h4 className="font-semibold">Notifications</h4>
              <p className="text-sm text-gray-600">Receive payroll updates</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
