import {
  BarChart3,
  ChevronRight,
  Copy,
  Edit3,
  Filter,
  KeyRound,
  MoreVertical,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  UserPlus,
  Users,
  XCircle
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchAdminRoles } from "../../services/adminRoleService.js";

const emptyFilters = {
  search: "",
  status: "",
  accessLevel: "",
  sort: "asc"
};

const roleVisuals = {
  Admin: { icon: Shield, color: "#7D8F58" },
  Finance: { icon: BarChart3, color: "#F38978" },
  HR: { icon: UserPlus, color: "#F0B23E" },
  Staff: { icon: Users, color: "#F26E5F" }
};

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

function accessBadgeClass(accessLevel = "") {
  if (accessLevel === "Full Access") return "border-[#cdd4b6] bg-[#eef1df] text-[#4d663a]";
  if (accessLevel === "High Access") return "border-[#f3c6bc] bg-[#fff0eb] text-[#b64d3b]";
  if (accessLevel === "Moderate Access") return "border-[#f4d59a] bg-[#fff4d8] text-[#9a6412]";
  return "border-[#f3c6bc] bg-[#fff0ec] text-[#c55245]";
}

function EmptyState({ children }) {
  return (
    <div className="rounded-lg border border-dashed border-[#f0c9bf] bg-[#fff6f2] px-4 py-8 text-center text-sm text-[#7b6660]">
      {children}
    </div>
  );
}

function RoleDistribution({ roles }) {
  const total = roles.reduce((sum, role) => sum + Number(role.assignedUsers || 0), 0);
  const colors = ["#7D8F58", "#F38978", "#F0B23E", "#F26E5F"];
  let cursor = 0;
  const segments = roles.map((role, index) => {
    const percentage = total ? (Number(role.assignedUsers || 0) / total) * 100 : 0;
    const start = cursor;
    cursor += percentage;
    return `${colors[index % colors.length]} ${start}% ${cursor}%`;
  });
  const background = total ? `conic-gradient(${segments.join(", ")})` : "#f5ded6";

  return (
    <div className="grid gap-5 md:grid-cols-[220px_1fr] md:items-center">
      <div className="relative mx-auto flex h-48 w-48 items-center justify-center rounded-full" style={{ background }}>
        <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-white text-center shadow-inner">
          <p className="text-2xl font-bold text-[#251E1F]">{formatCount(total)}</p>
          <p className="text-xs font-semibold text-[#7b6660]">Total Users</p>
        </div>
      </div>
      <div className="space-y-3">
        {roles.length === 0 ? (
          <EmptyState>No role distribution data found.</EmptyState>
        ) : (
          roles.map((role, index) => {
            const percentage = total
              ? Math.round((Number(role.assignedUsers || 0) / total) * 100)
              : 0;

            return (
              <div key={role.roleId} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: colors[index % colors.length] }}
                  />
                  <span className="truncate font-bold text-[#251E1F]">{role.roleName}</span>
                </div>
                <span className="shrink-0 text-[#6f4f47]">
                  {formatCount(role.assignedUsers)} ({percentage}%)
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function AdminRolesPermissionsPage() {
  const navigate = useNavigate();
  const [roles, setRoles] = useState([]);
  const [summary, setSummary] = useState({
    totalRoles: 0,
    assignedUsers: 0,
    activeRoles: 0,
    permissions: 0
  });
  const [activity, setActivity] = useState([]);
  const [distribution, setDistribution] = useState([]);
  const [options, setOptions] = useState({
    accessLevels: [],
    statuses: [],
    sortOptions: []
  });
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);

  async function loadRoles(nextFilters = appliedFilters) {
    setLoading(true);
    setError("");

    try {
      const data = await fetchAdminRoles(nextFilters);
      setRoles(data.roles || []);
      setSummary(data.summary || summary);
      setActivity(data.activity || []);
      setDistribution(data.distribution || []);
      setOptions(data.options || options);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRoles(emptyFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyFilters() {
    setAppliedFilters(filters);
    loadRoles(filters);
  }

  const kpiCards = [
    { label: "Total Roles", value: summary.totalRoles, icon: Users, accent: "#7D8F58" },
    { label: "Assigned Users", value: summary.assignedUsers, icon: UserPlus, accent: "#F38978" },
    { label: "Active Roles", value: summary.activeRoles, icon: ShieldCheck, accent: "#F0B23E" },
    { label: "Permissions", value: summary.permissions, icon: KeyRound, accent: "#F26E5F" }
  ];

  const actionItems = useMemo(
    () => [
      { label: "View Role", path: (role) => `/admin/roles/${role.roleId}`, icon: Shield },
      { label: "Edit Role", path: (role) => `/admin/roles/${role.roleId}/edit`, icon: Edit3 },
      { label: "Assign Users", path: (role) => `/admin/roles/${role.roleId}/assign-users`, icon: UserPlus },
      { label: "Duplicate Role", path: (role) => `/admin/roles/${role.roleId}/duplicate`, icon: Copy },
      { label: "Deactivate Role", path: (role) => `/admin/roles/${role.roleId}/deactivate`, icon: XCircle, danger: true }
    ],
    []
  );

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-normal text-[#251E1F]">Roles & Permissions</h2>
          <p className="mt-1 text-sm text-[#7b6660]">
            Manage user roles, permissions, and access levels across the system.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/admin/roles/create")}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#F38978] px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#F38978]/20 transition hover:bg-[#e77463]"
        >
          <Plus size={17} />
          Create New Role
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
        <div className="grid gap-3 xl:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
          <label>
            <span className="sr-only">Search Roles</span>
            <div className="flex items-center gap-2 rounded-lg border border-[#ead6cf] bg-white px-3 py-2">
              <Search size={15} className="text-[#8d7b76]" />
              <input
                value={filters.search}
                onChange={(event) => setFilters({ ...filters, search: event.target.value })}
                placeholder="Search roles..."
                className="w-full bg-transparent text-sm text-[#251E1F] outline-none placeholder:text-[#9c7b72]"
              />
            </div>
          </label>
          <select
            value={filters.status}
            onChange={(event) => setFilters({ ...filters, status: event.target.value })}
            className="rounded-lg border border-[#ead6cf] bg-white px-3 py-2 text-sm text-[#251E1F] outline-none"
          >
            <option value="">Status: All</option>
            {options.statuses.map((status) => (
              <option key={status.value} value={status.value}>
                Status: {status.label}
              </option>
            ))}
          </select>
          <select
            value={filters.accessLevel}
            onChange={(event) => setFilters({ ...filters, accessLevel: event.target.value })}
            className="rounded-lg border border-[#ead6cf] bg-white px-3 py-2 text-sm text-[#251E1F] outline-none"
          >
            <option value="">Access Level: All</option>
            {options.accessLevels.map((accessLevel) => (
              <option key={accessLevel} value={accessLevel}>
                Access Level: {accessLevel}
              </option>
            ))}
          </select>
          <select
            value={filters.sort}
            onChange={(event) => setFilters({ ...filters, sort: event.target.value })}
            className="rounded-lg border border-[#ead6cf] bg-white px-3 py-2 text-sm text-[#251E1F] outline-none"
          >
            {options.sortOptions.map((sortOption) => (
              <option key={sortOption.value} value={sortOption.value}>
                Sort by: {sortOption.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={applyFilters}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#ead6cf] px-4 py-2 text-sm font-bold text-[#6f4f47] hover:bg-[#fff3ef]"
          >
            <Filter size={16} />
            Filters
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-[#FDD9CD] bg-[#FDD9CD] px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-visible rounded-xl border border-[#f0d2ca] bg-white/95 shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[#f0d2ca] bg-[#fff8f5] text-xs font-bold uppercase tracking-wide text-[#6f4f47]">
              <tr>
                <th className="px-4 py-3">Role Name</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Assigned Users</th>
                <th className="px-4 py-3">Access Level</th>
                <th className="px-4 py-3">Key Modules</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f3ded7]">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-4 py-12 text-center text-[#7b6660]">
                    Loading roles...
                  </td>
                </tr>
              ) : roles.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-6">
                    <EmptyState>No roles found for the selected filters.</EmptyState>
                  </td>
                </tr>
              ) : (
                roles.map((role) => {
                  const visual = roleVisuals[role.roleName] || roleVisuals.Staff;
                  const Icon = visual.icon;

                  return (
                    <tr key={role.roleId} className="text-[#251E1F]">
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
                            style={{ backgroundColor: visual.color }}
                          >
                            <Icon size={18} />
                          </div>
                          <span className="font-bold">{role.roleName}</span>
                        </div>
                      </td>
                      <td className="min-w-64 px-4 py-3 text-[#514440]">{role.description}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="inline-flex items-center gap-2 text-[#514440]">
                          <Users size={16} />
                          {formatCount(role.assignedUsers)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className={`rounded-md border px-2 py-1 text-xs font-bold ${accessBadgeClass(role.accessLevel)}`}>
                          {role.accessLevel}
                        </span>
                      </td>
                      <td className="min-w-72 px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {role.keyModules.map((moduleName) => (
                            <span
                              key={moduleName}
                              className="rounded-md border border-[#ead6cf] bg-[#fff8f5] px-2 py-1 text-xs font-semibold text-[#6f4f47]"
                            >
                              {moduleName}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className={`inline-flex items-center gap-2 text-sm font-bold ${role.isActive ? "text-[#4d8c57]" : "text-[#a55b52]"}`}>
                          <span className={`h-2 w-2 rounded-full ${role.isActive ? "bg-[#4d8c57]" : "bg-[#a55b52]"}`} />
                          {role.statusLabel}
                        </span>
                      </td>
                      <td className="relative whitespace-nowrap px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setOpenMenuId(openMenuId === role.roleId ? null : role.roleId)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#ead6cf] text-[#6f4f47] hover:bg-[#fff3ef]"
                          aria-label={`Open actions for ${role.roleName}`}
                        >
                          <MoreVertical size={17} />
                        </button>
                        {openMenuId === role.roleId ? (
                          <div className="absolute right-4 top-12 z-20 w-52 overflow-hidden rounded-lg border border-[#ead6cf] bg-white text-left shadow-[0_18px_45px_rgba(37,30,31,0.16)]">
                            {actionItems.map((item) => {
                              const ActionIcon = item.icon;

                              return (
                                <button
                                  key={item.label}
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    navigate(item.path(role));
                                  }}
                                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold hover:bg-[#fff3ef] ${
                                    item.danger ? "text-[#d84e40]" : "text-[#251E1F]"
                                  }`}
                                >
                                  <ActionIcon size={16} />
                                  {item.label}
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-xl border border-[#f0d2ca] bg-white/95 p-5 shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h3 className="text-base font-bold text-[#251E1F]">Recent Role Activity</h3>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-[#ead6cf] px-3 py-1.5 text-xs font-bold text-[#6f4f47] hover:bg-[#fff3ef]"
            >
              View All
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="space-y-3">
            {activity.length === 0 ? (
              <EmptyState>No recent role activity found.</EmptyState>
            ) : (
              activity.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-4 border-b border-[#f3ded7] pb-3 last:border-b-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[#251E1F]">{item.actionDescription}</p>
                    <p className="mt-1 text-xs text-[#7b6660]">By {item.actorName || "System"}</p>
                  </div>
                  <time className="shrink-0 text-right text-xs font-semibold text-[#7b6660]">
                    {formatDate(item.createdAt)}
                  </time>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-[#f0d2ca] bg-white/95 p-5 shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
          <h3 className="mb-4 text-base font-bold text-[#251E1F]">Role Distribution</h3>
          <RoleDistribution roles={distribution} />
        </section>
      </div>
    </section>
  );
}
