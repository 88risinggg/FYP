import { useEffect, useState } from "react";
import { api } from "../services/api.js";

const fallback = { metrics: [], users: [], roles: [], payrollRates: [], invoiceSettings: [], reminderSettings: [], systemSettings: {}, reports: [], auditLogs: [], emailLogs: [] };
const tabs = ["overview", "users", "payroll", "invoice", "reminders", "reports", "audit", "system", "emails"];

function Pill({ children, tone = "slate" }) {
  const tones = { green: "bg-emerald-50 text-emerald-700", blue: "bg-blue-50 text-blue-700", amber: "bg-amber-50 text-amber-800", red: "bg-red-50 text-red-700", slate: "bg-slate-100 text-slate-700" };
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${tones[tone]}`}>{children}</span>;
}

function Field({ value, onChange, placeholder }) {
  return <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20" />;
}

function Select({ value, onChange, children }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20">{children}</select>;
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
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-black uppercase tracking-wide text-brand-600">Admin</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">Admin Control Centre</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Manage user accounts and roles, payroll rates, invoice settings, reminder settings, reports, audit logs, system settings, and email notification logs.</p>
      </header>

      {message && <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">{message}</div>}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.metrics.map((metric) => <article key={metric.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{metric.label}</p><p className="mt-2 text-3xl font-black text-slate-950">{metric.value}</p><p className="mt-1 text-sm text-slate-500">{metric.hint}</p></article>)}
      </section>

      <nav className="flex gap-2 overflow-x-auto rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
        {tabs.map((tab) => <button key={tab} onClick={() => setActiveTab(tab)} className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-black capitalize ${activeTab === tab ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-brand-50 hover:text-brand-700"}`}>{tab}</button>)}
      </nav>

      {activeTab === "overview" && <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black text-slate-950">Admin functional requirements</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{["Manage user accounts and roles", "Configure payroll rates", "Manage invoice settings", "Configure reminder settings", "View dashboard and system overview", "View and export reports", "View audit logs", "Manage system settings", "Monitor email notification logs"].map((item) => <div key={item} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">{item}</div>)}</div></section>}

      {activeTab === "users" && <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black text-slate-950">Manage user accounts and roles</h2><form onSubmit={createUser} className="grid gap-3 lg:grid-cols-[1fr_1fr_0.6fr_auto]"><Field value={newUser.name} onChange={(value) => setNewUser((current) => ({ ...current, name: value }))} placeholder="Name" /><Field value={newUser.email} onChange={(value) => setNewUser((current) => ({ ...current, email: value }))} placeholder="Email" /><Select value={newUser.role} onChange={(value) => setNewUser((current) => ({ ...current, role: value }))}>{data.roles.map((role) => <option key={role.role}>{role.role}</option>)}</Select><button className="rounded-md bg-brand-600 px-4 py-2 text-sm font-black text-white">Create user</button></form><div className="grid gap-3">{data.users.map((user) => <div key={user.id} className="grid gap-3 rounded-lg border border-slate-200 p-4 lg:grid-cols-[1fr_1fr_0.7fr_0.7fr_0.7fr_auto] lg:items-center"><Field value={user.name} onChange={(value) => setData((current) => ({ ...current, users: current.users.map((item) => item.id === user.id ? { ...item, name: value } : item) }))} /><Field value={user.email} onChange={(value) => setData((current) => ({ ...current, users: current.users.map((item) => item.id === user.id ? { ...item, email: value } : item) }))} /><Select value={user.role} onChange={(value) => setData((current) => ({ ...current, users: current.users.map((item) => item.id === user.id ? { ...item, role: value } : item) }))}>{data.roles.map((role) => <option key={role.role}>{role.role}</option>)}</Select><Select value={user.status} onChange={(value) => setData((current) => ({ ...current, users: current.users.map((item) => item.id === user.id ? { ...item, status: value } : item) }))}><option>Active</option><option>Suspended</option></Select><Pill tone={user.status === "Active" ? "green" : "red"}>{user.status}</Pill><button onClick={() => saveUser(user)} className="rounded-md border border-slate-200 px-3 py-2 text-sm font-black text-brand-700">Save</button></div>)}</div></section>}

      {activeTab === "payroll" && <PayrollRates items={data.payrollRates} onSave={(item) => savePatch(`/admin/payroll-rates/${item.id}`, item, `Saved ${item.label}.`)} onSaveAll={saveCpfTiers} setData={setData} />}
      {activeTab === "invoice" && <EditableList title="Manage invoice settings" items={data.invoiceSettings} onSave={(item) => savePatch(`/admin/invoice-settings/${item.id}`, item, `Saved ${item.label}.`)} setData={setData} dataKey="invoiceSettings" />}
      {activeTab === "reminders" && <EditableList title="Configure reminder settings" items={data.reminderSettings} onSave={(item) => savePatch(`/admin/reminder-settings/${item.id}`, item, `Saved ${item.label}.`)} setData={setData} dataKey="reminderSettings" />}

      {activeTab === "reports" && <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black text-slate-950">View and export reports</h2><form onSubmit={generateReport} className="mt-4 grid gap-3 sm:grid-cols-[1fr_0.5fr_auto_auto]"><Field value={report.name} onChange={(value) => setReport((current) => ({ ...current, name: value }))} /><Select value={report.format} onChange={(value) => setReport((current) => ({ ...current, format: value }))}><option>Excel</option><option>PDF</option><option>CSV</option></Select><button className="rounded-md bg-brand-600 px-4 py-2 text-sm font-black text-white">Generate</button><button type="button" onClick={exportReports} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-black text-brand-700">Export CSV</button></form><div className="mt-4 space-y-3">{data.reports.map((item) => <div key={item.id} className="grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-5"><strong>{item.id}</strong><span>{item.name}</span><span>{item.period}</span><span>{item.format}</span><Pill tone="green">{item.status}</Pill></div>)}</div></section>}

      {activeTab === "audit" && <LogList title="View audit logs" items={data.auditLogs} fields={["id", "actor", "action", "area", "time"]} />}
      {activeTab === "emails" && <LogList title="Monitor email notification logs" items={data.emailLogs} fields={["id", "recipient", "subject", "status", "sentAt"]} />}

      {activeTab === "system" && <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black text-slate-950">Manage system settings</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{Object.entries(data.systemSettings).map(([key, value]) => <label key={key} className="block"><span className="text-sm font-bold capitalize text-slate-700">{key.replace(/([A-Z])/g, " $1")}</span><Field value={value} onChange={(next) => setData((current) => ({ ...current, systemSettings: { ...current.systemSettings, [key]: next } }))} /></label>)}</div><button onClick={() => savePatch("/admin/system-settings", data.systemSettings, "System settings saved.")} className="mt-4 rounded-md bg-brand-600 px-4 py-2 text-sm font-black text-white">Save system settings</button></section>}
    </main>
  );
}

function EditableList({ title, items, dataKey, setData, onSave }) {
  return <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black text-slate-950">{title}</h2><div className="mt-4 grid gap-3">{items.map((item) => <div key={item.id} className="grid gap-3 rounded-lg border border-slate-200 p-4 lg:grid-cols-[0.8fr_0.7fr_1.4fr_auto] lg:items-center"><strong>{item.label}</strong><Field value={item.value} onChange={(value) => setData((current) => ({ ...current, [dataKey]: current[dataKey].map((entry) => entry.id === item.id ? { ...entry, value } : entry) }))} /><Field value={item.detail || item.scope} onChange={(value) => setData((current) => ({ ...current, [dataKey]: current[dataKey].map((entry) => entry.id === item.id ? { ...entry, detail: entry.detail !== undefined ? value : entry.detail, scope: entry.scope !== undefined ? value : entry.scope } : entry) }))} /><button onClick={() => onSave(item)} className="rounded-md border border-slate-200 px-3 py-2 text-sm font-black text-brand-700">Save</button></div>)}</div></section>;
}

function PayrollRates({ items, setData, onSave, onSaveAll }) {
  const cpfRates = items.filter((item) => item.totalRate !== undefined);
  const otherRates = items.filter((item) => item.totalRate === undefined);
  const wageBand = cpfRates.every((item) => item.wageBand === cpfRates[0]?.wageBand) ? cpfRates[0]?.wageBand || "" : "";
  const effectiveFrom = cpfRates.every((item) => item.effectiveFrom === cpfRates[0]?.effectiveFrom) ? cpfRates[0]?.effectiveFrom || "" : "";

  function updateRate(id, field, value) {
    setData((current) => ({
      ...current,
      payrollRates: current.payrollRates.map((entry) => entry.id === id ? { ...entry, [field]: value } : entry)
    }));
  }

  function updateAllCpfRates(field, value) {
    setData((current) => ({
      ...current,
      payrollRates: current.payrollRates.map((entry) => entry.totalRate !== undefined ? { ...entry, [field]: value } : entry)
    }));
  }

  return (
    <section className="space-y-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-sm font-black uppercase tracking-wide text-brand-600">CPF deduction tiers</p>
        <h2 className="mt-1 text-lg font-black text-slate-950">2026 CPF contribution rates</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Admins can edit each contribution percentage when CPF Board rates change. Wage band and effective date apply to every CPF tier.</p>
      </div>

      <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
        <label>
          <span className="text-sm font-bold text-slate-700">Wage band</span>
          <Field value={wageBand} onChange={(value) => updateAllCpfRates("wageBand", value)} placeholder="Monthly wages > $750" />
        </label>
        <label>
          <span className="text-sm font-bold text-slate-700">Effective from</span>
          <Field value={effectiveFrom} onChange={(value) => updateAllCpfRates("effectiveFrom", value)} placeholder="1 Jan 2026" />
        </label>
        <button onClick={() => onSaveAll(cpfRates)} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-black text-white">Save CPF tiers</button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-[680px] w-full border-collapse bg-white text-left text-sm">
          <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Employee age</th>
              <th className="px-4 py-3">Total (% of wage)</th>
              <th className="px-4 py-3">By employer</th>
              <th className="px-4 py-3">By employee</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {cpfRates.map((item) => (
              <tr key={item.id} className="align-top">
                <td className="px-4 py-3 font-black text-slate-900">{item.label}</td>
                <td className="px-4 py-3"><Field value={item.totalRate} onChange={(value) => updateRate(item.id, "totalRate", value)} /></td>
                <td className="px-4 py-3"><Field value={item.employerRate} onChange={(value) => updateRate(item.id, "employerRate", value)} /></td>
                <td className="px-4 py-3"><Field value={item.employeeRate} onChange={(value) => updateRate(item.id, "employeeRate", value)} /></td>
                <td className="px-4 py-3"><button onClick={() => onSave(item)} className="rounded-md border border-slate-200 px-3 py-2 text-sm font-black text-brand-700">Save</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {otherRates.length > 0 && (
        <div>
          <h3 className="text-base font-black text-slate-950">Other payroll rates</h3>
          <div className="mt-3 grid gap-3">
            {otherRates.map((item) => (
              <div key={item.id} className="grid gap-3 rounded-lg border border-slate-200 p-4 lg:grid-cols-[0.8fr_0.7fr_1.4fr_auto] lg:items-center">
                <strong>{item.label}</strong>
                <Field value={item.value} onChange={(value) => updateRate(item.id, "value", value)} />
                <Field value={item.scope} onChange={(value) => updateRate(item.id, "scope", value)} />
                <button onClick={() => onSave(item)} className="rounded-md border border-slate-200 px-3 py-2 text-sm font-black text-brand-700">Save</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function LogList({ title, items, fields }) {
  return <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black text-slate-950">{title}</h2><div className="mt-4 space-y-3">{items.map((item) => <div key={item.id} className="grid gap-3 rounded-lg border border-slate-200 p-4 md:grid-cols-5">{fields.map((field) => <span key={field} className="text-sm text-slate-700">{item[field]}</span>)}</div>)}</div></section>;
}
