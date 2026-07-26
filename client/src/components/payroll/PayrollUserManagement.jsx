import {
  BriefcaseBusiness, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Download, Eye, FileSpreadsheet, KeyRound,
  Loader2, Mail, Pencil, Plus, RefreshCw, Search, ShieldCheck, Trash2, Upload, UserCheck, Users, UserX, WalletCards, X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPayrollHire, deleteManagedPayrollUser, deleteUserAccountByHR, exportStaffWorkbook, getPayrollUsers, importPayrollHires, resendAccountSetup, reviewActivationRequest, updateActivationRequest } from "../../services/payrollUserService.js";
import { resetUserPassword, updateUserRole, updateUserStatus } from "../../services/adminPayrollService.js";
import { apiRequest } from "../../services/apiClient.js";
import { downloadBlob } from "../../services/apiClient.js";

const emptyHire = {
  name: "", email: "", employeeCode: "", phone: "", departmentName: "",
  hireDate: "", dateOfBirth: "", race: "", religion: "", baseSalary: "", bank: "", accountNo: "", roleName: "Staff"
};

function badge(value) {
  const normalized = String(value || "").toLowerCase();
  if (["approved", "active", "1"].includes(normalized)) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (["pending"].includes(normalized)) return "bg-amber-50 text-amber-700 border-amber-200";
  if (["rejected", "disabled", "inactive", "0"].includes(normalized)) return "bg-red-50 text-red-700 border-red-200";
  return "bg-[#fff8f5] text-[#7b6660] border-[#f0d2ca]";
}

function StatusBadge({ children }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badge(children)}`}>{children}</span>;
}

function DetailSection({ title, icon: Icon, items }) {
  return <section className="rounded-2xl border border-[#f0d2ca] bg-white p-5">
    <h4 className="flex items-center gap-2 text-sm font-semibold text-[#251E1F]"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#fff0ec] text-[#d66f5e]"><Icon size={16}/></span>{title}</h4>
    <dl className="mt-4 grid gap-4 sm:grid-cols-2">{items.map(([label, value]) => <div key={label}><dt className="text-xs font-semibold uppercase tracking-wide text-[#9a7f78]">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-[#251E1F]">{value}</dd></div>)}</dl>
  </section>;
}

function ActionProgress({ state, onClose }) {
  if (!state.open) return null;
  const tone = state.status === "failed" ? "bg-red-500" : state.status === "completed" ? "bg-emerald-500" : "bg-[#F38978]";
  return <div className="fixed inset-0 z-[1200] grid place-items-center bg-[#251E1F]/45 p-4"><section role="dialog" aria-modal="true" aria-label="Account action progress" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-center gap-3">{state.status === "running" ? <Loader2 className="animate-spin text-[#F38978]"/> : state.status === "completed" ? <CheckCircle2 className="text-emerald-600"/> : <X className="text-red-600"/>}<div><h3 className="font-semibold text-[#251E1F]">{state.title}</h3><p className="text-sm text-[#7b6660]">{state.phase}</p></div></div><div className="mt-5 flex justify-between text-xs font-semibold"><span>{state.status === "running" ? "Processing" : state.status === "completed" ? "Completed" : "Action failed"}</span><span>{state.progress}%</span></div><div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#f0d2ca]"><div className={`h-full rounded-full transition-all duration-500 motion-reduce:transition-none ${tone}`} style={{ width: `${state.progress}%` }}/></div>{state.detail ? <p className={`mt-4 rounded-xl p-3 text-sm ${state.status === "failed" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{state.detail}</p> : null}{state.status !== "running" ? <div className="mt-5 flex justify-end"><button type="button" onClick={onClose} className="rounded-xl border border-[#f0d2ca] px-4 py-2 text-sm font-semibold">Close</button></div> : null}</section></div>;
}

function initials(record) {
  return String(record.staff_name || record.name || "User")
    .split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function adminAccountStatus(record) {
  if (["Pending", "Rejected", "No Account"].includes(record.activation_status)) return record.activation_status;
  if (record.account_locked_at) return "Locked";
  return record.user_id && Number(record.account_status) !== 1 ? "Disabled" : "Approved";
}

function normalizeManagedUsers(payload) {
  return {
    ...(payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {}),
    users: Array.isArray(payload?.users) ? payload.users : [],
    roles: Array.isArray(payload?.roles) && payload.roles.length
      ? payload.roles
      : ["Admin", "Finance", "HR", "Staff"]
  };
}

const roleVisuals = {
  admin: { avatar: "admin-user-management__avatar--admin", badge: "admin-user-management__role--admin", row: "admin-user-management__row--admin" },
  finance: { avatar: "admin-user-management__avatar--finance", badge: "admin-user-management__role--finance", row: "admin-user-management__row--finance" },
  hr: { avatar: "admin-user-management__avatar--hr", badge: "admin-user-management__role--hr", row: "admin-user-management__row--hr" },
  staff: { avatar: "admin-user-management__avatar--staff", badge: "admin-user-management__role--staff", row: "admin-user-management__row--staff" },
  unlinked: { avatar: "admin-user-management__avatar--unlinked", badge: "admin-user-management__role--unlinked", row: "admin-user-management__row--unlinked" }
};

const statusVisuals = {
  Approved: "admin-user-management__status--approved",
  Pending: "admin-user-management__status--pending",
  Rejected: "admin-user-management__status--rejected",
  Disabled: "admin-user-management__status--disabled",
  Locked: "admin-user-management__status--locked",
  "No Account": "admin-user-management__status--no-account"
};

function getRoleVisuals(record) {
  const key = String(record.role_name || record.requested_role || "unlinked").toLowerCase();
  return roleVisuals[key] || roleVisuals.unlinked;
}

function AdminUserDirectory({ data, loading, busy, error, success, temporaryPassword, load, review, resendSetup, deleteAccount, accountAction, actionProgress, closeProgress }) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All Roles");
  const [departmentFilter, setDepartmentFilter] = useState("All Departments");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState(null);
  const users = Array.isArray(data?.users) ? data.users : [];
  const roles = Array.isArray(data?.roles) ? data.roles : [];
  const departments = [...new Set(users.map((record) => record.department_name).filter(Boolean))].sort();
  const statuses = [...new Set(users.map(adminAccountStatus).filter(Boolean))];
  const filteredUsers = useMemo(() => {
    const search = query.trim().toLowerCase();
    return users.filter((record) => {
      const matchesSearch = !search || [record.staff_name, record.name, record.staff_email, record.email,
        record.employee_code, record.department_name].some((value) => String(value || "").toLowerCase().includes(search));
      return matchesSearch
        && (roleFilter === "All Roles" || record.role_name === roleFilter)
        && (departmentFilter === "All Departments" || (record.department_name || "No department") === departmentFilter)
        && (statusFilter === "All Statuses" || adminAccountStatus(record) === statusFilter);
    });
  }, [users, query, roleFilter, departmentFilter, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const rows = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const activeAccounts = users.filter((record) => Number(record.account_status) === 1).length;
  const pendingAccounts = users.filter((record) => record.activation_status === "Pending").length;
  const disabledAccounts = users.filter((record) => record.user_id && Number(record.account_status) !== 1 && record.activation_status !== "Pending").length;

  useEffect(() => { setPage(1); }, [query, roleFilter, departmentFilter, statusFilter, pageSize]);
  useEffect(() => {
    if (!selected) return;
    const current = users.find((record) => record.user_id === selected.user_id && record.employee_id === selected.employee_id);
    if (current) setSelected(current);
  }, [users]);
  useEffect(() => {
    if (!selected) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event) => { if (event.key === "Escape" && !busy) setSelected(null); };
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", closeOnEscape); };
  }, [selected, busy]);

  const summary = [
    { label: "Total Users", value: users.filter((record) => record.user_id).length, note: "Registered PayNivo accounts", icon: Users, cardClass: "admin-user-management__metric--rose", iconClass: "admin-user-management__metric-icon--rose" },
    { label: "Active Accounts", value: activeAccounts, note: "Currently active", icon: UserCheck, cardClass: "admin-user-management__metric--green", iconClass: "admin-user-management__metric-icon--green" },
    { label: "Pending Activation", value: pendingAccounts, note: "Awaiting Admin review", icon: Clock3, cardClass: "admin-user-management__metric--amber", iconClass: "admin-user-management__metric-icon--amber" },
    { label: "Disabled Accounts", value: disabledAccounts, note: "Access currently disabled", icon: UserX, cardClass: "admin-user-management__metric--red", iconClass: "admin-user-management__metric-icon--red" }
  ];
  const start = filteredUsers.length ? (currentPage - 1) * pageSize + 1 : 0;
  const end = Math.min(currentPage * pageSize, filteredUsers.length);

  return <section className="admin-user-management">
    <header className="admin-user-management__header">
      <div><h2>User Management</h2><p>Manage employee account access, permissions and activation without exposing private HR or payroll data.</p></div>
      <button type="button" onClick={load} className="admin-user-management__secondary"><RefreshCw size={16}/>Refresh</button>
    </header>

    {error ? <div className="admin-user-management__alert admin-user-management__alert--error">{error}</div> : null}
    {success ? <div className="admin-user-management__alert admin-user-management__alert--success">{success}</div> : null}
    {temporaryPassword ? <div className="admin-user-management__alert admin-user-management__alert--warning"><strong>Temporary password (shown once):</strong> <code>{temporaryPassword}</code></div> : null}

    <div className="admin-user-management__summary">
      {summary.map((item) => <article key={item.label} className={`admin-user-management__metric ${item.cardClass}`}>
        <span className={`admin-user-management__metric-icon ${item.iconClass}`}><item.icon size={22}/></span>
        <div><p>{item.label}</p><strong>{item.value}</strong><small>{item.note}</small></div>
      </article>)}
    </div>

    <div className="admin-user-management__directory">
      <div className="admin-user-management__filters">
        <label className="admin-user-management__search"><Search size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, email, or employee code..."/></label>
        <label><span>Role</span><select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option>All Roles</option>{roles.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>Department</span><select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}><option>All Departments</option><option>No department</option>{departments.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>Activation status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All Statuses</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select></label>
      </div>

      {loading ? <div className="admin-user-management__loading"><Loader2 className="animate-spin" size={19}/>Loading users...</div> : <>
        <div className="admin-user-management__table-wrap"><table><thead><tr><th>Employee</th><th>Employment</th><th>Role / Access</th><th>Account activation status</th><th>Actions</th></tr></thead>
          <tbody>{rows.map((record, index) => <tr className={`admin-user-management__row ${getRoleVisuals(record).row}`} key={record.user_id || `staff-${record.employee_id}-${index}`}>
            <td><div className="admin-user-management__employee"><span className={`admin-user-management__avatar ${getRoleVisuals(record).avatar}`}>{initials(record)}</span><div><strong>{record.staff_name || record.name || "Unnamed user"}</strong><small>{record.employee_code || "No employee code"} · {record.staff_email || record.email || "No email"}</small></div></div></td>
            <td><strong>{record.department_name || "No department"}</strong><small>{record.employee_id ? "Staff record linked" : "No staff record linked"}</small></td>
            <td><span className={`admin-user-management__role ${getRoleVisuals(record).badge}`}>{record.role_name || record.requested_role || "No account"}</span><small>{record.role_name === "Admin" ? "Full system access" : record.user_id ? "Role-based access" : "Account not created"}</small></td>
            <td><span className={`admin-user-management__status ${statusVisuals[adminAccountStatus(record)] || statusVisuals["No Account"]}`}><i/>{adminAccountStatus(record)}</span><small>{record.account_locked_at ? `Locked ${new Date(record.account_locked_at).toLocaleString("en-SG")}` : record.user_id ? (Number(record.account_status) === 1 ? "Active" : "Access disabled") : "Unlinked"}</small></td>
            <td><button type="button" className="admin-user-management__manage" onClick={() => setSelected(record)}><BriefcaseBusiness size={15}/>Manage Account Details</button></td>
          </tr>)}</tbody></table>{!rows.length ? <div className="admin-user-management__empty">No users match the selected filters.</div> : null}</div>
        <footer className="admin-user-management__pagination"><p>Showing {start} to {end} of {filteredUsers.length} users</p><div><select aria-label="Rows per page" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value="10">10 per page</option><option value="25">25 per page</option><option value="50">50 per page</option></select><button disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} aria-label="Previous page"><ChevronLeft size={18}/></button><span>{currentPage} / {totalPages}</span><button disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} aria-label="Next page"><ChevronRight size={18}/></button></div></footer>
      </>}
    </div>

    {selected ? <div className="admin-user-management__modal-backdrop" onMouseDown={() => setSelected(null)}><section role="dialog" aria-modal="true" aria-labelledby="manage-account-title" className="admin-user-management__modal" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><span>Account administration</span><h3 id="manage-account-title">Manage Account Details</h3><p>Only access-related information is available to Admin.</p></div><button onClick={() => setSelected(null)} aria-label="Close"><X size={20}/></button></header>
      <div className="admin-user-management__identity"><span className={`admin-user-management__avatar ${getRoleVisuals(selected).avatar}`}>{initials(selected)}</span><div><strong>{selected.staff_name || selected.name}</strong><p>{selected.staff_email || selected.email}</p><small>{selected.employee_code || "No employee code"} · {selected.department_name || "No department"}</small></div></div>
      {selected.requested_by_name ? <p className="admin-user-management__request-note">Requested by {selected.requested_by_name}{selected.rejection_reason ? ` · Previous rejection: ${selected.rejection_reason}` : ""}</p> : null}
      {selected.account_locked_at ? <p className="admin-user-management__request-note admin-user-management__request-note--locked"><strong>Security lock:</strong> {selected.account_lock_reason || "Too many failed password attempts"}<br/>Locked {new Date(selected.account_locked_at).toLocaleString("en-SG")} after {selected.failed_login_attempts || 5} failed attempts.</p> : null}
      {selected.activation_status === "Pending" ? <div className="admin-user-management__review-actions"><button disabled={busy} onClick={async () => { if (await review(selected, "approve")) setSelected(null); }} className="admin-user-management__approve"><CheckCircle2 size={16}/>{busy ? "Approving..." : "Approve activation"}</button><button disabled={busy} onClick={async () => { if (await review(selected, "reject")) setSelected(null); }} className="admin-user-management__reject"><X size={16}/>{busy ? "Saving..." : "Reject request"}</button></div> : null}
      {selected.user_id && selected.activation_status === "Approved" ? <div className="admin-user-management__account-controls">
        <label><span>PayNivo role</span><select value={selected.role_name || "Staff"} onChange={(event) => accountAction(selected, "role", roles.indexOf(event.target.value) + 1)}>{roles.map((item) => <option key={item}>{item}</option>)}</select></label>
        <div><span>Account access</span><button onClick={() => accountAction(selected, "status", selected.account_locked_at ? 1 : Number(selected.account_status) === 1 ? 0 : 1)}>{selected.account_locked_at ? "Reactivate account" : Number(selected.account_status) === 1 ? "Disable account" : "Enable account"}</button></div>
        <div><span>Password security</span><button onClick={() => accountAction(selected, "password")}><KeyRound size={15}/>Issue temporary password</button></div>
      </div> : null}
      {selected.activation_status === "Approved" && Number(selected.must_change_password) === 1 ? <div className={`admin-user-management__request-note ${selected.setup_email_status === "Failed" ? "admin-user-management__request-note--locked" : ""}`}><strong>Setup email: {selected.setup_email_status || "Not sent"}</strong><br/>{selected.setup_email_recipient || selected.staff_email || "No staff email"}{selected.setup_email_error ? <><br/>{selected.setup_email_error}</> : null}<div className="mt-3"><button type="button" disabled={busy} onClick={() => resendSetup(selected)} className="admin-user-management__secondary">Resend setup link</button></div></div> : null}
      {selected.user_id ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4"><div className="flex items-center justify-between gap-3"><div><strong className="text-sm text-red-700">Delete account</strong><p className="mt-1 text-xs text-red-600">{selected.deletion_request_status === "pending" ? "This user requested deletion and is awaiting Admin approval." : "Removes login access while preserving the HR staff record."}</p></div><button type="button" disabled={busy} onClick={async () => { if (await deleteAccount(selected)) setSelected(null); }} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white"><Trash2 size={14}/>{selected.deletion_request_status === "pending" ? "Approve deletion" : "Delete account"}</button></div></div> : null}
      {!selected.user_id ? <p className="admin-user-management__request-note">This staff record has no PayNivo account. HR must create and submit the account request.</p> : null}
      <footer><button type="button" onClick={() => setSelected(null)} className="admin-user-management__secondary">Close</button></footer>
    </section></div> : null}
    <ActionProgress state={actionProgress} onClose={closeProgress}/>
  </section>;
}

export default function PayrollUserManagement({ role, defaultShowHire = false }) {
  const [data, setData] = useState({ users: [], roles: [] });
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showHire, setShowHire] = useState(defaultShowHire);
  const [hire, setHire] = useState(emptyHire);
  const [editing, setEditing] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [actionProgress, setActionProgress] = useState({ open: false, status: "idle", progress: 0, title: "", phase: "", detail: "" });
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { userId, name } when open
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const importInputRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try { setData(normalizeManagedUsers(await getPayrollUsers())); setError(""); }
    catch (loadError) { setError(loadError.message || "Unable to load user management."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!actionProgress.open || actionProgress.status !== "running") return undefined;
    const timer = window.setInterval(() => setActionProgress((current) => current.status === "running" ? { ...current, progress: Math.min(90, current.progress + Math.max(1, Math.ceil((90 - current.progress) / 7))) } : current), 180);
    return () => window.clearInterval(timer);
  }, [actionProgress.open, actionProgress.status]);
  const beginProgress = (title, phase = "Validating request…") => setActionProgress({ open: true, status: "running", progress: 5, title, phase, detail: "" });
  const finishProgress = (phase, detail = "") => setActionProgress((current) => ({ ...current, status: "completed", progress: 100, phase, detail }));
  const failProgress = (error) => setActionProgress((current) => ({ ...current, status: "failed", progress: 100, phase: "Unable to complete action", detail: error.message || String(error) }));

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return data.users || [];
    return (data.users || []).filter((record) => [record.name, record.staff_name, record.email,
      record.staff_email, record.employee_code, record.department_name, record.role_name,
      record.activation_status].some((item) => String(item || "").toLowerCase().includes(value)));
  }, [data.users, query]);

  const staffSummary = useMemo(() => ({
    total: (data.users || []).length,
    active: (data.users || []).filter((record) => record.user_id && Number(record.account_status) === 1).length,
    pending: (data.users || []).filter((record) => record.activation_status === "Pending").length,
    unlinked: (data.users || []).filter((record) => !record.user_id).length
  }), [data.users]);

  const submitHire = async (event) => {
    event.preventDefault(); setBusy("hire"); setError(""); setTemporaryPassword("");
    try {
      const payload = { staff: { ...hire, employeeId: editing?.type === "link" ? editing.employeeId : undefined }, account: { name: hire.name, email: hire.email, roleName: role === "HR" ? "Staff" : hire.roleName } };
      const result = editing?.type === "request"
        ? await updateActivationRequest(editing.requestId, payload)
        : editing?.type === "staff"
          ? await apiRequest(`/api/hr/staff/${editing.employeeId}`, {
              method: "PUT",
              body: JSON.stringify({
                name: hire.name, email: hire.email, employee_code: hire.employeeCode,
                phone: hire.phone, department_name: hire.departmentName, hire_date: hire.hireDate,
                date_of_birth: hire.dateOfBirth || null,
                race: hire.race || null,
                religion: hire.religion || null,
                base_salary: hire.baseSalary, bank: hire.bank, account_no: hire.accountNo
              })
            })
          : await createPayrollHire(payload);
      if (result.temporaryPassword) setTemporaryPassword(result.temporaryPassword);
      setSuccess(editing?.type === "request" ? "Account request updated and resubmitted to Admin."
        : editing?.type === "staff" ? "Staff details updated."
          : "New-hire account submitted to Admin for activation.");
      setHire(emptyHire); await load();
      if (editing?.type !== "link" && editing) { setEditing(null); setShowHire(false); }
    } catch (saveError) { setError(saveError.message || "Unable to create new-hire account."); }
    finally { setBusy(""); }
  };

  const openEditor = (record, type) => {
    const date = record.hire_date ? String(record.hire_date).slice(0, 10) : "";
    setEditing({ type, requestId: record.request_id, employeeId: record.employee_id });
    setHire({
      name: record.staff_name || record.name || "", email: record.staff_email || record.email || "",
      employeeCode: record.employee_code || "", phone: record.phone || "",
      departmentName: record.department_name || "", hireDate: date,
      dateOfBirth: record.date_of_birth ? String(record.date_of_birth).slice(0, 10) : "",
      race: record.race || "", religion: record.religion || "",
      baseSalary: record.base_salary ?? "", bank: record.bank || "", accountNo: record.account_no || "",
      roleName: record.requested_role || record.role_name || "Staff"
    });
    setTemporaryPassword(""); setShowHire(true);
  };

  const closeEditor = () => { setShowHire(false); setEditing(null); setHire(emptyHire); };

  const handleHRDeleteAccount = async () => {
    if (!deleteConfirm || !deletePassword.trim()) return;
    setBusy("hr-delete");
    setDeleteError("");
    try {
      let result;
      if (deleteConfirm.userId) {
        // Has a linked user account — delete account + staff record via HR endpoint
        result = await deleteUserAccountByHR(deleteConfirm.userId, deletePassword);
      } else {
        // Staff record only (no user account yet) — verify password then delete staff record
        const verifyRes = await apiRequest("/api/hr/users/verify-password", {
          method: "POST",
          body: JSON.stringify({ password: deletePassword })
        });
        if (!verifyRes.valid) throw new Error("Incorrect password. Deletion cancelled.");
        await apiRequest(`/api/hr/staff/${deleteConfirm.employeeId}`, { method: "DELETE" });
        result = { message: `Staff record for ${deleteConfirm.name} has been permanently removed.` };
      }
      setSuccess(result.message || "Record permanently removed.");
      setDeleteConfirm(null);
      setDeletePassword("");
      closeEditor();
      await load();
    } catch (err) {
      setDeleteError(err.message || "Failed to delete. Check your password and try again.");
    } finally {
      setBusy("");
    }
  };

  const previewImport = async (file) => {
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) { setError("Import requires an .xlsx Excel workbook."); return; }
    setBusy("import-preview"); setError("");
    try { setImportFile(file); setImportPreview(await importPayrollHires(file, "preview")); }
    catch (importError) { setError(importError.message); setImportFile(null); }
    finally { setBusy(""); if (importInputRef.current) importInputRef.current.value = ""; }
  };

  const commitImport = async () => {
    if (!importFile) return;
    setBusy("import-commit");
    try {
      const result = await importPayrollHires(importFile, "commit");
      setSuccess(`Imported ${result.created} staff record(s). ${result.skipped || 0} skipped and ${result.failed || 0} failed.`);
      setImportFile(null); setImportPreview(null); await load();
    } catch (importError) { setError(importError.message); }
    finally { setBusy(""); }
  };

  const exportStaff = async () => {
    setBusy("export"); setError("");
    try { downloadBlob(await exportStaffWorkbook(), `staff_records_${new Date().toISOString().slice(0, 10)}.xlsx`); }
    catch (exportError) { setError(exportError.message); }
    finally { setBusy(""); }
  };

  const review = async (record, action) => {
    const reason = action === "reject" ? window.prompt("Enter the rejection reason:") : "";
    if (action === "reject" && !reason) return false;
    setBusy(`review-${record.request_id}`);
    beginProgress(action === "approve" ? "Approve account activation" : "Reject account request", action === "approve" ? "Approving account and preparing setup email…" : "Saving rejection decision…");
    try { const result = await reviewActivationRequest(record.request_id, action, reason); const emailDetail = result.setupEmail ? `Setup email ${result.setupEmail.status.toLowerCase()}${result.setupEmail.recipient ? ` to ${result.setupEmail.recipient}` : ""}.` : ""; setSuccess(`Account ${action === "approve" ? "approved" : "rejected"}. ${emailDetail}`.trim()); setError(""); await load(); finishProgress("Account records refreshed", emailDetail || "The action was saved successfully."); return true; }
    catch (reviewError) { setError(reviewError.message); failProgress(reviewError); await load(); return false; }
    finally { setBusy(""); }
  };

  const resendSetup = async (record) => {
    setBusy(`resend-${record.request_id}`); beginProgress("Resend account setup link", "Validating staff email…");
    try { const result = await resendAccountSetup(record.request_id); await load(); finishProgress("Setup email sent", `Sent to ${result.setupEmail?.recipient || record.staff_email}.`); return true; }
    catch (error) { setError(error.message); failProgress(error); await load(); return false; }
    finally { setBusy(""); }
  };

  const deleteAccount = async (record) => {
    if (!window.confirm(`Delete ${record.staff_name || record.name}'s PayNivo account? The HR staff record will remain.`)) return false;
    if (!window.confirm("Final confirmation: permanently remove this account's login access?")) return false;
    setBusy(`delete-${record.user_id}`); beginProgress("Delete user account", "Checking deletion safeguards…");
    try { const result = await deleteManagedPayrollUser(record.user_id, record.deletion_request_status === "pending" ? "Approved user-requested account deletion" : "Deleted by Admin from Payroll User Management"); setSuccess(result.message); await load(); finishProgress("Account deleted", "The staff record remains available to HR."); return true; }
    catch (error) { setError(error.message); failProgress(error); return false; }
    finally { setBusy(""); }
  };

  const accountAction = async (record, action, value) => {
    setBusy(`account-${record.user_id}`);
    const titles = { status: Number(value) === 1 ? "Enable account access" : "Disable account access", role: "Change account role", password: "Issue temporary password" };
    beginProgress(titles[action] || "Update account", "Saving account settings…");
    try {
      let result;
      if (action === "status") result = await updateUserStatus(record.user_id, value);
      if (action === "role") result = await updateUserRole(record.user_id, value);
      if (action === "password") result = await resetUserPassword(record.user_id);
      if (result?.temporaryPassword) setTemporaryPassword(result.temporaryPassword);
      setSuccess("Account settings updated."); await load(); finishProgress("Account settings refreshed", "The change was saved successfully.");
    } catch (actionError) { setError(actionError.message); failProgress(actionError); }
    finally { setBusy(""); }
  };

  if (role === "Admin") return <AdminUserDirectory
    data={data} loading={loading} busy={busy} error={error} success={success}
    temporaryPassword={temporaryPassword} load={load} review={review} resendSetup={resendSetup} deleteAccount={deleteAccount} accountAction={accountAction} actionProgress={actionProgress} closeProgress={() => setActionProgress((current) => ({ ...current, open: false }))}
  />;

  return <section className="space-y-5">
    <header className="flex flex-col gap-4 rounded-2xl border border-[#f0d2ca] bg-gradient-to-r from-white to-[#fff8f5] p-5 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="text-2xl font-semibold text-[#251E1F]">Staff Management</h2>
        <p className="mt-2 text-sm text-[#7b6660]">Manage staff records, payroll details, PayNivo access, and Admin activation from one directory.</p></div>
      <div className="flex flex-wrap gap-2">
        <input ref={importInputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(event) => previewImport(event.target.files?.[0])}/>
        <button type="button" disabled={Boolean(busy)} onClick={() => importInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-[#f0d2ca] bg-white px-4 py-2.5 text-sm font-semibold"><Upload size={16}/>Import Excel</button>
        <button type="button" disabled={Boolean(busy)} onClick={exportStaff} className="inline-flex items-center gap-2 rounded-xl border border-[#f0d2ca] bg-white px-4 py-2.5 text-sm font-semibold"><Download size={16}/>{busy === "export" ? "Exporting..." : "Export Excel"}</button>
        <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-[#f0d2ca] bg-white px-4 py-2.5 text-sm font-semibold"><RefreshCw size={16}/>Refresh</button>
        {role === "HR" ? <button type="button" onClick={() => setShowHire(true)} className="primary-button inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold"><Plus size={16}/>Hire staff &amp; create user</button> : null}
      </div>
    </header>
    {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
    {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{success}</div> : null}
    {temporaryPassword ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><strong>Temporary password (shown once):</strong> <code className="ml-2 select-all">{temporaryPassword}</code></div> : null}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[["Total staff", staffSummary.total, Users, "bg-rose-50 text-[#d66f5e]"], ["Active accounts", staffSummary.active, UserCheck, "bg-emerald-50 text-emerald-700"], ["Awaiting Admin", staffSummary.pending, Clock3, "bg-amber-50 text-amber-700"], ["Accounts not linked", staffSummary.unlinked, UserX, "bg-slate-100 text-slate-600"]].map(([label, value, Icon, tone]) => <article key={label} className="app-panel flex items-center gap-3 rounded-2xl p-4"><span className={`grid h-11 w-11 place-items-center rounded-xl ${tone}`}><Icon size={20}/></span><div><p className="text-xs font-semibold uppercase tracking-wide text-[#7b6660]">{label}</p><strong className="mt-1 block text-2xl text-[#251E1F]">{value}</strong></div></article>)}
    </div>
    <div className="app-panel overflow-hidden rounded-2xl">
      <div className="flex flex-col gap-2 border-b border-[#f0d2ca] p-5 sm:flex-row sm:items-center sm:justify-between"><label className="flex w-full max-w-xl items-center gap-2 rounded-xl border border-[#f0d2ca] bg-white px-3 py-2.5 shadow-sm"><Search size={16} className="text-[#F38978]"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search employee, email, department, role or status" className="w-full bg-transparent text-sm outline-none"/></label><p className="text-xs text-[#7b6660]">Select a staff member to view their complete record.</p></div>
      {loading ? <div className="flex items-center justify-center gap-2 p-12 text-sm text-[#7b6660]"><Loader2 className="animate-spin" size={18}/>Loading users...</div> :
      <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-[#fff8f5] text-xs uppercase tracking-wide text-[#7b6660]"><tr>
        <th className="px-4 py-3">Employee</th><th className="px-4 py-3">Employment</th><th className="px-4 py-3">Account access</th><th className="px-4 py-3">Activation</th><th className="px-4 py-3">Actions</th>
      </tr></thead><tbody className="divide-y divide-[#f0d2ca]">{filtered.map((record, index) => <tr key={record.user_id || `staff-${record.employee_id}-${index}`} tabIndex={0} role="button" onClick={() => setSelectedStaff(record)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedStaff(record); } }} className="cursor-pointer align-top transition hover:bg-[#fff8f5] focus:bg-[#fff8f5] focus:outline-none">
        <td className="px-4 py-4"><p className="font-semibold text-[#251E1F]">{record.staff_name || record.name}</p><p className="mt-1 text-xs text-[#7b6660]">{record.employee_code || "No employee code"} · {record.staff_email || record.email}</p></td>
        <td className="px-4 py-4"><p>{record.department_name || "No department"}</p><p className="mt-1 text-xs text-[#7b6660]">Hire: {record.hire_date ? new Date(record.hire_date).toLocaleDateString("en-SG") : "Not set"} · Salary: ${Number(record.base_salary || 0).toLocaleString()}</p></td>
        <td className="px-4 py-4"><p className="font-semibold">{record.role_name || "No account"}</p><div className="mt-2"><StatusBadge>{record.user_id ? (Number(record.account_status) === 1 ? "Active" : "Disabled") : "Unlinked"}</StatusBadge></div></td>
        <td className="px-4 py-4"><StatusBadge>{record.activation_status}</StatusBadge>{record.requested_by_name ? <p className="mt-2 text-xs text-[#7b6660]">Requested by {record.requested_by_name}</p> : null}{record.rejection_reason ? <p className="mt-1 max-w-xs text-xs text-red-700">{record.rejection_reason}</p> : null}</td>
        <td className="px-4 py-4" onClick={(event) => event.stopPropagation()}><div className="flex min-w-56 flex-wrap gap-2">
          <button type="button" onClick={() => setSelectedStaff(record)} className="inline-flex items-center gap-1 rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-xs font-semibold text-[#7b6660]"><Eye size={14}/>View details</button>
          {role === "Admin" && record.activation_status === "Pending" ? <><button disabled={busy} onClick={() => review(record,"approve")} className="rounded-lg bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-700">Approve</button><button disabled={busy} onClick={() => review(record,"reject")} className="rounded-lg bg-red-100 px-3 py-2 text-xs font-semibold text-red-700">Reject</button></> : null}
          {role === "Admin" && record.employee_id ? <button onClick={() => openEditor(record,"staff")} className="rounded-lg border border-[#f0d2ca] p-2" title="Edit staff details"><Pencil size={15}/></button> : null}
          {role === "Admin" && record.user_id && record.activation_status === "Approved" ? <><select value={record.role_name || "Staff"} onChange={(event) => accountAction(record,"role",(data.roles.indexOf(event.target.value)+1))} className="rounded-lg border border-[#f0d2ca] bg-white px-2 py-2 text-xs">{data.roles.map((item)=><option key={item}>{item}</option>)}</select><button onClick={() => accountAction(record,"status",Number(record.account_status)===1?0:1)} className="rounded-lg border border-[#f0d2ca] px-3 py-2 text-xs font-semibold">{Number(record.account_status)===1?"Disable":"Enable"}</button><button onClick={() => accountAction(record,"password")} title="Reset temporary password" className="rounded-lg border border-[#f0d2ca] p-2"><KeyRound size={15}/></button></> : null}
          {role === "HR" && ["Pending","Rejected"].includes(record.activation_status) ? <><span className={`inline-flex items-center gap-1 text-xs font-semibold ${record.activation_status === "Pending" ? "text-amber-700" : "text-red-700"}`}><ShieldCheck size={14}/>{record.activation_status === "Pending" ? "Awaiting Admin" : "Correction required"}</span><button onClick={() => openEditor(record,"request")} className="rounded-lg border border-[#f0d2ca] px-3 py-2 text-xs font-semibold"><Pencil size={14} className="mr-1 inline"/>Edit{record.activation_status === "Rejected" ? " & resubmit" : ""}</button></> : null}
          {role === "HR" && record.activation_status === "No Account" ? <button onClick={() => openEditor(record,"link")} className="rounded-lg border border-[#f0d2ca] px-3 py-2 text-xs font-semibold"><Plus size={14} className="mr-1 inline"/>Create linked account</button> : null}
        </div></td>
      </tr>)}</tbody></table>{!filtered.length ? <p className="p-10 text-center text-sm text-[#7b6660]">No records match your search.</p> : null}</div>}
    </div>

    {importPreview ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#251E1F]/45 p-4" onMouseDown={() => { if (!busy) { setImportPreview(null); setImportFile(null); } }}><section role="dialog" aria-modal="true" aria-labelledby="import-staff-title" onMouseDown={(event) => event.stopPropagation()} className="app-panel max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl">
      <header className="flex items-start justify-between border-b border-[#f0d2ca] p-6"><div><p className="text-xs font-semibold uppercase tracking-wider text-[#F38978]">Excel import preview</p><h3 id="import-staff-title" className="mt-1 text-xl font-semibold text-[#251E1F]">Review staff records before import</h3><p className="mt-1 text-sm text-[#7b6660]">Valid rows create inactive Staff accounts and are submitted to Admin for activation.</p></div><button type="button" disabled={Boolean(busy)} onClick={() => { setImportPreview(null); setImportFile(null); }}><X size={20}/></button></header>
      <div className="grid gap-3 border-b border-[#f0d2ca] bg-[#fff8f5] p-5 sm:grid-cols-3"><div className="rounded-xl bg-white p-4"><span className="text-xs text-[#7b6660]">Rows found</span><strong className="block text-2xl">{importPreview.total}</strong></div><div className="rounded-xl bg-emerald-50 p-4 text-emerald-700"><span className="text-xs">Ready to import</span><strong className="block text-2xl">{importPreview.valid}</strong></div><div className="rounded-xl bg-red-50 p-4 text-red-700"><span className="text-xs">Needs correction</span><strong className="block text-2xl">{importPreview.invalid}</strong></div></div>
      <div className="max-h-[45vh] overflow-auto"><table className="min-w-full text-left text-sm"><thead className="sticky top-0 bg-white text-xs uppercase text-[#7b6660]"><tr><th className="px-4 py-3">Excel row</th><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Validation</th></tr></thead><tbody className="divide-y divide-[#f0d2ca]">{importPreview.rows.map((row) => <tr key={row.rowNumber}><td className="px-4 py-3">{row.rowNumber}</td><td className="px-4 py-3"><strong>{row.name || "Missing name"}</strong><small className="block text-[#7b6660]">{row.email || "Missing email"}</small></td><td className="px-4 py-3">{row.department || "Not provided"}</td><td className="px-4 py-3">{row.valid ? <span className="text-emerald-700">Ready</span> : <span className="text-red-700">{row.error}</span>}</td></tr>)}</tbody></table></div>
      <div className="border-t border-[#f0d2ca] bg-amber-50 px-6 py-3 text-xs text-amber-800"><strong>Required headings:</strong> Name, Email, Department, Hire Date, Date of Birth, Race, Religion, Base Salary, Bank, and Account Number. Employee Code and Phone are optional.</div>
      <footer className="flex justify-end gap-3 p-5"><button type="button" disabled={Boolean(busy)} onClick={() => { setImportPreview(null); setImportFile(null); }} className="rounded-xl border border-[#f0d2ca] px-4 py-2.5 text-sm font-semibold">Cancel</button><button type="button" disabled={!importPreview.valid || Boolean(busy)} onClick={commitImport} className="primary-button inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold">{busy === "import-commit" ? <Loader2 size={16} className="animate-spin"/> : <FileSpreadsheet size={16}/>}Import {importPreview.valid} valid record(s)</button></footer>
    </section></div> : null}

    {selectedStaff ? <div className="fixed inset-0 z-50 flex justify-end bg-[#251E1F]/40" onMouseDown={() => setSelectedStaff(null)}><aside role="dialog" aria-modal="true" aria-labelledby="staff-details-title" onMouseDown={(event) => event.stopPropagation()} className="h-full w-full max-w-xl overflow-y-auto bg-[#fffdfc] shadow-2xl">
      <header className="sticky top-0 z-10 flex items-start justify-between border-b border-[#f0d2ca] bg-white/95 p-6 backdrop-blur"><div><p className="text-xs font-semibold uppercase tracking-wider text-[#F38978]">Staff record</p><h3 id="staff-details-title" className="mt-1 text-2xl font-semibold text-[#251E1F]">{selectedStaff.staff_name || selectedStaff.name}</h3><p className="mt-1 text-sm text-[#7b6660]">{selectedStaff.employee_code || "No employee code"}</p></div><button type="button" onClick={() => setSelectedStaff(null)} className="rounded-xl border border-[#f0d2ca] p-2" aria-label="Close staff details"><X size={19}/></button></header>
      <div className="space-y-5 p-6">
        <section className="flex items-center gap-4 rounded-2xl border border-[#f0d2ca] bg-gradient-to-r from-[#fff8f5] to-white p-5"><span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-[#F38978] text-lg font-bold text-white">{initials(selectedStaff)}</span><div><h4 className="text-lg font-semibold text-[#251E1F]">{selectedStaff.staff_name || selectedStaff.name}</h4><p className="text-sm text-[#7b6660]">{selectedStaff.department_name || "No department"}</p><div className="mt-2 flex flex-wrap gap-2"><StatusBadge>{selectedStaff.user_id ? (Number(selectedStaff.account_status) === 1 ? "Active" : "Disabled") : "Unlinked"}</StatusBadge><StatusBadge>{selectedStaff.activation_status}</StatusBadge></div></div></section>
        <DetailSection title="Contact information" icon={Mail} items={[["Email", selectedStaff.staff_email || selectedStaff.email || "Not recorded"], ["Phone", selectedStaff.phone || "Not recorded"]]}/>
        <DetailSection title="Employment and payroll" icon={BriefcaseBusiness} items={[["Department", selectedStaff.department_name || "Not assigned"], ["Hire date", selectedStaff.hire_date ? new Date(selectedStaff.hire_date).toLocaleDateString("en-SG") : "Not recorded"], ["Base salary", `$${Number(selectedStaff.base_salary || 0).toLocaleString("en-SG", { minimumFractionDigits: 2 })}`], ["Work location", selectedStaff.work_location || "Singapore"], ["Date of birth", selectedStaff.date_of_birth ? new Date(selectedStaff.date_of_birth).toLocaleDateString("en-SG") : "Not recorded"], ["Race / Religion", [selectedStaff.race, selectedStaff.religion].filter(Boolean).join(" / ") || "Not recorded"]]}/>
        <DetailSection title="Payment details" icon={WalletCards} items={[["Bank", selectedStaff.bank || "Not recorded"], ["Account number", selectedStaff.account_no || "Not recorded"]]}/>
        <DetailSection title="PayNivo account" icon={ShieldCheck} items={[["Role", selectedStaff.role_name || selectedStaff.requested_role || "No account"], ["Account access", selectedStaff.user_id ? (Number(selectedStaff.account_status) === 1 ? "Active" : "Disabled") : "Not linked"], ["Activation", selectedStaff.activation_status || "No account"], ["Requested by", selectedStaff.requested_by_name || "Not applicable"]]}/>
        {selectedStaff.rejection_reason ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><strong>Admin correction required</strong><p className="mt-1">{selectedStaff.rejection_reason}</p></div> : null}
      </div>
      <footer className="sticky bottom-0 flex justify-end gap-3 border-t border-[#f0d2ca] bg-white p-5"><button type="button" onClick={() => setSelectedStaff(null)} className="rounded-xl border border-[#f0d2ca] px-4 py-2.5 text-sm font-semibold">Close</button><button type="button" onClick={() => { const record = selectedStaff; setSelectedStaff(null); openEditor(record, record.activation_status === "No Account" ? "link" : record.activation_status === "Rejected" ? "request" : "staff"); }} className="primary-button inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold"><Pencil size={15}/>{selectedStaff.activation_status === "No Account" ? "Create linked account" : "Edit staff details"}</button></footer>
    </aside></div> : null}

    {showHire ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#251E1F]/45 p-4" onMouseDown={closeEditor}><form onSubmit={submitHire} onMouseDown={(event)=>event.stopPropagation()} className="app-panel max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl p-6">
      <div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-[#F38978]">{editing?.type === "staff" ? "Employee record" : "HR hiring workflow"}</p><h3 className="mt-2 text-xl font-semibold text-[#251E1F]">{editing?.type === "link" ? "Create account for existing staff" : editing ? "Edit staff and account details" : "Create staff and PayNivo account"}</h3><p className="mt-1 text-sm text-[#7b6660]">{editing?.type === "staff" ? "Account access settings remain unchanged." : "The account remains disabled until Admin approval."}</p></div><button type="button" onClick={closeEditor}><X size={20}/></button></div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">{[
        ["name","Full name","text",true],["email","Employee email","email",true],["employeeCode","Employee code","text",false],["phone","Phone","text",false],["departmentName","Department","text",true],["hireDate","Hire date","date",true],["dateOfBirth","Date of birth","date",true],["race","Race","text",true],["religion","Religion","text",true],["baseSalary","Base salary","number",true],["bank","Bank","text",true],["accountNo","Bank account number","text",true]
      ].map(([key,label,type,required])=><label key={key} className="text-sm font-medium text-[#7b6660]">{label}<input type={type} required={required} min={type==="number"?0:undefined} value={hire[key]} onChange={(event)=>setHire(current=>({...current,[key]:event.target.value}))} className="mt-1 w-full rounded-xl border border-[#f0d2ca] px-3 py-2.5 text-[#251E1F] outline-none focus:border-[#F38978]"/></label>)}
        {editing?.type !== "staff" ? <label className="text-sm font-medium text-[#7b6660]">PayNivo account role<div className="mt-1 rounded-xl border border-[#f0d2ca] bg-[#fff8f5] px-3 py-2.5 font-semibold text-[#251E1F]">Staff</div><span className="mt-1 block text-xs font-normal text-[#7b6660]">Admin can change the role after account approval.</span></label> : null}
      </div><div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><strong>What happens next?</strong><p className="mt-1">The staff record and inactive user account are created together. Admin must approve activation before the employee receives the email setup link.</p></div>
      {["staff", "request"].includes(editing?.type) ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">Remove staff from system</p>
          <p className="mt-1 text-xs text-red-600">Permanently removes the PayNivo account and the HR staff record. Use this when a staff member has left the organisation.</p>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => {
              const record = data.users.find(u => u.employee_id === editing.employeeId);
              setDeleteConfirm({
                userId: record?.user_id || null,
                employeeId: editing.employeeId,
                name: record?.staff_name || record?.name || hire.name
              });
              setDeletePassword("");
              setDeleteError("");
            }}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            <Trash2 size={14}/>Delete linked account
          </button>
        </div>
      ) : null}
      <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={closeEditor} className="rounded-xl border border-[#f0d2ca] px-4 py-2.5 font-semibold">Cancel</button><button disabled={busy==="hire"} className="primary-button inline-flex items-center gap-2 px-4 py-2.5 font-semibold">{busy==="hire"?<Loader2 className="animate-spin" size={16}/>:<CheckCircle2 size={16}/>} {editing?.type === "staff" ? "Save staff details" : editing?.type === "request" ? "Save and resubmit" : "Create user and submit to Admin"}</button></div>
    </form></div> : null}

    {deleteConfirm ? <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#251E1F]/60 p-4"><div className="app-panel w-full max-w-sm rounded-2xl p-6" role="dialog" aria-modal="true" aria-labelledby="hr-delete-title">
      <div className="flex items-center gap-3 mb-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-100"><Trash2 size={18} className="text-red-600"/></span>
        <div><h3 id="hr-delete-title" className="font-semibold text-[#251E1F]">Delete account</h3><p className="text-xs text-[#7b6660]">{deleteConfirm.name}</p></div>
      </div>
      <p className="text-sm text-[#7b6660] mb-4">This permanently removes the PayNivo login account <strong>and</strong> the HR staff record. This action cannot be undone.</p>
      <label className="block text-sm font-medium text-[#7b6660] mb-1">Enter <strong>your</strong> HR password to confirm:
        <input
          type="password"
          autoFocus
          value={deletePassword}
          onChange={e => { setDeletePassword(e.target.value); setDeleteError(""); }}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleHRDeleteAccount(); } }}
          placeholder="Your password"
          className="mt-1 w-full rounded-xl border border-[#f0d2ca] px-3 py-2.5 text-sm text-[#251E1F] outline-none focus:border-red-400"
        />
      </label>
      {deleteError ? <p className="mt-2 text-xs text-red-700">{deleteError}</p> : null}
      <div className="mt-5 flex gap-3">
        <button
          type="button"
          disabled={busy === "hr-delete" || !deletePassword.trim()}
          onClick={handleHRDeleteAccount}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {busy === "hr-delete" ? <Loader2 size={15} className="animate-spin"/> : <Trash2 size={15}/>}
          {busy === "hr-delete" ? "Deleting..." : "Confirm delete"}
        </button>
        <button
          type="button"
          disabled={busy === "hr-delete"}
          onClick={() => { setDeleteConfirm(null); setDeletePassword(""); setDeleteError(""); }}
          className="flex-1 rounded-xl border border-[#f0d2ca] px-4 py-2.5 text-sm font-semibold text-[#251E1F] hover:bg-[#FDD9CD]/45"
        >
          Cancel
        </button>
      </div>
    </div></div> : null}
  </section>;
}

export { normalizeManagedUsers };
