export default function VanidayLogo({ className = "", compact = false, inverse = false }) {
  const primaryColor = inverse ? "text-white" : "text-[#251E1F]";
  const secondaryColor = inverse ? "text-white/65" : "text-[#7b6660]";

  return (
    <span className={`inline-flex min-w-0 items-center gap-3 ${className}`} aria-label="Vaniday">
      <span
        className={`shrink-0 whitespace-nowrap font-serif text-[1.35rem] leading-none tracking-[0.08em] ${primaryColor}`}
        aria-hidden="true"
      >
        VANIDAY<span className="text-[#F38978]">.</span>
      </span>
      {!compact ? (
        <span className={`hidden min-w-0 border-l border-[#F38978]/35 pl-3 text-[0.68rem] font-semibold uppercase leading-4 tracking-[0.12em] sm:block ${secondaryColor}`}>
          Automated Invoicing<br />&amp; Payroll System
        </span>
      ) : null}
    </span>
  );
}
