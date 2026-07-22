import payNivoLogo from "../../assets/paynivo-logo.png";

export default function VanidayLogo({ className = "", compact = false, inverse = false }) {
  const secondaryColor = inverse ? "text-white/65" : "text-[#7b6660]";

  return (
    <span className={`inline-flex min-w-0 items-center gap-3 ${className}`} aria-label="PayNivo">
      <img
        src={payNivoLogo}
        alt=""
        aria-hidden="true"
        className={`${compact ? "h-16 w-20" : "h-20 w-24"} shrink-0 object-contain`}
      />
      {!compact ? (
        <span className={`hidden min-w-0 border-l border-[#F38978]/35 pl-3 text-[0.68rem] font-semibold uppercase leading-4 tracking-[0.12em] sm:block ${secondaryColor}`}>
          Automated Invoicing<br />&amp; Payroll System
        </span>
      ) : null}
    </span>
  );
}
