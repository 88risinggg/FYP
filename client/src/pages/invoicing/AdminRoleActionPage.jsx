import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Edit3,
  KeyRound,
  Plus,
  Shield,
  UserPlus,
  XCircle
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  deactivateAdminRole,
  duplicateAdminRole,
  fetchAdminRole,
  fetchAdminRoles
} from "../../services/adminRoleService.js";

function formatCount(value) {
  return new Intl.NumberFormat("en-SG").format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function statusText(role) {
  if (!role) return "-";
  return role.isActive ? "Active" : "Inactive";
}

function Detail({ label, value }) {
  return (
    <div className="rounded-lg bg-[#fff8f5] p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-[#7b6660]">{label}</p>
      <p className="mt-2 text-sm font-bold text-[#251E1F]">{value || "-"}</p>
    </div>
  );
}

function EmptyState({ children }) {
  return (
    <div className="rounded-lg border border-dashed border-[#f0c9bf] bg-[#fff6f2] px-4 py-7 text-center text-sm text-[#7b6660]">
      {children}
    </div>
  );
}

const actionMeta = {
  view: {
    title: "View Role",
    icon: Shield,
    description: "Review role permissions, modules, and assigned users."
  },
  edit: {
    title: "Edit Role",
    icon: Edit3,
    description: "Role editing is prepared for this access configuration."
  },
  "assign-users": {
    title: "Assign Users",
    icon: UserPlus,
    description: "User assignment is prepared for this role."
  },
  duplicate: {
    title: "Duplicate Role",
    icon: Copy,
    description: "Record a duplicate-role request for this role."
  },
  deactivate: {
    title: "Deactivate Role",
    icon: XCircle,
    description: "Deactivate this role configuration."
  },
  create: {
    title: "Create New Role",
    icon: Plus,
    description: "The system is limited to Admin, Finance, HR, and Staff roles."
  }
};

export default function AdminRoleActionPage({ roleId, action = "view" }) {
  const navigate = useNavigate();
  const meta = actionMeta[action] || actionMeta.view;
  const Icon = meta.icon;
  const [role, setRole] = useState(null);
  const [roles, setRoles] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadRole() {
    setLoading(true);
    setError("");

    try {
      if (action === "create") {
        const data = await fetchAdminRoles();
        setRoles(data.roles || []);
      } else {
        const data = await fetchAdminRole(roleId);
        setRole(data.role);
        setActivity(data.activity || []);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRole();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleId, action]);

  async function handleDuplicate() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const data = await duplicateAdminRole(role.roleId);
      setMessage(data.message || "Role duplicate request recorded.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const data = await deactivateAdminRole(role.roleId);
      setRole(data.role);
      setMessage("Role deactivated.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  const modules = useMemo(() => role?.keyModules || [], [role]);

  if (loading) {
    return (
      <section className="rounded-xl border border-[#f0d2ca] bg-white/95 p-8 text-center text-sm text-[#7b6660]">
        Loading role...
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <button
        type="button"
        onClick={() => navigate("/dashboard/invoicing/admin/roles")}
        className="inline-flex items-center gap-2 rounded-lg border border-[#ead6cf] bg-white/90 px-4 py-2 text-sm font-bold text-[#6f4f47] hover:bg-[#fff3ef]"
      >
        <ArrowLeft size={16} />
        Back to Roles & Permissions
      </button>

      <div className="rounded-xl border border-[#f0d2ca] bg-white/95 p-6 shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#F38978]/15 text-[#F38978] ring-1 ring-[#F38978]/20">
              <Icon size={25} />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-[#251E1F]">{meta.title}</h2>
              <p className="mt-1 text-sm text-[#7b6660]">{meta.description}</p>
              {role ? <p className="mt-3 text-base font-bold text-[#b64d3b]">{role.roleName}</p> : null}
            </div>
          </div>

          {action === "duplicate" && role ? (
            <button
              type="button"
              onClick={handleDuplicate}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#F38978] px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#F38978]/20 hover:bg-[#e77463] disabled:opacity-60"
            >
              <Copy size={16} />
              {saving ? "Recording..." : "Duplicate Role"}
            </button>
          ) : null}

          {action === "deactivate" && role ? (
            <button
              type="button"
              onClick={handleDeactivate}
              disabled={saving || !role.isActive}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#F38978] px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#F38978]/20 hover:bg-[#e77463] disabled:opacity-60"
            >
              <XCircle size={16} />
              {saving ? "Deactivating..." : "Deactivate Role"}
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-[#FDD9CD] bg-[#FDD9CD] px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-[#FFF6F2] px-4 py-3 text-sm font-medium text-emerald-700">
          {message}
        </div>
      ) : null}

      {action === "create" ? (
        <section className="rounded-xl border border-[#f0d2ca] bg-white/95 p-5 shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
          <h3 className="text-base font-bold text-[#251E1F]">Available System Roles</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {roles.map((item) => (
              <div key={item.roleId} className="rounded-lg border border-[#ead6cf] bg-[#fff8f5] p-4">
                <p className="font-bold text-[#251E1F]">{item.roleName}</p>
                <p className="mt-1 text-sm text-[#7b6660]">{item.description}</p>
              </div>
            ))}
          </div>
        </section>
      ) : role ? (
        <>
          <div className="grid gap-4 lg:grid-cols-4">
            <Detail label="Assigned Users" value={formatCount(role.assignedUsers)} />
            <Detail label="Access Level" value={role.accessLevel} />
            <Detail label="Permissions" value={formatCount(role.permissionCount)} />
            <Detail label="Status" value={statusText(role)} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <section className="rounded-xl border border-[#f0d2ca] bg-white/95 p-5 shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
              <div className="mb-4 flex items-center gap-2">
                <KeyRound size={18} className="text-[#F38978]" />
                <h3 className="text-base font-bold text-[#251E1F]">Key Modules</h3>
              </div>
              {modules.length === 0 ? (
                <EmptyState>No modules found for this role.</EmptyState>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {modules.map((moduleName) => (
                    <span key={moduleName} className="rounded-md border border-[#ead6cf] bg-[#fff8f5] px-2.5 py-1 text-sm font-bold text-[#6f4f47]">
                      {moduleName}
                    </span>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-[#f0d2ca] bg-white/95 p-5 shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
              <div className="mb-4 flex items-center gap-2">
                <CheckCircle2 size={18} className="text-[#F38978]" />
                <h3 className="text-base font-bold text-[#251E1F]">Role Description</h3>
              </div>
              <p className="text-sm font-semibold leading-6 text-[#514440]">{role.description}</p>
            </section>
          </div>

          <section className="rounded-xl border border-[#f0d2ca] bg-white/95 p-5 shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
            <h3 className="text-base font-bold text-[#251E1F]">Recent Role Activity</h3>
            <div className="mt-4 space-y-3">
              {activity.length === 0 ? (
                <EmptyState>No recent activity found for this role.</EmptyState>
              ) : (
                activity.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-4 border-b border-[#f3ded7] pb-3 last:border-b-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#251E1F]">{item.actionDescription}</p>
                      <p className="mt-1 text-xs text-[#7b6660]">By {item.actorName || "System"}</p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-[#7b6660]">{formatDate(item.createdAt)}</span>
                  </div>
                ))
              )}
            </div>
          </section>
        </>
      ) : (
        <EmptyState>Role details were not found.</EmptyState>
      )}
    </section>
  );
}
