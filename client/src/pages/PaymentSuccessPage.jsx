/**
 * EVALUATION HEADER
 * FEATURE: INVOICE - SHARED
 * PURPOSE: Implements the Payment Success Page screen and its page-level interactions.
 * LAYER: Frontend page - renders a complete screen and coordinates its user interactions.
 * FIND RELATED CODE: Trace its imports for UI components and frontend services used by this screen.
 */
import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const invoiceId = searchParams.get("invoice");
  const sessionId = searchParams.get("session_id");

  const [status, setStatus] = useState("loading"); // loading | paid | error
  const [invoice, setInvoice] = useState(null);

  useEffect(() => {
    if (!invoiceId) { setStatus("error"); return; }

    async function confirmAndLoad() {
      try {
        // Step 1: Tell the server to mark the invoice as Paid
        // (handles webhook delay and demo mode with no real Stripe key)
        const confirmRes = await fetch(`${API_BASE}/api/payments/stripe/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoiceId, session_id: sessionId })
        });
        const confirmData = await confirmRes.json();

        if (!confirmRes.ok) {
          console.error("[PaymentSuccess] confirm failed:", confirmData.message);
          setStatus("error");
          return;
        }

        // Step 2: Load the invoice to display confirmation details
        const invoiceRes = await fetch(`${API_BASE}/api/public/invoice/${invoiceId}`);
        const invoiceData = await invoiceRes.json();

        setInvoice(invoiceData.invoice || null);

        // confirmData.status comes back as "Paid" once confirmed
        if (confirmData.status === "Paid" || invoiceData.invoice?.status === "Paid") {
          setStatus("paid");
        } else {
          // Very unlikely — server confirmed but invoice still not Paid
          setStatus("error");
        }
      } catch (err) {
        console.error("[PaymentSuccess] unexpected error:", err);
        setStatus("error");
      }
    }

    confirmAndLoad();
  }, [invoiceId, sessionId]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FFF8F5] px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-10 text-center shadow-lg">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#f0d2ca] border-t-[#F38978]" />
          <p className="text-sm text-[#7b6660]">Confirming your payment…</p>
        </div>
      </div>
    );
  }

  if (status === "paid") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FFF8F5] px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-10 text-center shadow-lg">
          {/* Green tick */}
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF6F2]">
            <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#251E1F]">Payment Successful</h1>
          <p className="mt-2 text-sm text-[#7b6660]">
            Thank you{invoice?.customer_name ? `, ${invoice.customer_name}` : ""}! Your payment for{" "}
            <strong className="text-[#251E1F]">{invoiceId}</strong> has been confirmed.
          </p>
          {invoice?.total_amount && (
            <p className="mt-4 text-3xl font-bold text-emerald-600">
              S${Number(invoice.total_amount).toFixed(2)}
            </p>
          )}

          <p className="mt-6 text-xs text-[#7b6660]/50">Powered by Stripe • PayNivo Invoicing</p>
        </div>
      </div>
    );
  }

  // error state
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FFF8F5] px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-10 text-center shadow-lg">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#FDD9CD]">
          <svg className="h-8 w-8 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-[#251E1F]">Something went wrong</h1>
        <p className="mt-2 text-sm text-[#7b6660]">
          We couldn't confirm your payment. Please check your invoice or contact support.
        </p>
        {invoiceId && (
          <Link
            to={`/invoice/view/${invoiceId}`}
            className="mt-8 block w-full rounded-xl bg-[#F38978] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#E87562]"
          >
            Return to Invoice
          </Link>
        )}
        <p className="mt-6 text-xs text-[#7b6660]/50">Powered by Stripe • PayNivo Invoicing</p>
      </div>
    </div>
  );
}
