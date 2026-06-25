import {
  AlertTriangle,
  BarChart3,
  BellRing,
  CalendarDays,
  Download,
  FileSpreadsheet,
  FileText,
  PieChart,
  ReceiptText,
  ShieldCheck,
  Users
} from "lucide-react";

const reportCards = [
  {
    title: "Invoice Summary",
    icon: ReceiptText,
    accent: "#C77DFF",
    description: "High-level invoice volume, status, outstanding amount, and monthly movement.",
    metrics: ["Total invoices", "Paid vs unpaid", "Outstanding amount"]
  },
  {
    title: "Payment Status",
    icon: BarChart3,
    accent: "#38BDF8",
    description: "Tracks paid, pending, partial, and overdue payment states for admin monitoring.",
    metrics: ["Payment status", "Paid date", "Amount remaining"]
  },
  {
    title: "Overdue Invoices",
    icon: AlertTriangle,
    accent: "#FB7185",
    description: "Highlights overdue invoices, aging buckets, and follow-up priority.",
    metrics: ["Days overdue", "Reminder count", "Outstanding value"]
  },
  {
    title: "Reminder Activity",
    icon: BellRing,
    accent: "#F59E0B",
    description: "Shows reminder rules, schedule performance, delivery status, and next reminder.",
    metrics: ["Rule name", "Sent status", "Next scheduled time"]
  },
  {
    title: "User Access",
    icon: Users,
    accent: "#34D399",
    description: "Reviews who can access invoicing, role assignment, status, and last activity.",
    metrics: ["Role", "Module access", "Account status"]
  },
  {
    title: "Audit Log",
    icon: ShieldCheck,
    accent: "#A78BFA",
    description: "Accountability report for user changes, settings changes, reminder changes, and exports.",
    metrics: ["Actor", "Action", "Timestamp"]
  }
];

const trendBars = [
  ["Jan", 42, 18],
  ["Feb", 55, 21],
  ["Mar", 49, 26],
  ["Apr", 68, 28],
  ["May", 73, 31],
  ["Jun", 64, 24]
];

const statusSlices = [
  ["Paid", 46, "#34D399"],
  ["Pending", 28, "#38BDF8"],
  ["Overdue", 16, "#FB7185"],
  ["Draft", 10, "#A78BFA"]
];

const previewRows = [
  ["INV-2026-1042", "Acme Supplies", "Paid", "$4,820.00", "2 reminders"],
  ["INV-2026-1043", "Bright Labs", "Pending", "$2,150.00", "1 reminder"],
  ["INV-2026-1044", "Northwind", "Overdue", "$8,430.00", "3 reminders"],
  ["INV-2026-1045", "Zenith Retail", "Draft", "$1,980.00", "0 reminders"]
];

function DonutChart() {
  let offset = 0;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="relative h-56 w-56">
      <svg viewBox="0 0 128 128" className="h-full w-full">
        <circle cx="64" cy="64" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="18" />
        {statusSlices.map(([label, value, color]) => {
          const dash = (value / 100) * circumference;
          const segment = (
            <circle
              key={label}
              cx="64"
              cy="64"
              r={radius}
              fill="none"
              stroke={color}
              strokeLinecap="round"
              strokeDasharray={`${dash - 2} ${circumference}`}
              strokeDashoffset={-offset}
              strokeWidth="18"
              transform="rotate(-90 64 64)"
            />
          );
          offset += dash;
          return segment;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-3xl font-semibold text-white">124</p>
        <p className="text-xs font-semibold uppercase text-[#d8c6e8]">Invoices</p>
      </div>
    </div>
  );
}

export default function AdminReportsDesignPage() {
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-medium text-[#C77DFF]">Invoicing Admin Report Studio</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">Reports & Visualisation Design</h2>
          <p className="mt-2 max-w-3xl text-sm text-[#d8c6e8]">
            A frontend-only reporting concept for admin review. It does not create, update, or delete backend data.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white">
            <FileSpreadsheet size={16} />
            CSV Layout
          </button>
          <button type="button" className="neon-button inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold">
            <Download size={16} />
            PDF Layout
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reportCards.map((report) => {
          const Icon = report.icon;
          return (
            <article key={report.title} className="neon-glass neon-border rounded-lg p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-white">{report.title}</p>
                  <p className="mt-2 text-sm leading-6 text-[#d8c6e8]">{report.description}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/[0.06]" style={{ color: report.accent }}>
                  <Icon size={23} />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {report.metrics.map((metric) => (
                  <span key={metric} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-[#f4e9ff]">
                    {metric}
                  </span>
                ))}
              </div>
            </article>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <section className="neon-glass neon-border rounded-lg p-5">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Monthly Invoice Movement</h3>
              <p className="mt-1 text-sm text-[#d8c6e8]">Visual concept for issued invoices vs overdue invoices.</p>
            </div>
            <BarChart3 size={21} className="text-[#C77DFF]" />
          </div>
          <div className="grid h-72 grid-cols-6 items-end gap-4 rounded-lg border border-white/10 bg-black/10 p-4">
            {trendBars.map(([month, issued, overdue]) => (
              <div key={month} className="flex h-full flex-col justify-end gap-2">
                <div className="flex items-end gap-1">
                  <div className="w-full rounded-t bg-[#C77DFF]" style={{ height: `${issued}%` }} />
                  <div className="w-full rounded-t bg-[#FB7185]" style={{ height: `${overdue}%` }} />
                </div>
                <p className="text-center text-xs font-semibold text-[#d8c6e8]">{month}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-4 text-sm">
            <span className="inline-flex items-center gap-2 text-[#d8c6e8]"><span className="h-3 w-3 rounded bg-[#C77DFF]" />Issued</span>
            <span className="inline-flex items-center gap-2 text-[#d8c6e8]"><span className="h-3 w-3 rounded bg-[#FB7185]" />Overdue</span>
          </div>
        </section>

        <section className="neon-glass neon-border rounded-lg p-5">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Status Mix</h3>
              <p className="mt-1 text-sm text-[#d8c6e8]">Admin snapshot for invoice health.</p>
            </div>
            <PieChart size={21} className="text-[#C77DFF]" />
          </div>
          <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)] md:items-center">
            <DonutChart />
            <div className="space-y-3">
              {statusSlices.map(([label, value, color]) => (
                <div key={label} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="font-medium text-white">{label}</span>
                    <span className="text-[#d8c6e8]">{value}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/[0.08]">
                    <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <section className="neon-glass neon-border overflow-hidden rounded-lg">
        <div className="grid gap-4 border-b border-white/10 p-5 lg:grid-cols-[160px_160px_1fr_180px]">
          <label className="space-y-2">
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#C77DFF]/80">
              <CalendarDays size={14} />
              From
            </span>
            <input type="date" className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none" />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#C77DFF]/80">To</span>
            <input type="date" className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none" />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#C77DFF]/80">Report type</span>
            <select className="w-full rounded-lg border border-white/10 bg-[#140026] px-3 py-2 text-sm text-white outline-none">
              {reportCards.map((report) => <option key={report.title}>{report.title}</option>)}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#C77DFF]/80">Format</span>
            <select className="w-full rounded-lg border border-white/10 bg-[#140026] px-3 py-2 text-sm text-white outline-none">
              <option>PDF</option>
              <option>CSV</option>
            </select>
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-[#d8c6e8]">
              <tr>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Reminder Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {previewRows.map((row) => (
                <tr key={row[0]} className="text-[#f7efff]">
                  {row.map((cell) => <td key={cell} className="px-4 py-4">{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-emerald-300/20 bg-emerald-400/10 p-5">
        <div className="mb-2 flex items-center gap-2 text-emerald-100">
          <FileText size={18} />
          <p className="font-semibold">Implementation boundary</p>
        </div>
        <p className="text-sm leading-6 text-emerald-100/85">
          This design can later be connected to real API data, but the current version is visual only. It does not touch
          existing invoice logic, reminder scheduling, audit logging, role guards, or database tables.
        </p>
      </section>
    </section>
  );
}
