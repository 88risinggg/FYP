import { useState, useEffect } from "react";
import DashboardShell from "../components/DashboardShell.jsx";

export default function HRDashboard() {
  const [payrollRecords, setPayrollRecords] = useState([]);
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [generateStatus, setGenerateStatus] = useState({});
  const [sendStatus, setSendStatus] = useState({});
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState(null);
  const [showUploadResults, setShowUploadResults] = useState(false);

  useEffect(() => {
    fetchPayrollRecords();
    fetchPayslips();
  }, []);

  useEffect(() => {
    if (!success) return undefined;

    const timeoutId = window.setTimeout(() => {
      setSuccess("");
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [success]);

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
    setSuccess("");
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
      setSuccess("Payslip generated and sent to Finance for approval. It will appear in the Payslip tab once Finance approves it.");
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

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setError("Please upload an XLSX, XLS, or CSV file");
      return;
    }

    setUploadFile(file);
    setUploading(true);
    setError("");
    setSuccess("");
    setUploadResults(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:4001/api/payroll/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Upload failed");
      }

      const data = await response.json();
      setUploadResults(data);
      setShowUploadResults(true);
      setPayrollRecords((prev) => {
        const existingIds = new Set(prev.map((record) => record.id));
        const nextRecords = [...prev];

        data.rows.forEach((row) => {
          if (!existingIds.has(row.id)) {
            nextRecords.unshift(row);
          }
        });

        return nextRecords;
      });
      setSuccess(`Upload successful. ${data.log.totalRows} payroll rows were processed with calculated values.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      setUploadFile(null);
      e.target.value = ""; // Reset file input
    }
  };

  const downloadTemplate = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:4001/api/payroll/template", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to download template");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "PayrollTemplate.xlsx";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  };

  const visiblePayslips = payslips.filter(
    (payslip) => payslip.approval_status === "approved" || payslip.approval_status === "sent"
  );
  const pendingFinancePayslips = payslips.filter((payslip) => payslip.approval_status === "pending");
  const payrollDisplayRows = uploadResults?.rows?.length ? payrollRecords : payrollRecords;

  return (
    <DashboardShell role="HR" title="HR Dashboard - Monthly Payroll Processing">
      <div className="p-6 space-y-8">
        {error && <div className="bg-red-100 text-red-800 p-4 rounded mb-4">{error}</div>}
        {success && <div className="bg-green-100 text-green-800 p-4 rounded mb-4">{success}</div>}

        {/* Workflow Guide */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded">
          <h2 className="text-xl font-bold text-blue-900 mb-4">📋 Monthly Payroll Workflow</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded border-2 border-blue-200">
              <div className="text-2xl font-bold text-blue-600 mb-2">1️⃣</div>
              <h4 className="font-semibold text-gray-900 mb-2">HR: Download Template</h4>
              <p className="text-sm text-gray-600">Get the monthly Excel template with required columns</p>
            </div>
            <div className="bg-white p-4 rounded border-2 border-blue-200">
              <div className="text-2xl font-bold text-blue-600 mb-2">2️⃣</div>
              <h4 className="font-semibold text-gray-900 mb-2">HR: Fill & Upload</h4>
              <p className="text-sm text-gray-600">Fill staff payroll data and upload the Excel file</p>
            </div>
            <div className="bg-white p-4 rounded border-2 border-blue-200">
              <div className="text-2xl font-bold text-blue-600 mb-2">3️⃣</div>
              <h4 className="font-semibold text-gray-900 mb-2">HR: Generate Payslips</h4>
              <p className="text-sm text-gray-600">Create payslips from validated payroll records</p>
            </div>
            <div className="bg-white p-4 rounded border-2 border-blue-200">
              <div className="text-2xl font-bold text-blue-600 mb-2">4️⃣</div>
              <h4 className="font-semibold text-gray-900 mb-2">Finance: Approve</h4>
              <p className="text-sm text-gray-600">Finance approves payslips manually before sending</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-blue-200">
            <p className="text-sm text-blue-900">
              <strong>Note:</strong> Only HR can upload data. Only Finance can approve payslips. Only you (HR) can send approved payslips. Staff can only view their own payslips.
            </p>
          </div>
        </div>

        {/* Template Download Section */}
        <div className="bg-green-50 p-6 rounded border-2 border-green-200">
          <h3 className="text-lg font-bold mb-4 text-green-900">📥 Excel Template Download</h3>
          <p className="text-sm text-gray-600 mb-4">Download the template, fill in your staff payroll data for the current month, then upload it.</p>
          <button
            onClick={downloadTemplate}
            className="px-6 py-3 bg-green-600 text-white rounded hover:bg-green-700 font-semibold transition"
          >
            📊 Download Template for This Month
          </button>
          <div className="mt-4 bg-white p-4 rounded text-sm text-gray-700">
            <p className="font-semibold mb-2">Template Includes:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Staff ID & Name</li>
              <li>Email, Month, Working Days</li>
              <li>Basic Salary & Commission (Services, Product, Credit)</li>
              <li>Allowance & Deductions (Loan, Other)</li>
            </ul>
          </div>
        </div>

        {/* Payroll Records Section */}
        <div>
          <h2 className="text-2xl font-bold mb-4">📊 Uploaded Payroll Records</h2>
          <p className="text-sm text-gray-600 mb-4">These records were uploaded from Excel. Once validated, generate payslips to send them for approval.</p>
          {loading ? (
            <p className="text-center text-gray-500">Loading payroll records...</p>
          ) : payrollRecords.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded text-center">
              <p className="text-yellow-800">📁 No payroll records yet. Download the template above and upload your first file.</p>
            </div>
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
                    <th className="border p-3 text-center">Generate Payslip</th>
                  </tr>
                </thead>
                <tbody>
                    {payrollDisplayRows.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="border p-3">{record.staff_id}</td>
                      <td className="border p-3">{record.staff_name}</td>
                      <td className="border p-3">{record.payroll_month}</td>
                        <td className="border p-3 text-right font-semibold">${Number(record.basic_salary || 0).toFixed(2)}</td>
                        <td className="border p-3 text-right font-bold text-green-600">${Number(record.net_pay || 0).toFixed(2)}</td>
                      <td className="border p-3 text-center">
                        <span className="px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800">
                          ✓ Valid
                        </span>
                      </td>
                      <td className="border p-3 text-center">
                        <button
                          onClick={() => generatePayslip(record.id)}
                          disabled={generateStatus[record.id] === "generating" || generateStatus[record.id] === "generated"}
                          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 text-sm"
                        >
                          {generateStatus[record.id] === "generating"
                            ? "Generating..."
                            : generateStatus[record.id] === "generated"
                            ? "✓ Generated"
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
          <h2 className="text-2xl font-bold mb-4">🎫 Payslip Management</h2>
          <div className="bg-purple-50 border-l-4 border-purple-500 p-4 mb-4 rounded">
            <p className="text-sm text-purple-900">
              <strong>Approval Workflow:</strong> After generating payslips, Finance will review and approve them manually. Once approved, you can send them to staff via email.
            </p>
          </div>

          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Pending payslips are hidden from this tab</p>
            <p className="mt-1">
              {pendingFinancePayslips.length > 0
                ? `${pendingFinancePayslips.length} payslip(s) are currently waiting for Finance approval.`
                : "No payslips are waiting for Finance approval right now."}
            </p>
          </div>
          
          {visiblePayslips.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No approved payslips available yet. Finance must approve generated payslips before they appear here.</p>
          ) : (
            <div className="space-y-6">
              {/* Approved - Ready to Send */}
              {visiblePayslips.filter(p => p.approval_status === "approved").length > 0 && (
                <div className="bg-green-50 p-6 rounded border-2 border-green-200">
                  <h3 className="text-lg font-bold text-green-900 mb-4">✅ Approved - Ready to Send</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300 text-sm">
                      <thead className="bg-green-100">
                        <tr>
                          <th className="border p-2 text-left">Staff ID</th>
                          <th className="border p-2 text-left">Staff Name</th>
                          <th className="border p-2 text-left">Month</th>
                          <th className="border p-2 text-right">Net Pay</th>
                          <th className="border p-2 text-center">Status</th>
                          <th className="border p-2 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visiblePayslips.filter(p => p.approval_status === "approved").map((payslip) => (
                          <tr key={payslip.id} className="hover:bg-green-50">
                            <td className="border p-2">{payslip.staff_id}</td>
                            <td className="border p-2">{payslip.staff_name}</td>
                            <td className="border p-2">{payslip.payroll_month}</td>
                            <td className="border p-2 text-right font-semibold">${payslip.net_pay || 0}</td>
                            <td className="border p-2 text-center">
                              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                                Approved
                              </span>
                            </td>
                            <td className="border p-2 text-center">
                              <button
                                onClick={() => sendPayslip(payslip.id)}
                                disabled={sendStatus[payslip.id] === "sending" || sendStatus[payslip.id] === "sent"}
                                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 text-xs"
                              >
                                {sendStatus[payslip.id] === "sending"
                                  ? "Sending..."
                                  : sendStatus[payslip.id] === "sent"
                                  ? "✓ Sent"
                                  : "Send Email"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Already Sent */}
              {visiblePayslips.filter(p => p.approval_status === "sent").length > 0 && (
                <div className="bg-blue-50 p-6 rounded border-2 border-blue-200">
                  <h3 className="text-lg font-bold text-blue-900 mb-4">📧 Sent to Staff</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300 text-sm">
                      <thead className="bg-blue-100">
                        <tr>
                          <th className="border p-2 text-left">Staff ID</th>
                          <th className="border p-2 text-left">Staff Name</th>
                          <th className="border p-2 text-left">Month</th>
                          <th className="border p-2 text-right">Net Pay</th>
                          <th className="border p-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visiblePayslips.filter(p => p.approval_status === "sent").map((payslip) => (
                          <tr key={payslip.id} className="hover:bg-blue-50">
                            <td className="border p-2">{payslip.staff_id}</td>
                            <td className="border p-2">{payslip.staff_name}</td>
                            <td className="border p-2">{payslip.payroll_month}</td>
                            <td className="border p-2 text-right font-semibold">${payslip.net_pay || 0}</td>
                            <td className="border p-2 text-center">
                              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                                Sent ✓
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="pt-6 border-t">
          <h3 className="text-lg font-bold mb-4">📁 Upload Excel File - Data Entry</h3>
          <div className="bg-blue-50 p-6 rounded mb-6 border-2 border-blue-200">
            <p className="text-sm text-gray-600 mb-4">
              Drag and drop your completed Excel file or click to browse. The system will validate and calculate all payroll values automatically.
            </p>
            <div className="border-2 border-dashed border-blue-300 rounded p-6 text-center cursor-pointer hover:border-blue-500 transition"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  setUploadFile(file);
                  handleFileUpload({ target: { files: [file] } });
                }
              }}
            >
              <input
                type="file"
                id="payrollUpload"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
              <label htmlFor="payrollUpload" className="cursor-pointer block">
                <p className="text-lg font-semibold text-blue-600">
                  {uploading ? "Uploading..." : "Drag & drop XLSX or click to select"}
                </p>
                <p className="text-sm text-gray-500 mt-2">Supported: XLSX, XLS, CSV</p>
              </label>
            </div>
          </div>

          {/* Upload Results */}
          {showUploadResults && uploadResults && (
            <div className="mb-6 bg-gray-50 p-6 rounded border-2 border-green-300">
              <h4 className="text-lg font-bold mb-4 text-green-700">✅ Upload Validation Results - {uploadResults.log.totalRows} Records</h4>
              
              {uploadResults.log.failedRows > 0 && (
                <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 p-4 rounded mb-4">
                  ⚠️ {uploadResults.log.failedRows} record(s) have validation errors
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300 text-sm">
                  <thead className="bg-gray-200">
                    <tr>
                      <th className="border p-2 text-left">Staff ID</th>
                      <th className="border p-2 text-left">Staff Name</th>
                      <th className="border p-2 text-left">Month</th>
                      <th className="border p-2 text-right">Basic</th>
                      <th className="border p-2 text-right">Earnings</th>
                      <th className="border p-2 text-right">Emp. CPF</th>
                      <th className="border p-2 text-right">Deductions</th>
                      <th className="border p-2 text-right">Net Pay</th>
                      <th className="border p-2 text-left">Validation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadResults.rows.map((record, idx) => (
                      <tr key={idx} className={record.validationErrors?.length > 0 ? "bg-red-50" : "hover:bg-gray-100"}>
                        <td className="border p-2">{record.staff_id}</td>
                        <td className="border p-2">{record.staff_name}</td>
                        <td className="border p-2">{record.payroll_month}</td>
                        <td className="border p-2 text-right font-semibold">${record.basic_salary?.toFixed(2) || "0.00"}</td>
                        <td className="border p-2 text-right font-semibold">${record.total_earnings?.toFixed(2) || "0.00"}</td>
                        <td className="border p-2 text-right font-semibold">${record.employee_cpf?.toFixed(2) || "0.00"}</td>
                        <td className="border p-2 text-right font-semibold">${record.total_deductions?.toFixed(2) || "0.00"}</td>
                        <td className="border p-2 text-right font-bold text-green-600">${record.net_pay?.toFixed(2) || "0.00"}</td>
                        <td className="border p-2">
                          {record.validationErrors?.length > 0 ? (
                            <div className="text-red-600 text-xs">
                              {record.validationErrors.map((err, i) => (
                                <div key={i}>❌ {err}</div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-green-600 font-semibold">✓ Valid</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
