import {
  Bell,
  CheckCircle2,
  ClipboardList,
  FileUp,
  FileText,
  Loader2,
  LayoutDashboard,
  Upload,
  Users
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { getStoredSession } from "../../services/sessionService.js";

const pageTitle = "Automated Payroll System – HR Payroll Upload & Payslip Generation";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const payrollSidebarSections = [
  {
    label: "HR",
    items: [
      {
        label: "Dashboard",
        icon: LayoutDashboard,
        path: "/dashboard/payroll/hr",
        end: true
      },
      {
        label: "Staff Records",
        icon: Users,
        path: "/dashboard/payroll/hr/staff-records"
      },
      {
        label: "Payroll Upload",
        icon: Upload,
        path: "/dashboard/payroll/hr/payroll-upload"
      },
      {
        label: "Payroll Runs",
        icon: ClipboardList,
        path: "/dashboard/payroll/hr/payroll-runs"
      },
      {
        label: "Payslips",
        icon: FileText,
        path: "/dashboard/payroll/hr/payslips"
      },
      {
        label: "Notifications",
        icon: Bell,
        path: "/dashboard/payroll/hr/notifications"
      }
    ]
  }
];

const routeHeadings = {
  "/dashboard/payroll/hr": "Dashboard",
  "/dashboard/payroll/hr/staff-records": "Staff Records",
  "/dashboard/payroll/hr/payroll-upload": "Payroll Upload",
  "/dashboard/payroll/hr/payroll-runs": "Payroll Runs",
  "/dashboard/payroll/hr/payslips": "Payslips",
  "/dashboard/payroll/hr/notifications": "Notifications"
};

function getAuthHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function displayCellValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  // Excel hyperlink cells may come as objects, e.g. { text, hyperlink }
  if (typeof value === "object") {
    if (typeof value.text === "string" && value.text.trim()) {
      return value.text;
    }
    if (typeof value.hyperlink === "string" && value.hyperlink.trim()) {
      return value.hyperlink;
    }
    try {
      return JSON.stringify(value);
    } catch (_err) {
      return "[object]";
    }
  }

  return String(value);
}

function StaffRecordsView() {
  const session = getStoredSession();
  const [staffRecords, setStaffRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  const fetchStaff = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch(`${API_BASE_URL}/api/hr/staff`, {
        headers: {
          ...getAuthHeaders(session?.token)
        }
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Failed to load staff records");
      }

      const data = await response.json();
      setStaffRecords(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load staff records");
      setStaffRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (staff) => {
    setEditingStaff(staff);
    setEditFormData({
      staff_name: staff.staff_name || "",
      email: staff.email || "",
      phone: staff.phone || "",
      department: staff.department || "",
      base_salary: staff.base_salary || "",
      status: staff.status || "Active"
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateStaff = async () => {
    if (!editingStaff) return;

    try {
      setError("");
      const response = await fetch(`${API_BASE_URL}/api/hr/staff/${editingStaff.staff_id}`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(session?.token),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(editFormData)
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Failed to update staff record");
      }

      setSuccessMessage("Staff record updated successfully");
      setIsEditModalOpen(false);
      setEditingStaff(null);
      await fetchStaff();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(err.message || "Failed to update staff record");
    }
  };

  const handleDeleteStaff = async (staffId) => {
    if (!window.confirm("Are you sure you want to delete this staff record?")) return;

    try {
      setError("");
      const response = await fetch(`${API_BASE_URL}/api/hr/staff/${staffId}`, {
        method: "DELETE",
        headers: {
          ...getAuthHeaders(session?.token)
        }
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Failed to delete staff record");
      }

      setSuccessMessage("Staff record deleted successfully");
      await fetchStaff();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(err.message || "Failed to delete staff record");
    }
  };

  useEffect(() => {
    fetchStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);

  return (
    <div className="space-y-5">
      <div className="neon-glass neon-border rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Staff Records</h3>
            <p className="mt-1 text-sm text-[#d8c6e8]">
              These are the in-memory records created from uploads or manual adds.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchStaff}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="neon-glass neon-border rounded-2xl border-red-500/40 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {successMessage ? (
        <div className="neon-glass neon-border rounded-2xl border-emerald-500/40 p-4 text-sm text-emerald-200">
          {successMessage}
        </div>
      ) : null}

      <div className="neon-glass neon-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center gap-3 p-6 text-[#d8c6e8]">
            <Loader2 className="animate-spin" size={18} />
            Loading staff records...
          </div>
        ) : staffRecords.length === 0 ? (
          <div className="p-6 text-sm text-[#d8c6e8]">
            No staff records yet. Upload a sample file first.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/5 text-[#d8c6e8]">
                <tr>
                  <th className="px-4 py-3 font-medium">Staff ID</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Department</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">Salary</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th> 
                </tr>
              </thead>
              <tbody>
                {staffRecords.map((staff) => (
                  <tr key={staff.staff_id || staff.email || staff.staff_name} className="border-b border-white/5 text-white">
                    <td className="px-4 py-3 text-[#d8c6e8]">{staff.staff_id || "-"}</td>
                    <td className="px-4 py-3">{staff.staff_name || "-"}</td>
                    <td className="px-4 py-3 text-[#d8c6e8]">{staff.email || "-"}</td>
                    <td className="px-4 py-3 text-[#d8c6e8]">{staff.phone || "-"}</td>
                    <td className="px-4 py-3 text-[#d8c6e8]">{staff.department || "-"}</td>
                    <td className="px-4 py-3 text-[#d8c6e8]">{staff.work_location || "-"}</td>
                    <td className="px-4 py-3 text-[#d8c6e8]">
                      ${staff.base_salary || "-"}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs text-emerald-300"> {staff.status || "active"}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2"><button type="button" onClick={() => handleEdit(staff)} className="rounded-lg bg-blue-500/20 px-3 py-1 text-xs text-blue-300 hover:bg-blue-500/30">Edit</button>
                        <button type="button" onClick={() => handleDeleteStaff(staff.staff_id)} className="rounded-lg bg-red-500/20 px-3 py-1 text-xs text-red-300 hover:bg-red-500/30" >
                          Delete
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

      {isEditModalOpen && editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="neon-glass neon-border rounded-2xl w-full max-w-md p-6 m-4">
            <h3 className="text-lg font-semibold text-white">Edit Staff Record</h3>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#d8c6e8]">Name</label>
                <input
                  type="text"
                  value={editFormData.staff_name || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, staff_name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-white/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#d8c6e8]">Email</label>
                <input
                  type="email"
                  value={editFormData.email || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-white/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#d8c6e8]">Phone</label>
                <input
                  type="text"
                  value={editFormData.phone || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-white/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#d8c6e8]">Department</label>
                <input
                  type="text"
                  value={editFormData.department || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-white/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#d8c6e8]">Base Salary</label>
                <input
                  type="number"
                  value={editFormData.base_salary || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, base_salary: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-white/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#d8c6e8]">Status</label>
                <select
                  value={editFormData.status || "Active"}
                  onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white"
                >
                  <option value="Active" style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>Active</option>
                  <option value="Inactive" style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>Inactive</option>
                  <option value="Leave" style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>Leave</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={handleUpdateStaff}
                className="flex-1 rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/30"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingStaff(null);
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

function PayrollUploadView() {
  const session = getStoredSession();
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const uploadHint = useMemo(() => {
    return "Upload CSV or XLSX using the field name file. The backend will map headers and create in-memory staff records when create=true.";
  }, []);

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!selectedFile) {
      setError("Choose a CSV or XLSX file first.");
      return;
    }

    try {
      setUploading(true);
      setError("");
      setResult(null);

      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch(`${API_BASE_URL}/api/hr/employees/upload?create=true`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(session?.token)
        },
        body: formData
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.message || "Upload failed");
      }

      setResult(body);
      setSelectedFile(null);
    } catch (err) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="neon-glass neon-border rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-[#C77DFF]/15 p-3 text-[#C77DFF] ring-1 ring-[#C77DFF]/25">
            <FileUp size={22} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Upload Sample Data</h3>
            <p className="mt-1 text-sm text-[#d8c6e8]">{uploadHint}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleUpload} className="neon-glass neon-border rounded-2xl p-6">
        <label className="block text-sm font-medium text-white">Choose sample file</label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
            className="block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white file:mr-4 file:rounded-md file:border-0 file:bg-[#C77DFF] file:px-4 file:py-2 file:text-white hover:file:bg-[#b866ff]"
          />
          <button
            type="submit"
            disabled={uploading}
            className="inline-flex items-center justify-center rounded-lg bg-[#C77DFF] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#b866ff] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {uploading ? (
              <span className="inline-flex items-center gap-2"><Loader2 className="animate-spin" size={16} /> Uploading</span>
            ) : (
              "Upload and Create"
            )}
          </button>
        </div>
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-[#d8c6e8]">
          Selected file: <span className="font-semibold text-white">{selectedFile?.name || "none"}</span>
        </div>
      </form>

      {error ? (
        <div className="neon-glass neon-border rounded-2xl border-red-500/40 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-6 text-white shadow-[0_0_30px_rgba(16,185,129,0.08)]">
            <div className="flex items-center gap-2 text-emerald-200">
              <CheckCircle2 size={18} />
              <span className="font-semibold">Upload processed</span>
            </div>
            <div className="mt-4 grid gap-3 text-sm text-emerald-50 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">Rows: <span className="font-semibold text-white">{result.processedRows ?? 0}</span></div>
              <div className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">Created: <span className="font-semibold text-white">{result.createdCount ?? 0}</span></div>
              <div className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">Missing headers: <span className="font-semibold text-white">{result.missingHeaders?.length ?? 0}</span></div>
              <div className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">Row errors: <span className="font-semibold text-white">{result.rowErrors?.length ?? 0}</span></div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#120022]/90 p-6 shadow-[0_0_30px_rgba(199,125,255,0.08)]">
            <h4 className="text-base font-semibold text-white">Sample rows preview</h4>
            <div className="mt-4 overflow-x-auto text-sm">
              <table className="min-w-full text-left">
                <thead className="border-b border-white/10 text-[#d8c6e8]">
                  <tr>
                    <th className="px-3 py-2">employee_id</th>
                    <th className="px-3 py-2">name</th>
                    <th className="px-3 py-2">email</th>
                    <th className="px-3 py-2">phone</th>
                    <th className="px-3 py-2">status</th>
                    <th className="px-3 py-2">department_id</th>
                  </tr>
                </thead>
                <tbody>
                  {(result.sampleRows || []).map((row, index) => (
                    <tr key={index} className="border-b border-white/5 text-white">
                      <td className="px-3 py-2 text-[#d8c6e8]">{displayCellValue(row.employee_id)}</td>
                      <td className="px-3 py-2">{displayCellValue(row.name)}</td>
                      <td className="px-3 py-2 text-[#d8c6e8]">{displayCellValue(row.email)}</td>
                      <td className="px-3 py-2 text-[#d8c6e8]">{displayCellValue(row.phone)}</td>
                      <td className="px-3 py-2 text-[#d8c6e8]">{displayCellValue(row.status)}</td>
                      <td className="px-3 py-2 text-[#d8c6e8]">{displayCellValue(row.department_id)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PayrollRunsView() {
  const mockPayrollRuns = [
    {
      run_id: "PR001",
      period: "January 2024",
      status: "Completed",
      staff_count: 25,
      total_amount: "$45,230.50",
      run_date: "2024-01-31"
    },
    {
      run_id: "PR002",
      period: "February 2024",
      status: "In Progress",
      staff_count: 25,
      total_amount: "$45,650.00",
      run_date: "2024-02-15"
    },
    {
      run_id: "PR003",
      period: "March 2024",
      status: "Pending",
      staff_count: 24,
      total_amount: "$44,920.75",
      run_date: "2024-03-31"
    }
  ];

  return (
    <div className="space-y-5">
      <div className="neon-glass neon-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-white/5 text-[#d8c6e8]">
              <tr>
                <th className="px-4 py-3 font-medium">Run ID</th>
                <th className="px-4 py-3 font-medium">Period</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Staff Count</th>
                <th className="px-4 py-3 font-medium">Total Amount</th>
                <th className="px-4 py-3 font-medium">Run Date</th>
              </tr>
            </thead>
            <tbody>
              {mockPayrollRuns.map((run) => (
                <tr key={run.run_id} className="border-b border-white/5 text-white">
                  <td className="px-4 py-3 text-[#d8c6e8]">{run.run_id}</td>
                  <td className="px-4 py-3">{run.period}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                      run.status === "Completed" ? "bg-emerald-500/20 text-emerald-300" :
                      run.status === "In Progress" ? "bg-blue-500/20 text-blue-300" :
                      "bg-yellow-500/20 text-yellow-300"
                    }`}>
                      {run.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#d8c6e8]">{run.staff_count}</td>
                  <td className="px-4 py-3 text-[#d8c6e8]">{run.total_amount}</td>
                  <td className="px-4 py-3 text-[#d8c6e8]">{run.run_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PayslipsView() {
  const session = getStoredSession();
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [generating, setGenerating] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [payrollMonth, setPayrollMonth] = useState(new Date().toLocaleString('en-US', { month: 'long' }));
  const [payrollYear, setPayrollYear] = useState(new Date().getFullYear());
  const [actionInProgress, setActionInProgress] = useState(null);

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
      setPayslips(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load payslips");
      setPayslips([]);
    } finally {
      setLoading(false);
    }
  };

  const generatePayslips = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError("Choose a payroll file first");
      return;
    }

    try {
      setGenerating(true);
      setError("");
      setSuccessMessage("");

      // First create payroll run
      const runResponse = await fetch(`${API_BASE_URL}/api/hr/payroll-run`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(session?.token),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          period_month: payrollMonth,
          period_year: payrollYear
        })
      });

      if (!runResponse.ok) {
        const body = await runResponse.json().catch(() => ({}));
        throw new Error(body.message || "Failed to create payroll run");
      }

      const runData = await runResponse.json();
      const payrollRunId = runData.payroll_run_id;

      // Then generate payslips
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("payroll_run_id", payrollRunId);
      formData.append("period_month", payrollMonth);
      formData.append("period_year", payrollYear);

      const response = await fetch(`${API_BASE_URL}/api/hr/payslips/generate`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(session?.token)
        },
        body: formData
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Failed to generate payslips");
      }

      const result = await response.json();
      setSuccessMessage(`Successfully generated ${result.generated_count} payslips. ${result.skipped_count} records were skipped.`);
      setSelectedFile(null);
      await fetchPayslips();
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (err) {
      setError(err.message || "Failed to generate payslips");
    } finally {
      setGenerating(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "draft":
        return "bg-gray-500/20 text-gray-300";
      case "finance_pending":
        return "bg-yellow-500/20 text-yellow-300";
      case "finance_approved":
        return "bg-blue-500/20 text-blue-300";
      case "admin_pending":
        return "bg-purple-500/20 text-purple-300";
      case "admin_approved":
        return "bg-cyan-500/20 text-cyan-300";
      case "sent_to_staff":
        return "bg-emerald-500/20 text-emerald-300";
      case "rejected":
        return "bg-red-500/20 text-red-300";
      default:
        return "bg-white/10 text-white";
    }
  };

  const getStatusLabel = (status) => {
    return status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const handleSendToFinance = async (payslipId) => {
    try {
      setActionInProgress(payslipId);
      setError("");
      const response = await fetch(`${API_BASE_URL}/api/payroll/payslips/${payslipId}/send-to-finance`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(session?.token),
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Failed to send to Finance");
      }

      setSuccessMessage("Payslip sent to Finance");
      await fetchPayslips();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(err.message || "Failed to send to Finance");
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
        <h3 className="text-lg font-semibold text-white">Generate Payslips</h3>
        <p className="mt-2 text-sm text-[#d8c6e8]">
          Upload a payroll file to generate payslips. They will be created in draft status.
        </p>
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

      <form onSubmit={generatePayslips} className="neon-glass neon-border rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-[#d8c6e8]">Payroll Month</label>
            <select
              value={payrollMonth}
              onChange={(e) => setPayrollMonth(e.target.value)}
              className="mt-2 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white"
            >
              {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(m => (
                <option key={m} value={m} style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#d8c6e8]">Payroll Year</label>
            <input
              type="number"
              value={payrollYear}
              onChange={(e) => setPayrollYear(parseInt(e.target.value))}
              className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#d8c6e8]">Payroll File (CSV/XLSX)</label>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            className="mt-2 block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white file:mr-4 file:rounded-md file:border-0 file:bg-[#C77DFF] file:px-4 file:py-2 file:text-white hover:file:bg-[#b866ff]"
          />
        </div>

        <button
          type="submit"
          disabled={generating}
          className="w-full rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"
        >
          {generating ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="animate-spin" size={16} /> Generating...
            </span>
          ) : (
            "Generate Payslips"
          )}
        </button>
      </form>

      <div className="neon-glass neon-border rounded-2xl overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-white/5 p-6">
          <div>
            <h3 className="text-lg font-semibold text-white">Payslips</h3>
            <p className="mt-1 text-sm text-[#d8c6e8]">
              {payslips.length} total payslips
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

        {loading ? (
          <div className="flex items-center gap-3 p-6 text-[#d8c6e8]">
            <Loader2 className="animate-spin" size={18} />
            Loading payslips...
          </div>
        ) : payslips.length === 0 ? (
          <div className="p-6 text-sm text-[#d8c6e8]">
            No payslips yet. Upload a payroll file to generate them.
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
                  <th className="px-4 py-3 font-medium">Deductions</th>
                  <th className="px-4 py-3 font-medium">Net Pay</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payslips.map((payslip) => (
                  <tr key={payslip.payslip_id} className="border-b border-white/5 text-white">
                    <td className="px-4 py-3 text-[#d8c6e8]">{payslip.payslip_id}</td>
                    <td className="px-4 py-3">{payslip.staff_name}</td>
                    <td className="px-4 py-3 text-[#d8c6e8]">
                      {payslip.period_month} {payslip.period_year}
                    </td>
                    <td className="px-4 py-3 text-[#d8c6e8]">
                      ${payslip.gross_salary?.toFixed(2) || "0.00"}
                    </td>
                    <td className="px-4 py-3 text-red-300">
                      ${payslip.total_deductions?.toFixed(2) || "0.00"}
                    </td>
                    <td className="px-4 py-3 text-emerald-300">
                      ${payslip.net_pay?.toFixed(2) || "0.00"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(payslip.status)}`}>
                        {getStatusLabel(payslip.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {payslip.status === 'draft' ? (
                        <button
                          type="button"
                          onClick={() => handleSendToFinance(payslip.payslip_id)}
                          disabled={actionInProgress === payslip.payslip_id}
                          className="rounded-lg bg-indigo-500/20 px-3 py-1 text-xs text-indigo-300 hover:bg-indigo-500/30 disabled:opacity-50"
                        >
                          {actionInProgress === payslip.payslip_id ? 'Sending...' : 'Send to Finance'}
                        </button>
                      ) : (
                        <span className="text-sm text-[#d8c6e8]">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function NotificationsView() {
  const mockNotifications = [
    {
      notif_id: "N001",
      type: "Payroll Alert",
      message: "Payroll run PR002 has been initiated for February 2024",
      timestamp: "2024-02-15 09:30:00",
      read: false,
      priority: "High"
    },
    {
      notif_id: "N002",
      type: "Staff Update",
      message: "New staff member Jane Doe has been added to the system",
      timestamp: "2024-02-14 14:20:00",
      read: false,
      priority: "Medium"
    },
    {
      notif_id: "N003",
      type: "System Info",
      message: "Monthly audit report is ready for review",
      timestamp: "2024-02-13 10:00:00",
      read: true,
      priority: "Low"
    },
    {
      notif_id: "N004",
      type: "Finance Alert",
      message: "Invoice INV-2024-002 payment received",
      timestamp: "2024-02-12 16:45:00",
      read: true,
      priority: "Low"
    }
  ];

  return (
    <div className="space-y-5">
      <div className="neon-glass neon-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-white/5 text-[#d8c6e8]">
              <tr>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Message</th>
                <th className="px-4 py-3 font-medium">Timestamp</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {mockNotifications.map((notif) => (
                <tr key={notif.notif_id} className="border-b border-white/5 text-white">
                  <td className="px-4 py-3 text-[#d8c6e8]">{notif.type}</td>
                  <td className="px-4 py-3 text-white">{notif.message}</td>
                  <td className="px-4 py-3 text-[#d8c6e8]">{notif.timestamp}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                      notif.priority === "High" ? "bg-red-500/20 text-red-300" :
                      notif.priority === "Medium" ? "bg-yellow-500/20 text-yellow-300" :
                      "bg-blue-500/20 text-blue-300"
                    }`}>
                      {notif.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                      notif.read ? "bg-white/10 text-white/70" : "bg-blue-500/20 text-blue-300"
                    }`}>
                      {notif.read ? "Read" : "Unread"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function HRPayrollPage() {
  const session = getStoredSession();
  const location = useLocation();
  const heading = routeHeadings[location.pathname] || "Dashboard";
  const activePath = location.pathname.replace(/\/+$/, "") || "/";

  const renderContent = () => {
    if (activePath === "/dashboard/payroll/hr/staff-records") {
      return <StaffRecordsView />;
    }

    if (activePath === "/dashboard/payroll/hr/payroll-upload") {
      return <PayrollUploadView />;
    }

    if (activePath === "/dashboard/payroll/hr/payroll-runs") {
      return <PayrollRunsView />;
    }

    if (activePath === "/dashboard/payroll/hr/payslips") {
      return <PayslipsView />;
    }

    if (activePath === "/dashboard/payroll/hr/notifications") {
      return <NotificationsView />;
    }

    return (
      <div className="space-y-4">
        <div className="neon-glass neon-border rounded-2xl p-5 text-white">
          <p className="text-sm font-semibold text-white">HR Dashboard</p>
          <p className="mt-1 break-all text-sm text-[#d8c6e8]">Welcome to the HR Payroll Module</p>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout
      pageTitle={pageTitle}
      user={session?.user}
      sidebarSections={payrollSidebarSections}
      sidebarTitle="Automated Invoicing & Payroll System"
      searchPlaceholder="Search staff, payroll runs, payslips..."
    >
      <section>
        <h2 className="text-2xl font-semibold text-white">{heading}</h2>
        <div className="mt-3 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-[#d8c6e8]">
          {activePath}
        </div>
        <div className="mt-6 min-h-[calc(100vh-12rem)]">{renderContent()}</div>
      </section>
    </DashboardLayout>
  );
}
