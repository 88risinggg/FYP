/**
 * EVALUATION HEADER
 * FEATURE: SECURITY / ACCESS
 * PURPOSE: Implements the reusable Auth Layout interface component.
 * LAYER: Frontend component - provides reusable interface and interaction logic.
 * FIND RELATED CODE: Use Find All References to locate the pages that render this component.
 */
import { Link } from "react-router-dom";
import PayNivoLogo from "../branding/PayNivoLogo.jsx";

export default function AuthLayout({ title, description, children }) {
  return (
    <main className="min-h-screen bg-[#fff8f5] px-4 py-8 text-[#251E1F] sm:py-12">
      <div className="mx-auto w-full max-w-lg">
        <Link
          to="/"
          className="inline-flex rounded-lg focus:outline-none focus:ring-4 focus:ring-[#F38978]/20"
          aria-label="Return to home"
        >
          <PayNivoLogo compact />
        </Link>
        <section className="mt-8 rounded-lg border border-[#f0d2ca] bg-white p-6 shadow-xl shadow-[#6f5b55]/10 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-normal">{title}</h1>
          {description && <p className="mt-2 text-sm leading-6 text-[#7b6660]">{description}</p>}
          <div className="mt-7">{children}</div>
        </section>
      </div>
    </main>
  );
}
