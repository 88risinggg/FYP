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
                        <div className="flex gap-2"><button type="button" className="rounded-lg bg-blue-500/20 px-3 py-1 text-xs text-blue-300 hover:bg-blue-500/30">Edit</button>
                        <button type="button" className="rounded-lg bg-red-500/20 px-3 py-1 text-xs text-red-300 hover:bg-red-500/30" >
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

    return (
      <div className="space-y-4">
        <div className="neon-glass neon-border rounded-2xl p-5 text-white">
          <p className="text-sm font-semibold text-white">HR upload workspace loaded</p>
          <p className="mt-1 break-all text-sm text-[#d8c6e8]">{activePath}</p>
        </div>
        <PayrollUploadView />
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
