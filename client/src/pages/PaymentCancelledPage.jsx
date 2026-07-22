import { useSearchParams, Link } from "react-router-dom";

export default function PaymentCancelledPage() {
  const [searchParams] = useSearchParams();
  const invoiceId = searchParams.get("invoice");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FFF8F5] px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-10 text-center shadow-lg">
        {/* Grey X icon */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF6F2]">
          <svg className="h-8 w-8 text-[#7B6660]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-[#251E1F]">Payment Cancelled</h1>
        <p className="mt-2 text-sm text-[#7b6660]">
          You cancelled the payment{invoiceId ? ` for invoice ${invoiceId}` : ""}. No charge was made.
        </p>
        <p className="mt-3 text-sm text-[#7b6660]">
          You can try again any time from your invoice page.
        </p>
        <div className="mt-8 space-y-3">
          {invoiceId && (
            <Link
              to={`/invoice/view/${invoiceId}`}
              className="block w-full rounded-xl bg-[#F38978] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#E87562]"
            >
              Try Again
            </Link>
          )}
          <p className="text-xs text-[#7b6660]/60">Your invoice link remains active until the due date.</p>
        </div>
        <p className="mt-6 text-xs text-[#7b6660]/50">Powered by Stripe • PayNivo Invoicing</p>
      </div>
    </div>
  );
}
