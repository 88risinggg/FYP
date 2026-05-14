import { useState, useEffect } from "react";
import DashboardShell from "../components/DashboardShell.jsx";

export default function StaffDashboard() {
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedPayslip, setSelectedPayslip] = useState(null);

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

  const viewPayslip = (payslip) => {
    if (!payslip?.fileUrl) return;
    setSelectedPayslip(payslip);
  };

  const downloadPayslip = async (fileUrl, filename = "payslip.pdf") => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`http://localhost:4001${fileUrl}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to download payslip PDF");

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(err.message);
    }
  };

  const latestPayslipsByMonth = payslips.reduce((accumulator, payslip) => {
    const monthKey = String(payslip.payroll_month || "").trim();
    if (!monthKey) return accumulator;

    const current = accumulator.get(monthKey);
    const currentTime = current ? new Date(current.createdAt || 0).getTime() : 0;
    const nextTime = new Date(payslip.createdAt || 0).getTime();
    const isNewer = nextTime > currentTime || (nextTime === currentTime && Number(payslip.id || 0) > Number(current?.id || 0));

    if (!current || isNewer) {
      accumulator.set(monthKey, payslip);
    }

    return accumulator;
  }, new Map());

  const latestPayslips = Array.from(latestPayslipsByMonth.values()).sort((left, right) => {
    const rightTime = new Date(right.createdAt || 0).getTime();
    const leftTime = new Date(left.createdAt || 0).getTime();
    return rightTime - leftTime || Number(right.id || 0) - Number(left.id || 0);
  });

  const latestDownloadablePayslip = latestPayslips.find(
    (payslip) => payslip.fileUrl && (payslip.approval_status === "approved" || payslip.approval_status === "sent")
  );

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

  return (
    <DashboardShell role="Staff" title="Staff Dashboard">
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-6">My Payslips</h2>

        {error && <div className="bg-red-100 text-red-800 p-4 rounded mb-4">{error}</div>}

        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-blue-950">Latest downloadable payslip</h3>
              <p className="text-sm text-blue-900">
                {latestDownloadablePayslip
                  ? `${latestDownloadablePayslip.payroll_month} is ready for preview and download.`
                  : "No downloadable payslip is ready yet. The PDF button appears after Finance approves and HR sends the payslip."}
              </p>
            </div>
            {latestDownloadablePayslip ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => viewPayslip(latestDownloadablePayslip)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  View PDF
                </button>
                <button
                  onClick={() => downloadPayslip(
                    latestDownloadablePayslip.fileUrl,
                    `payslip-${latestDownloadablePayslip.staff_id}-${String(latestDownloadablePayslip.payroll_month).replace(/\s+/g, "-")}.pdf`
                  )}
                  className="px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-900"
                >
                  Download PDF
                </button>
              </div>
            ) : (
              <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800">
                Waiting for approval
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <p className="text-center text-gray-500">Loading payslips...</p>
        ) : latestPayslips.length === 0 ? (
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
                {latestPayslips.map((payslip) => (
                  <tr key={payslip.id} className="hover:bg-gray-50">
                    <td className="border p-3">{payslip.payroll_month}</td>
                    <td className="border p-3 text-right font-semibold">${Number(payslip.net_pay || 0).toFixed(2)}</td>
                    <td className="border p-3 text-center">{getStatusBadge(payslip.approval_status)}</td>
                    <td className="border p-3 text-center">
                      {payslip.fileUrl && (payslip.approval_status === "approved" || payslip.approval_status === "sent") ? (
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                          <button
                            onClick={() => viewPayslip(payslip)}
                            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                          >
                            View PDF
                          </button>
                          <button
                            onClick={() => downloadPayslip(payslip.fileUrl, `payslip-${payslip.staff_id}-${String(payslip.payroll_month).replace(/\s+/g, "-")}.pdf`)}
                            className="px-4 py-2 bg-slate-700 text-white rounded hover:bg-slate-800"
                          >
                            Download
                          </button>
                        </div>
                      ) : (
                        <button
                          disabled
                          className="px-4 py-2 rounded bg-gray-300 text-gray-600 cursor-not-allowed text-sm"
                        >
                          {payslip.approval_status === "pending"
                            ? "Awaiting approval"
                            : payslip.approval_status === "rejected"
                            ? "Rejected"
                            : "PDF not ready"}
                        </button>
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

        {selectedPayslip && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
            <div className="w-full max-w-5xl rounded-xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">Payslip PDF Preview</h3>
                  <p className="text-sm text-slate-500">
                    {selectedPayslip.staff_name} - {selectedPayslip.payroll_month}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedPayslip(null)}
                  className="rounded-md px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Close
                </button>
              </div>
              <div className="h-[75vh] bg-slate-100">
                <iframe
                  title="Payslip PDF Preview"
                  src={`http://localhost:4001${selectedPayslip.fileUrl}`}
                  className="h-full w-full"
                />
              </div>
              <div className="flex items-center justify-end gap-3 border-t px-5 py-4">
                <button
                  onClick={() => downloadPayslip(selectedPayslip.fileUrl)}
                  className="px-4 py-2 rounded bg-slate-700 text-white hover:bg-slate-800"
                >
                  Download PDF
                </button>
                <button
                  onClick={() => setSelectedPayslip(null)}
                  className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
