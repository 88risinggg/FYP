import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api.js";

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "users", label: "Users & roles" },
  { id: "settings", label: "Settings" },
  { id: "approvals", label: "Approvals" },
  { id: "audit", label: "Audit logs" }
];

const fallbackData = {
  metrics: [],
  users: [],
  roles: [],
  payrollRates: [],
  invoiceSettings: [],
  manualPayments: [],
  auditLogs: [],
  systemSettings: {}
};

function StatusPill({ children, tone = "slate" }) {
  const tones = {
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    amber: "bg-amber-50 text-amber-800 ring-amber-100",
    red: "bg-red-50 text-red-700 ring-red-100",
    plum: "bg-brand-50 text-brand-700 ring-brand-100",
    slate: "bg-slate-100 text-slate-700 ring-slate-200"
  };

  return (
    <span className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-bold ring-1 ${tones[tone]}`}>
      {children}
    </span>
  );
}

function MetricCard({ label, value, hint }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{hint}</p>
    </article>
  );
}

function EmptyState({ message }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
      {message}
    </div>
  );
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [data, setData] = useState(fallbackData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const pendingPayments = useMemo(
    () => data.manualPayments.filter((payment) => payment.status === "Pending approval"),
    [data.manualPayments]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError("");
      try {
        const response = await api.get("/admin/dashboard");
        if (!cancelled) {
          setData({ ...fallbackData, ...response.data });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || "Unable to load admin dashboard data.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDashboard();
    return () => {
      cancelled = true;
    };
  }, []);

  async function updateUserStatus(user) {
    const nextStatus = user.status === "Active" ? "Suspended" : "Active";
    setActionMessage("");

    try {
      const response = await api.patch(`/admin/users/${user.id}/status`, { status: nextStatus });
      setData((current) => ({
        ...current,
        users: current.users.map((item) => (item.id === user.id ? response.data.user : item)),
        auditLogs: response.data.auditLogs || current.auditLogs
      }));
      setActionMessage(`${user.name} is now ${nextStatus.toLowerCase()}.`);
    } catch (err) {
      setActionMessage(err.response?.data?.message || "Unable to update user status.");
    }
  }

  async function approvePayment(payment) {
    setActionMessage("");

    try {
      const response = await api.patch(`/admin/payments/${payment.id}/approve`);
      setData((current) => ({
        ...current,
        manualPayments: response.data.manualPayments || current.manualPayments,
        auditLogs: response.data.auditLogs || current.auditLogs
      }));
      setActionMessage(`${payment.id} has been approved.`);
    } catch (err) {
      setActionMessage(err.response?.data?.message || "Unable to approve payment.");
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-brand-600">Admin</p>
            <h1 className="mt-2 text-3xl font-black text-slate-950 sm:text-4xl">Admin Control Centre</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
              Manage user accounts, role access, payroll rates, invoice settings, manual payment approvals, audit logs, and system settings from one admin workspace.
            </p>
          </div>
          <div className="grid gap-2 rounded-lg bg-slate-950 p-4 text-sm text-white shadow-lg shadow-slate-900/10 sm:min-w-64">
            <div className="flex items-center justify-between gap-4">
              <span className="text-white/70">Verification code login</span>
              <span className="font-black">{data.systemSettings.verificationCodeLogin || "Enabled"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-white/70">Session timeout</span>
              <span className="font-black">{data.systemSettings.sessionTimeout || "8 hours"}</span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {actionMessage && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
          {actionMessage}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-black transition ${
              activeTab === tab.id
                ? "bg-brand-600 text-white shadow-sm shadow-brand-600/20"
                : "text-slate-600 hover:bg-brand-50 hover:text-brand-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-500 shadow-sm">
          Loading admin data...
        </div>
      ) : (
        <>
          {activeTab === "overview" && (
            <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black text-slate-950">Admin functional requirements</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[
                    "Secure login with verification code",
                    "Manage user accounts and roles",
                    "Configure payroll rates",
                    "Manage invoice settings",
                    "Configure reminder settings",
                    "View dashboard and system overview",
                    "View and export reports",
                    "View audit logs",
                    "Approve manual payments",
                    "Manage system settings",
                    "Monitor email notification logs"
                  ].map((item) => (
                    <div key={item} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                      {item}
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-black text-slate-950">Pending manual payments</h2>
                  <StatusPill tone={pendingPayments.length ? "amber" : "green"}>{pendingPayments.length} pending</StatusPill>
                </div>
                <div className="mt-4 space-y-3">
                  {pendingPayments.length === 0 ? (
                    <EmptyState message="No manual payments pending approval." />
                  ) : (
                    pendingPayments.map((payment) => (
                      <div key={payment.id} className="rounded-lg border border-slate-200 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="font-black text-slate-950">{payment.invoiceNo}</p>
                            <p className="mt-1 text-sm text-slate-600">{payment.customer} - {payment.method}</p>
                          </div>
                          <p className="font-black text-slate-950">{payment.amount}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          )}

          {activeTab === "users" && (
            <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
              <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 p-5">
                  <h2 className="text-lg font-black text-slate-950">User accounts</h2>
                  <p className="mt-1 text-sm text-slate-500">Activate or suspend demo accounts and verify MFA status.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">User</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">MFA</th>
                        <th className="px-4 py-3">Last login</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.users.map((user) => (
                        <tr key={user.id}>
                          <td className="px-4 py-3">
                            <p className="font-black text-slate-950">{user.name}</p>
                            <p className="text-xs text-slate-500">{user.email}</p>
                          </td>
                          <td className="px-4 py-3"><StatusPill tone="plum">{user.role}</StatusPill></td>
                          <td className="px-4 py-3">{user.mfa}</td>
                          <td className="px-4 py-3 text-slate-600">{user.lastLogin}</td>
                          <td className="px-4 py-3">
                            <StatusPill tone={user.status === "Active" ? "green" : "red"}>{user.status}</StatusPill>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => updateUserStatus(user)}
                              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-black text-brand-700 hover:bg-brand-50"
                            >
                              {user.status === "Active" ? "Suspend" : "Activate"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black text-slate-950">Role permissions</h2>
                <div className="mt-4 space-y-3">
                  {data.roles.map((role) => (
                    <div key={role.role} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-black text-slate-950">{role.role}</p>
                        <StatusPill>{role.users} user</StatusPill>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{role.permissions.join(", ")}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="grid gap-5 lg:grid-cols-2">
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black text-slate-950">Payroll rates</h2>
                <div className="mt-4 space-y-3">
                  {data.payrollRates.map((rate) => (
                    <div key={rate.label} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-black text-slate-950">{rate.label}</p>
                        <StatusPill tone="plum">{rate.value}</StatusPill>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{rate.scope}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black text-slate-950">Invoice and reminder settings</h2>
                <div className="mt-4 space-y-3">
                  {data.invoiceSettings.map((setting) => (
                    <div key={setting.label} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-black text-slate-950">{setting.label}</p>
                        <StatusPill tone={setting.label.includes("Reminder") ? "amber" : "blue"}>{setting.value}</StatusPill>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{setting.detail}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeTab === "approvals" && (
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-slate-950">Manual payment approvals</h2>
              <div className="mt-4 grid gap-3">
                {data.manualPayments.map((payment) => (
                  <div key={payment.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_auto] lg:items-center">
                      <div>
                        <p className="font-black text-slate-950">{payment.id} - {payment.invoiceNo}</p>
                        <p className="mt-1 text-sm text-slate-600">{payment.customer}</p>
                      </div>
                      <div className="grid gap-1 text-sm text-slate-600 sm:grid-cols-3 lg:grid-cols-1">
                        <span>{payment.method}</span>
                        <span className="font-black text-slate-950">{payment.amount}</span>
                        <span>{payment.proof}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusPill tone={payment.status === "Approved" ? "green" : "amber"}>{payment.status}</StatusPill>
                        {payment.status !== "Approved" && (
                          <button
                            type="button"
                            onClick={() => approvePayment(payment)}
                            className="rounded-md bg-brand-600 px-3 py-2 text-xs font-black text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700"
                          >
                            Approve
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeTab === "audit" && (
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-slate-950">Audit logs</h2>
              <div className="mt-4 space-y-3">
                {data.auditLogs.map((log) => (
                  <div key={log.id} className="grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-[0.7fr_1.4fr_0.8fr_0.8fr] sm:items-center">
                    <p className="font-black text-slate-950">{log.id}</p>
                    <div>
                      <p className="font-semibold text-slate-800">{log.action}</p>
                      <p className="text-sm text-slate-500">{log.actor}</p>
                    </div>
                    <StatusPill tone="blue">{log.area}</StatusPill>
                    <p className="text-sm text-slate-500">{log.time}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </section>
  );
}
