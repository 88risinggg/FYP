import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const invoiceId = searchParams.get("invoice");
  const sessionId = searchParams.get("session_id");

  const [status, setStatus] = useState("loading"); // loading | paid | pending | error
  const [invoice, setInvoice] = useState(null);

  useEffect(() => {
    if (!invoiceId) { setStatus("error"); return; }

    // Poll the public invoice endpoint to confirm paid status
    // Stripe webhook updates the DB — give it a moment to process
    let attempts = 0;
    const maxAttempts = 8;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`${API_BASE}/api/public/invoice/${invoiceId}`);
        const data = await res.json();
        if (data.invoice?.status === "Paid") {
          setInvoice(data.invoice);
          setStatus("paid");
          clearInterval(interval);
        } else if (attempts >= maxAttempts) {
          // Webhook may still be processing — show pending state
          setInvoice(data.invoice);
          setStatus("pending");
          clearInterval(interval);
        }
      } catch {
        if (attempts >= maxAttempts) {
          setStatus("error");
          clearInterval(interval);
        }
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [invoiceId]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f5f5f5] px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-10 text-center shadow-lg">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#f0d2ca] border-t-[#F38978]" />
          <p className="text-sm text-[#7b6660]">Confirming your payment…</p>
        </div>
      </div>
    );
  }

  if (status === "paid") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f5f5f5] px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-10 text-center shadow-lg">
          {/* Green tick */}
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#061e4b]">Payment Successful</h1>
          <p className="mt-2 text-sm text-[#7b6660]">
            Thank you{invoice?.customer_name ? `, ${invoice.customer_name}` : ""}! Your payment for{" "}
            <strong className="text-[#251E1F]">{invoiceId}</strong> has been confirmed.
          </p>
          {invoice?.total_amount && (
            <p className="mt-4 text-3xl font-bold text-emerald-600">
              S${Number(invoice.total_amount).toFixed(2)}
            </p>
          )}
          <div className="mt-8 space-y-3">
            <Link
              to={`/invoice/view/${invoiceId}`}
              className="block w-full rounded-xl bg-[#061e4b] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0a2d6b]"
            >
              View Invoice
            </Link>
          </div>
          <p className="mt-6 text-xs text-[#7b6660]/50">Powered by Stripe • Vaniday Invoicing</p>
        </div>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f5f5f5] px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-10 text-center shadow-lg">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <svg className="h-8 w-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#061e4b]">Payment Processing</h1>
          <p className="mt-2 text-sm text-[#7b6660]">
            Your payment for <strong className="text-[#251E1F]">{invoiceId}</strong> is being processed.
            This usually takes a few seconds.
          </p>
          <div className="mt-8 space-y-3">
            <Link
              to={`/invoice/view/${invoiceId}`}
              className="block w-full rounded-xl bg-[#061e4b] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0a2d6b]"
            >
              Check Invoice Status
            </Link>
          </div>
          <p className="mt-6 text-xs text-[#7b6660]/50">Powered by Stripe • Vaniday Invoicing</p>
        </div>
      </div>
    );
  }

  // error state
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f5f5f5] px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-10 text-center shadow-lg">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-rose-100">
          <svg className="h-8 w-8 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-[#061e4b]">Something went wrong</h1>
        <p className="mt-2 text-sm text-[#7b6660]">
          We couldn't confirm your payment. Please check your invoice or contact support.
        </p>
        {invoiceId && (
          <Link
            to={`/invoice/view/${invoiceId}`}
            className="mt-8 block w-full rounded-xl bg-[#061e4b] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0a2d6b]"
          >
            Return to Invoice
          </Link>
        )}
        <p className="mt-6 text-xs text-[#7b6660]/50">Powered by Stripe • Vaniday Invoicing</p>
      </div>
    </div>
  );
}
