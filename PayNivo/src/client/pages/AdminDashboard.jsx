import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api.js";

const fallback = { metrics: [], users: [], roles: [], payrollRates: [], invoiceSettings: [], reminderSettings: [], systemSettings: {}, reports: [], auditLogs: [], emailLogs: [] };

const navigation = [
  { group: "MAIN", items: [{ id: "overview", label: "Dashboard", icon: "D" }] },
  { group: "ADMIN", items: [{ id: "users", label: "Users", icon: "U" }, { id: "payroll", label: "Payroll Settings", icon: "P" }] },
  { group: "INVOICING", items: [{ id: "invoice", label: "Invoice Settings", icon: "I" }, { id: "reminders", label: "Reminder Settings", icon: "R" }] },
  { group: "MONITORING", items: [{ id: "audit", label: "Audit Logs", icon: "A" }, { id: "emails", label: "Email Logs", icon: "E" }] },
  { group: "REPORTS", items: [{ id: "reports", label: "Reports", icon: "B" }] },
  { group: "SYSTEM", items: [{ id: "system", label: "System Settings", icon: "S" }] }
];

const pageTitles = {
  overview: "Automated Invoicing System - Admin Dashboard",
  users: "Automated Invoicing System - User Management",
  payroll: "Automated Payroll System - Payroll Settings",
  invoice: "Automated Invoicing System - Invoice Settings",
  reminders: "Automated Invoicing System - Reminder Settings",
  reports: "Automated Invoicing System - Reports",
  audit: "Automated Invoicing System - Audit Logs",
  emails: "Automated Invoicing System - Email Logs",
  system: "Automated Invoicing System - System Settings"
};

const moduleRequirements = ["Manage user accounts and roles", "Configure payroll rates", "Manage invoice settings", "Configure reminder settings", "View dashboard and system overview", "View and export reports", "View audit logs", "Manage system settings", "Monitor email notification logs"];

function IconBox({ children, tone = "blue" }) {
  const tones = { blue: "bg-blue-600", green: "bg-emerald-500", amber: "bg-orange-500", purple: "bg-violet-500", teal: "bg-cyan-500", red: "bg-red-500", slate: "bg-slate-600" };
  return <span className={`grid h-9 w-9 place-items-center rounded-lg text-xs font-black text-white ${tones[tone]}`}>{children}</span>;
}

function Pill({ children, tone = "slate" }) {
  const tones = { green: "bg-emerald-50 text-emerald-700 ring-emerald-200", blue: "bg-blue-50 text-blue-700 ring-blue-200", amber: "bg-amber-50 text-amber-800 ring-amber-200", red: "bg-red-50 text-red-700 ring-red-200", slate: "bg-slate-100 text-slate-700 ring-slate-200" };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${tones[tone]}`}>{children}</span>;
}

function Field({ value, onChange, placeholder, type = "text" }) {
  return <input type={type} value={value ?? ""} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />;
}

function Select({ value, onChange, children }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">{children}</select>;
}

function ActionButton({ children, variant = "primary", ...props }) {
  const styles = variant === "primary" ? "bg-blue-600 text-white hover:bg-blue-700" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50";
  return <button {...props} className={`h-10 rounded-md px-4 text-sm font-black transition ${styles}`}>{children}</button>;
}

function Panel({ children, className = "" }) {
  return <section className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>{children}</section>;
}

function PanelHeader({ title, description, action }) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-base font-black text-slate-950">{title}</h2>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function StatCard({ label, value, hint, tone, icon }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <IconBox tone={tone}>{icon}</IconBox>
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
          <p className="mt-1 text-xs font-semibold text-emerald-600">{hint}</p>
        </div>
      </div>
    </article>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState(fallback);
  const [activeTab, setActiveTab] = useState("overview");
  const [message, setMessage] = useState("");
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "Finance" });
  const [report, setReport] = useState({ name: "Admin overview report", format: "Excel" });

  useEffect(() => {
    api.get("/admin/dashboard")
      .then((response) => setData({ ...fallback, ...response.data }))
      .catch((err) => setMessage(err.response?.data?.message || "Unable to load Admin dashboard."));
  }, []);

  const pageTitle = pageTitles[activeTab] || pageTitles.overview;

  function apply(response, success) {
    setData({ ...fallback, ...response.data.dashboard });
    setMessage(success);
  }

  async function saveUser(user) {
    const response = await api.patch(`/admin/users/${user.id}`, user);
    apply(response, `Saved ${user.name}.`);
  }

  async function createUser(event) {
    event.preventDefault();
    const response = await api.post("/admin/users", newUser);
    apply(response, `Created ${newUser.name}.`);
    setNewUser({ name: "", email: "", role: "Finance" });
  }

  async function savePatch(path, payload, success) {
    const response = await api.patch(path, payload);
    apply(response, success);
  }

  async function saveCpfTiers(rates) {
    const response = await api.patch("/admin/payroll-rates/cpf-tiers", { rates });
    apply(response, "CPF tiers saved.");
  }

  async function generateReport(event) {
    event.preventDefault();
    const response = await api.post("/admin/reports", report);
    apply(response, "Report generated.");
  }

  async function exportReports() {
    const response = await api.get("/admin/reports/export.csv", { responseType: "blob" });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = "admin-reports.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="border-r border-slate-200 bg-white lg:sticky lg:top-0 lg:h-screen">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5">
          <IconBox>PN</IconBox>
          <div>
            <p className="text-sm font-black leading-4 text-slate-950">Automated Invoicing</p>
            <p className="text-sm font-black leading-4 text-slate-950">& Payroll System</p>
          </div>
        </div>

        <nav className="space-y-5 px-4 py-5">
          {navigation.map((group) => (
            <div key={group.group}>
              <p className="mb-2 px-2 text-[11px] font-black uppercase tracking-wide text-slate-400">{group.group}</p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-bold transition ${activeTab === item.id ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"}`}>
                    <span className={`grid h-6 w-6 place-items-center rounded-md text-[11px] font-black ${activeTab === item.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto hidden border-t border-slate-100 px-5 py-5 text-sm font-semibold text-slate-500 lg:block">Collapse</div>
      </aside>

      <main className="min-w-0">
        <header className="sticky top-0 z-10 flex flex-col gap-3 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <button className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 text-slate-600">=</button>
            <h1 className="text-lg font-black text-slate-950">{pageTitle}</h1>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative sm:w-80">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">Q</span>
              <input className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Search invoices, users, settings..." />
            </div>
            <button className="grid h-10 w-10 place-items-center rounded-md border border-slate-200 text-slate-600">N</button>
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-blue-100 text-sm font-black text-blue-700">AU</div>
              <div className="hidden sm:block">
                <p className="text-sm font-black text-slate-950">Admin User</p>
                <p className="text-xs text-slate-500">Administrator</p>
              </div>
            </div>
          </div>
        </header>

        <div className="space-y-5 p-5">
          {message && <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">{message}</div>}

          {activeTab === "overview" && <Overview data={data} />}
          {activeTab === "users" && <Users data={data} setData={setData} newUser={newUser} setNewUser={setNewUser} createUser={createUser} saveUser={saveUser} />}
          {activeTab === "payroll" && <PayrollRates items={data.payrollRates} setData={setData} onSave={(item) => savePatch(`/admin/payroll-rates/${item.id}`, item, `Saved ${item.label}.`)} onSaveAll={saveCpfTiers} />}
          {activeTab === "invoice" && <EditableSettings title="Invoice Settings" description="Configure invoice defaults and preferences for automated invoice generation." items={data.invoiceSettings} dataKey="invoiceSettings" setData={setData} onSave={(item) => savePatch(`/admin/invoice-settings/${item.id}`, item, `Saved ${item.label}.`)} />}
          {activeTab === "reminders" && <EditableSettings title="Reminder Settings" description="Configure automated reminder schedules and delivery rules." items={data.reminderSettings} dataKey="reminderSettings" setData={setData} onSave={(item) => savePatch(`/admin/reminder-settings/${item.id}`, item, `Saved ${item.label}.`)} />}
          {activeTab === "reports" && <Reports data={data} report={report} setReport={setReport} generateReport={generateReport} exportReports={exportReports} />}
          {activeTab === "audit" && <LogList title="Audit Logs" description="Monitor system activities and maintain accountability through comprehensive audit trails." items={data.auditLogs} fields={["id", "actor", "action", "area", "time"]} />}
          {activeTab === "emails" && <LogList title="Email Logs" description="Monitor email notification delivery and queued messages." items={data.emailLogs} fields={["id", "recipient", "subject", "status", "sentAt"]} />}
          {activeTab === "system" && <SystemSettings data={data} setData={setData} onSave={() => savePatch("/admin/system-settings", data.systemSettings, "System settings saved.")} />}
        </div>
      </main>
    </div>
  );
}

function Overview({ data }) {
  const tones = ["blue", "green", "amber", "purple"];
  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.metrics.map((metric, index) => <StatCard key={metric.label} label={metric.label} value={metric.value} hint={metric.hint} tone={tones[index % tones.length]} icon={String(index + 1)} />)}
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel>
          <PanelHeader title="Admin Functional Requirements" description="System modules available to the administrator." />
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            {moduleRequirements.map((item, index) => (
              <div key={item} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-700">
                <IconBox tone={["blue", "green", "amber", "purple", "teal"][index % 5]}>{index + 1}</IconBox>
                {item}
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Recent System Activities" action={<button className="text-sm font-black text-blue-600">View all</button>} />
          <div className="divide-y divide-slate-100">
            {data.auditLogs.slice(0, 5).map((item) => (
              <div key={item.id} className="flex items-start gap-3 px-5 py-3">
                <IconBox tone="blue">A</IconBox>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-slate-900">{item.action}</p>
                  <p className="text-xs text-slate-500">{item.actor} - {item.area}</p>
                </div>
                <p className="text-xs text-slate-400">{item.time}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Users({ data, setData, newUser, setNewUser, createUser, saveUser }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Users" value={data.users.length} hint="System accounts" tone="blue" icon="U" />
          <StatCard label="Active Users" value={data.users.filter((user) => user.status === "Active").length} hint="Available accounts" tone="green" icon="A" />
          <StatCard label="Disabled Users" value={data.users.filter((user) => user.status !== "Active").length} hint="Suspended accounts" tone="red" icon="D" />
          <StatCard label="Roles" value={data.roles.length} hint="Admin / Finance / HR" tone="purple" icon="R" />
        </section>

        <Panel>
          <PanelHeader title="User Management" description="Manage user accounts, roles, and system access permissions." action={<ActionButton form="create-user">Add New User</ActionButton>} />
          <form id="create-user" onSubmit={createUser} className="grid gap-3 border-b border-slate-100 p-5 lg:grid-cols-[1fr_1fr_180px]">
            <Field value={newUser.name} onChange={(value) => setNewUser((current) => ({ ...current, name: value }))} placeholder="Name" />
            <Field value={newUser.email} onChange={(value) => setNewUser((current) => ({ ...current, email: value }))} placeholder="Email" />
            <Select value={newUser.role} onChange={(value) => setNewUser((current) => ({ ...current, role: value }))}>{data.roles.map((role) => <option key={role.role}>{role.role}</option>)}</Select>
          </form>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                <tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Email</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">MFA</th><th className="px-5 py-3">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-5 py-3"><Field value={user.name} onChange={(value) => setData((current) => ({ ...current, users: current.users.map((item) => item.id === user.id ? { ...item, name: value } : item) }))} /></td>
                    <td className="px-5 py-3"><Field value={user.email} onChange={(value) => setData((current) => ({ ...current, users: current.users.map((item) => item.id === user.id ? { ...item, email: value } : item) }))} /></td>
                    <td className="px-5 py-3"><Select value={user.role} onChange={(value) => setData((current) => ({ ...current, users: current.users.map((item) => item.id === user.id ? { ...item, role: value } : item) }))}>{data.roles.map((role) => <option key={role.role}>{role.role}</option>)}</Select></td>
                    <td className="px-5 py-3"><Select value={user.status} onChange={(value) => setData((current) => ({ ...current, users: current.users.map((item) => item.id === user.id ? { ...item, status: value } : item) }))}><option>Active</option><option>Suspended</option></Select></td>
                    <td className="px-5 py-3"><Pill tone={user.mfa === "Enabled" ? "green" : "amber"}>{user.mfa}</Pill></td>
                    <td className="px-5 py-3"><ActionButton variant="secondary" onClick={() => saveUser(user)}>Save</ActionButton></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Selected User Details" />
        <div className="space-y-4 p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-blue-100 text-sm font-black text-blue-700">AU</div>
            <div>
              <p className="font-black text-slate-950">Admin User</p>
              <p className="text-sm text-slate-500">admin@paynivo.com</p>
            </div>
          </div>
          <Pill tone="green">Active</Pill>
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Permissions</p>
            <div className="mt-3 space-y-2 text-sm font-semibold text-slate-700">
              {["Dashboard Access", "User Management", "Payroll Settings", "Reports Access", "Audit Logs"].map((item) => <p key={item}>{item}</p>)}
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function PayrollRates({ items, setData, onSave, onSaveAll }) {
  const cpfRates = items.filter((item) => item.totalRate !== undefined);
  const otherRates = items.filter((item) => item.totalRate === undefined);
  const wageBand = cpfRates.every((item) => item.wageBand === cpfRates[0]?.wageBand) ? cpfRates[0]?.wageBand || "" : "";
  const effectiveFrom = cpfRates.every((item) => item.effectiveFrom === cpfRates[0]?.effectiveFrom) ? cpfRates[0]?.effectiveFrom || "" : "";
  const totalEmployer = useMemo(() => cpfRates.reduce((sum, item) => sum + Number.parseFloat(item.employerRate || 0), 0).toFixed(1), [cpfRates]);
  const totalEmployee = useMemo(() => cpfRates.reduce((sum, item) => sum + Number.parseFloat(item.employeeRate || 0), 0).toFixed(1), [cpfRates]);

  function updateRate(id, field, value) {
    setData((current) => ({ ...current, payrollRates: current.payrollRates.map((entry) => entry.id === id ? { ...entry, [field]: value } : entry) }));
  }

  function updateAllCpfRates(field, value) {
    setData((current) => ({ ...current, payrollRates: current.payrollRates.map((entry) => entry.totalRate !== undefined ? { ...entry, [field]: value } : entry) }));
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="CPF Tiers" value={cpfRates.length} hint="Age bands configured" tone="blue" icon="C" />
          <StatCard label="Wage Band" value={wageBand.replace("Monthly wages ", "") || "-"} hint="Applied to all tiers" tone="green" icon="W" />
          <StatCard label="Employer Rates" value={`${totalEmployer}%`} hint="Across age tiers" tone="purple" icon="ER" />
          <StatCard label="Employee Rates" value={`${totalEmployee}%`} hint="Across age tiers" tone="amber" icon="EE" />
        </section>

        <Panel>
          <PanelHeader title="CPF Deduction Tiers" description="Default CPF rates for employees earning monthly wages above $750. This screen is prepared for payroll CPF linking in the next step." action={<ActionButton onClick={() => onSaveAll(cpfRates)}>Save CPF Tiers</ActionButton>} />
          <div className="grid gap-3 border-b border-slate-100 p-5 lg:grid-cols-2">
            <label>
              <span className="text-sm font-bold text-slate-700">Wage band</span>
              <Field value={wageBand} onChange={(value) => updateAllCpfRates("wageBand", value)} placeholder="Monthly wages > $750" />
            </label>
            <label>
              <span className="text-sm font-bold text-slate-700">Effective from</span>
              <Field value={effectiveFrom} onChange={(value) => updateAllCpfRates("effectiveFrom", value)} placeholder="1 Jan 2026" />
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                <tr><th className="px-5 py-3">Employee Age</th><th className="px-5 py-3">Total</th><th className="px-5 py-3">Employer</th><th className="px-5 py-3">Employee</th><th className="px-5 py-3">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cpfRates.map((item) => (
                  <tr key={item.id}>
                    <td className="px-5 py-3 font-black text-slate-950">{item.label}</td>
                    <td className="px-5 py-3"><Field value={item.totalRate} onChange={(value) => updateRate(item.id, "totalRate", value)} /></td>
                    <td className="px-5 py-3"><Field value={item.employerRate} onChange={(value) => updateRate(item.id, "employerRate", value)} /></td>
                    <td className="px-5 py-3"><Field value={item.employeeRate} onChange={(value) => updateRate(item.id, "employeeRate", value)} /></td>
                    <td className="px-5 py-3"><ActionButton variant="secondary" onClick={() => onSave(item)}>Save</ActionButton></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {otherRates.length > 0 && <InlinePayrollSettings otherRates={otherRates} updateRate={updateRate} onSave={onSave} />}
      </div>

      <Panel>
        <PanelHeader title="CPF Settings Preview" />
        <div className="space-y-4 p-5">
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Effective Date</p>
            <p className="mt-1 text-lg font-black text-slate-950">{effectiveFrom || "-"}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Wage Band</p>
            <p className="mt-1 text-lg font-black text-slate-950">{wageBand || "-"}</p>
          </div>
          <div className="space-y-2">
            {cpfRates.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
                <span className="font-bold text-slate-700">{item.label}</span>
                <span className="font-black text-slate-950">{item.totalRate}</span>
              </div>
            ))}
          </div>
        </div>
      </Panel>
    </div>
  );
}

function InlinePayrollSettings({ otherRates, updateRate, onSave }) {
  return (
    <Panel>
      <PanelHeader title="Other Payroll Rates" />
      <div className="divide-y divide-slate-100">
        {otherRates.map((item) => (
          <div key={item.id} className="grid gap-3 p-5 lg:grid-cols-[1fr_160px_1.5fr_auto] lg:items-center">
            <strong className="text-sm text-slate-950">{item.label}</strong>
            <Field value={item.value} onChange={(value) => updateRate(item.id, "value", value)} />
            <Field value={item.scope} onChange={(value) => updateRate(item.id, "scope", value)} />
            <ActionButton variant="secondary" onClick={() => onSave(item)}>Save</ActionButton>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function EditableSettings({ title, description, items, dataKey, setData, onSave }) {
  return (
    <Panel>
      <PanelHeader title={title} description={description} />
      <div className="divide-y divide-slate-100">
        {items.map((item) => (
          <div key={item.id} className="grid gap-3 p-5 lg:grid-cols-[1fr_180px_1.5fr_auto] lg:items-center">
            <strong className="text-sm text-slate-950">{item.label}</strong>
            <Field value={item.value} onChange={(value) => setData((current) => ({ ...current, [dataKey]: current[dataKey].map((entry) => entry.id === item.id ? { ...entry, value } : entry) }))} />
            <Field value={item.detail || item.scope} onChange={(value) => setData((current) => ({ ...current, [dataKey]: current[dataKey].map((entry) => entry.id === item.id ? { ...entry, detail: entry.detail !== undefined ? value : entry.detail, scope: entry.scope !== undefined ? value : entry.scope } : entry) }))} />
            <ActionButton variant="secondary" onClick={() => onSave(item)}>Save</ActionButton>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Reports({ data, report, setReport, generateReport, exportReports }) {
  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Generated Reports" value={data.reports.length} hint="Available exports" tone="blue" icon="R" />
        <StatCard label="Ready Reports" value={data.reports.filter((item) => item.status === "Ready").length} hint="Ready to download" tone="green" icon="G" />
      </section>
      <Panel>
        <PanelHeader title="View and Export Reports" description="Generate administration reports and export report records." />
        <form onSubmit={generateReport} className="grid gap-3 border-b border-slate-100 p-5 sm:grid-cols-[1fr_180px_auto_auto]">
          <Field value={report.name} onChange={(value) => setReport((current) => ({ ...current, name: value }))} />
          <Select value={report.format} onChange={(value) => setReport((current) => ({ ...current, format: value }))}><option>Excel</option><option>PDF</option><option>CSV</option></Select>
          <ActionButton>Generate</ActionButton>
          <ActionButton type="button" variant="secondary" onClick={exportReports}>Export CSV</ActionButton>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
              <tr><th className="px-5 py-3">ID</th><th className="px-5 py-3">Name</th><th className="px-5 py-3">Period</th><th className="px-5 py-3">Format</th><th className="px-5 py-3">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.reports.map((item) => <tr key={item.id}><td className="px-5 py-3 font-black">{item.id}</td><td className="px-5 py-3">{item.name}</td><td className="px-5 py-3">{item.period}</td><td className="px-5 py-3">{item.format}</td><td className="px-5 py-3"><Pill tone="green">{item.status}</Pill></td></tr>)}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function LogList({ title, description, items, fields }) {
  return (
    <Panel>
      <PanelHeader title={title} description={description} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
            <tr>{fields.map((field) => <th key={field} className="px-5 py-3 capitalize">{field.replace(/([A-Z])/g, " $1")}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => <tr key={item.id}>{fields.map((field) => <td key={field} className="px-5 py-3 text-slate-700">{item[field]}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function SystemSettings({ data, setData, onSave }) {
  return (
    <Panel>
      <PanelHeader title="System Settings" description="Manage platform-level settings used across PayNivo." action={<ActionButton onClick={onSave}>Save System Settings</ActionButton>} />
      <div className="grid gap-4 p-5 md:grid-cols-2">
        {Object.entries(data.systemSettings).map(([key, value]) => (
          <label key={key}>
            <span className="text-sm font-bold capitalize text-slate-700">{key.replace(/([A-Z])/g, " $1")}</span>
            <Field value={value} onChange={(next) => setData((current) => ({ ...current, systemSettings: { ...current.systemSettings, [key]: next } }))} />
          </label>
        ))}
      </div>
    </Panel>
  );
}
