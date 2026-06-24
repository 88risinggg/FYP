import {
  Bell,
  CheckCircle2,
  FileBarChart,
  KeyRound,
  Lock,
  Settings,
  Shield,
  Sparkles,
  Users
} from "lucide-react";

const roleCards = [
  {
    role: "Admin",
    purpose: "Owns invoicing configuration, access control, monitoring, and governance reports.",
    coverage: 100,
    color: "#C77DFF",
    permissions: ["Users", "Roles", "Invoice Settings", "Reminder Settings", "Audit Logs", "Reports"]
  },
  {
    role: "Finance",
    purpose: "Runs daily invoice and payment operations without changing admin security settings.",
    coverage: 58,
    color: "#38BDF8",
    permissions: ["Invoice Workspace", "Payment Updates", "Finance Reports"]
  },
  {
    role: "HR",
    purpose: "Kept outside invoicing administration unless module access is explicitly assigned.",
    coverage: 12,
    color: "#F59E0B",
    permissions: ["Module Selection"]
  },
  {
    role: "Staff",
    purpose: "No invoicing admin access; limited to personal module access where applicable.",
    coverage: 8,
    color: "#34D399",
    permissions: ["Own Profile"]
  }
];

const permissionGroups = [
  {
    title: "Access Control",
    icon: Users,
    items: [
      ["Create users", "Admin"],
      ["Disable users", "Admin"],
      ["Assign module access", "Admin"],
      ["Reset user passwords", "Admin"]
    ]
  },
  {
    title: "Configuration",
    icon: Settings,
    items: [
      ["Invoice numbering", "Admin"],
      ["Payment terms", "Admin"],
      ["Reminder rules", "Admin"],
      ["Email test reminders", "Admin"]
    ]
  },
  {
    title: "Monitoring",
    icon: FileBarChart,
    items: [
      ["Audit logs", "Admin"],
      ["Reminder activity", "Admin"],
      ["Overdue overview", "Admin / Finance"],
      ["Invoice health", "Admin / Finance"]
    ]
  }
];

const matrixRows = [
  ["Dashboard overview", true, true, false, false],
  ["Manage users", true, false, false, false],
  ["Assign roles", true, false, false, false],
  ["Invoice settings", true, false, false, false],
  ["Reminder settings", true, false, false, false],
  ["Audit logs", true, false, false, false],
  ["Admin reports", true, false, false, false],
  ["Payment operations", false, true, false, false]
];

function Ring({ value, color }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const dash = (value / 100) * circumference;

  return (
    <svg viewBox="0 0 112 112" className="h-28 w-28">
      <circle cx="56" cy="56" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
      <circle
        cx="56"
        cy="56"
        r={radius}
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference}`}
        strokeWidth="12"
        transform="rotate(-90 56 56)"
      />
      <text x="56" y="60" textAnchor="middle" className="fill-white text-lg font-semibold">
        {value}%
      </text>
    </svg>
  );
}

function AccessDot({ enabled }) {
  return enabled ? (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/30">
      <CheckCircle2 size={15} />
    </span>
  ) : (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.04] text-[#d8c6e8]/50 ring-1 ring-white/10">
      <Lock size={13} />
    </span>
  );
}

export default function AdminRolesDesignPage() {
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-medium text-[#C77DFF]">Invoicing Admin Role Blueprint</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">Roles & Access Design</h2>
          <p className="mt-2 max-w-3xl text-sm text-[#d8c6e8]">
            A visual role model for the invoicing module. This page is design-only and does not change authentication,
            authorization, routes, database records, or backend permissions.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100">
          <Shield size={16} />
          Frontend design layer only
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {roleCards.map((role) => (
          <article key={role.role} className="neon-glass neon-border rounded-lg p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-white">{role.role}</p>
                <p className="mt-2 text-sm leading-6 text-[#d8c6e8]">{role.purpose}</p>
              </div>
              <Ring value={role.coverage} color={role.color} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {role.permissions.map((permission) => (
                <span key={permission} className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-[#f4e9ff]">
                  {permission}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <section className="neon-glass neon-border overflow-hidden rounded-lg">
          <div className="border-b border-white/10 px-5 py-4">
            <h3 className="text-lg font-semibold text-white">Permission Matrix</h3>
            <p className="mt-1 text-sm text-[#d8c6e8]">Recommended access boundaries for the invoicing module.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-[#d8c6e8]">
                <tr>
                  <th className="px-4 py-3">Capability</th>
                  <th className="px-4 py-3 text-center">Admin</th>
                  <th className="px-4 py-3 text-center">Finance</th>
                  <th className="px-4 py-3 text-center">HR</th>
                  <th className="px-4 py-3 text-center">Staff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {matrixRows.map(([capability, admin, finance, hr, staff]) => (
                  <tr key={capability}>
                    <td className="px-4 py-4 font-medium text-white">{capability}</td>
                    {[admin, finance, hr, staff].map((enabled, index) => (
                      <td key={`${capability}-${index}`} className="px-4 py-4 text-center">
                        <AccessDot enabled={enabled} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-6">
          <section className="neon-glass neon-border rounded-lg p-5">
            <div className="flex items-center gap-3">
              <KeyRound size={21} className="text-[#C77DFF]" />
              <h3 className="text-lg font-semibold text-white">Design Principle</h3>
            </div>
            <p className="mt-4 text-sm leading-6 text-[#d8c6e8]">
              Admin owns rules and visibility. Finance owns daily invoice work. HR and Staff stay outside invoicing
              administration unless a future module requirement adds scoped access.
            </p>
          </section>

          {permissionGroups.map((group) => {
            const Icon = group.icon;
            return (
              <section key={group.title} className="neon-glass neon-border rounded-lg p-5">
                <div className="mb-4 flex items-center gap-3">
                  <Icon size={20} className="text-[#C77DFF]" />
                  <h3 className="font-semibold text-white">{group.title}</h3>
                </div>
                <div className="space-y-3">
                  {group.items.map(([item, owner]) => (
                    <div key={item} className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm">
                      <span className="text-[#f4e9ff]">{item}</span>
                      <span className="text-xs font-semibold text-[#C77DFF]">{owner}</span>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}

          <section className="rounded-lg border border-sky-300/20 bg-sky-400/10 p-5">
            <div className="mb-2 flex items-center gap-2 text-sky-100">
              <Sparkles size={18} />
              <p className="font-semibold">Future Enhancement</p>
            </div>
            <p className="text-sm leading-6 text-sky-100/85">
              Custom permissions can be added later using role-permission tables. For the current project, fixed roles
              are clearer and safer.
            </p>
          </section>
        </aside>
      </div>
    </section>
  );
}
