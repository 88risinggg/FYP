import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import InvoiceTemplate from "../components/invoicing/InvoiceTemplate.jsx";

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
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    payment_date: new Date().toISOString().slice(0, 10),
    reference_number: "",
    payment_method: "Bank Transfer",
    notes: ""
  });
  const [proofFile, setProofFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);

  useEffect(() => {
    async function loadInvoice() {
      try {
        const res = await fetch(`${API_BASE}/api/public/invoice/${invoiceId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Invoice not found");
        setInvoice(data.invoice);
        if (data.settings) setSettings(data.settings);
        if (data.invoice?.total_amount) {
          setPaymentForm(prev => ({ ...prev, amount: String(data.invoice.total_amount) }));
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadInvoice();
  }, [invoiceId]);

  async function handleSubmitPayment(e) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitResult(null);

    try {
      const formData = new FormData();
      formData.append("amount", paymentForm.amount);
      formData.append("payment_date", paymentForm.payment_date);
      if (paymentForm.reference_number) formData.append("reference_number", paymentForm.reference_number);
      if (paymentForm.payment_method) formData.append("payment_method", paymentForm.payment_method);
      if (paymentForm.notes) formData.append("notes", paymentForm.notes);
      if (proofFile) formData.append("proof", proofFile);

      const res = await fetch(`${API_BASE}/api/public/invoice/${invoiceId}/submit-payment`, {
        method: "POST",
        body: formData
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Submission failed");

      setSubmitResult({ success: true, message: data.message });
      setShowPaymentForm(false);
      setInvoice(prev => ({ ...prev, status: "Pending Review", is_pending_review: true }));
    } catch (err) {
      setSubmitResult({ success: false, message: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fff8f5]">
        <p className="text-[#7b6660]">Loading invoice...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fff8f5]">
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-8 text-center">
          <h1 className="text-xl font-semibold text-rose-700">Invoice Not Found</h1>
          <p className="mt-2 text-sm text-rose-700/70">{error}</p>
        </div>
      </div>
    );
  }

  const isPayable = !["Paid", "Cancelled", "Refunded", "Pending Review"].includes(invoice.status);

  return (
    <div className="min-h-screen bg-[#f5f5f5] px-4 py-8">
      <div className="mx-auto max-w-[900px]">
        {/* Invoice Template — same component used for PDF and Admin Preview */}
        <div
          style={{
            boxShadow: "0 4px 25px rgba(0,0,0,0.1)",
            borderRadius: "4px",
            overflow: "visible",
            marginBottom: "2rem",
          }}
        >
          <InvoiceTemplate
            invoice={{
              ...invoice,
              invoiceId: invoice.invoiceId || invoice.invoice_number || invoiceId,
            }}
            settings={settings || {}}
            options={{
              logoUrl: settings?.companyLogoUrl || settings?.branding?.companyLogoUrl || "",
              qrCodeUrl: "",
              stripeQrCodeUrl: invoice.qr_code || invoice.qr_code_url || "",
              paymentUrl: invoice.payment_url ? String(invoice.payment_url) : "",
              signatureUrl: settings?.signatureUrl || "",
              stampUrl: settings?.companyStampUrl || settings?.branding?.companyStampUrl || "",
            }}
          />
        </div>

        {/* Payment Actions Section */}
        <div className="mx-auto max-w-3xl">
          {/* Success/Error Message */}
          {submitResult && (
            <div className={`mb-4 rounded-xl border p-4 text-center text-sm ${
              submitResult.success
                ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-700"
                : "border-rose-400/30 bg-rose-500/10 text-rose-700"
            }`}>
              {submitResult.message}
            </div>
          )}

          {invoice.status === "Paid" ? (
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-center">
              <p className="text-sm font-semibold text-emerald-700">
                ✅ This invoice has been paid{invoice.paid_date ? ` on ${formatDate(invoice.paid_date)}` : ""}. Thank you!
              </p>
            </div>
          ) : invoice.status === "Pending Review" || invoice.is_pending_review ? (
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-center">
              <p className="text-sm font-semibold text-amber-700">
                ⏳ Your payment is being reviewed. You will be notified once it is confirmed.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Online Payment Button (Stripe) */}
              {invoice.payment_url && (
                <a
                  href={invoice.payment_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full rounded-xl bg-[#061e4b] px-6 py-4 text-center text-sm font-semibold text-white transition hover:bg-[#0a2d6b]"
                >
                  Pay Online with Card / PayNow — {formatCurrency(invoice.total_amount)}
                </a>
              )}

              {/* Manual Payment Option */}
              <div className="rounded-xl border border-[#f0d2ca] bg-white p-4">
                <p className="text-sm text-[#7b6660]">
                  Already paid via Bank Transfer or PayNow?
                </p>
                <button
                  onClick={() => setShowPaymentForm(!showPaymentForm)}
                  className="mt-2 rounded-lg bg-[#F38978] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#e07868]"
                >
                  {showPaymentForm ? "Cancel" : "Submit Payment Proof"}
                </button>

                {showPaymentForm && (
                  <form onSubmit={handleSubmitPayment} className="mt-4 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium text-[#7b6660]">Payment Amount (SGD) *</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={paymentForm.amount}
                          onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-sm text-[#251E1F] outline-none focus:border-[#F38978]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#7b6660]">Payment Date *</label>
                        <input
                          type="date"
                          required
                          value={paymentForm.payment_date}
                          onChange={(e) => setPaymentForm(prev => ({ ...prev, payment_date: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-sm text-[#251E1F] outline-none focus:border-[#F38978]"
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium text-[#7b6660]">Reference Number</label>
                        <input
                          type="text"
                          value={paymentForm.reference_number}
                          onChange={(e) => setPaymentForm(prev => ({ ...prev, reference_number: e.target.value }))}
                          placeholder="e.g. TXN123456"
                          className="mt-1 w-full rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-sm text-[#251E1F] outline-none focus:border-[#F38978]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#7b6660]">Payment Method</label>
                        <select
                          value={paymentForm.payment_method}
                          onChange={(e) => setPaymentForm(prev => ({ ...prev, payment_method: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-sm text-[#251E1F] outline-none focus:border-[#F38978]"
                        >
                          <option value="Bank Transfer">Bank Transfer</option>
                          <option value="PayNow">PayNow</option>
                          <option value="Cash">Cash</option>
                          <option value="Credit Card">Credit Card</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#7b6660]">Payment Proof (Screenshot)</label>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => setProofFile(e.target.files[0] || null)}
                        className="mt-1 w-full rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-sm text-[#251E1F]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#7b6660]">Notes (optional)</label>
                      <textarea
                        value={paymentForm.notes}
                        onChange={(e) => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
                        rows={2}
                        className="mt-1 w-full rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-sm text-[#251E1F] outline-none focus:border-[#F38978]"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {submitting ? "Submitting..." : "Submit Payment for Review"}
                    </button>
                  </form>
                )}
              </div>

              <div className="rounded-xl border border-[#F38978]/30 bg-[#F38978]/10 p-4 text-center">
                <p className="text-sm text-[#7b6660]">
                  Payment is due by <strong className="text-[#251E1F]">{formatDate(invoice.due_date)}</strong>.
                </p>
              </div>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-[#7b6660]/50">
          Generated by Vaniday • Automated Invoicing & Payroll System
        </p>
      </div>
    </div>
  );
}
