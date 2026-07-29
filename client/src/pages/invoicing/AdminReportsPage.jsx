/**
 * EVALUATION HEADER
 * FEATURE: INVOICE - ADMIN
 * PURPOSE: Implements the Admin Reports Page screen and its page-level interactions.
 * LAYER: Frontend page - renders a complete screen and coordinates its user interactions.
 * FIND RELATED CODE: Trace its imports for UI components and frontend services used by this screen.
 */
import {
  AlertCircle,
  BarChart3,
  Download,
  FileBarChart,
  Landmark,
  Loader2,
  PieChart,
  ReceiptText,
  TrendingUp,
  Users
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { fetchFinancialExport, fetchInvoiceReports } from "../../services/invoiceService.js";

const reportTabs = [
  { key: "overview", label: "Overview", icon: FileBarChart },
  { key: "revenue", label: "Revenue", icon: TrendingUp },
  { key: "receivables", label: "Receivables", icon: ReceiptText },
  { key: "customers", label: "Customers", icon: Users },
  { key: "statement", label: "Statement", icon: Landmark }
];

function formatCurrency(value) {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD"
  }).format(Number(value || 0));
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function downloadJson(data, fileName) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function MetricCard({ label, value, detail, icon: Icon, tone = "text-[#251E1F]" }) {
  return (
    <article className="app-panel rounded-lg p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#7b6660]">{label}</p>
          <p className={`mt-3 text-2xl font-bold ${tone}`}>{value}</p>
          {detail ? <p className="mt-2 text-xs font-semibold text-[#7b6660]">{detail}</p> : null}
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#F38978]/12 text-[#F38978] ring-1 ring-[#F38978]/25">
          <Icon size={21} />
        </div>
      </div>
    </article>
  );
}

function SectionPanel({ title, eyebrow, children, action }) {
  return (
    <section className="app-panel rounded-lg p-5">
      <div className="mb-5 flex flex-col gap-3 border-b border-[#f0d2ca] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {eyebrow ? <p className="text-xs font-bold uppercase tracking-wide text-[#F38978]">{eyebrow}</p> : null}
          <h3 className="mt-1 text-lg font-bold text-[#251E1F]">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function BarList({ data = [], labelKey, valueKey, valueFormatter = formatCurrency }) {
  const maxValue = Math.max(...data.map((item) => Number(item[valueKey] || 0)), 1);

  if (!data.length) {
    return <div className="rounded-lg border border-dashed border-[#ead3cc] p-8 text-center text-sm text-[#7b6660]">No report data available.</div>;
  }

  return (
    <div className="space-y-4">
      {data.map((item) => {
        const value = Number(item[valueKey] || 0);
        const width = Math.max(6, Math.round((value / maxValue) * 100));

        return (
          <div key={`${item[labelKey]}-${value}`} className="grid gap-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-[#251E1F]">{item[labelKey] || "Unassigned"}</span>
              <span className="text-right font-bold text-[#251E1F]">{valueFormatter(value)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#fff3ee]">
              <div className="h-full rounded-full bg-[#F38978]" style={{ width: `${width}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RevenueLineChart({ data = [] }) {
  const width = 720;
  const height = 220;
  const chartData = data.slice(-12);
  const maxValue = Math.max(...chartData.map((item) => Number(item.revenue || 0)), 1);
  const points = chartData.map((item, index) => {
    const x = chartData.length === 1 ? width / 2 : (index / (chartData.length - 1)) * width;
    const y = height - (Number(item.revenue || 0) / maxValue) * (height - 32) - 16;
    return `${x},${y}`;
  });

  if (!chartData.length) {
    return <div className="rounded-lg border border-dashed border-[#ead3cc] p-8 text-center text-sm text-[#7b6660]">No monthly revenue data available.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height + 42}`} className="min-w-[640px]">
        <line x1="0" y1={height} x2={width} y2={height} stroke="#ead3cc" />
        <polyline fill="none" stroke="#F38978" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" points={points.join(" ")} />
        {chartData.map((item, index) => {
          const x = chartData.length === 1 ? width / 2 : (index / (chartData.length - 1)) * width;
          const y = height - (Number(item.revenue || 0) / maxValue) * (height - 32) - 16;
          return (
            <g key={item.month || index}>
              <circle cx={x} cy={y} r="5" fill="#F38978" stroke="white" strokeWidth="2" />
              <text x={x} y={height + 22} textAnchor="middle" fill="#7b6660" fontSize="12" fontWeight="700">
                {item.month}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function DataTable({ columns, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-[#f0d2ca] bg-[#fff8f5] text-xs font-bold uppercase text-[#7b6660]">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={`px-4 py-3 ${column.align === "right" ? "text-right" : ""}`}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f0d2ca]">
          {rows.length ? rows.map((row, index) => (
            <tr key={row.id || row.name || row.month || row.status || row.bucket || index} className="text-[#251E1F]">
              {columns.map((column) => (
                <td key={column.key} className={`px-4 py-3 ${column.align === "right" ? "text-right font-semibold" : ""}`}>
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          )) : (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-[#7b6660]">No records found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function StatementView({ statement }) {
  const income = statement?.incomeStatement || {};
  const cash = statement?.cashFlow || {};
  const ratios = statement?.ratios || {};
  const groups = [
    {
      title: "Income Statement",
      rows: [
        ["Total Revenue", formatCurrency(income.totalInflow)],
        ["Salon Payouts", `-${formatCurrency(income.salonPayouts)}`],
        ["Gross Revenue", formatCurrency(income.grossRevenue)],
        ["Collected Commission", formatCurrency(income.collections)],
        ["Outstanding Commission", formatCurrency(income.outstanding)],
        ["Overdue Amount", formatCurrency(income.overdue)]
      ]
    },
    {
      title: "Cash Flow",
      rows: [
        ["Customer Payments In", formatCurrency(cash.totalInflow)],
        ["Salon Payouts Out", `-${formatCurrency(cash.salonPayouts)}`],
        ["Net Platform Cash", formatCurrency(cash.platformRevenue)],
        ["Pending Inflow", formatCurrency(cash.pendingInflow)],
        ["This Month Revenue", formatCurrency(cash.thisMonthRevenue)],
        ["Month Growth", formatPercent(cash.monthOverMonthGrowth)]
      ]
    },
    {
      title: "Ratios",
      rows: [
        ["Collection Rate", formatPercent(ratios.collectionRate)],
        ["Average Invoice Value", formatCurrency(ratios.avgInvoiceValue)],
        ["Average Commission Rate", formatPercent(ratios.avgCommissionRate)],
        ["Revenue Per Customer", formatCurrency(ratios.revenuePerCustomer)],
        ["Paid Invoices", ratios.paidInvoiceCount || 0],
        ["Overdue Invoices", ratios.overdueInvoiceCount || 0]
      ]
    }
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {groups.map((group) => (
        <div key={group.title} className="rounded-lg border border-[#f0d2ca] bg-white/90 p-4">
          <h4 className="text-sm font-bold uppercase tracking-wide text-[#F38978]">{group.title}</h4>
          <div className="mt-4 space-y-3">
            {group.rows.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 text-sm">
                <span className="text-[#7b6660]">{label}</span>
                <span className="text-right font-bold text-[#251E1F]">{value}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  async function loadReports() {
    setLoading(true);
    setError("");
    try {
      setReports(await fetchInvoiceReports());
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, []);

  const summary = reports?.summary || {};
  const statement = reports?.financialStatement || {};
  const collectionRate = statement?.ratios?.collectionRate || 0;
  const reportGeneratedAt = useMemo(() => new Date().toLocaleString("en-SG"), [reports]);

  async function handleExport() {
    setExporting(true);
    setError("");
    try {
      const data = await fetchFinancialExport();
      downloadJson(data, `admin-invoice-report-${new Date().toISOString().slice(0, 10)}.json`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setExporting(false);
    }
  }

  const monthlyColumns = [
    { key: "month", label: "Month" },
    { key: "invoice_count", label: "Invoices", align: "right" },
    { key: "revenue", label: "Revenue", align: "right", render: (row) => formatCurrency(row.revenue) },
    { key: "collected", label: "Collected", align: "right", render: (row) => formatCurrency(row.collected) },
    { key: "commission", label: "Commission", align: "right", render: (row) => formatCurrency(row.commission) },
    { key: "salon_payout", label: "Salon Payout", align: "right", render: (row) => formatCurrency(row.salon_payout) }
  ];
  const statusColumns = [
    { key: "status", label: "Status" },
    { key: "count", label: "Invoices", align: "right" },
    { key: "total", label: "Total Amount", align: "right", render: (row) => formatCurrency(row.total) }
  ];
  const customerColumns = [
    { key: "name", label: "Customer" },
    { key: "invoice_count", label: "Invoices", align: "right" },
    { key: "total", label: "Total Inflow", align: "right", render: (row) => formatCurrency(row.total) },
    { key: "commission", label: "Commission", align: "right", render: (row) => formatCurrency(row.commission) }
  ];

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-bold text-[#F38978]">Admin Invoicing Reports</p>
          <h2 className="mt-1 text-2xl font-bold text-[#251E1F]">Reports</h2>
          <p className="mt-2 text-sm text-[#7b6660]">Generated {reportGeneratedAt}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || loading}
            className="primary-button inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold disabled:opacity-60"
          >
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Export Report
          </button>
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-700">
          <AlertCircle size={16} />
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="app-panel rounded-lg p-8 text-center text-sm font-semibold text-[#7b6660]">
          <Loader2 size={20} className="mr-2 inline animate-spin" />
          Loading reports...
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Total Revenue" value={formatCurrency(summary.total_revenue)} detail={`${summary.invoice_count || 0} invoices`} icon={ReceiptText} />
            <MetricCard label="Gross Revenue" value={formatCurrency(summary.gross_revenue)} detail="Platform commission" icon={TrendingUp} tone="text-emerald-700" />
            <MetricCard label="Salon Payouts" value={formatCurrency(summary.total_salon_payout)} detail="Partner share" icon={Landmark} tone="text-amber-700" />
            <MetricCard label="Outstanding" value={formatCurrency(summary.outstanding_revenue)} detail={`${formatPercent(collectionRate)} collected`} icon={BarChart3} tone="text-rose-700" />
            <MetricCard label="Avg Commission" value={formatPercent(summary.avg_commission_rate)} detail={`${statement?.ratios?.totalCustomers || 0} customers`} icon={PieChart} tone="text-[#2D7C83]" />
          </div>

          <div className="flex gap-2 overflow-x-auto border-b border-[#f0d2ca] pb-1">
            {reportTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`inline-flex items-center gap-2 whitespace-nowrap rounded-t-lg px-4 py-2.5 text-sm font-bold transition ${
                    isActive
                      ? "border-b-2 border-[#F38978] bg-[#FDD9CD]/30 text-[#251E1F]"
                      : "text-[#7b6660] hover:bg-[#FDD9CD]/15 hover:text-[#251E1F]"
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {activeTab === "overview" ? (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
              <SectionPanel title="Monthly Revenue Trend" eyebrow="Revenue">
                <RevenueLineChart data={reports?.monthlyRevenue || []} />
              </SectionPanel>
              <SectionPanel title="Invoice Status Distribution" eyebrow="Status">
                <BarList data={reports?.statusDistribution || []} labelKey="status" valueKey="total" />
              </SectionPanel>
            </div>
          ) : null}

          {activeTab === "revenue" ? (
            <SectionPanel title="Monthly Revenue Report" eyebrow="Revenue">
              <DataTable columns={monthlyColumns} rows={reports?.monthlyRevenue || []} />
            </SectionPanel>
          ) : null}

          {activeTab === "receivables" ? (
            <div className="grid gap-5 xl:grid-cols-[minmax(360px,0.7fr)_minmax(0,1fr)]">
              <SectionPanel title="Aging Receivables" eyebrow="Receivables">
                <BarList data={reports?.agingReceivables || []} labelKey="bucket" valueKey="total" />
              </SectionPanel>
              <SectionPanel title="Status Summary" eyebrow="Status">
                <DataTable columns={statusColumns} rows={reports?.statusDistribution || []} />
              </SectionPanel>
            </div>
          ) : null}

          {activeTab === "customers" ? (
            <div className="grid gap-5 xl:grid-cols-[minmax(360px,0.7fr)_minmax(0,1fr)]">
              <SectionPanel title="Top Customer Revenue" eyebrow="Customers">
                <BarList data={reports?.topCustomers || []} labelKey="name" valueKey="total" />
              </SectionPanel>
              <SectionPanel title="Customer Report" eyebrow="Customers">
                <DataTable columns={customerColumns} rows={reports?.topCustomers || []} />
              </SectionPanel>
            </div>
          ) : null}

          {activeTab === "statement" ? (
            <SectionPanel title="Financial Statement Summary" eyebrow="Statement">
              <StatementView statement={statement} />
            </SectionPanel>
          ) : null}
        </>
      )}
    </section>
  );
}
