import {
  CheckCircle2,
  Eye,
  KeyRound,
  Pencil,
  Plus,
  Search,
  Shield,
  UserCheck,
  UserMinus,
  Users,
  XCircle
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  createAdminUser,
  fetchAdminUsers,
  resetAdminUserPassword,
  updateAdminUser,
  updateAdminUserStatus
} from "../../services/adminUserService.js";

const initialForm = {
  name: "",
  email: "",
  password: "",
  roleId: "",
  status: "1"
};

function formatDate(value) {
  if (!value) {
    return "Not tracked";
  }

  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function statusClass(status) {
  return Number(status) === 1
    ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200"
    : "border-rose-300/30 bg-rose-400/10 text-rose-200";
}

export default function AdminUserManagementPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [summary, setSummary] = useState({
    totalUsers: 0,
    activeUsers: 0,
    disabledUsers: 0,
    roles: {}
  });
  const [filters, setFilters] = useState({ search: "", roleId: "", status: "" });
  const [selectedUser, setSelectedUser] = useState(null);
  const [mode, setMode] = useState("details");
  const [form, setForm] = useState(initialForm);
  const [resetPassword, setResetPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selectedRole = useMemo(
    () => roles.find((role) => String(role.roleId) === String(form.roleId)),
    [form.roleId, roles]
  );

  async function loadUsers(nextFilters = filters) {
    setLoading(true);
    setError("");

    try {
      const data = await fetchAdminUsers(nextFilters);
      setUsers(data.users || []);
      setRoles(data.roles || []);
      setSummary(data.summary || summary);

      if (selectedUser) {
        const refreshed = data.users?.find((user) => user.userId === selectedUser.userId);
        setSelectedUser(refreshed || null);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFilterChange(key, value) {
    const nextFilters = { ...filters, [key]: value };
    setFilters(nextFilters);
    loadUsers(nextFilters);
  }

  function openCreateForm() {
    setMode("create");
    setSelectedUser(null);
    setResetPassword("");
    setMessage("");
    setError("");
    setForm({
      ...initialForm,
      roleId: roles[0]?.roleId ? String(roles[0].roleId) : ""
    });
  }

  function openDetails(user) {
    setSelectedUser(user);
    setMode("details");
    setResetPassword("");
    setMessage("");
    setError("");
  }

  function openEditForm(user) {
    setSelectedUser(user);
    setMode("edit");
    setResetPassword("");
    setMessage("");
    setError("");
    setForm({
      name: user.name,
      email: user.email,
      password: "",
      roleId: String(user.roleId),
      status: String(user.status)
    });
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const payload = {
        name: form.name,
        email: form.email,
        roleId: Number(form.roleId),
        status: Number(form.status)
      };

      if (mode === "create") {
        const created = await createAdminUser({
          ...payload,
          password: form.password
        });
        setSelectedUser(created.user);
        setMessage("User account created.");
      } else if (selectedUser) {
        const updated = await updateAdminUser(selectedUser.userId, payload);
        setSelectedUser(updated.user);
        setMessage("User account updated.");
      }

      setMode("details");
      await loadUsers();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(user, nextStatus) {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const data = await updateAdminUserStatus(user.userId, nextStatus);
      setSelectedUser(data.user);
      setMessage(nextStatus === 1 ? "User account enabled." : "User account disabled.");
      await loadUsers();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault();

    if (!selectedUser) {
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await resetAdminUserPassword(selectedUser.userId, resetPassword);
      setResetPassword("");
      setMessage("Password reset successfully.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  const summaryCards = [
    { label: "Total Users", value: summary.totalUsers, icon: Users },
    { label: "Active Users", value: summary.activeUsers, icon: UserCheck },
    { label: "Disabled Users", value: summary.disabledUsers, icon: UserMinus },
    {
      label: "Admin / Finance / HR / Staff",
      value: `${summary.roles?.Admin || 0} / ${summary.roles?.Finance || 0} / ${
        summary.roles?.HR || 0
      } / ${summary.roles?.Staff || 0}`,
      icon: Shield
    }
  ];

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-medium text-[#C77DFF]">Admin Manage User Accounts</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">
            Automated Invoicing System - User Management
          </h2>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          className="neon-button inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold"
        >
          <Plus size={17} />
          Add New User
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;

          return (
            <div key={card.label} className="neon-glass neon-border rounded-lg p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-[#d8c6e8]">{card.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{card.value}</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#C77DFF]/15 text-[#C77DFF] ring-1 ring-[#C77DFF]/25">
                  <Icon size={21} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="neon-glass neon-border overflow-hidden rounded-lg">
          <div className="grid gap-3 border-b border-white/10 p-4 md:grid-cols-[minmax(0,1fr)_180px_180px]">
            <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2">
              <Search size={16} className="text-[#C77DFF]" />
              <input
                type="search"
                value={filters.search}
                onChange={(event) => handleFilterChange("search", event.target.value)}
                placeholder="Search by name or email"
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[#d8c6e8]/60"
              />
            </label>
            <select
              value={filters.roleId}
              onChange={(event) => handleFilterChange("roleId", event.target.value)}
              className="rounded-lg border border-white/10 bg-[#140026] px-3 py-2 text-sm text-white outline-none"
            >
              <option value="">All roles</option>
              {roles.map((role) => (
                <option key={role.roleId} value={role.roleId}>
                  {role.roleName}
                </option>
              ))}
            </select>
            <select
              value={filters.status}
              onChange={(event) => handleFilterChange("status", event.target.value)}
              className="rounded-lg border border-white/10 bg-[#140026] px-3 py-2 text-sm text-white outline-none"
            >
              <option value="">All statuses</option>
              <option value="1">Active</option>
              <option value="0">Disabled</option>
            </select>
          </div>

          {error ? (
            <div className="border-b border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}
          {message ? (
            <div className="border-b border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
              {message}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm">
              <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-[#d8c6e8]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Last Login</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-10 text-center text-[#d8c6e8]">
                      Loading users...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-14 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#C77DFF]/15 text-[#C77DFF] ring-1 ring-[#C77DFF]/25">
                          <Users size={26} />
                        </div>
                        <p className="mt-4 text-base font-semibold text-white">
                          No users found. Create your first user account.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.userId} className="text-[#f7efff]">
                      <td className="whitespace-nowrap px-4 py-4 font-medium">{user.name}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-[#d8c6e8]">{user.email}</td>
                      <td className="whitespace-nowrap px-4 py-4">{user.roleName}</td>
                      <td className="whitespace-nowrap px-4 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(
                            user.status
                          )}`}
                        >
                          {user.statusLabel}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-[#d8c6e8]">
                        {formatDate(user.lastLogin)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openDetails(user)}
                            className="rounded-lg p-2 text-[#d8c6e8] hover:bg-white/10 hover:text-white"
                            title="View details"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditForm(user)}
                            className="rounded-lg p-2 text-[#d8c6e8] hover:bg-white/10 hover:text-white"
                            title="Edit user"
                          >
                            <Pencil size={16} />
                          </button>
                          {Number(user.status) === 1 ? (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(user, 0)}
                              className="rounded-lg p-2 text-rose-200 hover:bg-rose-400/10"
                              title="Disable user"
                            >
                              <XCircle size={16} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(user, 1)}
                              className="rounded-lg p-2 text-emerald-200 hover:bg-emerald-400/10"
                              title="Enable user"
                            >
                              <CheckCircle2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="neon-glass neon-border rounded-lg p-5">
          {mode === "create" || mode === "edit" ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <p className="text-lg font-semibold text-white">
                  {mode === "create" ? "Add New User" : "Edit User"}
                </p>
                <p className="mt-1 text-sm text-[#d8c6e8]">
                  {selectedRole?.roleName || "Select a role"} access will apply after save.
                </p>
              </div>

              <label className="block">
                <span className="text-sm font-medium text-[#d8c6e8]">Full Name</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-[#d8c6e8]">Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none"
                />
              </label>

              {mode === "create" ? (
                <label className="block">
                  <span className="text-sm font-medium text-[#d8c6e8]">Password</span>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(event) => setForm({ ...form, password: event.target.value })}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none"
                  />
                </label>
              ) : null}

              <label className="block">
                <span className="text-sm font-medium text-[#d8c6e8]">Role</span>
                <select
                  value={form.roleId}
                  onChange={(event) => setForm({ ...form, roleId: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#140026] px-3 py-2 text-sm text-white outline-none"
                >
                  <option value="">Select role</option>
                  {roles.map((role) => (
                    <option key={role.roleId} value={role.roleId}>
                      {role.roleName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-[#d8c6e8]">Status</span>
                <select
                  value={form.status}
                  onChange={(event) => setForm({ ...form, status: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#140026] px-3 py-2 text-sm text-white outline-none"
                >
                  <option value="1">Active</option>
                  <option value="0">Disabled</option>
                </select>
              </label>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="neon-button flex-1 px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save User"}
                </button>
                <button
                  type="button"
                  onClick={() => (selectedUser ? openDetails(selectedUser) : setMode("details"))}
                  className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold text-[#d8c6e8] hover:bg-white/10 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : selectedUser ? (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-white">{selectedUser.name}</p>
                  <p className="mt-1 text-sm text-[#d8c6e8]">{selectedUser.email}</p>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(
                    selectedUser.status
                  )}`}
                >
                  {selectedUser.statusLabel}
                </span>
              </div>

              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-[#d8c6e8]">Role</dt>
                  <dd className="font-medium text-white">{selectedUser.roleName}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#d8c6e8]">Last Login</dt>
                  <dd className="font-medium text-white">{formatDate(selectedUser.lastLogin)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#d8c6e8]">Created</dt>
                  <dd className="font-medium text-white">{formatDate(selectedUser.createdAt)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#d8c6e8]">Updated</dt>
                  <dd className="font-medium text-white">{formatDate(selectedUser.updatedAt)}</dd>
                </div>
              </dl>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => openEditForm(selectedUser)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10"
                >
                  <Pencil size={15} />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleStatusChange(selectedUser, Number(selectedUser.status) === 1 ? 0 : 1)
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10"
                >
                  {Number(selectedUser.status) === 1 ? (
                    <XCircle size={15} />
                  ) : (
                    <CheckCircle2 size={15} />
                  )}
                  {Number(selectedUser.status) === 1 ? "Disable" : "Enable"}
                </button>
              </div>

              <form onSubmit={handleResetPassword} className="border-t border-white/10 pt-5">
                <label className="block">
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-[#d8c6e8]">
                    <KeyRound size={15} />
                    Reset Password
                  </span>
                  <input
                    type="password"
                    value={resetPassword}
                    onChange={(event) => setResetPassword(event.target.value)}
                    placeholder="Enter new password"
                    className="mt-2 w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none placeholder:text-[#d8c6e8]/60"
                  />
                </label>
                <button
                  type="submit"
                  disabled={saving}
                  className="mt-3 w-full rounded-lg border border-[#C77DFF]/30 bg-[#C77DFF]/15 px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#C77DFF]/25 disabled:opacity-60"
                >
                  Reset Password
                </button>
              </form>
            </div>
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#C77DFF]/15 text-[#C77DFF] ring-1 ring-[#C77DFF]/25">
                <Eye size={25} />
              </div>
              <p className="mt-4 text-base font-semibold text-white">Select a user</p>
              <p className="mt-2 text-sm text-[#d8c6e8]">
                View details, edit account access, reset password, or change status.
              </p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
