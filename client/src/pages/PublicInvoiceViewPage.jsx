import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-SG", { year: "numeric", month: "short", day: "2-digit" }).format(new Date(value));
}

export default function PublicInvoiceViewPage() {
  const { invoiceId } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInvoice() {
      try {
        const res = await fetch(`${API_BASE}/api/public/invoice/${invoiceId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Invoice not found");
        setInvoice(data.invoice);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadInvoice();
  }, [invoiceId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090014]">
        <p className="text-[#d8c6e8]">Loading invoice...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090014]">
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-8 text-center">
          <h1 className="text-xl font-semibold text-rose-200">Invoice Not Found</h1>
          <p className="mt-2 text-sm text-rose-100/70">{error}</p>
        </div>
      </div>
    );
  }

  const statusColor = {
    Draft: "bg-slate-500",
    Scheduled: "bg-violet-500",
    Sent: "bg-blue-500",
    Viewed: "bg-cyan-500",
    Paid: "bg-emerald-500",
    Overdue: "bg-rose-500"
  };

  return (
    <div className="min-h-screen bg-[#090014] px-4 py-12">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="rounded-t-2xl border border-white/10 bg-white/[0.04] p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[#C77DFF]">PayNivo</h1>
              <p className="mt-1 text-sm text-[#d8c6e8]/70">Automated Invoicing System</p>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-semibold text-white">{invoice.invoiceId}</h2>
              <div className="mt-2 inline-flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${statusColor[invoice.status] || "bg-white"}`} />
                <span className="text-sm font-medium text-[#d8c6e8]">{invoice.status}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Invoice Details */}
        <div className="border-x border-white/10 bg-white/[0.02] p-8">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase text-[#C77DFF]/70">Bill To</p>
              <p className="mt-2 text-lg font-semibold text-white">{invoice.customer_name}</p>
              <p className="text-sm text-[#d8c6e8]/70">{invoice.customer_email}</p>
              {invoice.customer_address ? (
                <p className="mt-1 text-sm text-[#d8c6e8]/70">{invoice.customer_address}</p>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-[#d8c6e8]/60">Issue Date</p>
                <p className="mt-1 text-sm font-medium text-white">{formatDate(invoice.issue_date)}</p>
              </div>
              <div>
                <p className="text-xs text-[#d8c6e8]/60">Due Date</p>
                <p className="mt-1 text-sm font-medium text-white">{formatDate(invoice.due_date)}</p>
              </div>
            </div>
          </div>

          {/* Line Items */}
          {invoice.items && invoice.items.length > 0 ? (
            <div className="mt-8 overflow-hidden rounded-xl border border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/[0.06] text-xs uppercase text-[#d8c6e8]/70">
                  <tr>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="px-4 py-3 text-right">Unit Price</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {invoice.items.map((item, idx) => (
                    <tr key={idx} className="text-[#f7edff]">
                      <td className="px-4 py-3">{item.description}</td>
                      <td className="px-4 py-3 text-right">{item.quantity}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(item.unit_price)}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        {/* Total & Payment */}
        <div className="rounded-b-2xl border border-white/10 bg-white/[0.04] p-8">
          <div className="flex items-center justify-between">
            <span className="text-lg text-[#d8c6e8]">Total Amount</span>
            <span className="text-3xl font-bold text-white">{formatCurrency(invoice.total_amount)}</span>
          </div>

          {invoice.status !== "Paid" ? (
            <div className="mt-6 rounded-xl border border-[#C77DFF]/30 bg-[#C77DFF]/10 p-4 text-center">
              <p className="text-sm text-[#d8c6e8]">
                Payment is due by <strong className="text-white">{formatDate(invoice.due_date)}</strong>.
                Please contact the sender for payment instructions.
              </p>
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-center">
              <p className="text-sm font-semibold text-emerald-200">
                ✓ This invoice has been paid. Thank you!
              </p>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-[#d8c6e8]/50">
          Generated by PayNivo • Automated Invoicing & Payroll System
        </p>
      </div>
    </div>
  );
}
