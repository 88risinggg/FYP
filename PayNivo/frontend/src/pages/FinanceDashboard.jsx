import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api.js";

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "invoices", label: "Invoices" },
  { id: "payments", label: "Payments" },
  { id: "reports", label: "Reports" },
  { id: "notifications", label: "Notifications" }
];

const fallbackData = {
  metrics: [],
  customers: [],
  invoices: [],
  payments: [],
  reports: [],
  notifications: [],
  auditLogs: []
};

function currency(amount) {
  return `$${Number(amount || 0).toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

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

function invoiceTone(status) {
  if (status === "Paid") return "green";
  if (status === "Overdue") return "red";
  if (status === "Draft") return "amber";
  return "blue";
}

function paymentTone(status) {
  if (["Verified", "Settled"].includes(status)) return "green";
  if (status === "Pending admin approval") return "amber";
  return "blue";
}

export default function FinanceDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [data, setData] = useState(fallbackData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const pendingInvoices = useMemo(
    () => data.invoices.filter((invoice) => ["Draft", "Overdue"].includes(invoice.status)),
    [data.invoices]
  );
  const pendingPayments = useMemo(
    () => data.payments.filter((payment) => payment.status === "Pending admin approval"),
    [data.payments]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError("");
      try {
        const response = await api.get("/finance/dashboard");
        if (!cancelled) {
          setData({ ...fallbackData, ...response.data });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || "Unable to load finance dashboard data.");
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

  function applyDashboard(response) {
    setData({ ...fallbackData, ...response.data.dashboard });
  }

  async function issueInvoice(invoice) {
    setActionMessage("");

    try {
      const response = await api.patch(`/finance/invoices/${invoice.id}/issue`);
      applyDashboard(response);
      setActionMessage(`${invoice.id} has been issued and emailed.`);
    } catch (err) {
      setActionMessage(err.response?.data?.message || "Unable to issue invoice.");
    }
  }

  async function verifyPayment(payment) {
    setActionMessage("");

    try {
      const response = await api.patch(`/finance/payments/${payment.id}/verify`);
      applyDashboard(response);
      setActionMessage(`${payment.id} has been verified and matched to ${payment.invoiceId}.`);
    } catch (err) {
      setActionMessage(err.response?.data?.message || "Unable to verify payment.");
    }
  }

  async function sendReminder(invoice) {
    setActionMessage("");

    try {
      const response = await api.post(`/finance/invoices/${invoice.id}/reminder`);
      applyDashboard(response);
      setActionMessage(`Reminder sent for ${invoice.id}.`);
    } catch (err) {
      setActionMessage(err.response?.data?.message || "Unable to send reminder.");
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-brand-600">Finance</p>
            <h1 className="mt-2 text-3xl font-black text-slate-950 sm:text-4xl">Finance Dashboard</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
              Create and issue invoices, track payment proofs, generate reports, and monitor customer email notifications from one workspace.
            </p>
          </div>
          <div className="grid gap-2 rounded-lg bg-slate-950 p-4 text-sm text-white shadow-lg shadow-slate-900/10 sm:min-w-64">
            <div className="flex items-center justify-between gap-4">
              <span className="text-white/70">Invoice queue</span>
              <span className="font-black">{pendingInvoices.length} open</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-white/70">Payment proofs</span>
              <span className="font-black">{pendingPayments.length} pending</span>
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
          Loading finance data...
        </div>
      ) : (
        <>
          {activeTab === "overview" && (
            <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black text-slate-950">Finance functional requirements</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[
                    "Import Vaniday invoice CSV",
                    "Create and issue invoices",
                    "Generate invoice PDF",
                    "Email invoices to customers",
                    "Track Stripe, PayNow, and bank transfer payments",
                    "Verify payment proofs",
                    "Send overdue reminders",
                    "View customer billing records",
                    "Generate finance reports",
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
                  <h2 className="text-lg font-black text-slate-950">Work queue</h2>
                  <StatusPill tone={pendingInvoices.length || pendingPayments.length ? "amber" : "green"}>
                    {pendingInvoices.length + pendingPayments.length} actions
                  </StatusPill>
                </div>
                <div className="mt-4 space-y-3">
                  {pendingInvoices.length === 0 && pendingPayments.length === 0 ? (
                    <EmptyState message="No finance actions pending." />
                  ) : (
                    <>
                      {pendingInvoices.slice(0, 3).map((invoice) => (
                        <div key={invoice.id} className="rounded-lg border border-slate-200 p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-black text-slate-950">{invoice.id}</p>
                              <p className="mt-1 text-sm text-slate-600">{invoice.customer} - {invoice.source}</p>
                            </div>
                            <StatusPill tone={invoiceTone(invoice.status)}>{invoice.status}</StatusPill>
                          </div>
                        </div>
                      ))}
                      {pendingPayments.slice(0, 2).map((payment) => (
                        <div key={payment.id} className="rounded-lg border border-slate-200 p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-black text-slate-950">{payment.id}</p>
                              <p className="mt-1 text-sm text-slate-600">{payment.customer} - {payment.method}</p>
                            </div>
                            <StatusPill tone="amber">Proof review</StatusPill>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </section>
            </div>
          )}

          {activeTab === "invoices" && (
            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 p-5">
                <h2 className="text-lg font-black text-slate-950">Invoices</h2>
                <p className="mt-1 text-sm text-slate-500">Issue drafts, generate PDFs, email customers, and send payment reminders.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Invoice</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Due</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.invoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td className="px-4 py-3">
                          <p className="font-black text-slate-950">{invoice.id}</p>
                          <p className="text-xs text-slate-500">{invoice.source} - {invoice.items} items</p>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{invoice.customer}</td>
                        <td className="px-4 py-3 text-slate-600">{invoice.dueDate}</td>
                        <td className="px-4 py-3 font-black text-slate-950">{currency(invoice.amount)}</td>
                        <td className="px-4 py-3"><StatusPill tone={invoiceTone(invoice.status)}>{invoice.status}</StatusPill></td>
                        <td className="px-4 py-3 text-slate-600">{invoice.emailStatus}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            {invoice.status === "Draft" && (
                              <button type="button" onClick={() => issueInvoice(invoice)} className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-black text-white hover:bg-brand-700">
                                Issue
                              </button>
                            )}
                            {invoice.status !== "Paid" && invoice.status !== "Draft" && (
                              <button type="button" onClick={() => sendReminder(invoice)} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-black text-brand-700 hover:bg-brand-50">
                                Reminder
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeTab === "payments" && (
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-slate-950">Payment tracking</h2>
              <div className="mt-4 grid gap-3">
                {data.payments.map((payment) => (
                  <div key={payment.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr_auto] lg:items-center">
                      <div>
                        <p className="font-black text-slate-950">{payment.id} - {payment.invoiceId}</p>
                        <p className="mt-1 text-sm text-slate-600">{payment.customer}</p>
                      </div>
                      <div className="grid gap-1 text-sm text-slate-600 sm:grid-cols-3 lg:grid-cols-1">
                        <span>{payment.method}</span>
                        <span className="font-black text-slate-950">{currency(payment.amount)}</span>
                        <span>{payment.proof}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusPill tone={paymentTone(payment.status)}>{payment.status}</StatusPill>
                        {payment.status === "Pending admin approval" && (
                          <button type="button" onClick={() => verifyPayment(payment)} className="rounded-md bg-brand-600 px-3 py-2 text-xs font-black text-white hover:bg-brand-700">
                            Verify
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeTab === "reports" && (
            <div className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black text-slate-950">Finance reports</h2>
                <div className="mt-4 space-y-3">
                  {data.reports.map((report) => (
                    <div key={report.id} className="grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-[1.2fr_0.7fr_0.5fr_auto] sm:items-center">
                      <div>
                        <p className="font-black text-slate-950">{report.name}</p>
                        <p className="text-sm text-slate-500">{report.period}</p>
                      </div>
                      <p className="text-sm font-semibold text-slate-700">{report.format}</p>
                      <StatusPill tone={report.status === "Ready" ? "green" : "amber"}>{report.status}</StatusPill>
                      <p className="text-sm text-slate-500">{report.updatedAt}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black text-slate-950">Customer billing records</h2>
                <div className="mt-4 space-y-3">
                  {data.customers.map((customer) => (
                    <div key={customer.id} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-black text-slate-950">{customer.name}</p>
                        <StatusPill tone="green">{customer.status}</StatusPill>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{customer.contact} - {customer.email}</p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">{customer.terms}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black text-slate-950">Email notification logs</h2>
                <div className="mt-4 space-y-3">
                  {data.notifications.map((mail) => (
                    <div key={mail.id} className="grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-[0.7fr_1.1fr_0.8fr_0.8fr] sm:items-center">
                      <p className="font-black text-slate-950">{mail.id}</p>
                      <div>
                        <p className="font-semibold text-slate-800">{mail.type}</p>
                        <p className="text-sm text-slate-500">{mail.customer} - {mail.invoiceId}</p>
                      </div>
                      <StatusPill tone={mail.status === "Delivered" ? "green" : "amber"}>{mail.status}</StatusPill>
                      <p className="text-sm text-slate-500">{mail.sentAt}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black text-slate-950">Finance audit trail</h2>
                <div className="mt-4 space-y-3">
                  {data.auditLogs.map((log) => (
                    <div key={log.id} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-black text-slate-950">{log.id}</p>
                        <StatusPill tone="blue">{log.area}</StatusPill>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-800">{log.action}</p>
                      <p className="mt-1 text-sm text-slate-500">{log.actor} - {log.time}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </>
      )}
    </section>
  );
}
