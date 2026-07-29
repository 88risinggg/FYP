/**
 * EVALUATION HEADER
 * FEATURE: SHARED / APPLICATION CORE
 * PURPOSE: Implements the reusable Pay Nivo Logo interface component.
 * LAYER: Frontend component - provides reusable interface and interaction logic.
 * FIND RELATED CODE: Use Find All References to locate the pages that render this component.
 */
import payNivoLogo from "../../assets/paynivo-logo.png";
import payNivoLogoWhite from "../../assets/paynivo-logo-report-white.png";

export default function PayNivoLogo({ className = "", compact = false, inverse = false }) {
  const secondaryColor = inverse ? "text-white/65" : "text-[#7b6660]";

  return (
    <span className={`inline-flex min-w-0 items-center gap-3 ${className}`} aria-label="PayNivo">
      <img
        src={payNivoLogo}
        alt=""
        aria-hidden="true"
        className={`brand-logo-light ${compact ? "h-16 w-20" : "h-20 w-24"} shrink-0 object-contain`}
      />
      <img
        src={payNivoLogoWhite}
        alt=""
        aria-hidden="true"
        className={`brand-logo-dark hidden ${compact ? "h-16 w-20" : "h-20 w-24"} shrink-0 object-contain`}
      />
      {!compact ? (
        <span className={`hidden min-w-0 border-l border-[#F38978]/35 pl-3 text-[0.68rem] font-semibold uppercase leading-4 tracking-[0.12em] sm:block ${secondaryColor}`}>
          Automated Invoicing<br />&amp; Payroll System
        </span>
      ) : null}
    </span>
  );
}
