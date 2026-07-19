import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  KeyRound,
  Pencil,
  ShieldCheck,
  UserMinus,
  XCircle
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  fetchAdminUser,
  resetAdminUserPassword,
  updateAdminUser,
  updateAdminUserStatus
} from "../../services/adminUserService.js";

function formatDate(value) {
  if (!value) return "Never";

  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
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

  if (normalized === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (normalized === "pending") return "border-amber-200 bg-amber-50 text-amber-700";
  if (normalized === "disabled" || normalized === "suspended") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-stone-200 bg-stone-100 text-stone-600";
}

function EmptyState({ children }) {
  return (
    <div className="rounded-lg border border-dashed border-[#f0c9bf] bg-[#fff6f2] px-4 py-7 text-center text-sm text-[#7b6660]">
      {children}
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div className="rounded-lg bg-[#fff8f5] p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-[#7b6660]">{label}</p>
      <p className="mt-2 text-sm font-bold text-[#251E1F]">{value || "Not assigned"}</p>
    </div>
  );
}

function EditModal({ user, roles, departments, statusOptions, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: user.name || "",
    email: user.email || "",
    roleId: String(user.roleId || roles[0]?.roleId || ""),
    departmentId: user.departmentId ? String(user.departmentId) : "",
    status: String(user.status)
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      await updateAdminUser(user.userId, {
        name: form.name,
        email: form.email,
        roleId: Number(form.roleId),
        departmentId: form.departmentId || null,
        status: Number(form.status)
      });
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
            <h3 className="text-lg font-bold text-[#251E1F]">Edit User</h3>
            <p className="mt-1 text-sm text-[#7b6660]">{user.email}</p>
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
              className="mt-1 w-full rounded-lg border border-[#ead6cf] px-3 py-2 text-sm outline-none focus:border-[#F38978] focus:ring-2 focus:ring-[#F38978]/15"
              required
            />
          </label>
          <label className="sm:col-span-2">
            <span className="text-xs font-bold uppercase tracking-wide text-[#7b6660]">Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              className="mt-1 w-full rounded-lg border border-[#ead6cf] px-3 py-2 text-sm outline-none focus:border-[#F38978] focus:ring-2 focus:ring-[#F38978]/15"
              required
            />
          </label>
          <label>
            <span className="text-xs font-bold uppercase tracking-wide text-[#7b6660]">Role</span>
            <select
              value={form.roleId}
              onChange={(event) => setForm({ ...form, roleId: event.target.value })}
              className="mt-1 w-full rounded-lg border border-[#ead6cf] px-3 py-2 text-sm outline-none"
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
              className="mt-1 w-full rounded-lg border border-[#ead6cf] px-3 py-2 text-sm outline-none"
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
              className="mt-1 w-full rounded-lg border border-[#ead6cf] px-3 py-2 text-sm outline-none"
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
            className="inline-flex items-center gap-2 rounded-lg bg-[#F38978] px-4 py-2 text-sm font-bold text-white shadow-lg shadow-[#F38978]/20 hover:bg-[#e77463] disabled:opacity-60"
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
            className="mt-1 w-full rounded-lg border border-[#ead6cf] px-3 py-2 text-sm outline-none focus:border-[#F38978] focus:ring-2 focus:ring-[#F38978]/15"
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
            className="inline-flex items-center gap-2 rounded-lg bg-[#F38978] px-4 py-2 text-sm font-bold text-white shadow-lg shadow-[#F38978]/20 hover:bg-[#e77463] disabled:opacity-60"
          >
            <KeyRound size={16} />
            {saving ? "Resetting..." : "Reset"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AdminUserProfilePage({ userId }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function loadProfile() {
    setLoading(true);
    setError("");

    try {
      const data = await fetchAdminUser(userId);
      setUser(data.user);
      setRoles(data.roles || []);
      setDepartments(data.departments || []);
      setStatusOptions(data.statusOptions || []);
      setRecentActivity(data.recentActivity || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function deactivateUser() {
    if (!user) return;
    setError("");

    try {
      await updateAdminUserStatus(user.userId, 0);
      await loadProfile();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  if (loading) {
    return (
      <section className="rounded-xl border border-[#f0d2ca] bg-white/95 p-8 text-center text-sm text-[#7b6660]">
        Loading user profile...
      </section>
    );
  }

  if (error || !user) {
    return (
      <section className="space-y-4">
        <button
          type="button"
          onClick={() => navigate("/dashboard/invoicing/admin/users")}
          className="inline-flex items-center gap-2 rounded-lg border border-[#ead6cf] px-4 py-2 text-sm font-bold text-[#6f4f47] hover:bg-[#fff3ef]"
        >
          <ArrowLeft size={16} />
          Back to User Management
        </button>
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error || "User profile was not found."}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <button
        type="button"
        onClick={() => navigate("/dashboard/invoicing/admin/users")}
        className="inline-flex items-center gap-2 rounded-lg border border-[#ead6cf] bg-white/90 px-4 py-2 text-sm font-bold text-[#6f4f47] hover:bg-[#fff3ef]"
      >
        <ArrowLeft size={16} />
        Back to User Management
      </button>

      <div className="rounded-xl border border-[#f0d2ca] bg-white/95 p-6 shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
        <div className="grid gap-6 xl:grid-cols-[1fr_auto] xl:items-start">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-[#F38978]/12 text-3xl font-bold text-[#F38978] ring-1 ring-[#F38978]/15">
              {getInitials(user.name)}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-3xl font-bold text-[#251E1F]">{user.name}</h2>
                <span className={`rounded-md border px-2 py-1 text-xs font-bold ${statusBadgeClass(user.statusLabel)}`}>
                  {user.statusLabel}
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold text-[#6f4f47]">{user.email}</p>
              <p className="mt-3 max-w-2xl text-sm text-[#7b6660]">
                {user.permissions?.[0] || "No permissions assigned to this role."}
              </p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 xl:w-[520px]">
            <button
              type="button"
              onClick={() => setShowEdit(true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#ead6cf] px-3 py-2 text-sm font-bold text-[#6f4f47] hover:bg-[#fff3ef]"
            >
              <Pencil size={16} />
              Edit User
            </button>
            <button
              type="button"
              onClick={() => setShowPassword(true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#ead6cf] px-3 py-2 text-sm font-bold text-[#6f4f47] hover:bg-[#fff3ef]"
            >
              <KeyRound size={16} />
              Reset Password
            </button>
            <button
              type="button"
              onClick={deactivateUser}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#F38978] px-3 py-2 text-sm font-bold text-white shadow-lg shadow-[#F38978]/20 hover:bg-[#e77463]"
            >
              <UserMinus size={16} />
              Deactivate
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Detail label="Role" value={user.roleName} />
        <Detail label="Department" value={user.departmentName} />
        <Detail label="Last Login" value={formatDate(user.lastLogin)} />
        <Detail label="Joined Date" value={formatDate(user.createdAt)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-xl border border-[#f0d2ca] bg-white/95 p-5 shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck size={18} className="text-[#F38978]" />
            <h3 className="text-base font-bold text-[#251E1F]">Permissions</h3>
          </div>
          {user.permissions?.length ? (
            <div className="space-y-2">
              {user.permissions.map((permission) => (
                <div key={permission} className="rounded-lg bg-[#fff8f5] px-3 py-2 text-sm font-semibold text-[#514440]">
                  {permission}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState>No permissions found for this user.</EmptyState>
          )}
        </section>

        <section className="rounded-xl border border-[#f0d2ca] bg-white/95 p-5 shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
          <div className="mb-4 flex items-center gap-2">
            <CalendarDays size={18} className="text-[#F38978]" />
            <h3 className="text-base font-bold text-[#251E1F]">Assigned Modules</h3>
          </div>
          {user.assignedModules?.length ? (
            <div className="flex flex-wrap gap-2">
              {user.assignedModules.map((module) => (
                <span key={module} className="rounded-md border border-[#f3c6bc] bg-[#fff0eb] px-2.5 py-1 text-sm font-bold text-[#b64d3b]">
                  {module}
                </span>
              ))}
            </div>
          ) : (
            <EmptyState>No assigned modules found in the database.</EmptyState>
          )}
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-xl border border-[#f0d2ca] bg-white/95 p-5 shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
          <h3 className="text-base font-bold text-[#251E1F]">Recent Activity</h3>
          <div className="mt-4 space-y-3">
            {recentActivity.length === 0 ? (
              <EmptyState>No recent activity found for this user.</EmptyState>
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
          <h3 className="text-base font-bold text-[#251E1F]">Security Settings</h3>
          <div className="mt-4 space-y-3">
            <Detail label="Account Status" value={user.statusLabel} />
            <Detail label="Login Access" value={Number(user.status) === 1 ? "Enabled" : "Blocked"} />
          </div>
        </section>
      </div>

      {showEdit ? (
        <EditModal
          user={user}
          roles={roles}
          departments={departments}
          statusOptions={statusOptions}
          onClose={() => setShowEdit(false)}
          onSaved={() => {
            setShowEdit(false);
            loadProfile();
          }}
        />
      ) : null}

      {showPassword ? (
        <PasswordModal
          user={user}
          onClose={() => setShowPassword(false)}
          onSaved={() => {
            setShowPassword(false);
            loadProfile();
          }}
        />
      ) : null}
    </section>
  );
}
