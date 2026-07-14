import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
  FilterX,
  KeyRound,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  XCircle
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  createAdminUser,
  fetchAdminUsers,
  resetAdminUserPassword,
  updateAdminUser,
  updateAdminUserStatus
} from "../../services/adminUserService.js";

const emptyFilters = {
  search: "",
  roleId: "",
  departmentId: "",
  status: "",
  lastActiveFrom: ""
};

const emptyForm = {
  name: "",
  email: "",
  password: "",
  roleId: "",
  departmentId: "",
  status: ""
};

function formatDate(value) {
  if (!value) return "Never";

  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatCount(value) {
  return new Intl.NumberFormat("en-SG").format(Number(value || 0));
}

function getInitials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function statusBadgeClass(label = "") {
  const normalized = label.toLowerCase();

  if (normalized === "active") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (normalized === "pending") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (normalized === "disabled" || normalized === "suspended") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-stone-200 bg-stone-100 text-stone-600";
}

function EmptyState({ children }) {
  return (
    <div className="rounded-lg border border-dashed border-[#f0c9bf] bg-[#fff6f2] px-4 py-8 text-center text-sm text-[#7b6660]">
      {children}
    </div>
  );
}

function UserFormModal({
  mode,
  user,
  roles,
  departments,
  statusOptions,
  onClose,
  onSaved
}) {
  const [form, setForm] = useState(() => ({
    ...emptyForm,
    name: user?.name || "",
    email: user?.email || "",
    roleId: user?.roleId ? String(user.roleId) : String(roles[0]?.roleId || ""),
    departmentId: user?.departmentId ? String(user.departmentId) : "",
    status: user?.status !== undefined ? String(user.status) : String(statusOptions[0]?.value ?? 1)
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = {
        name: form.name,
        email: form.email,
        roleId: Number(form.roleId),
        departmentId: form.departmentId || null,
        status: Number(form.status)
      };

      if (mode === "create") {
        await createAdminUser({ ...payload, password: form.password });
      } else {
        await updateAdminUser(user.userId, payload);
      }

      onSaved();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#251E1F]/35 px-4 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-xl border border-[#f0d2ca] bg-white p-5 shadow-[0_24px_70px_rgba(37,30,31,0.18)]"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-[#251E1F]">
              {mode === "create" ? "Add New User" : "Edit User"}
            </h3>
            <p className="mt-1 text-sm text-[#7b6660]">
              Manage the selected account details and access status.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[#7b6660] hover:bg-[#fff3ef] hover:text-[#F38978]"
            aria-label="Close"
          >
            <XCircle size={19} />
          </button>
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="text-xs font-bold uppercase tracking-wide text-[#7b6660]">Name</span>
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className="mt-1 w-full rounded-lg border border-[#ead6cf] bg-white px-3 py-2 text-sm text-[#251E1F] outline-none focus:border-[#F38978] focus:ring-2 focus:ring-[#F38978]/15"
              required
            />
          </label>
          <label className="sm:col-span-2">
            <span className="text-xs font-bold uppercase tracking-wide text-[#7b6660]">Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              className="mt-1 w-full rounded-lg border border-[#ead6cf] bg-white px-3 py-2 text-sm text-[#251E1F] outline-none focus:border-[#F38978] focus:ring-2 focus:ring-[#F38978]/15"
              required
            />
          </label>
          {mode === "create" ? (
            <label className="sm:col-span-2">
              <span className="text-xs font-bold uppercase tracking-wide text-[#7b6660]">Password</span>
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                className="mt-1 w-full rounded-lg border border-[#ead6cf] bg-white px-3 py-2 text-sm text-[#251E1F] outline-none focus:border-[#F38978] focus:ring-2 focus:ring-[#F38978]/15"
                required
              />
            </label>
          ) : null}
          <label>
            <span className="text-xs font-bold uppercase tracking-wide text-[#7b6660]">Role</span>
            <select
              value={form.roleId}
              onChange={(event) => setForm({ ...form, roleId: event.target.value })}
              className="mt-1 w-full rounded-lg border border-[#ead6cf] bg-white px-3 py-2 text-sm text-[#251E1F] outline-none focus:border-[#F38978] focus:ring-2 focus:ring-[#F38978]/15"
              required
            >
              {roles.map((role) => (
                <option key={role.roleId} value={role.roleId}>
                  {role.roleName}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-xs font-bold uppercase tracking-wide text-[#7b6660]">Department</span>
            <select
              value={form.departmentId}
              onChange={(event) => setForm({ ...form, departmentId: event.target.value })}
              className="mt-1 w-full rounded-lg border border-[#ead6cf] bg-white px-3 py-2 text-sm text-[#251E1F] outline-none focus:border-[#F38978] focus:ring-2 focus:ring-[#F38978]/15"
            >
              <option value="">No department</option>
              {departments.map((department) => (
                <option key={department.departmentId} value={department.departmentId}>
                  {department.departmentName}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-xs font-bold uppercase tracking-wide text-[#7b6660]">Status</span>
            <select
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
              className="mt-1 w-full rounded-lg border border-[#ead6cf] bg-white px-3 py-2 text-sm text-[#251E1F] outline-none focus:border-[#F38978] focus:ring-2 focus:ring-[#F38978]/15"
              required
            >
              {statusOptions.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#ead6cf] px-4 py-2 text-sm font-bold text-[#6f4f47] hover:bg-[#fff3ef]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[#F38978] px-4 py-2 text-sm font-bold text-white shadow-lg shadow-[#F38978]/20 transition hover:bg-[#e77463] disabled:opacity-60"
          >
            <CheckCircle2 size={16} />
            {saving ? "Saving..." : "Save User"}
          </button>
        </div>
      </form>
    </div>
  );
}

function PasswordModal({ user, onClose, onSaved }) {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      await resetAdminUserPassword(user.userId, password);
      onSaved();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#251E1F]/35 px-4 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl border border-[#f0d2ca] bg-white p-5 shadow-[0_24px_70px_rgba(37,30,31,0.18)]"
      >
        <h3 className="text-lg font-bold text-[#251E1F]">Reset Password</h3>
        <p className="mt-1 text-sm text-[#7b6660]">{user.email}</p>
        {error ? (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            {error}
          </div>
        ) : null}
        <label className="mt-4 block">
          <span className="text-xs font-bold uppercase tracking-wide text-[#7b6660]">New Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-lg border border-[#ead6cf] bg-white px-3 py-2 text-sm text-[#251E1F] outline-none focus:border-[#F38978] focus:ring-2 focus:ring-[#F38978]/15"
            required
          />
        </label>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#ead6cf] px-4 py-2 text-sm font-bold text-[#6f4f47] hover:bg-[#fff3ef]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[#F38978] px-4 py-2 text-sm font-bold text-white shadow-lg shadow-[#F38978]/20 transition hover:bg-[#e77463] disabled:opacity-60"
          >
            <KeyRound size={16} />
            {saving ? "Resetting..." : "Reset"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AdminUserManagementPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);
  const [summary, setSummary] = useState({
    totalUsers: 0,
    activeUsers: 0,
    pendingInvitations: 0,
    suspendedAccounts: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [accessOverview, setAccessOverview] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [formState, setFormState] = useState(null);
  const [passwordUser, setPasswordUser] = useState(null);

  async function loadUsers(nextFilters = appliedFilters, page = pagination.page) {
    setLoading(true);
    setError("");

    try {
      const data = await fetchAdminUsers({
        ...nextFilters,
        page,
        pageSize: pagination.pageSize
      });
      setUsers(data.users || []);
      setRoles(data.roles || []);
      setDepartments(data.departments || []);
      setStatusOptions(data.statusOptions || []);
      setSummary(data.summary || summary);
      setRecentActivity(data.recentActivity || []);
      setAccessOverview(data.accessOverview || []);
      setPagination(data.pagination || pagination);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers(emptyFilters, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyFilters() {
    setAppliedFilters(filters);
    loadUsers(filters, 1);
  }

  function clearFilters() {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    loadUsers(emptyFilters, 1);
  }

  async function deactivateUser(user) {
    setOpenMenuId(null);
    setError("");

    try {
      await updateAdminUserStatus(user.userId, 0);
      await loadUsers(appliedFilters, pagination.page);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  const totalAccessUsers = useMemo(
    () => accessOverview.reduce((sum, role) => sum + Number(role.userCount || 0), 0),
    [accessOverview]
  );

  const kpiCards = [
    { label: "Total Users", value: summary.totalUsers, icon: Users, accent: "#F38978" },
    { label: "Active Users", value: summary.activeUsers, icon: UserCheck, accent: "#e87562" },
    { label: "Pending Invitations", value: summary.pendingInvitations, icon: UserPlus, accent: "#F0B23E" },
    { label: "Suspended Accounts", value: summary.suspendedAccounts, icon: UserMinus, accent: "#F26E5F" }
  ];

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-normal text-[#251E1F]">
            Manage User Accounts
          </h2>
          <p className="mt-1 text-sm text-[#7b6660]">
            View, manage and control system user accounts and access.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormState({ mode: "create", user: null })}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#F38978] px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#F38978]/20 transition hover:bg-[#e77463]"
        >
          <Plus size={17} />
          Add New User
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;

          return (
            <article
              key={card.label}
              className="rounded-xl border border-[#f0d2ca] bg-white/95 p-4 shadow-[0_10px_28px_rgba(37,30,31,0.06)]"
            >
              <div className="flex items-center gap-4">
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${card.accent}1f`, color: card.accent }}
                >
                  <Icon size={25} strokeWidth={2.1} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#514440]">{card.label}</p>
                  <p className="mt-1 text-2xl font-bold text-[#251E1F]">{formatCount(card.value)}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="rounded-xl border border-[#f0d2ca] bg-white/95 p-4 shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
        <div className="grid gap-3 xl:grid-cols-[1.2fr_1fr_1fr_1fr_1fr_auto_auto]">
          <label>
            <span className="text-xs font-bold text-[#514440]">Search</span>
            <div className="mt-1 flex items-center gap-2 rounded-lg border border-[#ead6cf] bg-white px-3 py-2">
              <Search size={15} className="text-[#8d7b76]" />
              <input
                value={filters.search}
                onChange={(event) => setFilters({ ...filters, search: event.target.value })}
                placeholder="Name or email"
                className="w-full bg-transparent text-sm text-[#251E1F] outline-none placeholder:text-[#9c7b72]"
              />
            </div>
          </label>
          <label>
            <span className="text-xs font-bold text-[#514440]">Role</span>
            <select
              value={filters.roleId}
              onChange={(event) => setFilters({ ...filters, roleId: event.target.value })}
              className="mt-1 w-full rounded-lg border border-[#ead6cf] bg-white px-3 py-2 text-sm text-[#251E1F] outline-none"
            >
              <option value="">All Roles</option>
              {roles.map((role) => (
                <option key={role.roleId} value={role.roleId}>
                  {role.roleName}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-xs font-bold text-[#514440]">Department</span>
            <select
              value={filters.departmentId}
              onChange={(event) => setFilters({ ...filters, departmentId: event.target.value })}
              className="mt-1 w-full rounded-lg border border-[#ead6cf] bg-white px-3 py-2 text-sm text-[#251E1F] outline-none"
            >
              <option value="">All Departments</option>
              {departments.map((department) => (
                <option key={department.departmentId} value={department.departmentId}>
                  {department.departmentName}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-xs font-bold text-[#514440]">Status</span>
            <select
              value={filters.status}
              onChange={(event) => setFilters({ ...filters, status: event.target.value })}
              className="mt-1 w-full rounded-lg border border-[#ead6cf] bg-white px-3 py-2 text-sm text-[#251E1F] outline-none"
            >
              <option value="">All Statuses</option>
              {statusOptions.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-xs font-bold text-[#514440]">Last Active</span>
            <input
              type="date"
              value={filters.lastActiveFrom}
              onChange={(event) => setFilters({ ...filters, lastActiveFrom: event.target.value })}
              className="mt-1 w-full rounded-lg border border-[#ead6cf] bg-white px-3 py-2 text-sm text-[#251E1F] outline-none"
            />
          </label>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg border border-[#ead6cf] px-4 py-2 text-sm font-bold text-[#6f4f47] hover:bg-[#fff3ef]"
          >
            <FilterX size={16} />
            Clear
          </button>
          <button
            type="button"
            onClick={applyFilters}
            className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-[#F38978] px-4 py-2 text-sm font-bold text-white shadow-lg shadow-[#F38978]/15 hover:bg-[#e87562]"
          >
            <Filter size={16} />
            Apply
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-visible rounded-xl border border-[#f0d2ca] bg-white/95 shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[#f0d2ca] bg-[#fff8f5] text-xs font-bold uppercase tracking-wide text-[#6f4f47]">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Login</th>
                <th className="px-4 py-3">Permissions</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f3ded7]">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-4 py-12 text-center text-[#7b6660]">
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-6">
                    <EmptyState>No users found for the selected filters.</EmptyState>
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.userId} className="text-[#251E1F]">
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F38978]/12 text-xs font-bold text-[#F38978]">
                          {getInitials(user.name)}
                        </div>
                        <span className="font-bold">{user.name}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#6f4f47]">{user.email}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="rounded-md border border-[#f3c6bc] bg-[#fff0eb] px-2 py-1 text-xs font-bold text-[#b64d3b]">
                        {user.roleName}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#514440]">
                      {user.departmentName || "Unassigned"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={`rounded-md border px-2 py-1 text-xs font-bold ${statusBadgeClass(user.statusLabel)}`}>
                        {user.statusLabel}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#514440]">{formatDate(user.lastLogin)}</td>
                    <td className="min-w-48 px-4 py-3 text-[#514440]">
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={16} className="shrink-0 text-[#6f4f47]" />
                        <span className="line-clamp-1">{user.permissions?.[0] || "No permissions assigned"}</span>
                      </div>
                    </td>
                    <td className="relative whitespace-nowrap px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setOpenMenuId(openMenuId === user.userId ? null : user.userId)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#ead6cf] text-[#6f4f47] hover:bg-[#fff3ef]"
                        aria-label={`Open actions for ${user.name}`}
                      >
                        <MoreVertical size={17} />
                      </button>
                      {openMenuId === user.userId ? (
                        <div className="absolute right-4 top-12 z-20 w-48 overflow-hidden rounded-lg border border-[#ead6cf] bg-white text-left shadow-[0_18px_45px_rgba(37,30,31,0.16)]">
                          <button
                            type="button"
                            onClick={() => navigate(`/dashboard/invoicing/admin/users/${user.userId}`)}
                            className="block w-full px-4 py-2.5 text-left text-sm font-semibold text-[#251E1F] hover:bg-[#fff3ef]"
                          >
                            View Profile
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              setFormState({ mode: "edit", user });
                            }}
                            className="block w-full px-4 py-2.5 text-left text-sm font-semibold text-[#251E1F] hover:bg-[#fff3ef]"
                          >
                            Edit User
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              setPasswordUser(user);
                            }}
                            className="block w-full px-4 py-2.5 text-left text-sm font-semibold text-[#251E1F] hover:bg-[#fff3ef]"
                          >
                            Reset Password
                          </button>
                          <button
                            type="button"
                            onClick={() => deactivateUser(user)}
                            className="block w-full px-4 py-2.5 text-left text-sm font-semibold text-[#d84e40] hover:bg-rose-50"
                          >
                            Deactivate User
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-[#f0d2ca] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[#7b6660]">
            Showing {users.length} of {formatCount(pagination.total)} users
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadUsers(appliedFilters, Math.max(pagination.page - 1, 1))}
              disabled={pagination.page <= 1 || loading}
              className="inline-flex items-center gap-2 rounded-lg border border-[#ead6cf] px-3 py-2 text-sm font-bold text-[#6f4f47] hover:bg-[#fff3ef] disabled:opacity-45"
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            <span className="text-sm font-bold text-[#514440]">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              type="button"
              onClick={() => loadUsers(appliedFilters, Math.min(pagination.page + 1, pagination.totalPages))}
              disabled={pagination.page >= pagination.totalPages || loading}
              className="inline-flex items-center gap-2 rounded-lg border border-[#ead6cf] px-3 py-2 text-sm font-bold text-[#6f4f47] hover:bg-[#fff3ef] disabled:opacity-45"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-xl border border-[#f0d2ca] bg-white/95 p-5 shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
          <h3 className="text-base font-bold text-[#251E1F]">Recent Account Activity</h3>
          <div className="mt-4 space-y-3">
            {recentActivity.length === 0 ? (
              <EmptyState>No recent user account activity found.</EmptyState>
            ) : (
              recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start justify-between gap-4 border-b border-[#f3ded7] pb-3 last:border-b-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[#251E1F]">{activity.actionDescription}</p>
                    <p className="mt-1 text-xs text-[#7b6660]">By {activity.actorName || "System"}</p>
                  </div>
                  <time className="shrink-0 text-right text-xs font-semibold text-[#7b6660]">
                    {formatDate(activity.createdAt)}
                  </time>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-[#f0d2ca] bg-white/95 p-5 shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
          <h3 className="text-base font-bold text-[#251E1F]">Access Overview</h3>
          <div className="mt-4 space-y-3">
            {accessOverview.length === 0 ? (
              <EmptyState>No role distribution data found.</EmptyState>
            ) : (
              accessOverview.map((role, index) => {
                const percentage = totalAccessUsers
                  ? Math.round((Number(role.userCount || 0) / totalAccessUsers) * 100)
                  : 0;
                const colors = ["#F38978", "#e87562", "#F0B23E", "#F26E5F"];
                const color = colors[index % colors.length];

                return (
                  <div key={role.roleId}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                      <span className="font-bold text-[#251E1F]">{role.roleName}</span>
                      <span className="text-[#6f4f47]">
                        {formatCount(role.userCount)} ({percentage}%)
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#f5ded6]">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${percentage}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {formState ? (
        <UserFormModal
          mode={formState.mode}
          user={formState.user}
          roles={roles}
          departments={departments}
          statusOptions={statusOptions}
          onClose={() => setFormState(null)}
          onSaved={() => {
            setFormState(null);
            loadUsers(appliedFilters, pagination.page);
          }}
        />
      ) : null}

      {passwordUser ? (
        <PasswordModal
          user={passwordUser}
          onClose={() => setPasswordUser(null)}
          onSaved={() => {
            setPasswordUser(null);
            loadUsers(appliedFilters, pagination.page);
          }}
        />
      ) : null}
    </section>
  );
}
