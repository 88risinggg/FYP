import { useState } from "react";
import {
  BarChart3,
  Bell,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  Layers3,
  Lock,
  Mail,
  Menu,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  X
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";

import { login } from "../services/authService.js";
import { saveSession } from "../services/sessionService.js";

const features = [
  {
    title: "Centralized finance operations",
    description: "One entry point for invoicing, payroll, reports, and access control.",
    icon: Layers3
  },
  {
    title: "Role-based access",
    description: "Admin, Finance, HR, and Staff users land in their assigned module views.",
    icon: ShieldCheck
  },
  {
    title: "Audit-ready structure",
    description: "A clean foundation for reports, audit logs, notifications, and approvals.",
    icon: BarChart3
  }
];

const roleItems = ["Admin", "Finance", "HR", "Staff"];

export default function LoginPage() {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  function openLogin() {
    setError("");
    setIsLoginOpen(true);
  }

  function closeLogin() {
    if (!isLoading) {
      setIsLoginOpen(false);
      setError("");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const data = await login(email, password);
      saveSession(data.token, data.user, rememberMe);
      navigate("/module-selection", { replace: true });
    } catch (requestError) {
      setError("Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  }

  const sectionInitial = shouldReduceMotion ? false : { opacity: 0, y: 28 };
  const sectionVisible = { opacity: 1, y: 0 };
  const standardTransition = { duration: shouldReduceMotion ? 0 : 0.6, ease: "easeOut" };
  const heroVariant = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.12
      }
    }
  };
  const heroItem = {
    hidden: { opacity: 0, y: 22 },
    show: { opacity: 1, y: 0, transition: standardTransition }
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#060716] text-white">
      <section id="top" className="relative min-h-screen">
        <motion.div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 18% 22%, rgba(123,47,247,0.38), transparent 28%), radial-gradient(circle at 86% 18%, rgba(255,77,219,0.26), transparent 30%), radial-gradient(circle at 72% 72%, rgba(76,201,240,0.16), transparent 34%), linear-gradient(135deg, #090014 0%, #120022 46%, #1A0033 100%)",
            backgroundSize: "130% 130%"
          }}
          animate={shouldReduceMotion ? undefined : { backgroundPosition: ["0% 45%", "100% 55%", "0% 45%"] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:64px_64px] opacity-30" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#060716] to-transparent" />

        <header className="relative z-20 border-b border-white/10 bg-white/[0.04] backdrop-blur-xl">
          <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">
            <a href="#top" className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#C77DFF]/30 bg-[#C77DFF]/10 text-sm font-bold text-[#f3dcff] shadow-lg shadow-[#9D4EDD]/25">
                AIP
              </div>
              <span className="truncate text-sm font-semibold text-white sm:text-base">
                Automated Invoicing & Payroll System
              </span>
            </a>

            <nav className="hidden items-center gap-7 text-sm font-medium text-slate-300 lg:flex">
              <a href="#about" className="transition hover:text-white">About</a>
              <a href="#features" className="transition hover:text-white">Features</a>
              <a href="#modules" className="transition hover:text-white">Modules</a>
              <a href="#contact" className="transition hover:text-white">Contact</a>
            </nav>

            <div className="flex items-center gap-3">
              <motion.button
                type="button"
                className="flex h-10 items-center rounded-lg border border-[#C77DFF]/30 bg-white/10 px-4 text-sm font-semibold text-white shadow-lg shadow-[#9D4EDD]/20 transition hover:bg-white/15"
                onClick={openLogin}
                whileHover={shouldReduceMotion ? undefined : { scale: 1.03 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
              >
                Login
              </motion.button>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white ring-1 ring-white/15 lg:hidden"
                aria-label="Open navigation"
              >
                <Menu size={20} />
              </button>
            </div>
          </div>
        </header>

        <div className="relative z-10 mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-12 px-5 py-16 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
          <motion.div
            initial={shouldReduceMotion ? false : "hidden"}
            animate="show"
            variants={heroVariant}
          >
            <motion.p
              className="inline-flex items-center gap-2 rounded-full border border-[#C77DFF]/25 bg-white/10 px-4 py-2 text-sm font-medium text-[#f3dcff] shadow-lg shadow-purple-950/20 backdrop-blur"
              variants={heroItem}
            >
              <Sparkles size={16} />
              Academic FYP platform for secure business workflows
            </motion.p>
            <motion.h1
              className="mt-7 max-w-3xl text-4xl font-semibold leading-tight tracking-normal text-white sm:text-5xl lg:text-6xl"
              variants={heroItem}
            >
              Automate Invoicing. Simplify Payroll.
            </motion.h1>
            <motion.p
              className="mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg"
              variants={heroItem}
            >
              A role-based platform for managing invoices, payroll, reports, and staff access.
            </motion.p>

            <motion.div className="mt-9 flex flex-col gap-3 sm:flex-row" variants={heroItem}>
              <motion.button
                type="button"
                onClick={openLogin}
                className="rounded-lg bg-gradient-to-r from-[#7B2FF7] via-[#9D4EDD] to-[#FF4DDB] px-6 py-3 text-sm font-semibold text-white shadow-xl shadow-[#9D4EDD]/35 transition hover:brightness-110"
                whileHover={shouldReduceMotion ? undefined : { scale: 1.03 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
              >
                Login
              </motion.button>
              <motion.a
                href="#modules"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/8 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/12"
                whileHover={shouldReduceMotion ? undefined : { scale: 1.03 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
              >
                Explore Modules
                <ChevronRight size={17} />
              </motion.a>
            </motion.div>
          </motion.div>

          <motion.div
            className="relative min-h-[520px]"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...standardTransition, delay: shouldReduceMotion ? 0 : 0.2 }}
          >
            <motion.div
              className="absolute left-8 top-4 h-20 w-20 rotate-12 rounded-2xl border border-[#C77DFF]/25 bg-[#C77DFF]/10 shadow-2xl shadow-[#9D4EDD]/25"
              animate={shouldReduceMotion ? undefined : { y: [0, -14, 0], rotate: [12, 18, 12] }}
              transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute bottom-12 right-6 h-24 w-24 -rotate-12 rounded-[1.35rem] border border-[#FF4DDB]/20 bg-[#FF4DDB]/10 shadow-2xl shadow-[#FF4DDB]/20"
              animate={shouldReduceMotion ? undefined : { y: [0, 16, 0], rotate: [-12, -18, -12] }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute right-24 top-8 h-14 w-32 skew-x-6 rounded-xl border border-white/15 bg-white/8 shadow-xl shadow-blue-500/10"
              animate={shouldReduceMotion ? undefined : { x: [0, 14, 0], opacity: [0.8, 1, 0.8] }}
              transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
            />

            <div className="absolute inset-x-0 top-20 rounded-3xl border border-white/15 bg-white/[0.08] p-5 shadow-2xl shadow-cyan-950/40 backdrop-blur-2xl lg:left-8">
              <div className="rounded-2xl border border-white/10 bg-[#0b1027]/80 p-5">
                <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <div>
                    <p className="text-sm font-semibold text-white">Operations Overview</p>
                    <p className="mt-1 text-xs text-slate-400">Invoice and payroll monitoring</p>
                  </div>
                  <div className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                    Secured
                  </div>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  {[
                    ["Invoices", "Active", FileText],
                    ["Payroll", "Ready", Wallet],
                    ["Reports", "Synced", BarChart3]
                  ].map(([label, value, Icon]) => (
                    <div key={label} className="rounded-xl border border-white/10 bg-white/[0.06] p-4">
                      <Icon className="text-[#C77DFF]" size={20} />
                      <p className="mt-4 text-xs text-slate-400">{label}</p>
                      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                  <div className="flex items-end gap-2">
                    {[48, 70, 54, 82, 62, 92, 76, 88].map((height, index) => (
                      <motion.div
                        key={height + index}
                        className="flex-1 rounded-t-md bg-gradient-to-t from-[#7B2FF7] via-[#C77DFF] to-[#FF4DDB]"
                        style={{ height }}
                        animate={shouldReduceMotion ? undefined : { opacity: [0.65, 1, 0.65] }}
                        transition={{ duration: 2.8, delay: index * 0.12, repeat: Infinity }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <motion.div
              className="absolute left-0 top-8 w-64 rounded-2xl border border-[#C77DFF]/20 bg-[#1A0033]/80 p-4 shadow-2xl shadow-purple-950/40 backdrop-blur-xl"
              animate={shouldReduceMotion ? undefined : { y: [0, -16, 0] }}
              transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C77DFF]/15 text-[#C77DFF]">
                  <FileText size={20} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Invoice Card</p>
                  <p className="text-xs text-slate-400">Settings and reports</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="absolute bottom-6 right-0 w-72 rounded-2xl border border-[#FF4DDB]/20 bg-[#1A0033]/80 p-4 shadow-2xl shadow-[#FF4DDB]/10 backdrop-blur-xl"
              animate={shouldReduceMotion ? undefined : { y: [0, 14, 0] }}
              transition={{ duration: 7.2, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF4DDB]/15 text-[#FF4DDB]">
                  <Wallet size={20} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Payroll Card</p>
                  <p className="text-xs text-slate-400">Runs, payslips, summaries</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <motion.section
        id="features"
        className="relative bg-[#060716] px-5 py-20 sm:px-6 lg:px-8"
        initial={sectionInitial}
        whileInView={sectionVisible}
        viewport={{ once: true, amount: 0.18 }}
        transition={standardTransition}
      >
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#C77DFF]">Features</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal text-white">
              Built for controlled enterprise-style workflows
            </h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <motion.article
                  key={feature.title}
                  className="rounded-2xl border border-white/10 bg-white/[0.06] p-6 shadow-xl shadow-purple-950/10 backdrop-blur transition-colors hover:border-[#C77DFF]/40"
                  initial={sectionInitial}
                  whileInView={sectionVisible}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={standardTransition}
                  whileHover={shouldReduceMotion ? undefined : { y: -5 }}
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#C77DFF]/12 text-[#C77DFF]">
                    <Icon size={22} />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-white">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{feature.description}</p>
                </motion.article>
              );
            })}
          </div>
        </div>
      </motion.section>

      <motion.section
        id="modules"
        className="bg-[#090b20] px-5 py-20 sm:px-6 lg:px-8"
        initial={sectionInitial}
        whileInView={sectionVisible}
        viewport={{ once: true, amount: 0.18 }}
        transition={standardTransition}
      >
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-2">
          <motion.article
            className="rounded-2xl border border-[#C77DFF]/20 bg-white/[0.06] p-7 shadow-xl shadow-purple-950/20 backdrop-blur"
            whileHover={shouldReduceMotion ? undefined : { y: -5 }}
          >
            <FileText className="text-[#C77DFF]" size={30} />
            <h2 className="mt-5 text-2xl font-semibold text-white">Invoicing Module</h2>
            <p className="mt-4 text-sm leading-7 text-slate-400">
              A dedicated workspace for invoice settings, reminders, finance dashboards,
              reports, and audit visibility.
            </p>
          </motion.article>
          <motion.article
            className="rounded-2xl border border-[#FF4DDB]/20 bg-white/[0.06] p-7 shadow-xl shadow-[#FF4DDB]/10 backdrop-blur"
            whileHover={shouldReduceMotion ? undefined : { y: -5 }}
          >
            <Wallet className="text-[#FF4DDB]" size={30} />
            <h2 className="mt-5 text-2xl font-semibold text-white">Payroll Module</h2>
            <p className="mt-4 text-sm leading-7 text-slate-400">
              A structured payroll area for HR uploads, finance review, staff payslips,
              notifications, and payroll summaries.
            </p>
          </motion.article>
        </div>
      </motion.section>

      <motion.section
        id="about"
        className="bg-[#060716] px-5 py-20 sm:px-6 lg:px-8"
        initial={sectionInitial}
        whileInView={sectionVisible}
        viewport={{ once: true, amount: 0.18 }}
        transition={standardTransition}
      >
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#C77DFF]">
              Role-Based Access
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal text-white">
              Users continue through the same authenticated module flow
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-400">
              The login modal still uses the existing API. After successful authentication,
              saved user data controls Admin, Finance, HR, and Staff access.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {roleItems.map((role) => (
              <motion.div
                key={role}
                className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-xl shadow-purple-950/10 backdrop-blur transition-colors hover:border-[#C77DFF]/40"
                initial={sectionInitial}
                whileInView={sectionVisible}
                viewport={{ once: true, amount: 0.2 }}
                transition={standardTransition}
                whileHover={shouldReduceMotion ? undefined : { y: -4 }}
              >
                <Users className="text-[#C77DFF]" size={22} />
                <p className="mt-4 text-base font-semibold text-white">{role}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Access is assigned after successful database-backed authentication.
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      <footer id="contact" className="border-t border-white/10 bg-[#050612] px-5 py-10 text-slate-400 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Automated Invoicing & Payroll System</p>
            <p className="mt-1 text-sm text-slate-500">
              Secure module access for academic FYP business operations.
            </p>
          </div>
          <p className="text-sm text-slate-500">Built for role-based invoicing and payroll workflows.</p>
        </div>
      </footer>

      <AnimatePresence>
        {isLoginOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-md"
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(12px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.22 }}
          >
            <motion.section
              className="relative w-full max-w-md rounded-3xl border border-white/15 bg-[#0b1027]/95 p-6 text-white shadow-2xl shadow-cyan-950/40 backdrop-blur-xl sm:p-8"
              initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.94, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.97, y: 12 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.24, ease: "easeOut" }}
            >
              <button
                type="button"
                onClick={closeLogin}
                disabled={isLoading}
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed"
                aria-label="Close login"
              >
                <X size={20} />
              </button>

              <div className="pr-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-r from-[#7B2FF7] to-[#FF4DDB] text-sm font-bold text-white shadow-lg shadow-[#9D4EDD]/30">
                  AIP
                </div>
                <h2 className="mt-6 text-2xl font-semibold tracking-normal text-white">
                  Login to System
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  Use your assigned account to continue to module selection.
                </p>
              </div>

              <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
                <div>
                  <label className="block text-sm font-medium text-slate-300" htmlFor="email">
                    Email
                  </label>
                  <div className="mt-2 flex transform-gpu rounded-xl border border-white/10 bg-white/[0.06] transition-all duration-300 focus-within:-translate-y-0.5 focus-within:border-[#C77DFF]/70 focus-within:ring-4 focus-within:ring-[#9D4EDD]/15">
                    <span className="flex items-center px-3 text-slate-400">
                      <Mail size={18} />
                    </span>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="min-w-0 flex-1 rounded-r-xl bg-transparent px-1 py-3 pr-4 text-sm text-white outline-none placeholder:text-slate-500"
                      placeholder="name@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300" htmlFor="password">
                    Password
                  </label>
                  <div className="mt-2 flex transform-gpu rounded-xl border border-white/10 bg-white/[0.06] transition-all duration-300 focus-within:-translate-y-0.5 focus-within:border-[#C77DFF]/70 focus-within:ring-4 focus-within:ring-[#9D4EDD]/15">
                    <span className="flex items-center px-3 text-slate-400">
                      <Lock size={18} />
                    </span>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="min-w-0 flex-1 bg-transparent px-1 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="flex w-11 items-center justify-center rounded-r-xl text-slate-400 transition hover:bg-white/8 hover:text-white"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 text-sm">
                  <label className="flex cursor-pointer items-center gap-2 text-slate-400">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(event) => setRememberMe(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-500 bg-transparent text-[#C77DFF] focus:ring-[#C77DFF]"
                    />
                    Remember me
                  </label>
                  <Link className="font-medium text-[#C77DFF] hover:text-[#f3dcff]" to="/login">
                    Forgot password?
                  </Link>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      className="rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100"
                      initial={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}
                      transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  type="submit"
                  disabled={isLoading}
                  className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#7B2FF7] via-[#9D4EDD] to-[#FF4DDB] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#9D4EDD]/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-slate-500 disabled:text-slate-200 disabled:shadow-none"
                  whileHover={!isLoading && !shouldReduceMotion ? { scale: 1.02 } : undefined}
                  whileTap={!isLoading && !shouldReduceMotion ? { scale: 0.98 } : undefined}
                  animate={isLoading && !shouldReduceMotion ? { scale: 0.99 } : { scale: 1 }}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />
                      Logging in
                    </span>
                  ) : (
                    "Login"
                  )}
                </motion.button>
              </form>

              <div className="mt-5 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-slate-400">
                <Bell size={16} className="shrink-0 text-[#C77DFF]" />
                Role-based access is applied after successful login.
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
