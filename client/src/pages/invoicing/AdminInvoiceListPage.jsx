import { ArrowLeft, Eye, Loader2, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { fetchInvoices } from "../../services/invoiceService.js";

const performancePath = "/dashboard/invoicing/admin/dashboard/invoice-performance";

function money(value) {
  return new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" }).format(Number(value || 0));
}

function date(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-SG", { dateStyle: "medium", timeZone: "Asia/Singapore" }).format(new Date(value));
}

function rangeStart(range) {
  const now = new Date();
  if (range === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === "last-7-days") return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  if (range === "last-30-days") return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
  if (range === "last-90-days") return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89);
  if (range === "this-month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (range === "this-quarter") return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  if (range === "this-year") return new Date(now.getFullYear(), 0, 1);
  return null;
}

export default function AdminInvoiceListPage() {
  const [params, setParams] = useSearchParams();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const searchParam = params.get("search") || "";
  const [query, setQuery] = useState(searchParam);
  const status = params.get("status") || "";
  const range = params.get("range") || "all-time";
  const invoiceId = params.get("invoiceId");

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchInvoices().then((response) => {
      if (active) setInvoices(response.invoices || []);
    }).catch((requestError) => {
      if (active) setError(requestError?.message || "Unable to load invoices.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setQuery(searchParam);
  }, [searchParam]);

  const filtered = useMemo(() => {
    const start = range === "custom" && params.get("startDate") ? new Date(`${params.get("startDate")}T00:00:00`) : rangeStart(range);
    const end = range === "custom" && params.get("endDate") ? new Date(`${params.get("endDate")}T23:59:59`) : new Date();
    const term = query.trim().toLowerCase();
    return invoices.filter((invoice) => {
      if (status && String(invoice.status || "").toLowerCase() !== status.toLowerCase()) return false;
      const performanceDateValue = invoice.sent_at || invoice.created_at || invoice.issue_date;
      const performanceDate = performanceDateValue ? new Date(performanceDateValue) : null;
      if (start && (!performanceDate || performanceDate < start || performanceDate > end)) return false;
      return !term || [invoice.invoiceId, invoice.customer_name, invoice.customer_email].some((value) => String(value || "").toLowerCase().includes(term));
    });
  }, [invoices, params, query, range, status]);
  const selected = invoices.find((invoice) => String(invoice.invoice_id) === String(invoiceId));

  function closeDetails() {
    const next = new URLSearchParams(params);
    next.delete("invoiceId");
    setParams(next);
  }

  return (
    <div className="space-y-5">
      <Link to={performancePath} className="inline-flex items-center gap-2 text-sm font-bold text-[#F38978] hover:underline"><ArrowLeft size={16} /> Back to Invoice Performance</Link>
      <header><h1 className="text-3xl font-bold text-[#251E1F]">Invoices</h1><p className="mt-1 text-sm text-[#7b6660]">Read-only Admin view of the same invoice records used by Finance.</p></header>
      <section className="rounded-2xl border border-[#f0d2ca] bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-[#7b6660]">{status ? `${status[0].toUpperCase()}${status.slice(1)} invoices` : "All invoices"}</p><label className="relative"><Search size={16} className="absolute left-3 top-2.5 text-[#9c7b72]" /><span className="sr-only">Search invoices</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search invoice or customer" className="rounded-lg border border-[#f0d2ca] py-2 pl-9 pr-3 text-sm outline-none focus:border-[#F38978]" /></label></div>
        {loading ? <div className="flex min-h-64 items-center justify-center gap-2 text-[#7b6660]"><Loader2 className="animate-spin" size={19} /> Loading invoices...</div> : error ? <p className="rounded-xl border border-[#FDD9CD] bg-[#FDD9CD] p-4 text-sm text-red-700">{error}</p> : filtered.length ? <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-y border-[#f0d2ca] bg-[#fff8f5] text-xs uppercase text-[#7b6660]"><th className="px-4 py-3">Invoice #</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Issue Date</th><th className="px-4 py-3">Due Date</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody>{filtered.map((invoice) => <tr key={invoice.invoice_id} className="border-b border-[#FFF3EE]"><td className="px-4 py-3 font-bold">{invoice.invoiceId}</td><td className="px-4 py-3"><strong>{invoice.customer_name}</strong><p className="text-xs text-[#7b6660]">{invoice.customer_email}</p></td><td className="px-4 py-3">{date(invoice.issue_date)}</td><td className="px-4 py-3">{date(invoice.due_date)}</td><td className="px-4 py-3"><span className="rounded-full bg-[#fff0eb] px-2.5 py-1 text-xs font-bold">{invoice.status}</span></td><td className="px-4 py-3 text-right font-semibold">{money(invoice.total_amount)}</td><td className="px-4 py-3 text-right"><button type="button" onClick={() => { const next = new URLSearchParams(params); next.set("invoiceId", invoice.invoice_id); setParams(next); }} className="inline-flex items-center gap-1 font-bold text-[#F38978] hover:underline"><Eye size={15} /> View Invoice</button></td></tr>)}</tbody></table></div> : <p className="rounded-xl border border-dashed border-[#F0D2CA] bg-[#fff8f5] p-12 text-center text-sm text-[#7b6660]">No invoices found for these filters.</p>}
      </section>
      {invoiceId ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#251E1F]/35 p-4" role="dialog" aria-modal="true" aria-label="Invoice details"><section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold">{selected?.invoiceId || "Invoice"}</h2><p className="text-sm text-[#7b6660]">Read-only invoice details</p></div><button type="button" onClick={closeDetails} aria-label="Close invoice details" className="rounded-lg p-2 hover:bg-[#fff8f5]"><X size={20} /></button></div>{selected ? <div className="mt-5 grid gap-4 sm:grid-cols-2"><div><p className="text-xs font-bold uppercase text-[#7b6660]">Customer</p><p className="mt-1 font-semibold">{selected.customer_name}</p><p className="text-sm text-[#7b6660]">{selected.customer_email}</p></div><div><p className="text-xs font-bold uppercase text-[#7b6660]">Status</p><p className="mt-1 font-semibold">{selected.status}</p></div><div><p className="text-xs font-bold uppercase text-[#7b6660]">Issue / Due</p><p className="mt-1">{date(selected.issue_date)} / {date(selected.due_date)}</p></div><div><p className="text-xs font-bold uppercase text-[#7b6660]">Total</p><p className="mt-1 text-lg font-bold">{money(selected.total_amount)}</p></div><div className="sm:col-span-2"><p className="mb-2 text-xs font-bold uppercase text-[#7b6660]">Items</p>{selected.items?.length ? <div className="space-y-2">{selected.items.map((item, index) => <div key={item.item_id || index} className="flex justify-between gap-4 rounded-lg bg-[#fff8f5] p-3 text-sm"><span>{item.description}</span><strong>{money(item.amount)}</strong></div>)}</div> : <p className="text-sm text-[#7b6660]">No line items available.</p>}</div></div> : <p className="mt-6 text-sm text-red-700">Invoice not found.</p>}</section></div> : null}
    </div>
  );
}
