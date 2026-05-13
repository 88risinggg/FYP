import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4001";
const demoEmails = ["admin@paynivo.com", "finance@paynivo.com", "hr@paynivo.com", "staff@paynivo.com"];
const dashboardByRole = { Admin: "admin", Finance: "finance", HR: "hr", Staff: "staff" };
const money = (value) => `$${Number(value || 0).toFixed(2)}`;

function App() {
  const [session, setSession] = useState(() => JSON.parse(localStorage.getItem("paynivoSession") || "null"));
  const [page, setPage] = useState(() => (session ? dashboardByRole[session.user.role] : "login"));
  const [toast, setToast] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const api = useMemo(() => createApi(session?.token, setToast), [session?.token]);

  function saveSession(nextSession) {
    setSession(nextSession);
    localStorage.setItem("paynivoSession", JSON.stringify(nextSession));
    setPage(dashboardByRole[nextSession.user.role]);
  }

  function logout() {
    localStorage.removeItem("paynivoSession");
    setSession(null);
    setPage("login");
  }

  if (!session) {
    return <Login onLogin={saveSession} />;
  }

  return (
    <div className={`app-shell ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
      <Topbar user={session.user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <Sidebar user={session.user} page={page} setPage={setPage} onLogout={logout} sidebarOpen={sidebarOpen} />
      <main className="main">
        {toast && <div className="toast">{toast}</div>}
        {page === "admin" && <AdminDashboard api={api} setPage={setPage} />}
        {page === "finance" && <FinanceDashboard api={api} setPage={setPage} />}
        {page === "hr" && <HrDashboard api={api} setPage={setPage} />}
        {page === "staff" && <StaffDashboard api={api} setPage={setPage} user={session.user} />}
        {page === "payroll" && <PayrollPage api={api} user={session.user} />}
        {page === "invoice" && <InvoicePage api={api} />}
        {page === "payslip" && <PayslipPage api={api} user={session.user} />}
        {page === "reports" && <ReportsPage api={api} />}
        {page === "audit" && <AuditPage api={api} />}
      </main>
    </div>
  );
}

function createApi(token, setToast) {
  async function request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (!(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${API_URL}${path}`, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Request failed");
    return data;
  }
  return {
    request,
    notify(message) {
      setToast(message);
      window.setTimeout(() => setToast(""), 3000);
    }
  };
}

function Login({ onLogin }) {
  const [email, setEmail] = useState(demoEmails[0]);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "password" })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Login failed");
      onLogin(data);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div>
          <p className="eyebrow">Final Year Project Prototype</p>
          <h1>PayNivo</h1>
          <p className="muted">Automated invoicing and payroll for SME teams.</p>
        </div>
        <form onSubmit={submit} className="form-grid">
          <label>
            Demo account
            <select value={email} onChange={(event) => setEmail(event.target.value)}>
              {demoEmails.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="primary">Sign in</button>
          {error && <p className="error">{error}</p>}
          <p className="hint">All demo accounts use hardcoded login. Password is ignored for this prototype.</p>
        </form>
      </section>
    </main>
  );
}

function Sidebar({ user, page, setPage, onLogout, sidebarOpen }) {
  const roleHome = dashboardByRole[user.role];
  const links = [
    { id: roleHome, label: `${user.role} dashboard`, roles: ["Admin", "Finance", "HR", "Staff"] },
    { id: "payroll", label: "Payroll", roles: ["Admin", "HR", "Staff"] },
    { id: "invoice", label: "Invoices", roles: ["Admin", "Finance"] },
    { id: "payslip", label: "Payslips", roles: ["HR", "Staff", "Admin"] },
    { id: "reports", label: "Reports", roles: ["Admin", "Finance", "HR"] },
    { id: "audit", label: "Audit logs", roles: ["Admin"] }
  ].filter((link, index, list) => link.roles.includes(user.role) && list.findIndex((item) => item.id === link.id) === index);

  return (
    <aside className={`sidebar ${sidebarOpen ? "is-open" : "is-collapsed"}`}>
      <nav>
        {links.map((link) => (
          <button key={link.id} className={page === link.id ? "active" : ""} onClick={() => setPage(link.id)} title={link.label}>
            <span className="nav-icon">{navInitial(link.label)}</span>
            <span className="nav-label">{link.label}</span>
          </button>
        ))}
      </nav>
      <button className="ghost" onClick={onLogout}>Logout</button>
    </aside>
  );
}

function Topbar({ user, sidebarOpen, setSidebarOpen }) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle sidebar">
          <span />
          <span />
          <span />
        </button>
        <div className="brand-block">
          <div className="brand-mark">PN</div>
          <div>
            <div className="brand">PayNivo</div>
            <p>SME payroll and invoicing</p>
          </div>
        </div>
      </div>
      <div className="topbar-actions">
        <div className="user-chip">
          <span>{user.role}</span>
          <strong>{user.name}</strong>
          <small>{user.email}</small>
        </div>
      </div>
    </header>
  );
}

function navInitial(label) {
  return label.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase();
}

function StatGrid({ stats }) {
  return (
    <div className="stat-grid">
      {stats.map((stat, index) => (
        <article className="stat-card" key={stat.label} data-tone={index % 4}>
          <span>{stat.label}</span>
          <strong>{stat.value}</strong>
        </article>
      ))}
    </div>
  );
}

function useLoad(loader, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    loader().then((result) => live && setData(result)).catch((err) => live && setError(err.message));
    return () => {
      live = false;
    };
  }, deps);
  return { data, setData, error };
}

function AdminDashboard({ api, setPage }) {
  const { data, error } = useLoad(() => api.request("/api/dashboard"), []);
  const rates = useLoad(() => api.request("/api/payroll/rates"), []);
  const users = useLoad(() => api.request("/api/users"), []);
  if (error) return <ErrorBox message={error} />;
  if (!data || !rates.data || !users.data) return <Loading />;
  return (
    <section className="stack">
      <PageHeader title="Admin dashboard" subtitle="System overview, users, payroll rates, reports, and audit activity." />
      <StatGrid stats={[
        { label: "Users", value: data.users },
        { label: "Payroll records", value: data.payrollRecords },
        { label: "Net payroll", value: money(data.totalPayroll) },
        { label: "Invoices", value: data.invoices }
      ]} />
      <QuickActions actions={[
        { title: "Review payroll", text: "Check uploaded records and generate payslips.", action: () => setPage("payroll") },
        { title: "Open reports", text: "View payroll and invoice totals.", action: () => setPage("reports") },
        { title: "Audit activity", text: "Track key system actions.", action: () => setPage("audit") }
      ]} />
      <RateConfig api={api} initial={rates.data} />
      <AutomationSettings api={api} />
      <UserCreator api={api} users={users.data} setUsers={users.setData} />
      <Panel title="Users">
        <ResponsiveTable headers={["Name", "Email", "Role"]} rows={users.data.map((user) => [user.name, user.email, user.role])} />
      </Panel>
      <Panel title="Recent audit logs" action={<button onClick={() => setPage("audit")}>View all</button>}>
        <AuditList logs={data.auditLogs} />
      </Panel>
    </section>
  );
}

function FinanceDashboard({ api, setPage }) {
  const { data } = useLoad(() => api.request("/api/dashboard"), []);
  const reports = useLoad(() => api.request("/api/reports"), []);
  if (!data || !reports.data) return <Loading />;
  return (
    <section className="stack">
      <PageHeader title="Finance dashboard" subtitle="Invoices, payment status, and bank transfer approvals." />
      <StatGrid stats={[
        { label: "Invoices", value: reports.data.invoice.totalInvoices },
        { label: "Paid", value: reports.data.invoice.paidInvoices },
        { label: "Unpaid", value: reports.data.invoice.unpaidInvoices },
        { label: "Invoice amount", value: money(data.invoiceAmount) }
      ]} />
      <QuickActions actions={[
        { title: "Create invoice", text: "Prepare a draft invoice for a customer.", action: () => setPage("invoice") },
        { title: "Approve payment", text: "Review bank transfer payment proof.", action: () => setPage("invoice") },
        { title: "Invoice reports", text: "Check paid, unpaid, and overdue totals.", action: () => setPage("reports") }
      ]} />
    </section>
  );
}

function HrDashboard({ api, setPage }) {
  const staff = useLoad(() => api.request("/api/staff"), []);
  const dashboard = useLoad(() => api.request("/api/dashboard"), []);
  if (!staff.data || !dashboard.data) return <Loading />;
  return (
    <section className="stack">
      <PageHeader title="HR dashboard" subtitle="Staff records, payroll uploads, validations, and payslip generation." />
      <StatGrid stats={[
        { label: "Staff records", value: staff.data.length },
        { label: "Payroll rows", value: dashboard.data.payrollRecords },
        { label: "Payslips", value: dashboard.data.payslips },
        { label: "Total payroll", value: money(dashboard.data.totalPayroll) }
      ]} />
      <QuickActions actions={[
        { title: "Upload payroll", text: "Import Excel rows and validate missing fields.", action: () => setPage("payroll") },
        { title: "Generate payslip", text: "Create PDF payslips from payroll records.", action: () => setPage("payroll") },
        { title: "Manage staff", text: "Add and review employee records.", action: () => document.querySelector("#staff-manager")?.scrollIntoView({ behavior: "smooth" }) }
      ]} />
      <StaffManager api={api} staff={staff.data} setStaff={staff.setData} />
      <AutomationSettings api={api} compact />
    </section>
  );
}

function StaffDashboard({ api, setPage, user }) {
  const payroll = useLoad(() => api.request("/api/payroll"), []);
  if (!payroll.data) return <Loading />;
  const latest = payroll.data[0];
  return (
    <section className="stack">
      <PageHeader title="Staff dashboard" subtitle="Your own payslip, salary breakdown, and contact details." />
      <StatGrid stats={[
        { label: "Staff ID", value: user.staffId || "STF001" },
        { label: "Latest net pay", value: latest ? money(latest.net_pay) : "$0.00" },
        { label: "Earnings", value: latest ? money(latest.total_earnings) : "$0.00" },
        { label: "Deductions", value: latest ? money(latest.total_deductions) : "$0.00" }
      ]} />
      {latest && <SalaryBreakdown record={latest} />}
      <ContactUpdate api={api} user={user} />
      <button className="primary fit" onClick={() => setPage("payslip")}>View my payslip</button>
    </section>
  );
}

function PayrollPage({ api, user }) {
  const payroll = useLoad(() => api.request("/api/payroll"), []);
  const [uploadRows, setUploadRows] = useState([]);
  const [file, setFile] = useState(null);
  const [query, setQuery] = useState("");
  const [validationFilter, setValidationFilter] = useState("All");

  async function uploadFile(event) {
    event.preventDefault();
    if (!file) return api.notify("Choose an Excel file first.");
    const body = new FormData();
    body.append("file", file);
    const result = await api.request("/api/payroll/upload", { method: "POST", body });
    setUploadRows(result.rows);
    payroll.setData(await api.request("/api/payroll"));
    api.notify(`Uploaded ${result.rows.length} payroll rows.`);
  }

  async function generatePayslip(id) {
    const result = await api.request(`/api/payslips/${id}/generate`, { method: "POST" });
    api.notify(`Payslip generated for ${result.staff_name}.`);
  }

  if (!payroll.data) return <Loading />;
  const filteredPayroll = filterPayroll(payroll.data, query, validationFilter);
  return (
    <section className="stack">
      <PageHeader title="Payroll" subtitle="Upload Excel, validate rows, calculate CPF, deductions, and net pay." />
      {user.role !== "Staff" && (
        <Panel title="Upload payroll Excel">
          <form className="inline-form" onSubmit={uploadFile}>
            <input type="file" accept=".xlsx,.xls" onChange={(event) => setFile(event.target.files[0])} />
            <button className="primary" type="submit">Upload and validate</button>
          </form>
          <p className="hint">Required fields: staff_id, staff_name, email, payroll_month, working_days, no_pay_leave_days, basic_salary, services_commission, product_commission, credit_commission, loan_deduction, other_deduction.</p>
        </Panel>
      )}
      {user.role !== "Staff" && <ManualPayrollEntry api={api} onCreated={(record) => payroll.setData([record, ...payroll.data])} />}
      {!!uploadRows.length && <PayrollTable records={uploadRows} title="Uploaded payroll data" onGenerate={generatePayslip} />}
      <Panel title={user.role === "Staff" ? "My payroll" : "Payroll records"}>
        <Toolbar>
          <input placeholder="Search staff, ID, month, or email" value={query} onChange={(event) => setQuery(event.target.value)} />
          <select value={validationFilter} onChange={(event) => setValidationFilter(event.target.value)}>
            <option>All</option>
            <option>Valid</option>
            <option>Invalid</option>
          </select>
        </Toolbar>
        <PayrollTableContent records={filteredPayroll} onGenerate={user.role === "Staff" ? null : generatePayslip} />
      </Panel>
    </section>
  );
}

function PayrollTable({ records, title, onGenerate }) {
  return (
    <Panel title={title}>
      <PayrollTableContent records={records} onGenerate={onGenerate} />
    </Panel>
  );
}

function PayrollTableContent({ records, onGenerate }) {
  if (!records.length) return <EmptyState title="No payroll records found" text="Adjust the search or upload a payroll Excel file." />;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {["Staff", "Month", "Days", "Basic", "Earnings", "Employee CPF", "Employer CPF", "Deductions", "Net pay", "Validation", "Action"].map((header) => <th key={header}>{header}</th>)}
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={`${record.id}-${record.staff_id}`}>
              <td><strong>{record.staff_name}</strong><br /><span className="muted">{record.staff_id}</span></td>
              <td>{record.payroll_month}</td>
              <td>{record.working_days}</td>
              <td>{money(record.basic_salary)}</td>
              <td>{money(record.total_earnings)}</td>
              <td>{money(record.employee_cpf)}</td>
              <td>{money(record.employer_cpf)}</td>
              <td>{money(record.total_deductions)}</td>
              <td><strong>{money(record.net_pay)}</strong></td>
              <td>{record.validationErrors?.length ? <span className="badge danger">{record.validationErrors.join(", ")}</span> : <span className="badge">Valid</span>}</td>
              <td>{onGenerate ? <button onClick={() => onGenerate(record.id)}>Generate PDF Payslip</button> : <span className="muted">View only</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PayslipPage({ api, user }) {
  const payslipsState = useLoad(() => api.request("/api/payslips"), []);
  const payroll = useLoad(() => api.request("/api/payroll"), []);
  async function sendEmail(id) {
    await api.request(`/api/email/payslip/${id}`, { method: "POST" });
    api.notify("Payslip email queued or sent.");
  }
  if (!payslipsState.data || !payroll.data) return <Loading />;
  return (
    <section className="stack">
      <PageHeader title={user.role === "Staff" ? "My payslip" : "Payslips"} subtitle="Generated PDF payslips and salary breakdown." />
      {user.role === "Staff" && payroll.data[0] && <PayrollTable records={payroll.data} title="Salary breakdown" />}
      <Panel title="Generated payslips">
        <ResponsiveTable
          headers={["Staff", "Month", "PDF", "Email"]}
          rows={payslipsState.data.map((payslip) => [
            payslip.staff_name,
            payslip.payroll_month,
            <a href={`${API_URL}${payslip.fileUrl}`} target="_blank" rel="noreferrer">Download PDF</a>,
            user.role !== "Staff" ? <button onClick={() => sendEmail(payslip.id)}>Send payslip email</button> : "Staff access"
          ])}
          empty="No payslips generated yet. Generate one from the Payroll page."
        />
      </Panel>
    </section>
  );
}

function InvoicePage({ api }) {
  const invoicesState = useLoad(() => api.request("/api/invoices"), []);
  const paymentsState = useLoad(() => api.request("/api/payments"), []);
  const [form, setForm] = useState({
    sellerId: "",
    shopTitle: "",
    orderId: "",
    customerId: "",
    customerName: "",
    customerEmail: "",
    contactNo: "",
    serviceName: "",
    bookedDate: "",
    serviceDuration: 60,
    staffId: "",
    staffName: "",
    qty: 1,
    totalRevenue: 500,
    vanidayCommission: 0,
    vanidayShare: 0,
    salonShare: 0,
    cashbackFee: 0,
    cashbackDiscount: 0,
    dueDate: "",
    paymentMethod: "Stripe",
    status: "Draft"
  });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [csvFile, setCsvFile] = useState(null);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  async function createInvoice(event) {
    event.preventDefault();
    const invoice = await api.request("/api/invoices", { method: "POST", body: JSON.stringify(form) });
    invoicesState.setData([invoice, ...invoicesState.data]);
    setShowInvoiceForm(false);
    api.notify(`Created ${invoice.invoiceNumber}.`);
  }
  async function setStatus(id, status) {
    const invoice = await api.request(`/api/invoices/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    invoicesState.setData(invoicesState.data.map((item) => (item.id === id ? invoice : item)));
  }
  async function sendInvoice(id) {
    const result = await api.request(`/api/email/invoice/${id}`, { method: "POST" });
    invoicesState.setData(invoicesState.data.map((item) => (item.id === id ? result.invoice : item)));
    api.notify("Invoice email queued or sent.");
  }
  async function approvePayment(id) {
    const result = await api.request(`/api/payments/${id}/approve`, { method: "POST" });
    invoicesState.setData(invoicesState.data.map((item) => (item.id === id ? result.invoice : item)));
    api.notify("Bank transfer payment proof approved.");
  }
  async function sendReminder(id, reminderNumber) {
    await api.request(`/api/email/reminder/${id}`, { method: "POST", body: JSON.stringify({ reminderNumber }) });
    api.notify(`Reminder ${reminderNumber} email queued or sent.`);
  }
  async function uploadProof(invoice) {
    const proofUrl = window.prompt("Enter payment proof file/link for prototype", `${invoice.invoiceNumber}-proof.pdf`);
    if (!proofUrl) return;
    await api.request(`/api/payments/${invoice.id}/proof`, { method: "POST", body: JSON.stringify({ method: invoice.paymentMethod, proofUrl }) });
    paymentsState.setData(await api.request("/api/payments"));
    api.notify("Payment proof recorded.");
  }
  async function bulkApprove() {
    const pendingIds = paymentsState.data.filter((payment) => payment.status === "Pending").map((payment) => payment.invoiceId);
    if (!pendingIds.length) return api.notify("No pending payment proofs to approve.");
    const result = await api.request("/api/payments/bulk-approve", { method: "POST", body: JSON.stringify({ invoiceIds: pendingIds }) });
    invoicesState.setData(invoicesState.data.map((item) => result.approved.find((invoice) => invoice.id === item.id) || item));
    paymentsState.setData(await api.request("/api/payments"));
    api.notify(`Bulk approved ${result.approved.length} payment(s).`);
  }
  async function uploadInvoiceCsv(event) {
    event.preventDefault();
    if (!csvFile) return api.notify("Choose the Vaniday invoice CSV first.");
    const body = new FormData();
    body.append("file", csvFile);
    const result = await api.request("/api/invoices/upload-csv", { method: "POST", body });
    invoicesState.setData([...result.rows, ...invoicesState.data]);
    api.notify(`Imported ${result.imported} invoice row(s) from CSV.`);
  }
  if (!invoicesState.data || !paymentsState.data) return <Loading />;
  const filteredInvoices = invoicesState.data.filter((invoice) => {
    const matchesStatus = statusFilter === "All" || invoice.status === statusFilter;
    const haystack = `${invoice.invoiceNumber} ${invoice.customerName} ${invoice.customerEmail} ${invoice.paymentMethod}`.toLowerCase();
    return matchesStatus && haystack.includes(query.toLowerCase());
  });
  return (
    <section className="stack">
      <PageHeader title="Invoices" subtitle="Create invoices, send emails, update statuses, and approve payment proof." />
      <div className="page-actions">
        <button className="primary fit" onClick={() => setShowInvoiceForm(true)}>Create invoice</button>
      </div>
      <Panel title="Upload Vaniday invoice CSV">
        <form className="inline-form" onSubmit={uploadInvoiceCsv}>
          <input type="file" accept=".csv" onChange={(event) => setCsvFile(event.target.files[0])} />
          <button className="primary" type="submit">Import CSV invoices</button>
        </form>
        <p className="hint">Supports the sample fields: seller_id, shop_title, OrderID, paymentMethod, customerName, email, serviceName, bookedDate, Total_Revenue, vanidayCommission, vanidayShare, and salonshare.</p>
      </Panel>
      {showInvoiceForm && (
        <InvoiceFormModal
          form={form}
          setForm={setForm}
          onSubmit={createInvoice}
          onClose={() => setShowInvoiceForm(false)}
        />
      )}
      <Panel title="Invoice list">
        <Toolbar>
          <input placeholder="Search invoice, customer, email, or method" value={query} onChange={(event) => setQuery(event.target.value)} />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            {["All", "Draft", "Sent", "Viewed", "Paid", "Overdue"].map((status) => <option key={status}>{status}</option>)}
          </select>
        </Toolbar>
        <div className="table-wrap">
          <table>
            <thead><tr>{["Invoice", "Customer", "Amount", "Method", "Status", ""].map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>{invoice.invoiceNumber}<br /><span className="muted">Due {invoice.dueDate}</span></td>
                  <td>{invoice.customerName}<br /><span className="muted">{invoice.customerEmail}</span>{invoice.shopTitle && <><br /><span className="muted">{invoice.shopTitle}</span></>}</td>
                  <td>{money(invoice.amount)}</td>
                  <td>{invoice.paymentMethod}</td>
                  <td><span className={`badge status-${invoice.status.toLowerCase().replace(/\s+/g, "-")}`}>{invoice.status}</span></td>
                  <td className="invoice-menu-cell">
                    <button className="manage-button" onClick={() => setSelectedInvoice(invoice)}>Manage</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filteredInvoices.length && <EmptyState title="No invoices found" text="Try another search or status filter." />}
      </Panel>
      <PaymentProofs payments={paymentsState.data} onBulkApprove={bulkApprove} />
      <AutomationSettings api={api} compact />
      {selectedInvoice && (
        <InvoiceActionModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onSetStatus={async (status) => {
            await setStatus(selectedInvoice.id, status);
            setSelectedInvoice({ ...selectedInvoice, status });
          }}
          onSendInvoice={() => sendInvoice(selectedInvoice.id)}
          onSendReminder={(number) => sendReminder(selectedInvoice.id, number)}
          onUploadProof={() => uploadProof(selectedInvoice)}
          onApprovePayment={() => approvePayment(selectedInvoice.id)}
          onStripe={() => api.notify("Stripe checkout is a placeholder in this prototype.")}
        />
      )}
    </section>
  );
}

function PaymentProofs({ payments, onBulkApprove }) {
  return (
    <Panel title="Payment proof approval" action={<button className="primary" onClick={onBulkApprove}>Bulk approve pending</button>}>
      <ResponsiveTable
        headers={["Invoice", "Customer", "Method", "Proof", "Status"]}
        rows={payments.map((payment) => [
          payment.invoice?.invoiceNumber || `Invoice ${payment.invoiceId}`,
          payment.invoice?.customerName || "Unknown",
          payment.method,
          payment.proofUrl || "No proof uploaded",
          <span className={`badge ${payment.status === "Approved" ? "status-paid" : "status-sent"}`}>{payment.status}</span>
        ])}
        empty="No payment proofs yet."
      />
      <p className="hint">PayNow and bank transfer payments require proof upload in this prototype. Finance/Admin can approve individually or in bulk.</p>
    </Panel>
  );
}

function InvoiceFormModal({ form, setForm, onSubmit, onClose }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="invoice-modal-title">
        <div className="modal-head">
          <div>
            <p className="eyebrow">Manual invoice</p>
            <h2 id="invoice-modal-title">Create invoice</h2>
          </div>
          <button className="icon-close" onClick={onClose} aria-label="Close create invoice form">x</button>
        </div>
        <div className="info-strip">
          <strong>Standardized invoice fields</strong>
          <span>This form follows the same structure as the Vaniday CSV import, so uploaded and manually-created invoices use comparable shop, order, customer, service, revenue, commission, and share fields.</span>
        </div>
        <form className="form-grid invoice-form invoice-form-labelled" onSubmit={onSubmit}>
          <FormSection title="Shop and order">
            <Field label="Seller ID" hint="From Vaniday CSV seller_id">
              <input placeholder="e.g. 1064" value={form.sellerId} onChange={(event) => setForm({ ...form, sellerId: event.target.value })} />
            </Field>
            <Field label="Shop title" required hint="Salon or merchant name">
              <input required placeholder="e.g. Palace Therapy - Club Street" value={form.shopTitle} onChange={(event) => setForm({ ...form, shopTitle: event.target.value })} />
            </Field>
            <Field label="Order ID" hint="Booking/order reference">
              <input placeholder="e.g. 539751" value={form.orderId} onChange={(event) => setForm({ ...form, orderId: event.target.value })} />
            </Field>
          </FormSection>

          <FormSection title="Customer details">
            <Field label="Customer ID" hint="From customerId if available">
              <input placeholder="e.g. 110653" value={form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value })} />
            </Field>
            <Field label="Customer name" required>
              <input required placeholder="e.g. Riho Sonoda" value={form.customerName} onChange={(event) => setForm({ ...form, customerName: event.target.value })} />
            </Field>
            <Field label="Customer email" required>
              <input required type="email" placeholder="customer@email.com" value={form.customerEmail} onChange={(event) => setForm({ ...form, customerEmail: event.target.value })} />
            </Field>
            <Field label="Contact number">
              <input placeholder="e.g. 80536703" value={form.contactNo} onChange={(event) => setForm({ ...form, contactNo: event.target.value })} />
            </Field>
          </FormSection>

          <FormSection title="Service booking">
            <Field label="Service name" required hint="Invoice item description">
              <input required placeholder="e.g. Oriental Body Massage" value={form.serviceName} onChange={(event) => setForm({ ...form, serviceName: event.target.value })} />
            </Field>
            <Field label="Booked date" hint="Actual appointment date">
              <input type="date" value={form.bookedDate} onChange={(event) => setForm({ ...form, bookedDate: event.target.value })} />
            </Field>
            <Field label="Service duration" hint="Minutes">
              <input type="number" min="0" value={form.serviceDuration} onChange={(event) => setForm({ ...form, serviceDuration: Number(event.target.value) })} />
            </Field>
            <Field label="Staff ID">
              <input placeholder="Staff reference" value={form.staffId} onChange={(event) => setForm({ ...form, staffId: event.target.value })} />
            </Field>
            <Field label="Staff name">
              <input placeholder="Staff who performed service" value={form.staffName} onChange={(event) => setForm({ ...form, staffName: event.target.value })} />
            </Field>
          </FormSection>

          <FormSection title="Revenue and shares">
            <Field label="Quantity" required>
              <input type="number" min="1" value={form.qty} onChange={(event) => setForm({ ...form, qty: Number(event.target.value) })} />
            </Field>
            <Field label="Total revenue" required hint="Gross customer payment">
              <input type="number" min="0" value={form.totalRevenue} onChange={(event) => setForm({ ...form, totalRevenue: Number(event.target.value) })} />
            </Field>
            <Field label="Vaniday commission" hint="Commission percentage or amount from sample">
              <input type="number" min="0" value={form.vanidayCommission} onChange={(event) => setForm({ ...form, vanidayCommission: Number(event.target.value) })} />
            </Field>
            <Field label="Vaniday share" hint="Amount retained by platform">
              <input type="number" min="0" value={form.vanidayShare} onChange={(event) => setForm({ ...form, vanidayShare: Number(event.target.value) })} />
            </Field>
            <Field label="Salon share" hint="Amount payable to salon">
              <input type="number" min="0" value={form.salonShare} onChange={(event) => setForm({ ...form, salonShare: Number(event.target.value) })} />
            </Field>
            <Field label="Cashback fee">
              <input type="number" min="0" value={form.cashbackFee} onChange={(event) => setForm({ ...form, cashbackFee: Number(event.target.value) })} />
            </Field>
            <Field label="Cashback discount">
              <input type="number" min="0" value={form.cashbackDiscount} onChange={(event) => setForm({ ...form, cashbackDiscount: Number(event.target.value) })} />
            </Field>
          </FormSection>

          <FormSection title="Invoice settings">
            <Field label="Invoice due date" required>
              <input required type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
            </Field>
            <Field label="Payment method">
              <select value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}>
                <option>Stripe</option>
                <option>PayNow</option>
                <option>Bank transfer</option>
              </select>
            </Field>
            <Field label="Invoice status">
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                {["Draft", "Sent", "Viewed", "Paid", "Overdue"].map((status) => <option key={status}>{status}</option>)}
              </select>
            </Field>
          </FormSection>
          <div className="modal-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button className="primary" type="submit">Create invoice</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function InvoiceActionModal({ invoice, onClose, onSetStatus, onSendInvoice, onSendReminder, onUploadProof, onApprovePayment, onStripe }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel action-modal" role="dialog" aria-modal="true" aria-labelledby="invoice-action-title">
        <div className="modal-head">
          <div>
            <p className="eyebrow">Invoice actions</p>
            <h2 id="invoice-action-title">{invoice.invoiceNumber}</h2>
          </div>
          <button className="icon-close" onClick={onClose} aria-label="Close invoice actions">x</button>
        </div>

        <div className="invoice-summary">
          <div><span>Customer</span><strong>{invoice.customerName}</strong><small>{invoice.customerEmail}</small></div>
          <div><span>Shop</span><strong>{invoice.shopTitle || "Manual invoice"}</strong><small>{invoice.orderId ? `Order ${invoice.orderId}` : "No order ID"}</small></div>
          <div><span>Amount</span><strong>{money(invoice.amount)}</strong><small>{invoice.paymentMethod}</small></div>
          <div><span>Status</span><strong><span className={`badge status-${invoice.status.toLowerCase().replace(/\s+/g, "-")}`}>{invoice.status}</span></strong><small>Due {invoice.dueDate}</small></div>
        </div>

        <div className="action-sections">
          <section>
            <h3>Status</h3>
            <div className="status-grid">
              {["Draft", "Sent", "Viewed", "Paid", "Overdue"].map((status) => (
                <button key={status} className={invoice.status === status ? "selected" : ""} onClick={() => onSetStatus(status)}>
                  {status}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3>Email</h3>
            <div className="action-tile-grid">
              <button onClick={onSendInvoice}><strong>Send invoice</strong><span>Email invoice to customer</span></button>
              <button onClick={() => onSendReminder(1)}><strong>Reminder 1</strong><span>First overdue reminder</span></button>
              <button onClick={() => onSendReminder(2)}><strong>Reminder 2</strong><span>Final follow-up reminder</span></button>
            </div>
          </section>

          <section>
            <h3>Payment</h3>
            <div className="action-tile-grid">
              <button onClick={onUploadProof}><strong>Upload proof</strong><span>Record PayNow/bank transfer proof</span></button>
              <button onClick={onApprovePayment}><strong>Approve payment</strong><span>Mark payment as approved and paid</span></button>
              {invoice.paymentMethod === "Stripe" && <button onClick={onStripe}><strong>Stripe checkout</strong><span>Prototype placeholder</span></button>}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function FormSection({ title, children }) {
  return (
    <fieldset className="form-section">
      <legend>{title}</legend>
      <div className="form-section-grid">{children}</div>
    </fieldset>
  );
}

function Field({ label, hint, required, children }) {
  return (
    <label className="field-label">
      <span>{label}{required && <b> *</b>}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function ReportsPage({ api }) {
  const { data } = useLoad(() => api.request("/api/reports"), []);
  if (!data) return <Loading />;
  return (
    <section className="stack">
      <PageHeader title="Reports" subtitle="Simple payroll and invoice report summaries." />
      <StatGrid stats={[
        { label: "Staff processed", value: data.payroll.totalStaffProcessed },
        { label: "Payroll amount", value: money(data.payroll.totalPayrollAmount) },
        { label: "Payslips generated", value: data.payroll.totalPayslipsGenerated },
        { label: "Failed upload records", value: data.payroll.failedUploadRecords }
      ]} />
      <ReportMeters
        title="Payroll progress"
        items={[
          { label: "Payslips generated", value: data.payroll.totalPayslipsGenerated, total: Math.max(data.payroll.totalStaffProcessed, 1) },
          { label: "Clean upload records", value: Math.max(data.payroll.totalStaffProcessed - data.payroll.failedUploadRecords, 0), total: Math.max(data.payroll.totalStaffProcessed, 1) }
        ]}
      />
      <StatGrid stats={[
        { label: "Total invoices", value: data.invoice.totalInvoices },
        { label: "Paid invoices", value: data.invoice.paidInvoices },
        { label: "Unpaid invoices", value: data.invoice.unpaidInvoices },
        { label: "Overdue invoices", value: data.invoice.overdueInvoices },
        { label: "Invoice amount", value: money(data.invoice.totalInvoiceAmount) }
      ]} />
      <ReportMeters
        title="Invoice collection"
        items={[
          { label: "Paid invoices", value: data.invoice.paidInvoices, total: Math.max(data.invoice.totalInvoices, 1) },
          { label: "Unpaid invoices", value: data.invoice.unpaidInvoices, total: Math.max(data.invoice.totalInvoices, 1) },
          { label: "Overdue invoices", value: data.invoice.overdueInvoices, total: Math.max(data.invoice.totalInvoices, 1) }
        ]}
      />
    </section>
  );
}

function AuditPage({ api }) {
  const { data } = useLoad(() => api.request("/api/audit-logs"), []);
  const [query, setQuery] = useState("");
  if (!data) return <Loading />;
  const logs = data.filter((log) => `${log.action} ${log.module} ${log.actor}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <section className="stack">
      <PageHeader title="Audit logs" subtitle="Login, payroll upload, payslip generation, email, invoice, payment, and rate config events." />
      <Panel title="Activity">
        <Toolbar>
          <input placeholder="Search action, module, or actor" value={query} onChange={(event) => setQuery(event.target.value)} />
        </Toolbar>
        {logs.length ? <AuditList logs={logs} /> : <EmptyState title="No audit logs found" text="Try a different search term." />}
      </Panel>
    </section>
  );
}

function RateConfig({ api, initial }) {
  const [rates, setRates] = useState(initial);
  async function save(event) {
    event.preventDefault();
    const updated = await api.request("/api/payroll/rates", { method: "PUT", body: JSON.stringify(rates) });
    setRates(updated);
    api.notify("Payroll rate configuration updated.");
  }
  return (
    <Panel title="Payroll rate configuration">
      <div className="info-strip">
        <strong>System-computed payroll</strong>
        <span>Admin/HR enters salary inputs; PayNivo calculates allowance, deductions, CPF, employer CPF, and net pay. Prototype CPF defaults follow CPFB 2026 full-rate example for age 55 and below: employee 20%, employer 17%.</span>
      </div>
      <form className="rate-grid" onSubmit={save}>
        {[
          ["employeeCpfRate", "Employee CPF rate"],
          ["employerCpfRate", "Employer CPF rate"],
          ["sdlRate", "SDL rate"],
          ["defaultAllowanceRate", "Default allowance rate"],
          ["defaultDeductionRate", "Default deduction rate"]
        ].map(([key, label]) => (
          <label key={key}>{label}<input type="number" step="0.0001" value={rates[key]} onChange={(event) => setRates({ ...rates, [key]: event.target.value })} /></label>
        ))}
        <button className="primary" type="submit">Save rates</button>
      </form>
    </Panel>
  );
}

function AutomationSettings({ api, compact = false }) {
  const settings = useLoad(() => api.request("/api/settings/automation"), []);
  if (!settings.data) return null;
  async function save(event) {
    event.preventDefault();
    const updated = await api.request("/api/settings/automation", { method: "PUT", body: JSON.stringify(settings.data) });
    settings.setData(updated);
    api.notify("Automation settings saved.");
  }
  return (
    <Panel title={compact ? "Auto email and reminders" : "Automation settings"}>
      <form className="rate-grid" onSubmit={save}>
        <label>Auto payslip email
          <select value={settings.data.payslipAutoEmailEnabled ? "Yes" : "No"} onChange={(event) => settings.setData({ ...settings.data, payslipAutoEmailEnabled: event.target.value === "Yes" })}>
            <option>Yes</option><option>No</option>
          </select>
        </label>
        <label>Payslip email day
          <input type="number" min="1" max="31" value={settings.data.payslipEmailDay} onChange={(event) => settings.setData({ ...settings.data, payslipEmailDay: Number(event.target.value) })} />
        </label>
        <label>Auto invoice email
          <select value={settings.data.invoiceAutoEmailEnabled ? "Yes" : "No"} onChange={(event) => settings.setData({ ...settings.data, invoiceAutoEmailEnabled: event.target.value === "Yes" })}>
            <option>Yes</option><option>No</option>
          </select>
        </label>
        <label>Invoice email day
          <input type="number" min="1" max="31" value={settings.data.invoiceEmailDay} onChange={(event) => settings.setData({ ...settings.data, invoiceEmailDay: Number(event.target.value) })} />
        </label>
        <label>Reminder 1 after due date
          <input type="number" min="1" value={settings.data.reminder1DaysAfterDue} onChange={(event) => settings.setData({ ...settings.data, reminder1DaysAfterDue: Number(event.target.value) })} />
        </label>
        <label>Reminder 2 after due date
          <input type="number" min="1" value={settings.data.reminder2DaysAfterDue} onChange={(event) => settings.setData({ ...settings.data, reminder2DaysAfterDue: Number(event.target.value) })} />
        </label>
        <label>WhatsApp option
          <select value={settings.data.whatsappEnabled ? "Enabled" : "Disabled"} onChange={(event) => settings.setData({ ...settings.data, whatsappEnabled: event.target.value === "Enabled" })}>
            <option>Disabled</option><option>Enabled</option>
          </select>
        </label>
        <button className="primary" type="submit">Save automation</button>
      </form>
      <p className="hint">Prototype stores the schedule settings and provides manual trigger buttons. Production would run a scheduled job.</p>
    </Panel>
  );
}

function UserCreator({ api, users, setUsers }) {
  const [form, setForm] = useState({ name: "", email: "", role: "Staff", department: "", workLocation: "Singapore HQ", phone: "" });
  async function submit(event) {
    event.preventDefault();
    const created = await api.request("/api/users", { method: "POST", body: JSON.stringify(form) });
    setUsers([...users, created]);
    setForm({ name: "", email: "", role: "Staff", department: "", workLocation: "Singapore HQ", phone: "" });
    api.notify("User account created by Admin.");
  }
  return (
    <Panel title="Admin create account">
      <form className="form-grid invoice-form" onSubmit={submit}>
        <input required placeholder="Full name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <input required type="email" placeholder="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
          {["Admin", "Finance", "HR", "Staff"].map((role) => <option key={role}>{role}</option>)}
        </select>
        <input placeholder="Department" value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} />
        <input placeholder="Work location" value={form.workLocation} onChange={(event) => setForm({ ...form, workLocation: event.target.value })} />
        <input placeholder="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        <button className="primary" type="submit">Create account</button>
      </form>
    </Panel>
  );
}

function ManualPayrollEntry({ api, onCreated }) {
  const [form, setForm] = useState({
    staff_id: "STF001",
    staff_name: "Siti Staff",
    email: "staff@paynivo.com",
    payroll_month: "May 2026",
    working_days: 22,
    no_pay_leave_days: 0,
    basic_salary: 3200,
    services_commission: 0,
    product_commission: 0,
    credit_commission: 0,
    allowance: 100,
    loan_deduction: 0,
    other_deduction: 50
  });
  async function submit(event) {
    event.preventDefault();
    const created = await api.request("/api/payroll", { method: "POST", body: JSON.stringify(form) });
    onCreated(created);
    api.notify("Manual payroll entered and calculated by system.");
  }
  const fields = [
    ["staff_id", "Staff ID"], ["staff_name", "Staff name"], ["email", "Email"], ["payroll_month", "Payroll month"],
    ["working_days", "Working days"], ["no_pay_leave_days", "No pay leave"], ["basic_salary", "Basic salary"],
    ["services_commission", "Services commission"], ["product_commission", "Product commission"], ["credit_commission", "Credit commission"],
    ["allowance", "Allowance"], ["loan_deduction", "Loan deduction"], ["other_deduction", "Other deduction"]
  ];
  return (
    <Panel title="Manual payroll entry">
      <form className="rate-grid" onSubmit={submit}>
        {fields.map(([key, label]) => (
          <label key={key}>{label}
            <input type={key === "email" ? "email" : key.includes("name") || key.includes("month") || key.includes("id") ? "text" : "number"} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
          </label>
        ))}
        <button className="primary" type="submit">Compute payroll</button>
      </form>
    </Panel>
  );
}

function StaffManager({ api, staff, setStaff }) {
  const [form, setForm] = useState({ staff_name: "", email: "", department: "", work_location: "Singapore HQ", phone: "" });
  async function submit(event) {
    event.preventDefault();
    const created = await api.request("/api/staff", { method: "POST", body: JSON.stringify(form) });
    setStaff([...staff, created]);
    setForm({ staff_name: "", email: "", department: "", work_location: "Singapore HQ", phone: "" });
    api.notify("Staff record added.");
  }
  return (
    <Panel title="Manage staff records" id="staff-manager">
      <form className="form-grid invoice-form" onSubmit={submit}>
        <input required placeholder="Staff name" value={form.staff_name} onChange={(event) => setForm({ ...form, staff_name: event.target.value })} />
        <input required type="email" placeholder="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        <input placeholder="Department" value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} />
        <input placeholder="Work location" value={form.work_location} onChange={(event) => setForm({ ...form, work_location: event.target.value })} />
        <input placeholder="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        <button className="primary" type="submit">Add staff record</button>
      </form>
      <ResponsiveTable headers={["ID", "Name", "Email", "Department", "Location"]} rows={staff.map((item) => [item.staff_id, item.staff_name, item.email, item.department, item.work_location])} />
    </Panel>
  );
}

function ContactUpdate({ api, user }) {
  const [form, setForm] = useState({ email: user.email, phone: "" });
  async function submit(event) {
    event.preventDefault();
    await api.request(`/api/staff/${user.staffId || "STF001"}/contact`, { method: "PATCH", body: JSON.stringify(form) });
    api.notify("Contact details updated.");
  }
  return (
    <Panel title="Update contact details">
      <form className="inline-form" onSubmit={submit}>
        <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        <input placeholder="Phone number" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        <button className="primary">Update</button>
      </form>
    </Panel>
  );
}

function AuditList({ logs }) {
  return (
    <div className="audit-list">
      {logs.map((log) => (
        <div key={log.id} className="audit-item">
          <strong>{log.action}</strong>
          <span>{log.module} by {log.actor} at {new Date(log.createdAt).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

function QuickActions({ actions }) {
  return (
    <div className="quick-grid">
      {actions.map((item) => (
        <button className="quick-card" key={item.title} onClick={item.action}>
          <strong>{item.title}</strong>
          <span>{item.text}</span>
        </button>
      ))}
    </div>
  );
}

function SalaryBreakdown({ record }) {
  const earningsPct = Math.min((record.total_earnings / Math.max(record.total_earnings + record.total_deductions, 1)) * 100, 100);
  return (
    <Panel title="Salary breakdown">
      <div className="breakdown">
        <div>
          <span>Earnings</span>
          <strong>{money(record.total_earnings)}</strong>
        </div>
        <div>
          <span>Deductions</span>
          <strong>{money(record.total_deductions)}</strong>
        </div>
        <div>
          <span>Net pay</span>
          <strong>{money(record.net_pay)}</strong>
        </div>
      </div>
      <div className="meter" aria-label="Salary split"><span style={{ width: `${earningsPct}%` }} /></div>
    </Panel>
  );
}

function ReportMeters({ title, items }) {
  return (
    <Panel title={title}>
      <div className="meter-list">
        {items.map((item) => {
          const pct = Math.round((item.value / item.total) * 100);
          return (
            <div className="meter-row" key={item.label}>
              <div><strong>{item.label}</strong><span>{item.value} of {item.total}</span></div>
              <div className="meter"><span style={{ width: `${Math.min(pct, 100)}%` }} /></div>
              <b>{pct}%</b>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function Toolbar({ children }) {
  return <div className="toolbar">{children}</div>;
}

function EmptyState({ title, text }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function ResponsiveTable({ headers, rows, empty = "No records yet." }) {
  if (!rows.length) return <p className="muted">{empty}</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function PageHeader({ title, subtitle }) {
  return (
    <div className="page-header">
      <div>
        <p className="eyebrow">PayNivo workspace</p>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}

function Panel({ title, action, children, id }) {
  return (
    <section className="panel" id={id}>
      <div className="panel-head">
        <h3>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Loading() {
  return (
    <div className="loading-card">
      <span />
      <span />
      <span />
    </div>
  );
}

function ErrorBox({ message }) {
  return <div className="error-box">{message}</div>;
}

createRoot(document.getElementById("root")).render(<App />);

function filterPayroll(records, query, validationFilter) {
  return records.filter((record) => {
    const hasErrors = Boolean(record.validationErrors?.length);
    const matchesValidation = validationFilter === "All" || (validationFilter === "Valid" && !hasErrors) || (validationFilter === "Invalid" && hasErrors);
    const haystack = `${record.staff_name} ${record.staff_id} ${record.email} ${record.payroll_month}`.toLowerCase();
    return matchesValidation && haystack.includes(query.toLowerCase());
  });
}
