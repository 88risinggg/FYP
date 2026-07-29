/**
 * EVALUATION HEADER
 * FEATURE: INVOICE - ADMIN
 * PURPOSE: Implements the Admin Invoicing Record Page screen and its page-level interactions.
 * LAYER: Frontend page - renders a complete screen and coordinates its user interactions.
 * FIND RELATED CODE: Trace its imports for UI components and frontend services used by this screen.
 */
import { CreditCard, FileText, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import AdminInvoicingFullView, { displayValue, FullViewError, FullViewLoading, FullViewStatus } from "../../components/invoicing/AdminInvoicingFullView.jsx";
import { fetchAdminPaymentUpdates } from "../../services/adminDashboardService.js";
import { fetchInvoices } from "../../services/invoiceService.js";

const basePath = "/dashboard/invoicing/admin";

function money(value) {
  return new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" }).format(Number(value || 0));
}

function dateTime(value) {
  if (!value) return "\u2014";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "\u2014";
  return new Intl.DateTimeFormat("en-SG", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Singapore" }).format(date);
}

function fallbackFor(from, mode) {
  if (from === "status-changes") return `${basePath}/dashboard/invoice-performance/status-changes`;
  if (from === "email-delivery") return `${basePath}/email-delivery/logs`;
  if (mode === "payment") return `${basePath}/payment-updates`;
  return `${basePath}/dashboard/payment-reminder-summary`;
}

export default function AdminInvoicingRecordPage({ mode }) {
  const { recordId } = useParams();
  const [searchParams] = useSearchParams();
  const from = searchParams.get("from") || "";
  const backTo = fallbackFor(from, mode);
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      if (!recordId) throw new Error(`A valid ${mode} identifier is required.`);
      if (mode === "payment") {
        const response = await fetchAdminPaymentUpdates({ recordId, page: 1, pageSize: 5 });
        setRecord((response.records || []).find((item) => String(item.id) === String(recordId) || String(item.reference) === String(recordId)) || null);
      } else {
        const response = await fetchInvoices();
        setRecord((response.invoices || []).find((item) => String(item.invoice_id) === String(recordId)) || null);
      }
    } catch (requestError) {
      setError(requestError?.message || `Unable to load the ${mode} record.`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [mode, recordId]);

  const title = mode === "payment" ? "Payment Details" : "Invoice Details";
  return (
    <AdminInvoicingFullView title={title} description={`Read-only Admin view of the selected ${mode} record.`} backTo={backTo} backLabel={mode === "payment" ? "Back to Payment Update History" : "Back to Previous Invoicing Page"} icon={mode === "payment" ? CreditCard : FileText} actions={<button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-[#ead3cc] bg-white px-4 py-2 text-sm font-bold hover:border-[#F38978] disabled:opacity-60"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh</button>}>
      {error ? <FullViewError message={error} onRetry={load} backTo={backTo} backLabel="Back to Previous Invoicing Page" /> : loading ? <section className="rounded-lg border border-[#f0d2ca] bg-white"><FullViewLoading label={`Loading ${mode} details...`} /></section> : !record ? <FullViewError message={`The requested ${mode} record was not found.`} onRetry={load} backTo={backTo} backLabel="Back to Previous Invoicing Page" /> : mode === "payment" ? <PaymentDetails payment={record} /> : <InvoiceDetails invoice={record} />}
    </AdminInvoicingFullView>
  );
}

function PaymentDetails({ payment }) {
  return (
    <section className="rounded-lg border border-[#f0d2ca] bg-white p-5">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"><Field label="Payment Reference" value={payment.reference} /><Field label="Updated At" value={dateTime(payment.date)} /><Field label="Payment Method" value={payment.paymentMethod} /><div><p className="text-xs font-bold uppercase text-[#7b6660]">Status</p><div className="mt-1"><FullViewStatus value={payment.status} /></div></div><Field label="Invoice Number" value={payment.invoiceNo} /><Field label="Customer" value={payment.customerName} /><Field label="Amount" value={money(payment.amount)} /><Field label="Updated By" value={payment.updatedBy || "System"} /></div>
      <div className="mt-6 flex flex-wrap gap-3 border-t border-[#f4ded7] pt-4">{payment.invoiceId ? <Link to={`${basePath}/invoice-records/${payment.invoiceId}?from=payment-updates`} className="rounded-lg border border-[#ead3cc] px-4 py-2 text-sm font-bold text-[#F38978]">View Invoice</Link> : <button type="button" disabled title="No related invoice is available" className="rounded-lg border border-[#ead3cc] px-4 py-2 text-sm font-bold opacity-50">View Invoice</button>}<Link to={`${basePath}/audit-trail?keyword=${encodeURIComponent(payment.reference || payment.id)}&from=payment-updates`} className="rounded-lg border border-[#ead3cc] px-4 py-2 text-sm font-bold text-[#F38978]">View Audit Log</Link></div>
    </section>
  );
}

function InvoiceDetails({ invoice }) {
  return (
    <section className="rounded-lg border border-[#f0d2ca] bg-white p-5">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"><Field label="Invoice Number" value={invoice.invoiceId} /><Field label="Customer" value={invoice.customer_name} /><Field label="Customer Email" value={invoice.customer_email} /><div><p className="text-xs font-bold uppercase text-[#7b6660]">Status</p><div className="mt-1"><FullViewStatus value={invoice.status} /></div></div><Field label="Issue Date" value={dateTime(invoice.issue_date)} /><Field label="Due Date" value={dateTime(invoice.due_date)} /><Field label="Total Amount" value={money(invoice.total_amount)} /><Field label="Created At" value={dateTime(invoice.created_at)} /></div>
      <div className="mt-6 border-t border-[#f4ded7] pt-4"><h2 className="text-sm font-bold">Invoice Items</h2>{invoice.items?.length ? <div className="mt-3 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="bg-[#fff8f5] text-xs uppercase text-[#7b6660]"><th className="px-3 py-2">Description</th><th className="px-3 py-2 text-right">Quantity</th><th className="px-3 py-2 text-right">Unit Price</th><th className="px-3 py-2 text-right">Amount</th></tr></thead><tbody>{invoice.items.map((item, index) => <tr key={item.item_id || index} className="border-b border-[#f4ded7]"><td className="px-3 py-3">{displayValue(item.description)}</td><td className="px-3 py-3 text-right">{displayValue(item.quantity)}</td><td className="px-3 py-3 text-right">{money(item.unit_price)}</td><td className="px-3 py-3 text-right font-bold">{money(item.amount)}</td></tr>)}</tbody></table></div> : <p className="mt-3 text-sm text-[#7b6660]">No line items are available for this invoice.</p>}</div>
    </section>
  );
}

function Field({ label, value }) {
  return <div className="min-w-0"><p className="text-xs font-bold uppercase text-[#7b6660]">{label}</p><p className="mt-1 break-words text-sm font-semibold">{displayValue(value)}</p></div>;
}
