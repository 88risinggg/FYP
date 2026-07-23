import {
  BriefcaseBusiness, CheckCircle2, ChevronLeft, ChevronRight, Clock3, KeyRound,
  Loader2, Pencil, Plus, RefreshCw, Search, ShieldCheck, UserCheck, Users, UserX, X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPayrollHire, getPayrollUsers, reviewActivationRequest, updateActivationRequest } from "../../services/payrollUserService.js";
import { resetUserPassword, updateUserRole, updateUserStatus } from "../../services/adminPayrollService.js";
import { apiRequest } from "../../services/apiClient.js";

const emptyHire = {
  name: "", email: "", employeeCode: "", phone: "", departmentName: "",
  hireDate: "", baseSalary: "", bank: "", accountNo: "", roleName: "Staff"
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

function initials(record) {
  return String(record.staff_name || record.name || "User")
    .split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function adminAccountStatus(record) {
  if (["Pending", "Rejected", "No Account"].includes(record.activation_status)) return record.activation_status;
  return record.user_id && Number(record.account_status) !== 1 ? "Disabled" : "Approved";
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
  "No Account": "admin-user-management__status--no-account"
};

function getRoleVisuals(record) {
  const key = String(record.role_name || record.requested_role || "unlinked").toLowerCase();
  return roleVisuals[key] || roleVisuals.unlinked;
}

function AdminUserDirectory({ data, loading, busy, error, success, temporaryPassword, load, review, accountAction }) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All Roles");
  const [departmentFilter, setDepartmentFilter] = useState("All Departments");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState(null);
  const users = data.users || [];
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
        <label><span>Role</span><select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option>All Roles</option>{data.roles.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>Department</span><select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}><option>All Departments</option><option>No department</option>{departments.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>Activation status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All Statuses</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select></label>
      </div>

      {loading ? <div className="admin-user-management__loading"><Loader2 className="animate-spin" size={19}/>Loading users...</div> : <>
        <div className="admin-user-management__table-wrap"><table><thead><tr><th>Employee</th><th>Employment</th><th>Role / Access</th><th>Account activation status</th><th>Actions</th></tr></thead>
          <tbody>{rows.map((record, index) => <tr className={`admin-user-management__row ${getRoleVisuals(record).row}`} key={record.user_id || `staff-${record.employee_id}-${index}`}>
            <td><div className="admin-user-management__employee"><span className={`admin-user-management__avatar ${getRoleVisuals(record).avatar}`}>{initials(record)}</span><div><strong>{record.staff_name || record.name || "Unnamed user"}</strong><small>{record.employee_code || "No employee code"} · {record.staff_email || record.email || "No email"}</small></div></div></td>
            <td><strong>{record.department_name || "No department"}</strong><small>{record.employee_id ? "Staff record linked" : "No staff record linked"}</small></td>
            <td><span className={`admin-user-management__role ${getRoleVisuals(record).badge}`}>{record.role_name || record.requested_role || "No account"}</span><small>{record.role_name === "Admin" ? "Full system access" : record.user_id ? "Role-based access" : "Account not created"}</small></td>
            <td><span className={`admin-user-management__status ${statusVisuals[adminAccountStatus(record)] || statusVisuals["No Account"]}`}><i/>{adminAccountStatus(record)}</span><small>{record.user_id ? (Number(record.account_status) === 1 ? "Active" : "Access disabled") : "Unlinked"}</small></td>
            <td><button type="button" className="admin-user-management__manage" onClick={() => setSelected(record)}><BriefcaseBusiness size={15}/>Manage Account Details</button></td>
          </tr>)}</tbody></table>{!rows.length ? <div className="admin-user-management__empty">No users match the selected filters.</div> : null}</div>
        <footer className="admin-user-management__pagination"><p>Showing {start} to {end} of {filteredUsers.length} users</p><div><select aria-label="Rows per page" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value="10">10 per page</option><option value="25">25 per page</option><option value="50">50 per page</option></select><button disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} aria-label="Previous page"><ChevronLeft size={18}/></button><span>{currentPage} / {totalPages}</span><button disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} aria-label="Next page"><ChevronRight size={18}/></button></div></footer>
      </>}
    </div>

    {selected ? <div className="admin-user-management__modal-backdrop" onMouseDown={() => setSelected(null)}><section role="dialog" aria-modal="true" aria-labelledby="manage-account-title" className="admin-user-management__modal" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><span>Account administration</span><h3 id="manage-account-title">Manage Account Details</h3><p>Only access-related information is available to Admin.</p></div><button onClick={() => setSelected(null)} aria-label="Close"><X size={20}/></button></header>
      <div className="admin-user-management__identity"><span className={`admin-user-management__avatar ${getRoleVisuals(selected).avatar}`}>{initials(selected)}</span><div><strong>{selected.staff_name || selected.name}</strong><p>{selected.staff_email || selected.email}</p><small>{selected.employee_code || "No employee code"} · {selected.department_name || "No department"}</small></div></div>
      {selected.requested_by_name ? <p className="admin-user-management__request-note">Requested by {selected.requested_by_name}{selected.rejection_reason ? ` · Previous rejection: ${selected.rejection_reason}` : ""}</p> : null}
      {selected.activation_status === "Pending" ? <div className="admin-user-management__review-actions"><button disabled={busy} onClick={() => review(selected, "approve")} className="admin-user-management__approve"><CheckCircle2 size={16}/>Approve activation</button><button disabled={busy} onClick={() => review(selected, "reject")} className="admin-user-management__reject"><X size={16}/>Reject request</button></div> : null}
      {selected.user_id && selected.activation_status === "Approved" ? <div className="admin-user-management__account-controls">
        <label><span>PayNivo role</span><select value={selected.role_name || "Staff"} onChange={(event) => accountAction(selected, "role", data.roles.indexOf(event.target.value) + 1)}>{data.roles.map((item) => <option key={item}>{item}</option>)}</select></label>
        <div><span>Account access</span><button onClick={() => accountAction(selected, "status", Number(selected.account_status) === 1 ? 0 : 1)}>{Number(selected.account_status) === 1 ? "Disable account" : "Enable account"}</button></div>
        <div><span>Password security</span><button onClick={() => accountAction(selected, "password")}><KeyRound size={15}/>Issue temporary password</button></div>
      </div> : null}
      {!selected.user_id ? <p className="admin-user-management__request-note">This staff record has no PayNivo account. HR must create and submit the account request.</p> : null}
      <footer><button type="button" onClick={() => setSelected(null)} className="admin-user-management__secondary">Close</button></footer>
    </section></div> : null}
  </section>;
}

export default function PayrollUserManagement({ role }) {
  const [data, setData] = useState({ users: [], roles: [] });
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showHire, setShowHire] = useState(false);
  const [hire, setHire] = useState(emptyHire);
  const [editing, setEditing] = useState(null);
  const [temporaryPassword, setTemporaryPassword] = useState("");

  const load = async () => {
    setLoading(true);
    try { setData(await getPayrollUsers()); setError(""); }
    catch (loadError) { setError(loadError.message || "Unable to load user management."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return data.users || [];
    return (data.users || []).filter((record) => [record.name, record.staff_name, record.email,
      record.staff_email, record.employee_code, record.department_name, record.role_name,
      record.activation_status].some((item) => String(item || "").toLowerCase().includes(value)));
  }, [data.users, query]);

  const submitHire = async (event) => {
    event.preventDefault(); setBusy("hire"); setError(""); setTemporaryPassword("");
    try {
      const payload = { staff: { ...hire, employeeId: editing?.type === "link" ? editing.employeeId : undefined }, account: { name: hire.name, email: hire.email, roleName: hire.roleName } };
      const result = editing?.type === "request"
        ? await updateActivationRequest(editing.requestId, payload)
        : editing?.type === "staff"
          ? await apiRequest(`/api/hr/staff/${editing.employeeId}`, {
              method: "PUT",
              body: JSON.stringify({
                name: hire.name, email: hire.email, employee_code: hire.employeeCode,
                phone: hire.phone, department_name: hire.departmentName, hire_date: hire.hireDate,
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
      baseSalary: record.base_salary ?? "", bank: record.bank || "", accountNo: record.account_no || "",
      roleName: record.requested_role || record.role_name || "Staff"
    });
    setTemporaryPassword(""); setShowHire(true);
  };

  const closeEditor = () => { setShowHire(false); setEditing(null); setHire(emptyHire); };

  const review = async (record, action) => {
    const reason = action === "reject" ? window.prompt("Enter the rejection reason:") : "";
    if (action === "reject" && !reason) return;
    setBusy(`review-${record.request_id}`);
    try { await reviewActivationRequest(record.request_id, action, reason); setSuccess(`Account ${action === "approve" ? "approved" : "rejected"}.`); await load(); }
    catch (reviewError) { setError(reviewError.message); }
    finally { setBusy(""); }
  };

  const accountAction = async (record, action, value) => {
    setBusy(`account-${record.user_id}`);
    try {
      let result;
      if (action === "status") result = await updateUserStatus(record.user_id, value);
      if (action === "role") result = await updateUserRole(record.user_id, value);
      if (action === "password") result = await resetUserPassword(record.user_id);
      if (result?.temporaryPassword) setTemporaryPassword(result.temporaryPassword);
      setSuccess("Account settings updated."); await load();
    } catch (actionError) { setError(actionError.message); }
    finally { setBusy(""); }
  };

  if (role === "Admin") return <AdminUserDirectory
    data={data} loading={loading} busy={busy} error={error} success={success}
    temporaryPassword={temporaryPassword} load={load} review={review} accountAction={accountAction}
  />;

  return <section className="space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><h2 className="text-2xl font-semibold text-[#251E1F]">User Management</h2>
        <p className="mt-2 text-sm text-[#7b6660]">Employee records, PayNivo access, staff linkage and account activation in one directory.</p></div>
      <div className="flex gap-2">
        <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-[#f0d2ca] bg-white px-4 py-2.5 text-sm font-semibold"><RefreshCw size={16}/>Refresh</button>
        {role === "HR" ? <button type="button" onClick={() => setShowHire(true)} className="primary-button inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold"><Plus size={16}/>Add new hire</button> : null}
      </div>
    </header>
    {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
    {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{success}</div> : null}
    {temporaryPassword ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><strong>Temporary password (shown once):</strong> <code className="ml-2 select-all">{temporaryPassword}</code></div> : null}
    <div className="app-panel overflow-hidden rounded-2xl">
      <div className="border-b border-[#f0d2ca] p-5"><label className="flex max-w-xl items-center gap-2 rounded-xl border border-[#f0d2ca] bg-white px-3 py-2.5"><Search size={16} className="text-[#F38978]"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search employee, email, department, role or status" className="w-full bg-transparent text-sm outline-none"/></label></div>
      {loading ? <div className="flex items-center justify-center gap-2 p-12 text-sm text-[#7b6660]"><Loader2 className="animate-spin" size={18}/>Loading users...</div> :
      <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-[#fff8f5] text-xs uppercase tracking-wide text-[#7b6660]"><tr>
        <th className="px-4 py-3">Employee</th><th className="px-4 py-3">Employment</th><th className="px-4 py-3">Account access</th><th className="px-4 py-3">Activation</th><th className="px-4 py-3">Actions</th>
      </tr></thead><tbody className="divide-y divide-[#f0d2ca]">{filtered.map((record, index) => <tr key={record.user_id || `staff-${record.employee_id}-${index}`} className="align-top hover:bg-[#fff8f5]">
        <td className="px-4 py-4"><p className="font-semibold text-[#251E1F]">{record.staff_name || record.name}</p><p className="mt-1 text-xs text-[#7b6660]">{record.employee_code || "No employee code"} · {record.staff_email || record.email}</p></td>
        <td className="px-4 py-4"><p>{record.department_name || "No department"}</p><p className="mt-1 text-xs text-[#7b6660]">Hire: {record.hire_date ? new Date(record.hire_date).toLocaleDateString("en-SG") : "Not set"} · Salary: ${Number(record.base_salary || 0).toLocaleString()}</p></td>
        <td className="px-4 py-4"><p className="font-semibold">{record.role_name || "No account"}</p><div className="mt-2"><StatusBadge>{record.user_id ? (Number(record.account_status) === 1 ? "Active" : "Disabled") : "Unlinked"}</StatusBadge></div></td>
        <td className="px-4 py-4"><StatusBadge>{record.activation_status}</StatusBadge>{record.requested_by_name ? <p className="mt-2 text-xs text-[#7b6660]">Requested by {record.requested_by_name}</p> : null}{record.rejection_reason ? <p className="mt-1 max-w-xs text-xs text-red-700">{record.rejection_reason}</p> : null}</td>
        <td className="px-4 py-4"><div className="flex min-w-56 flex-wrap gap-2">
          {role === "Admin" && record.activation_status === "Pending" ? <><button disabled={busy} onClick={() => review(record,"approve")} className="rounded-lg bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-700">Approve</button><button disabled={busy} onClick={() => review(record,"reject")} className="rounded-lg bg-red-100 px-3 py-2 text-xs font-semibold text-red-700">Reject</button></> : null}
          {role === "Admin" && record.employee_id ? <button onClick={() => openEditor(record,"staff")} className="rounded-lg border border-[#f0d2ca] p-2" title="Edit staff details"><Pencil size={15}/></button> : null}
          {role === "Admin" && record.user_id && record.activation_status === "Approved" ? <><select value={record.role_name || "Staff"} onChange={(event) => accountAction(record,"role",(data.roles.indexOf(event.target.value)+1))} className="rounded-lg border border-[#f0d2ca] bg-white px-2 py-2 text-xs">{data.roles.map((item)=><option key={item}>{item}</option>)}</select><button onClick={() => accountAction(record,"status",Number(record.account_status)===1?0:1)} className="rounded-lg border border-[#f0d2ca] px-3 py-2 text-xs font-semibold">{Number(record.account_status)===1?"Disable":"Enable"}</button><button onClick={() => accountAction(record,"password")} title="Reset temporary password" className="rounded-lg border border-[#f0d2ca] p-2"><KeyRound size={15}/></button></> : null}
          {role === "HR" && ["Pending","Rejected"].includes(record.activation_status) ? <><span className={`inline-flex items-center gap-1 text-xs font-semibold ${record.activation_status === "Pending" ? "text-amber-700" : "text-red-700"}`}><ShieldCheck size={14}/>{record.activation_status === "Pending" ? "Awaiting Admin" : "Correction required"}</span><button onClick={() => openEditor(record,"request")} className="rounded-lg border border-[#f0d2ca] px-3 py-2 text-xs font-semibold"><Pencil size={14} className="mr-1 inline"/>Edit{record.activation_status === "Rejected" ? " & resubmit" : ""}</button></> : null}
          {role === "HR" && record.activation_status === "No Account" ? <button onClick={() => openEditor(record,"link")} className="rounded-lg border border-[#f0d2ca] px-3 py-2 text-xs font-semibold"><Plus size={14} className="mr-1 inline"/>Create linked account</button> : null}
        </div></td>
      </tr>)}</tbody></table>{!filtered.length ? <p className="p-10 text-center text-sm text-[#7b6660]">No records match your search.</p> : null}</div>}
    </div>

    {showHire ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#251E1F]/45 p-4" onMouseDown={closeEditor}><form onSubmit={submitHire} onMouseDown={(event)=>event.stopPropagation()} className="app-panel max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl p-6">
      <div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-[#F38978]">{editing?.type === "staff" ? "Employee record" : "HR hiring workflow"}</p><h3 className="mt-2 text-xl font-semibold text-[#251E1F]">{editing?.type === "link" ? "Create account for existing staff" : editing ? "Edit staff and account details" : "Create staff and PayNivo account"}</h3><p className="mt-1 text-sm text-[#7b6660]">{editing?.type === "staff" ? "Account access settings remain unchanged." : "The account remains disabled until Admin approval."}</p></div><button type="button" onClick={closeEditor}><X size={20}/></button></div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">{[
        ["name","Full name","text",true],["email","Employee email","email",true],["employeeCode","Employee code","text",false],["phone","Phone","text",false],["departmentName","Department","text",false],["hireDate","Hire date","date",false],["baseSalary","Base salary","number",false],["bank","Bank","text",false],["accountNo","Bank account number","text",false]
      ].map(([key,label,type,required])=><label key={key} className="text-sm font-medium text-[#7b6660]">{label}<input type={type} required={required} min={type==="number"?0:undefined} value={hire[key]} onChange={(event)=>setHire(current=>({...current,[key]:event.target.value}))} className="mt-1 w-full rounded-xl border border-[#f0d2ca] px-3 py-2.5 text-[#251E1F] outline-none focus:border-[#F38978]"/></label>)}
        {editing?.type !== "staff" ? <label className="text-sm font-medium text-[#7b6660]">Requested PayNivo role<select value={hire.roleName} onChange={(event)=>setHire(current=>({...current,roleName:event.target.value}))} className="mt-1 w-full rounded-xl border border-[#f0d2ca] px-3 py-2.5">{(data.roles.length?data.roles:["Admin","Finance","HR","Staff"]).map(item=><option key={item}>{item}</option>)}</select></label> : null}
      </div><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={closeEditor} className="rounded-xl border border-[#f0d2ca] px-4 py-2.5 font-semibold">Cancel</button><button disabled={busy==="hire"} className="primary-button inline-flex items-center gap-2 px-4 py-2.5 font-semibold">{busy==="hire"?<Loader2 className="animate-spin" size={16}/>:<CheckCircle2 size={16}/>} {editing?.type === "staff" ? "Save staff details" : editing?.type === "request" ? "Save and resubmit" : "Submit for activation"}</button></div>
    </form></div> : null}
  </section>;
}
