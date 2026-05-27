import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  FileText,
  LogOut,
  Sparkles,
  Users,
  WalletCards
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { clearSession, getStoredSession } from "../services/sessionService.js";

const moduleDetails = {
  invoicing: {
    title: "Invoicing System",
    action: "Open Invoicing",
    badge: "Billing and reports",
    description: "Manage billing, invoice records, PDF generation, reminders, and reports.",
    icon: FileText,
    shellClass: "border-[#4CC9F0]/30 bg-white/[0.07] shadow-[#4CC9F0]/10",
    iconClass: "bg-gradient-to-br from-[#4CC9F0] to-[#7B2FF7] text-white shadow-[#4CC9F0]/25",
    accentClass: "from-[#4CC9F0] via-[#9D4EDD] to-[#C77DFF]",
    buttonClass: "bg-gradient-to-r from-[#4CC9F0] to-[#7B2FF7] text-white hover:brightness-110"
  },
  payroll: {
    title: "Payroll System",
    action: "Open Payroll",
    badge: "Payroll and staff access",
    description: "Manage payroll processing, staff records, payslips, exports, and summaries.",
    icon: WalletCards,
    shellClass: "border-[#FF4DDB]/30 bg-white/[0.07] shadow-[#FF4DDB]/10",
    iconClass: "bg-gradient-to-br from-[#FF4DDB] to-[#7B2FF7] text-white shadow-[#FF4DDB]/25",
    accentClass: "from-[#FF4DDB] via-[#C77DFF] to-[#7B2FF7]",
    buttonClass: "bg-gradient-to-r from-[#FF4DDB] to-[#7B2FF7] text-white hover:brightness-110"
  }
};

export default function ModuleSelectionPage() {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const session = getStoredSession();
  const user = session?.user;
  const allowedModules = user?.allowedModules || [];

  function handleLogout() {
    clearSession();
    navigate("/login", { replace: true });
  }

  function handleModuleSelection(moduleKey) {
    if (moduleKey === "invoicing" && user?.role === "Admin") {
      navigate("/dashboard/invoicing/admin");
      return;
    }

    if (moduleKey === "invoicing" && user?.role === "Finance") {
      navigate("/dashboard/invoicing/finance");
      return;
    }

    if (moduleKey === "payroll" && user?.role === "Admin") {
      navigate("/dashboard/payroll/admin");
      return;
    }

    if (moduleKey === "payroll" && user?.role === "Finance") {
      navigate("/dashboard/payroll/finance");
      return;
    }

    if (moduleKey === "payroll" && user?.role === "HR") {
      navigate("/dashboard/payroll/hr");
      return;
    }

    if (moduleKey === "payroll" && user?.role === "Staff") {
      navigate("/dashboard/payroll/staff");
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#090014] via-[#120022] to-[#1A0033] px-5 py-6 text-white sm:px-6 lg:px-8">
      <motion.div
        className="pointer-events-none absolute left-[-8rem] top-[-6rem] h-80 w-80 rounded-full bg-[#7B2FF7]/30 blur-3xl"
        animate={shouldReduceMotion ? undefined : { y: [0, 24, 0], x: [0, 18, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute bottom-[-8rem] right-[-6rem] h-96 w-96 rounded-full bg-[#FF4DDB]/20 blur-3xl"
        animate={shouldReduceMotion ? undefined : { y: [0, -28, 0], x: [0, -18, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:72px_72px] opacity-20" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl flex-col">
        <header className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-sm font-bold shadow-lg shadow-blue-950/20 backdrop-blur">
              AIP
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                Automated Invoicing & Payroll System
              </p>
              <p className="text-xs text-[#d8c6e8]/70">Secure module launcher</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-lg border border-[#C77DFF]/25 bg-white/10 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-[#9D4EDD]/10 backdrop-blur transition hover:bg-white/15"
          >
            <LogOut size={16} />
            Logout
          </button>
        </header>

        <section className="flex flex-1 flex-col justify-center py-14">
          <motion.div
            className="mx-auto max-w-3xl text-center"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.55, ease: "easeOut" }}
          >
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#C77DFF]/25 bg-white/10 px-4 py-2 text-sm font-medium text-[#f3dcff] shadow-lg shadow-purple-950/20 backdrop-blur">
              <BadgeCheck size={16} />
              Signed in as {user?.name || "User"}
            </div>
            <h1 className="mt-6 text-4xl font-semibold tracking-normal text-white sm:text-5xl">
              Choose your workspace
            </h1>
            <p className="mt-4 text-base leading-7 text-[#d8c6e8]">
              Launch the modules assigned to your account and continue your role-based workflow.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-slate-200 backdrop-blur">
              <Sparkles size={16} className="text-[#FF4DDB]" />
              <span className="font-medium text-white">{user?.role}</span>
              <span className="text-[#d8c6e8]/70">role access enabled</span>
            </div>
          </motion.div>

          <section className="mt-12 grid gap-6 lg:grid-cols-2">
            {allowedModules.map((moduleKey, index) => {
              const module = moduleDetails[moduleKey];
              const Icon = module.icon;

              return (
                <motion.button
                  key={moduleKey}
                  type="button"
                  onClick={() => handleModuleSelection(moduleKey)}
                  className={`group relative cursor-pointer overflow-hidden rounded-3xl border p-6 text-left shadow-2xl backdrop-blur-xl transition ${module.shellClass}`}
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 28 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: shouldReduceMotion ? 0 : 0.5, delay: index * 0.1 }}
                  whileHover={
                    shouldReduceMotion
                      ? undefined
                      : {
                          y: -8,
                          scale: 1.01
                        }
                  }
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
                >
                  <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${module.accentClass}`} />
                  <div className="absolute right-5 top-5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-[#f3dcff] shadow-sm backdrop-blur">
                    {module.badge}
                  </div>

                  <div className="mt-10 flex items-start justify-between gap-6">
                    <motion.div
                      className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl shadow-xl ${module.iconClass}`}
                      whileHover={shouldReduceMotion ? undefined : { rotate: -4, scale: 1.08 }}
                    >
                      <Icon size={30} />
                    </motion.div>
                    <ArrowRight className="mt-4 text-[#d8c6e8]/70 transition group-hover:translate-x-1 group-hover:text-white" size={22} />
                  </div>

                  <h2 className="mt-7 text-2xl font-semibold text-white">{module.title}</h2>
                  <p className="mt-3 min-h-14 text-sm leading-7 text-[#d8c6e8]">
                    {module.description}
                  </p>

                  <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-sm font-medium text-[#f3dcff] opacity-0 transition group-hover:opacity-100">
                      Click to enter this module
                    </span>
                    <span className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition ${module.buttonClass}`}>
                      {module.action}
                      <ArrowRight size={16} />
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </section>

          <motion.div
            className="mx-auto mt-10 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/8 px-5 py-4 text-sm text-[#d8c6e8] shadow-xl shadow-purple-950/20 backdrop-blur"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.5, delay: 0.25 }}
          >
            <Users size={18} className="text-[#C77DFF]" />
            Modules are shown only when your account is allowed to access them.
          </motion.div>
        </section>
      </div>
    </main>
  );
}
