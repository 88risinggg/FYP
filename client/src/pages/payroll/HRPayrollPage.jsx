import {
  AlertCircle,
  Bell,
  CheckCircle2,
  ClipboardList,
  FileUp,
  FileText,
  Send,
  Loader2,
  LayoutDashboard,
  Upload,
  Users
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { getStoredSession } from "../../services/sessionService.js";

const pageTitle = "Automated Payroll System – HR Payroll Upload & Payslip Generation";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

function normalizeSearchValue(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function recordMatchesSearch(record, query, fields = []) {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery || !record) return false;

  const haystack = fields
    .map((field) => {
      const value = typeof field === "function" ? field(record) : record?.[field];
      return normalizeSearchValue(value);
    })
    .filter(Boolean)
    .join(" ");

  if (!haystack) return false;

  return normalizedQuery.split(/\s+/).filter(Boolean).some((token) => haystack.includes(token));
}

function getSearchCountLabel(filteredCount, totalCount, query = "") {
  if (query && filteredCount === 0) {
    return "No records match your search.";
  }

  return `Showing ${filteredCount} of ${totalCount} records`;
}

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

function HRDashboardView() {
  const session = getStoredSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [counts, setCounts] = useState({ total: 0, active: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const handleUnauthorized = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
    navigate("/login", { state: { from: location, message: "Session expired." } });
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/api/hr/staff`, { headers: { ...getAuthHeaders(session?.token) } });
        if (res.status === 401 || res.status === 403) return handleUnauthorized();
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!mounted) return;
        const total = Array.isArray(data) ? data.length : 0;
        const active = Array.isArray(data)
          ? data.filter((staff) => staff.status === 1 || String(staff.status || "").toLowerCase() === "active").length
          : 0;
        setCounts({ total, active });
      } catch (err) {
        setError(err.name === 'TypeError' ? "Network error: Server unreachable" : "Failed to load dashboard data");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [session?.token]);

  const pct = counts.total ? Math.round((counts.active / counts.total) * 100) : 0;

  return (
    <div className="space-y-4">
      {error ? (
        <div className="neon-glass neon-border rounded-2xl border-red-500/40 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="neon-glass neon-border rounded-2xl p-4">
          <div className="text-sm text-[#d8c6e8]">Total Employees</div>
          <div className="mt-2 text-2xl font-semibold text-white">{loading ? '...' : counts.total}</div>
        </div>
        <div className="neon-glass neon-border rounded-2xl p-4">
          <div className="text-sm text-[#d8c6e8]">Active Employees</div>
          <div className="mt-2 text-2xl font-semibold text-white">{loading ? '...' : counts.active}</div>
        </div>
        <div className="neon-glass neon-border rounded-2xl p-4 flex items-center justify-center">
          <div className="text-center">
            <svg width="80" height="80" viewBox="0 0 36 36">
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#1f2937" strokeWidth="4"/>
              <path stroke="#10b981" strokeWidth="4" strokeDasharray={`${pct},100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none"/>
            </svg>
            <div className="mt-2 text-sm text-[#d8c6e8]">Active %</div>
            <div className="text-lg font-semibold text-white">{pct}%</div>
          </div>
        </div>
      </div>
    </div>
  );
}

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

function getStaffDisplayName(staff) {
  return staff?.staff_name || staff?.name || staff?.full_name || "-";
}

function getStaffDisplayId(staff) {
  return staff?.staff_id || staff?.employee_id || staff?.id || "-";
}

function getStaffDisplayDepartment(staff) {
  return staff?.department || staff?.department_name || staff?.department_id || "-";
}

function getStaffDisplayLocation(staff) {
  return staff?.work_location || staff?.location || staff?.office_location || "-";
}

function getStaffDisplayHireDate(staff) {
  return staff?.hire_date || staff?.hireDate || staff?.hired_at || "-";
}

function getStaffActionId(staff) {
  return staff?.staff_id || staff?.employee_id || staff?.id || "";
}

function StaffRecordsView() {
  const session = getStoredSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [staffRecords, setStaffRecords] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [advanceRequests, setAdvanceRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [approvingId, setApprovingId] = useState(null);
  const [highlightedStaffId, setHighlightedStaffId] = useState("");
  const rowRefs = useRef(new Map())
  const [historyStaff, setHistoryStaff] = useState(null);
  const [historyPayslips, setHistoryPayslips] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const handleViewHistory = async (staff) => {
    setHistoryStaff(staff);
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/hr/payslips`, {
        headers: { ...getAuthHeaders(session?.token) }
      });
      const data = await res.json();
      const staffId = staff.employee_id || staff.staff_id;
      const filtered = Array.isArray(data)
        ? data.filter(p => p.employee_id === staffId)
        : [];
      setHistoryPayslips(filtered);
    } catch {
      setHistoryPayslips([]);
    } finally {
      setHistoryLoading(false);
    }
};

  const getRowKey = (staff) => staff.staff_id || staff.employee_id || staff.email || staff.staff_name || staff.name || "";

  const filteredStaff = useMemo(() => {
    const query = searchTerm.trim();
    if (!query) return staffRecords;

    return staffRecords.filter((staff) =>
      recordMatchesSearch(staff, query, ["name", "staff_name", "email", "department", "department_id", "position", "job_title", "employee_id", "staff_id"])
    );
  }, [staffRecords, searchTerm]);

  const registerRowRef = (key) => (node) => {
    if (!key) return;
    if (node) {
      rowRefs.current.set(key, node);
    } else {
      rowRefs.current.delete(key);
    }
  };

  useEffect(() => {
    const highlight = new URLSearchParams(location.search).get("highlight") || "";
    if (!highlight) {
      setHighlightedStaffId("");
      return undefined;
    }

    setHighlightedStaffId(highlight);
    const row = rowRefs.current.get(highlight);
    if (row && typeof row.scrollIntoView === "function") {
      row.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    const timer = setTimeout(() => {
      setHighlightedStaffId("");
      navigate("/dashboard/payroll/hr/staff-records", { replace: true });
    }, 1400);

    return () => clearTimeout(timer);
  }, [location.search, navigate, staffRecords.length]);

  useEffect(() => {
    const query = searchTerm.trim();
    if (!query || filteredStaff.length === 0) return undefined;

    const firstMatchKey = getRowKey(filteredStaff[0]);
    const timer = setTimeout(() => {
      const row = rowRefs.current.get(firstMatchKey);
      if (row && typeof row.scrollIntoView === "function") {
        row.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [filteredStaff, searchTerm]);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch(`${API_BASE_URL}/api/hr/staff`, {
        headers: {
          ...getAuthHeaders(session?.token)
        }
      });

      if (response.status === 401 || response.status === 403) {
        return handleUnauthorized();
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Failed to load staff records");
      }

      const data = await response.json();
      setStaffRecords(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load staff records");
      setError(err.name === 'TypeError' ? "Network error: Server unreachable" : err.message || "Failed to load staff records");
      setStaffRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUnauthorized = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
    navigate("/login", { state: { from: location, message: "Session expired. Please login again." } });
    return null;
  };

  const handleEdit = (staff) => {
    setEditingStaff(staff);
    setEditFormData({
      email: staff.email || "",
      phone: staff.phone || "",
      address: staff.address || "",
      department: staff.department || "",
      base_salary: staff.base_salary || "",
      status: staff.status || "Active",
      staffRequestConfirmed: false
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateStaff = async () => {
    if (!editingStaff) return;

    if ((editFormData.email !== (editingStaff.email || "") ||
      editFormData.phone !== (editingStaff.phone || "") ||
      editFormData.address !== (editingStaff.address || "")) &&
      !editFormData.staffRequestConfirmed) {
      setFieldError("Confirm that personal field changes were requested by the staff member.");
      setError("Confirm that personal field changes were requested by the staff member.");
      return;
    }

    try {
      setError("");
      setFieldError("");
      const { staffRequestConfirmed, ...payload } = editFormData;
      const response = await fetch(`${API_BASE_URL}/api/hr/staff/${getStaffActionId(editingStaff)}`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(session?.token),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (response.status === 401 || response.status === 403) {
        return handleUnauthorized();
      }

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
      setError(err.name === 'TypeError' ? "Network error: Unable to reach server" : err.message || "Failed to update staff record");
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

      if (response.status === 401 || response.status === 403) {
        return handleUnauthorized();
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Failed to delete staff record");
      }

      setSuccessMessage("Staff record deleted successfully");
      await fetchStaff();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(err.name === 'TypeError' ? "Network error: Unable to reach server" : err.message || "Failed to delete staff record");
    }
  };

  const fetchAdvanceRequests = async () => {
    try {
      setLoadingRequests(true);
      setError("");
      const response = await fetch(`${API_BASE_URL}/api/hr/advance-requests`, {
        headers: {
          ...getAuthHeaders(session?.token)
        }
      });

      if (response.status === 401 || response.status === 403) {
        return handleUnauthorized();
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to load advance requests');
      }

      const data = await response.json();
      setAdvanceRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError(err.name === 'TypeError' ? "Network error: Server unreachable" : "Failed to load requests");
    } finally {
      setLoadingRequests(false);
    }
  };


  const approveAdvanceRequest = async (requestId) => {
    try {
      setApprovingId(requestId);
      setError('');
      const response = await fetch(`${API_BASE_URL}/api/hr/advance-requests/${requestId}/approve`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(session?.token),
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401 || response.status === 403) {
        return handleUnauthorized();
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to approve');
      }

      await fetchAdvanceRequests();
      setSuccessMessage('Advance request approved and queued for Finance');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      setError(err.name === 'TypeError' ? "Network error: Unable to reach server" : err.message || 'Failed to approve');
    } finally {
      setApprovingId(null);
    }
  };

  useEffect(() => {
    fetchStaff();
    fetchAdvanceRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);

  useEffect(() => {
    if (!isEditModalOpen) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setIsEditModalOpen(false);
        setEditingStaff(null);
        setFieldError("");
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isEditModalOpen]);

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
        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <label className="block text-sm text-[#d8c6e8]">
            Search staff records...
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search staff records..."
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none placeholder:text-[#d8c6e8]/50"
            />
          </label>
          <div className="text-sm text-[#d8c6e8]">
            {getSearchCountLabel(filteredStaff.length, staffRecords.length, searchTerm.trim())}
          </div>
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
        ) : filteredStaff.length === 0 ? (
          <div className="p-6 text-sm text-[#d8c6e8]">
            No records match your search.
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
                  <th className="px-4 py-3 font-medium">Hire Date</th>
                  <th className="px-4 py-3 font-medium">Department</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">Salary</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th> 
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((staff) => {
                  const rowKey = getRowKey(staff);
                  const isHighlighted = highlightedStaffId && highlightedStaffId === rowKey;
                  const isSearchMatched = searchTerm.trim().length > 0;

                  return (
                    <tr
                      key={rowKey}
                      ref={registerRowRef(rowKey)}
                      className={`border-b border-white/5 text-white transition-colors duration-700 ${isSearchMatched ? "bg-amber-400/10" : ""} ${isHighlighted ? "bg-yellow-400/20 ring-2 ring-yellow-300/70" : ""}`}
                    >
                    <td className="px-4 py-3 text-[#d8c6e8]">{getStaffDisplayId(staff)}</td>
                    <td className="px-4 py-3">{getStaffDisplayName(staff)}</td>
                    <td className="px-4 py-3 text-[#d8c6e8]">{staff.email || "-"}</td>
                    <td className="px-4 py-3 text-[#d8c6e8]">{staff.phone || "-"}</td>
                    <td className="px-4 py-3 text-[#d8c6e8]">{getStaffDisplayHireDate(staff)}</td>
                    <td className="px-4 py-3 text-[#d8c6e8]">{getStaffDisplayDepartment(staff)}</td>
                    <td className="px-4 py-3 text-[#d8c6e8]">{getStaffDisplayLocation(staff)}</td>
                    <td className="px-4 py-3 text-[#d8c6e8]">
                      ${staff.base_salary || "-"}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs text-emerald-300"> {staff.status || "active"}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                            <button type="button" onClick={() => handleEdit(staff)} className="rounded-lg bg-blue-500/20 px-3 py-1 text-xs text-blue-300 hover:bg-blue-500/30">Edit</button>
                            <button type="button" onClick={() => handleDeleteStaff(getStaffActionId(staff))} className="rounded-lg bg-red-500/20 px-3 py-1 text-xs text-red-300 hover:bg-red-500/30" >
                            Delete
                          </button>
                          <button type="button" onClick={() => handleViewHistory(staff)}>History</button>
                        </div>
                      </td>
                      </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isEditModalOpen && editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="neon-glass neon-border rounded-2xl w-full max-w-md p-6 m-4" role="dialog" aria-modal="true" aria-labelledby="staff-edit-title">
            <h3 id="staff-edit-title" className="text-lg font-semibold text-white">Edit Staff Record</h3>
            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-medium text-white">{getStaffDisplayName(editingStaff)}</p>
                <p className="mt-1 text-xs text-[#d8c6e8]">{getStaffDisplayId(editingStaff)}</p>
                <p className="mt-3 text-xs text-[#d8c6e8]">
                  Personal fields below must only be updated when requested by the staff member.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-semibold text-white">Personal Fields</p>
                <div className="mt-3 space-y-3">
                  <div>
                    <label htmlFor="staff-edit-email" className="block text-sm font-medium text-[#d8c6e8]">Email</label>
                    <input
                      id="staff-edit-email"
                      type="email"
                      value={editFormData.email || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-white/30"
                    />
                  </div>
                  <div>
                    <label htmlFor="staff-edit-phone" className="block text-sm font-medium text-[#d8c6e8]">Phone</label>
                    <input
                      id="staff-edit-phone"
                      type="tel"
                      value={editFormData.phone || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-white/30"
                    />
                  </div>
                  <div>
                    <label htmlFor="staff-edit-address" className="block text-sm font-medium text-[#d8c6e8]">Address</label>
                    <input
                      id="staff-edit-address"
                      type="text"
                      value={editFormData.address || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-white/30"
                    />
                  </div>
                  <label className="flex items-start gap-2 text-xs text-[#d8c6e8]">
                    <input
                      type="checkbox"
                      checked={Boolean(editFormData.staffRequestConfirmed)}
                      onChange={(e) => setEditFormData({ ...editFormData, staffRequestConfirmed: e.target.checked })}
                      aria-invalid={Boolean(fieldError)}
                      aria-describedby={fieldError ? "staff-request-error" : undefined}
                      className="mt-0.5"
                    />
                    Staff member formally requested these personal field changes.
                  </label>
                  {fieldError ? (
                    <p id="staff-request-error" className="text-xs text-red-200">
                      {fieldError}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-semibold text-white">Employment Fields</p>
              <div>
                <label htmlFor="staff-edit-department" className="block text-sm font-medium text-[#d8c6e8]">Department</label>
                <input
                  id="staff-edit-department"
                  type="text"
                  value={editFormData.department || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-white/30"
                />
              </div>
              <div>
                <label htmlFor="staff-edit-base-salary" className="block text-sm font-medium text-[#d8c6e8]">Base Salary</label>
                <input
                  id="staff-edit-base-salary"
                  type="number"
                  value={editFormData.base_salary || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, base_salary: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-white/30"
                />
              </div>
              <div>
                <label htmlFor="staff-edit-status" className="block text-sm font-medium text-[#d8c6e8]">Status</label>
                <select
                  id="staff-edit-status"
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
      {historyStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="neon-glass neon-border rounded-2xl w-full max-w-2xl p-6 m-4" role="dialog">
            <h3 className="text-lg font-semibold text-white">
              Payroll History — {historyStaff.name || historyStaff.staff_name}
            </h3>
            <div className="mt-4 overflow-x-auto">
              {historyLoading ? (
                <p className="text-[#d8c6e8] text-sm">Loading...</p>
              ) : historyPayslips.length === 0 ? (
                <p className="text-[#d8c6e8] text-sm">No payroll history found for this employee.</p>
              ) : (
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-white/10 text-[#d8c6e8]">
                    <tr>
                      <th className="px-3 py-2">Period</th>
                      <th className="px-3 py-2">Gross</th>
                      <th className="px-3 py-2">Deductions</th>
                      <th className="px-3 py-2">Net Pay</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyPayslips.map(p => (
                      <tr key={p.payslip_id} className="border-b border-white/5 text-white">
                        <td className="px-3 py-2">{p.period_month} {p.period_year}</td>
                        <td className="px-3 py-2">${p.gross_salary?.toFixed(2)}</td>
                        <td className="px-3 py-2 text-red-300">${p.total_deductions?.toFixed(2)}</td>
                        <td className="px-3 py-2 text-emerald-300">${p.net_pay?.toFixed(2)}</td>
                        <td className="px-3 py-2">{p.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <button
              className="mt-4 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
              onClick={() => { setHistoryStaff(null); setHistoryPayslips([]); }}
            >
              Close
            </button>
          </div>
        </div>
      )}
      

      {/* Advance requests list for HR */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h4 className="text-sm font-semibold text-white">Advance Pay Requests</h4>
        <div className="mt-3">
          {loadingRequests ? (
            <div className="text-sm text-[#d8c6e8]">Loading requests...</div>
          ) : advanceRequests.length === 0 ? (
            <div className="text-sm text-[#d8c6e8]">No advance requests</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-white/10 text-[#d8c6e8]"><tr><th className="px-3 py-2">ID</th><th className="px-3 py-2">Staff</th><th className="px-3 py-2">Amount</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Actions</th></tr></thead>
                <tbody>
                  {advanceRequests.map(r=> (
                    <tr key={r.request_id} className="border-b border-white/5 text-white"><td className="px-3 py-2 text-[#d8c6e8]">{r.request_id}</td><td className="px-3 py-2">{r.staff_id}</td><td className="px-3 py-2">${r.requested_amount}</td><td className="px-3 py-2 text-[#d8c6e8]">{r.status}</td><td className="px-3 py-2">{r.status==='pending' ? <button onClick={()=>approveAdvanceRequest(r.request_id)} disabled={approvingId===r.request_id} className="rounded-lg bg-indigo-500/20 px-3 py-1 text-xs text-indigo-300 hover:bg-indigo-500/30">{approvingId===r.request_id ? 'Approving...' : 'Approve'}</button> : '-'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PayrollUploadView() {
  const session = getStoredSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [warning, setWarning] = useState("");
  const [error, setError] = useState("");

  const uploadHint = useMemo(() => {
    return "Upload CSV or XLSX using the field name file. The backend will map headers and create in-memory staff records when create=true.";
  }, []);

  const handleUnauthorized = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
    navigate("/login", { state: { from: location, message: "Session expired." } });
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!selectedFile) {
      setError("Choose a CSV or XLSX file first.");
      return;
    }
    if (!/\.(csv|xlsx|xls)$/i.test(selectedFile.name)) {
      setError("Invalid file format. Please upload a CSV or XLSX file.");
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) setWarning("Large file detected. Processing may take a moment.");

    let progressTimer;
    try {
      setUploading(true);
      setUploadProgress(10);
      setError("");
      setResult(null);
      progressTimer = window.setInterval(() => {
        setUploadProgress((current) => Math.min(current + 15, 90));
      }, 120);

      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch(`${API_BASE_URL}/api/hr/employees/upload?create=true`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(session?.token)
        },
        body: formData
      });

      if (response.status === 401 || response.status === 403) return handleUnauthorized();

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.message || "Upload failed");
      }

      setResult(body);
      setSelectedFile(null);
      setUploadProgress(100);
    } catch (err) {
      setError(err.name === 'TypeError' ? "Network error: Server unreachable" : err.message || "Upload failed");
    } finally {
      if (progressTimer) window.clearInterval(progressTimer);
      setUploading(false);
      window.setTimeout(() => setUploadProgress(0), 500);
      window.setTimeout(() => setWarning(""), 5000);
    }
  };

  return (
    <div className="space-y-5">
      <div className="neon-glass neon-border rounded-2xl p-6">
        <div
          className="flex items-start gap-4 outline-none focus-within:ring-2 focus-within:ring-[#C77DFF] rounded-xl"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') document.getElementById('hr-sample-upload').click();
          }}
        >
          <div className="rounded-xl bg-[#C77DFF]/15 p-3 text-[#C77DFF] ring-1 ring-[#C77DFF]/25">
            <FileUp size={22} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Upload Payroll Data</h3>
            <p className="mt-1 text-sm text-[#d8c6e8]">{uploadHint}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleUpload} className="neon-glass neon-border rounded-2xl p-6">
        <label htmlFor="hr-sample-upload" className="block text-sm font-medium text-white">Choose sample file</label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            id="hr-sample-upload"
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(event) => {
              setSelectedFile(event.target.files?.[0] || null);
              setUploadProgress(0);
              setError("");
            }}
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
        {(uploading || uploadProgress > 0) ? (
          <div className="mt-4" role="progressbar" aria-label="Upload progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={uploadProgress}>
            <div className="h-3 overflow-hidden rounded-full border border-white/10 bg-black/30">
              <div
                className="h-full rounded-full bg-emerald-400 transition-all duration-150"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        ) : null}
      </form>

      {error ? (
        <div className="neon-glass neon-border rounded-2xl border-red-500/40 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {warning ? (
        <div className="neon-glass neon-border rounded-2xl border-yellow-500/40 p-4 text-sm text-yellow-200">
          <span className="font-semibold">Note:</span> {warning}
        </div>
      ) : null}

      {result?.rowErrors?.length > 0 ? (
        <div className="neon-glass neon-border rounded-2xl border-red-500/40 p-6 text-white shadow-[0_0_30px_rgba(239,68,68,0.08)]">
          <div className="flex items-center gap-2 text-red-200">
            <AlertCircle size={18} />
            <span className="font-semibold text-sm">Validation Errors Found</span>
          </div>
          <div className="mt-3 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
            <ul className="space-y-1 text-xs text-red-100/80">
              {result.rowErrors.map((err, idx) => (
                <li key={idx} className="flex gap-2"><span className="font-mono text-red-300">Row {err.row}:</span> {err.error}</li>
              ))}
            </ul>
          </div>
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
  const session = getStoredSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [payrollRuns, setPayrollRuns] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const rowRefs = useRef(new Map());

  const handleUnauthorized = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
    navigate("/login", { state: { from: location, message: "Session expired." } });
  };

  const getRowKey = (run) => run.payroll_run_id || run.run_id || run.id || "";

  const fetchPayrollRuns = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch(`${API_BASE_URL}/api/hr/payroll-run`, {
        headers: {
          ...getAuthHeaders(session?.token)
        }
      });

      if (response.status === 401 || response.status === 403) return handleUnauthorized();

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Failed to load payroll runs");
      }

      const data = await response.json();
      setPayrollRuns(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.name === 'TypeError' ? "Network error: Server unreachable" : err.message || "Failed to load payroll runs");
      setPayrollRuns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayrollRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);

  const filteredPayrollRuns = useMemo(() => {
    const query = searchTerm.trim();
    let runs = payrollRuns;

    if (query) {
      runs = runs.filter((run) =>
        recordMatchesSearch(run, query, ["payroll_run_id", "run_id", "period", "period_month", "period_year", "status", "staff_name", "employee_name"])
      );
    }

    if (monthFilter) {
      const monthQuery = monthFilter.trim().toLowerCase();
      runs = runs.filter((run) => String(run.period_month || run.period || "").toLowerCase().includes(monthQuery));
    }

    if (yearFilter) {
      const yearQuery = yearFilter.trim().toLowerCase();
      runs = runs.filter((run) => String(run.period_year || run.period || "").toLowerCase().includes(yearQuery));
    }

    if (statusFilter) {
      const statusQuery = statusFilter.trim().toLowerCase();
      runs = runs.filter((run) => String(run.status || "").toLowerCase() === statusQuery);
    }

    return runs;
  }, [payrollRuns, searchTerm, monthFilter, yearFilter, statusFilter]);

  useEffect(() => {
    const query = searchTerm.trim();
    if (!query || filteredPayrollRuns.length === 0) return undefined;

    const firstMatchKey = getRowKey(filteredPayrollRuns[0]);
    const timer = setTimeout(() => {
      const row = rowRefs.current.get(firstMatchKey);
      if (row && typeof row.scrollIntoView === "function") {
        row.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [filteredPayrollRuns, searchTerm]);

  return (
    <div className="space-y-5">
      {error ? (
        <div className="neon-glass neon-border rounded-2xl border-red-500/40 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="neon-glass neon-border rounded-2xl p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="text-sm text-[#d8c6e8]">
            Search
            <input
              id="payroll-run-search"
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search staff or period"
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
            />
          </label>
          <label className="text-sm text-[#d8c6e8]">
            Month
            <input
              id="payroll-run-month"
              type="text"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              placeholder="June"
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
            />
          </label>
          <label className="text-sm text-[#d8c6e8]">
            Year
            <input
              id="payroll-run-year"
              type="number"
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              placeholder="2026"
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
            />
          </label>
          <label className="text-sm text-[#d8c6e8]">
            Status
            <select
              id="payroll-run-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white"
            >
              <option value="">All</option>
              <option value="created">Created</option>
              <option value="payslips_generated">Payslips Generated</option>
              <option value="completed">Completed</option>
            </select>
          </label>
        </div>
        <div className="mt-3 text-sm text-[#d8c6e8]">
          {getSearchCountLabel(filteredPayrollRuns.length, payrollRuns.length, searchTerm.trim())}
        </div>
      </div>

      <div className="neon-glass neon-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center gap-3 p-6 text-[#d8c6e8]">
            <Loader2 className="animate-spin" size={18} />
            Loading payroll runs...
          </div>
        ) : payrollRuns.length === 0 ? (
          <div className="p-6 text-sm text-[#d8c6e8]">
            No payroll runs yet. Create a run when generating payslips.
          </div>
        ) : filteredPayrollRuns.length === 0 ? (
          <div className="p-6 text-sm text-[#d8c6e8]">
            No records match your search. No payroll records match your search or filters.
          </div>
        ) : (
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
                {filteredPayrollRuns.map((run) => {
                  const rowKey = getRowKey(run);
                  const isSearchMatched = searchTerm.trim().length > 0;

                  return (
                    <tr
                      key={rowKey}
                      ref={(node) => {
                        if (node) {
                          rowRefs.current.set(rowKey, node);
                        } else {
                          rowRefs.current.delete(rowKey);
                        }
                      }}
                      className={`border-b border-white/5 text-white transition-colors duration-300 ${isSearchMatched ? "bg-amber-400/10" : ""}`}
                    >
                      <td className="px-4 py-3 text-[#d8c6e8]">{run.payroll_run_id || run.run_id || "-"}</td>
                      <td className="px-4 py-3">
                        {run.period || `${run.period_month || "-"} ${run.period_year || ""}`.trim()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                          run.status === "completed" || run.status === "Completed" ? "bg-emerald-500/20 text-emerald-300" :
                          run.status === "created" || run.status === "In Progress" ? "bg-blue-500/20 text-blue-300" :
                          "bg-yellow-500/20 text-yellow-300"
                        }`}>
                          {run.status || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#d8c6e8]">{run.staff_count ?? run.total_payslips ?? 0}</td>
                      <td className="px-4 py-3 text-[#d8c6e8]">{run.total_amount || "-"}</td>
                      <td className="px-4 py-3 text-[#d8c6e8]">
                        {run.run_date || (run.created_at ? new Date(run.created_at).toLocaleDateString() : "-")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function PayslipsView() {
  const session = getStoredSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [payslips, setPayslips] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [generating, setGenerating] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmPayload, setConfirmPayload] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [payrollMonth, setPayrollMonth] = useState(new Date().toLocaleString('en-US', { month: 'long' }));
  const [payrollYear, setPayrollYear] = useState(new Date().getFullYear());
  const [actionInProgress, setActionInProgress] = useState(null);
  const rowRefs = useRef(new Map());

  const handleUnauthorized = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
    navigate("/login", { state: { from: location, message: "Session expired." } });
  };

  const getRowKey = (payslip) => payslip.payslip_id || payslip.employee_id || payslip.staff_name || "";

  const fetchPayslips = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch(`${API_BASE_URL}/api/hr/payslips`, {
        headers: {
          ...getAuthHeaders(session?.token)
        }
      });

      if (response.status === 401 || response.status === 403) return handleUnauthorized();

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Failed to load payslips");
      }

      const data = await response.json();
      setPayslips(Array.isArray(data) ? data : []);
      setSelectedIds(new Set());
    } catch (err) {
      setError(err.name === 'TypeError' ? "Network error: Server unreachable" : err.message || "Failed to load payslips");
      setPayslips([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id) => {
    const payslip = payslips.find((item) => item.payslip_id === id);
    if (!payslip || payslip.status !== "draft") return;

    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAllDrafts = () => {
    const draftIds = payslips.filter(p => p.status === 'draft').map(p => p.payslip_id);
    if (draftIds.length === 0) return;
    // if all already selected, clear
    const allSelected = draftIds.every(id => selectedIds.has(id));
    setSelectedIds(allSelected ? new Set() : new Set(draftIds));
  };

  const openConfirmBulkSend = (opts) => {
    // opts: { payslip_ids: [...]} or { allDrafts: true }
    const draftIds = new Set(payslips.filter((p) => p.status === "draft").map((p) => p.payslip_id));
    const payload = opts.allDrafts
      ? { allDrafts: true }
      : { payslip_ids: (opts.payslip_ids || []).filter((id) => draftIds.has(id)) };
    const count = opts.allDrafts ? draftIds.size : payload.payslip_ids.length;
    if (count === 0) {
      setError('No draft payslips selected');
      return;
    }
    setConfirmPayload(payload);
    setConfirmModalOpen(false);
    performBulkSend(payload);
  };

  const performBulkSend = async (payload = confirmPayload) => {
    if (!payload) return;
    try {
      setActionInProgress('bulk');
      setError("");
      const response = await fetch(`${API_BASE_URL}/api/payroll/payslips/bulk-send-to-finance`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(session?.token),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.status === 401 || response.status === 403) {
        return handleUnauthorized();
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || 'Bulk send failed');
      }

      const body = await response.json();
      const sent = body.updated_count ?? 0;
      const skipped = (body.skipped && body.skipped.length) ? body.skipped.length : 0;
      setSuccessMessage(`${sent} sent. ${skipped} skipped.`);
      // show toast
      addToast('success', `${sent} sent. ${skipped} skipped.`);
      setConfirmModalOpen(false);
      setConfirmPayload(null);
      await fetchPayslips();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      setError(err.name === 'TypeError' ? "Network error: Server unreachable" : err.message || 'Bulk send failed');
      addToast('error', err.message || 'Bulk send failed');
    } finally {
      setActionInProgress(null);
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

  const getRejectionReason = (payslip) => {
    return payslip.finance_rejection_reason || payslip.admin_rejection_reason || "";
  };

  const handleSendToFinance = async (payslipId) => {
    try {
      setActionInProgress(payslipId);
      setError("");
      const response = await fetch(`${API_BASE_URL}/api/hr/payslips/${payslipId}/send-to-finance`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(session?.token),
          "Content-Type": "application/json"
        }
      });

      if (response.status === 401 || response.status === 403) {
        return handleUnauthorized();
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Failed to send to Finance");
      }

      setSuccessMessage("Payslip sent to Finance");
      addToast('success', 'Payslip sent to Finance');
      await fetchPayslips();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(err.name === 'TypeError' ? "Network error: Server unreachable" : err.message || "Failed to send to Finance");
      addToast('error', err.message || 'Failed to send to Finance');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleSendToStaff = async (payslipId) => {
    try {
      setActionInProgress(payslipId);
      setError("");
      const response = await fetch(`${API_BASE_URL}/api/hr/payslips/${payslipId}/send-to-staff`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(session?.token),
          "Content-Type": "application/json"
        }
      });

      if (response.status === 401 || response.status === 403) {
        return handleUnauthorized();
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Failed to send to staff");
      }

      setSuccessMessage("Payslip sent to staff");
      addToast("success", "Payslip sent to staff");
      await fetchPayslips();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(err.name === 'TypeError' ? "Network error: Server unreachable" : err.message || "Failed to send to staff");
      addToast("error", err.message || "Failed to send to staff");
    } finally {
      setActionInProgress(null);
    }
  };

  const removeToast = (id) => setToasts((t) => t.filter(x => x.id !== id));

  const addToast = (type, message) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter(x => x.id !== id)), 4000);
  };

  useEffect(() => {
    fetchPayslips();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);

  const filteredPayslips = useMemo(() => {
    let list = payslips;
    const query = searchTerm.trim().toLowerCase();

    if (query) {
      list = list.filter((p) => recordMatchesSearch(p, query, ["payslip_id", "staff_name", "employee_id", "period_month", "period_year"]));
    }
    if (monthFilter) {
      list = list.filter((p) => String(p.period_month || "").toLowerCase() === monthFilter.toLowerCase());
    }
    if (yearFilter) {
      list = list.filter((p) => String(p.period_year || "") === yearFilter);
    }
    if (statusFilter) {
      list = list.filter((p) => p.status === statusFilter);
    }

    return list;
  }, [payslips, searchTerm, monthFilter, yearFilter, statusFilter]);

  useEffect(() => {
    const query = searchTerm.trim();
    if (!query || filteredPayslips.length === 0) return undefined;

    const firstMatchKey = getRowKey(filteredPayslips[0]);
    const timer = setTimeout(() => {
      const row = rowRefs.current.get(firstMatchKey);
      if (row && typeof row.scrollIntoView === "function") {
        row.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [filteredPayslips, searchTerm]);

  return (
    <div className="space-y-5">
      {/* Toasts container */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={`max-w-sm rounded-lg px-4 py-2 shadow-lg ${t.type === 'success' ? 'bg-emerald-500/90 text-white' : 'bg-red-600/90 text-white'}`}>
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm">{t.message}</div>
              <button onClick={() => removeToast(t.id)} className="text-white/80 text-xs">Dismiss</button>
            </div>
          </div>
        ))}
      </div>
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
          <label htmlFor="payslip-payroll-file" className="block text-sm font-medium text-[#d8c6e8]">Payroll File (CSV/XLSX)</label>
          <input
            id="payslip-payroll-file"
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            className="mt-2 block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white file:mr-4 file:rounded-md file:border-0 file:bg-[#C77DFF] file:px-4 file:py-2 file:text-white hover:file:bg-[#b866ff]"
          />
        </div>

        <button
          type="submit"
          disabled={generating}
          className="w-full rounded-lg bg-[#C77DFF] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b866ff] disabled:opacity-50"
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

      <div className="neon-glass neon-border rounded-2xl p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <label className="block text-sm text-[#d8c6e8]">
            Search payslips...
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search payslips..."
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none placeholder:text-[#d8c6e8]/50"
            />
          </label>
          <div className="text-sm text-[#d8c6e8]">
            {getSearchCountLabel(filteredPayslips.length, payslips.length, searchTerm.trim())}
          </div>
        </div>
      </div>

      <div className="neon-glass neon-border rounded-2xl overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-white/5 p-6">
          <div>
            <h3 className="text-lg font-semibold text-white">Payslips</h3>
            <p className="mt-1 text-sm text-[#d8c6e8]">{payslips.length} total payslips</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAllDrafts}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10"
            >
              {Array.from(selectedIds).length > 0 ? 'Clear selection' : 'Select Drafts'}
            </button>
            <button
              type="button"
              onClick={() => openConfirmBulkSend({ payslip_ids: Array.from(selectedIds) })}
              disabled={actionInProgress === 'bulk' || selectedIds.size === 0}
              title="Send selected to Finance"
              aria-label="Send selected to Finance"
              className="rounded-lg bg-indigo-500/20 p-2 text-indigo-300 hover:bg-indigo-500/30 disabled:opacity-50 relative"
            >
              {actionInProgress === 'bulk' ? (
                <span className="text-sm">Sending...</span>
              ) : (
                <div className="relative">
                  <Send size={16} />
                  {selectedIds.size > 0 && (
                    <span className="absolute -top-2 -right-2 inline-flex items-center justify-center bg-red-600 text-white text-xs rounded-full w-5 h-5">{selectedIds.size}</span>
                  )}
                </div>
              )}
            </button>
            <button
              type="button"
              onClick={fetchPayslips}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10"
            >
              Refresh
            </button>
          </div>
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
        ) : filteredPayslips.length === 0 ? (
          <div className="p-6 text-sm text-[#d8c6e8]">
            No records match your search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/5 text-[#d8c6e8]">
                  <tr>
                    <th className="px-4 py-3 font-medium"><input type="checkbox" checked={payslips.filter(p=>p.status==='draft').length>0 && payslips.filter(p=>p.status==='draft').every(p=>selectedIds.has(p.payslip_id))} onChange={selectAllDrafts} /></th>
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
                {filteredPayslips.map((payslip) => {
                  const rowKey = getRowKey(payslip);
                  const isSearchMatched = searchTerm.trim().length > 0;

                  return (
                    <tr
                      key={rowKey}
                      ref={(node) => {
                        if (node) {
                          rowRefs.current.set(rowKey, node);
                        } else {
                          rowRefs.current.delete(rowKey);
                        }
                      }}
                      className={`border-b border-white/5 text-white transition-colors duration-300 ${isSearchMatched ? "bg-amber-400/10" : ""}`}
                    >
                      <td className="px-4 py-3 text-[#d8c6e8]">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(payslip.payslip_id)}
                          onChange={() => toggleSelect(payslip.payslip_id)}
                          disabled={payslip.status !== 'draft'}
                        />
                      </td>
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
                        {getRejectionReason(payslip) ? (
                          <div className="mt-2 max-w-xs rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                            <span className="font-semibold">Rejection reason:</span> {getRejectionReason(payslip)}
                          </div>
                        ) : null}
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
                        ) : payslip.status === 'admin_approved' ? (
                          <button
                            type="button"
                            onClick={() => handleSendToStaff(payslip.payslip_id)}
                            disabled={actionInProgress === payslip.payslip_id}
                            className="rounded-lg bg-emerald-500/20 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"
                          >
                            {actionInProgress === payslip.payslip_id ? 'Sending...' : 'Send to Staff'}
                          </button>
                        ) : payslip.status === 'sent_to_staff' ? (
                          <span className="text-sm text-emerald-300">Released to staff</span>
                        ) : (
                          <span className="text-sm text-[#d8c6e8]">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function NotificationsView() {
  const session = getStoredSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const handleUnauthorized = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
    navigate("/login", { state: { from: location, message: "Session expired." } });
  };

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setLoading(true);
        setError("");
        const response = await fetch(`${API_BASE_URL}/api/hr/notifications`, {
          headers: {
            ...getAuthHeaders(session?.token)
          }
        });

        if (response.status === 401 || response.status === 403) return handleUnauthorized();
        if (!response.ok) {
          setNotifications([]);
          return;
        }

        const data = await response.json();
        setNotifications(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.name === 'TypeError' ? "Network error: Server unreachable" : "Failed to load notifications");
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [session?.token]);

  return (
    <div className="space-y-5">
      {error ? (
        <div className="neon-glass neon-border rounded-2xl border-red-500/40 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="neon-glass neon-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center gap-3 p-6 text-[#d8c6e8]">
            <Loader2 className="animate-spin" size={18} />
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-6 text-sm text-[#d8c6e8]">
            Notifications will appear here once the notification system is set up.
          </div>
        ) : (
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
              {notifications.map((notif) => (
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
        )}
      </div>
    </div>
  );
}

export default function HRPayrollPage() {
  const session = getStoredSession();
  const location = useLocation();
  const heading = routeHeadings[location.pathname] || "Dashboard";
  const activePath = location.pathname.replace(/\/+$/, "") || "/";
  const headerSearchEndpoint = `${API_BASE_URL}/api/hr/search`;

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
        <HRDashboardView />
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
      searchEndpoint={headerSearchEndpoint}
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
