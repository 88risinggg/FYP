import { CheckCircle2, Circle, Clock3, XCircle } from "lucide-react";
import { getClaimWorkflowSteps } from "../../utils/claimWorkflow.js";

const stateStyles = {
  complete: "border-emerald-400/40 bg-[#FFF6F2] text-emerald-700",
  current: "border-amber-400/40 bg-[#FDD9CD] text-amber-700",
  rejected: "border-red-400/40 bg-[#FDD9CD] text-red-700",
  pending: "border-[#f0d2ca] bg-[#fff8f5] text-[#7b6660]"
};

const stateIcons = {
  complete: CheckCircle2,
  current: Clock3,
  rejected: XCircle,
  pending: Circle
};

export default function ClaimWorkflowProgress({ status }) {
  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-3" aria-label="Claim approval progress">
      {getClaimWorkflowSteps(status).map((step) => {
        const Icon = stateIcons[step.state];
        return (
          <div key={step.label} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${stateStyles[step.state]}`}>
            <Icon size={14} />
            <span>{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}
