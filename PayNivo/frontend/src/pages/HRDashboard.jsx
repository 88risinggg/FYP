import { useState, useEffect } from "react";
import DashboardShell from "../components/DashboardShell.jsx";

export default function HRDashboard() {
  const [payrollRecords, setPayrollRecords] = useState([]);
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [generateStatus, setGenerateStatus] = useState({});
  const [sendStatus, setSendStatus] = useState({});

  useEffect(() => {
    fetchPayrollRecords();
    fetchPayslips();
  }, []);

  const fetchPayrollRecords = async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:4001/api/payroll", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to fetch payroll records");
      const data = await response.json();
      setPayrollRecords(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPayslips = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:4001/api/payroll/payslips", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to fetch payslips");
      const data = await response.json();
      setPayslips(data);
    } catch (err) {
      console.error(err.message);
    }
  };

  const generatePayslip = async (payrollId) => {
    setGenerateStatus((prev) => ({ ...prev, [payrollId]: "generating" }));
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`http://localhost:4001/api/payroll/payslips/${payrollId}/generate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to generate payslip");
      }
      setGenerateStatus((prev) => ({ ...prev, [payrollId]: "generated" }));
      fetchPayslips(); // Refresh payslips list
      alert("Payslip generated successfully!");
    } catch (err) {
      setError(err.message);
      setGenerateStatus((prev) => ({ ...prev, [payrollId]: "error" }));
    }
  };

  const sendPayslip = async (payslipId) => {
    setSendStatus((prev) => ({ ...prev, [payslipId]: "sending" }));
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`http://localhost:4001/api/payroll/payslips/${payslipId}/email`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to send payslip");
      }
      setSendStatus((prev) => ({ ...prev, [payslipId]: "sent" }));
      alert("Payslip sent successfully!");
    } catch (err) {
      setError(err.message);
      setSendStatus((prev) => ({ ...prev, [payslipId]: "error" }));
    }
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

  const canSend = (payslip) => payslip.approval_status === "approved";

  return (
    <DashboardShell role="HR" title="HR Dashboard">
      <div className="p-6 space-y-8">
        {error && <div className="bg-red-100 text-red-800 p-4 rounded mb-4">{error}</div>}

        {/* Payroll Records Section */}
        <div>
          <h2 className="text-2xl font-bold mb-6">Payroll Records</h2>
          {loading ? (
            <p className="text-center text-gray-500">Loading payroll records...</p>
          ) : payrollRecords.length === 0 ? (
            <p className="text-center text-gray-500">No payroll records found. Upload an XLSX file first.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border p-3 text-left">Staff ID</th>
                    <th className="border p-3 text-left">Staff Name</th>
                    <th className="border p-3 text-left">Month</th>
                    <th className="border p-3 text-right">Basic Salary</th>
                    <th className="border p-3 text-right">Net Pay</th>
                    <th className="border p-3 text-center">Validation</th>
                    <th className="border p-3 text-center">Generate</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="border p-3">{record.staff_id}</td>
                      <td className="border p-3">{record.staff_name}</td>
                      <td className="border p-3">{record.payroll_month}</td>
                      <td className="border p-3 text-right">${record.basic_salary || 0}</td>
                      <td className="border p-3 text-right">${record.net_pay || 0}</td>
                      <td className="border p-3 text-center">
                        <span className="px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800">
                          Valid
                        </span>
                      </td>
                      <td className="border p-3 text-center">
                        <button
                          onClick={() => generatePayslip(record.id)}
                          disabled={generateStatus[record.id] === "generating" || generateStatus[record.id] === "generated"}
                          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                        >
                          {generateStatus[record.id] === "generating"
                            ? "Generating..."
                            : generateStatus[record.id] === "generated"
                            ? "Generated ✓"
                            : "Generate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Payslips Section */}
        <div>
          <h2 className="text-2xl font-bold mb-6">Payslip Management</h2>
          {payslips.length === 0 ? (
            <p className="text-center text-gray-500">No payslips generated yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border p-3 text-left">Staff ID</th>
                    <th className="border p-3 text-left">Staff Name</th>
                    <th className="border p-3 text-left">Month</th>
                    <th className="border p-3 text-right">Net Pay</th>
                    <th className="border p-3 text-center">Approval Status</th>
                    <th className="border p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payslips.map((payslip) => (
                    <tr key={payslip.id} className="hover:bg-gray-50">
                      <td className="border p-3">{payslip.staff_id}</td>
                      <td className="border p-3">{payslip.staff_name}</td>
                      <td className="border p-3">{payslip.payroll_month}</td>
                      <td className="border p-3 text-right">${payslip.net_pay || 0}</td>
                      <td className="border p-3 text-center">{getStatusBadge(payslip.approval_status)}</td>
                      <td className="border p-3 text-center">
                        {canSend(payslip) ? (
                          <button
                            onClick={() => sendPayslip(payslip.id)}
                            disabled={sendStatus[payslip.id] === "sending" || sendStatus[payslip.id] === "sent"}
                            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                          >
                            {sendStatus[payslip.id] === "sending"
                              ? "Sending..."
                              : sendStatus[payslip.id] === "sent"
                              ? "Sent ✓"
                              : "Send Email"}
                          </button>
                        ) : (
                          <button disabled className="px-4 py-2 bg-gray-300 text-gray-500 rounded cursor-not-allowed">
                            Awaiting Approval
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

        <div className="pt-6 border-t">
          <h3 className="text-lg font-bold mb-4">HR Features</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-gray-100 rounded">
              <h4 className="font-semibold">Staff Profiles</h4>
              <p className="text-sm text-gray-600">Manage employee data and records</p>
            </div>
            <div className="p-4 bg-gray-100 rounded">
              <h4 className="font-semibold">Excel Uploads</h4>
              <p className="text-sm text-gray-600">Import payroll and commission data</p>
            </div>
            <div className="p-4 bg-gray-100 rounded">
              <h4 className="font-semibold">Payroll Records</h4>
              <p className="text-sm text-gray-600">Review and manage payroll entries</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
