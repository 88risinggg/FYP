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
    <main className="min-h-screen overflow-hidden bg-[#fff8f5] text-[#251E1F]">
      <section id="top" className="relative min-h-screen">
        <motion.div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 18% 22%, rgba(253,217,205,0.78), transparent 28%), radial-gradient(circle at 86% 18%, rgba(255,240,235,0.86), transparent 30%), radial-gradient(circle at 72% 72%, rgba(255,246,242,0.72), transparent 34%), linear-gradient(135deg, #fff8f5 0%, #fff3ee 46%, #FDD9CD 100%)",
            backgroundSize: "130% 130%"
          }}
          animate={shouldReduceMotion ? undefined : { backgroundPosition: ["0% 45%", "100% 55%", "0% 45%"] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:64px_64px] opacity-30" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#fff8f5] to-transparent" />

        <header className="relative z-20 border-b border-[#f0d2ca] bg-[#fff8f5] backdrop-blur-xl">
          <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">
            <a href="#top" className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#F38978]/30 bg-[#F38978]/10 text-sm font-bold text-[#6f5b55] shadow-lg shadow-[#F38978]/25">
                AIP
              </div>
              <span className="truncate text-sm font-semibold text-[#251E1F] sm:text-base">
                Automated Invoicing & Payroll System
              </span>
            </a>

            <nav className="hidden items-center gap-7 text-sm font-medium text-[#6f5b55] lg:flex">
              <a href="#about" className="transition hover:text-[#251E1F]">About</a>
              <a href="#features" className="transition hover:text-[#251E1F]">Features</a>
              <a href="#modules" className="transition hover:text-[#251E1F]">Modules</a>
              <a href="#contact" className="transition hover:text-[#251E1F]">Contact</a>
            </nav>

            <div className="flex items-center gap-3">
              <motion.button
                type="button"
                className="flex h-10 items-center rounded-lg border border-[#F38978]/30 bg-white/80 px-4 text-sm font-semibold text-[#251E1F] shadow-lg shadow-[#F38978]/20 transition hover:bg-[#fff3ee]"
                onClick={openLogin}
                whileHover={shouldReduceMotion ? undefined : { scale: 1.03 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
              >
                Login
              </motion.button>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/80 text-[#251E1F] ring-1 ring-[#ead3cc] lg:hidden"
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
              className="inline-flex items-center gap-2 rounded-full border border-[#F38978]/25 bg-white/80 px-4 py-2 text-sm font-medium text-[#6f5b55] shadow-lg shadow-[#f2b5a9]/20 backdrop-blur"
              variants={heroItem}
            >
              <Sparkles size={16} />
              Academic FYP platform for secure business workflows
            </motion.p>
            <motion.h1
              className="mt-7 max-w-3xl text-4xl font-semibold leading-tight tracking-normal text-[#251E1F] sm:text-5xl lg:text-6xl"
              variants={heroItem}
            >
              Automate Invoicing. Simplify Payroll.
            </motion.h1>
            <motion.p
              className="mt-6 max-w-2xl text-base leading-8 text-[#6f5b55] sm:text-lg"
              variants={heroItem}
            >
              A role-based platform for managing invoices, payroll, reports, and staff access.
            </motion.p>

            <motion.div className="mt-9 flex flex-col gap-3 sm:flex-row" variants={heroItem}>
              <motion.button
                type="button"
                onClick={openLogin}
                className="rounded-lg bg-gradient-to-r from-[#F38978] via-[#F38978] to-[#e87562] px-6 py-3 text-sm font-semibold text-[#251E1F] shadow-xl shadow-[#F38978]/35 transition hover:brightness-110"
                whileHover={shouldReduceMotion ? undefined : { scale: 1.03 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
              >
                Login
              </motion.button>
              <motion.a
                href="#modules"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#ead3cc] bg-white/80 px-6 py-3 text-sm font-semibold text-[#251E1F] transition hover:bg-[#fff3ee]"
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
              className="absolute left-8 top-4 h-20 w-20 rotate-12 rounded-2xl border border-[#F38978]/25 bg-[#F38978]/10 shadow-2xl shadow-[#F38978]/25"
              animate={shouldReduceMotion ? undefined : { y: [0, -14, 0], rotate: [12, 18, 12] }}
              transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute bottom-12 right-6 h-24 w-24 -rotate-12 rounded-[1.35rem] border border-[#e87562]/20 bg-[#e87562]/10 shadow-2xl shadow-[#e87562]/20"
              animate={shouldReduceMotion ? undefined : { y: [0, 16, 0], rotate: [-12, -18, -12] }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute right-24 top-8 h-14 w-32 skew-x-6 rounded-xl border border-[#ead3cc] bg-white/80 shadow-xl shadow-[#f2b5a9]/10"
              animate={shouldReduceMotion ? undefined : { x: [0, 14, 0], opacity: [0.8, 1, 0.8] }}
              transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
            />

            <div className="absolute inset-x-0 top-20 rounded-3xl border border-[#ead3cc] bg-white/95 p-5 shadow-2xl shadow-[#f2b5a9]/30 backdrop-blur-2xl lg:left-8">
              <div className="rounded-2xl border border-[#f0d2ca] bg-[#fff8f5]/80 p-5">
                <div className="flex items-center justify-between gap-4 border-b border-[#f0d2ca] pb-4">
                  <div>
                    <p className="text-sm font-semibold text-[#251E1F]">Operations Overview</p>
                    <p className="mt-1 text-xs text-[#7b6660]">Invoice and payroll monitoring</p>
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
                    <div key={label} className="rounded-xl border border-[#f0d2ca] bg-[#fff8f5] p-4">
                      <Icon className="text-[#F38978]" size={20} />
                      <p className="mt-4 text-xs text-[#7b6660]">{label}</p>
                      <p className="mt-1 text-sm font-semibold text-[#251E1F]">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-2xl border border-[#f0d2ca] bg-[#fff8f5] p-4">
                  <div className="flex items-end gap-2">
                    {[48, 70, 54, 82, 62, 92, 76, 88].map((height, index) => (
                      <motion.div
                        key={height + index}
                        className="flex-1 rounded-t-md bg-gradient-to-t from-[#F38978] via-[#F38978] to-[#e87562]"
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
              className="absolute left-0 top-8 w-64 rounded-2xl border border-[#F38978]/20 bg-[#FDD9CD]/80 p-4 shadow-2xl shadow-[#f2b5a9]/30 backdrop-blur-xl"
              animate={shouldReduceMotion ? undefined : { y: [0, -16, 0] }}
              transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F38978]/15 text-[#F38978]">
                  <FileText size={20} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#251E1F]">Invoice Card</p>
                  <p className="text-xs text-[#7b6660]">Settings and reports</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="absolute bottom-6 right-0 w-72 rounded-2xl border border-[#e87562]/20 bg-[#FDD9CD]/80 p-4 shadow-2xl shadow-[#e87562]/10 backdrop-blur-xl"
              animate={shouldReduceMotion ? undefined : { y: [0, 14, 0] }}
              transition={{ duration: 7.2, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e87562]/15 text-[#e87562]">
                  <Wallet size={20} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#251E1F]">Payroll Card</p>
                  <p className="text-xs text-[#7b6660]">Runs, payslips, summaries</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <motion.section
        id="features"
        className="relative bg-[#fff8f5] px-5 py-20 sm:px-6 lg:px-8"
        initial={sectionInitial}
        whileInView={sectionVisible}
        viewport={{ once: true, amount: 0.18 }}
        transition={standardTransition}
      >
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#F38978]">Features</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal text-[#251E1F]">
              Built for controlled enterprise-style workflows
            </h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <motion.article
                  key={feature.title}
                  className="rounded-2xl border border-[#f0d2ca] bg-[#fff8f5] p-6 shadow-xl shadow-[#f2b5a9]/10 backdrop-blur transition-colors hover:border-[#F38978]/40"
                  initial={sectionInitial}
                  whileInView={sectionVisible}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={standardTransition}
                  whileHover={shouldReduceMotion ? undefined : { y: -5 }}
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F38978]/12 text-[#F38978]">
                    <Icon size={22} />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-[#251E1F]">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#7b6660]">{feature.description}</p>
                </motion.article>
              );
            })}
          </div>
        </div>
      </motion.section>

      <motion.section
        id="modules"
        className="bg-[#fff3ee] px-5 py-20 sm:px-6 lg:px-8"
        initial={sectionInitial}
        whileInView={sectionVisible}
        viewport={{ once: true, amount: 0.18 }}
        transition={standardTransition}
      >
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-2">
          <motion.article
            className="rounded-2xl border border-[#F38978]/20 bg-[#fff8f5] p-7 shadow-xl shadow-[#f2b5a9]/20 backdrop-blur"
            whileHover={shouldReduceMotion ? undefined : { y: -5 }}
          >
            <FileText className="text-[#F38978]" size={30} />
            <h2 className="mt-5 text-2xl font-semibold text-[#251E1F]">Invoicing Module</h2>
            <p className="mt-4 text-sm leading-7 text-[#7b6660]">
              A dedicated workspace for invoice settings, reminders, finance dashboards,
              reports, and audit visibility.
            </p>
          </motion.article>
          <motion.article
            className="rounded-2xl border border-[#e87562]/20 bg-[#fff8f5] p-7 shadow-xl shadow-[#e87562]/10 backdrop-blur"
            whileHover={shouldReduceMotion ? undefined : { y: -5 }}
          >
            <Wallet className="text-[#e87562]" size={30} />
            <h2 className="mt-5 text-2xl font-semibold text-[#251E1F]">Payroll Module</h2>
            <p className="mt-4 text-sm leading-7 text-[#7b6660]">
              A structured payroll area for HR uploads, finance review, staff payslips,
              notifications, and payroll summaries.
            </p>
          </motion.article>
        </div>
      </motion.section>

      <motion.section
        id="about"
        className="bg-[#fff8f5] px-5 py-20 sm:px-6 lg:px-8"
        initial={sectionInitial}
        whileInView={sectionVisible}
        viewport={{ once: true, amount: 0.18 }}
        transition={standardTransition}
      >
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#F38978]">
              Role-Based Access
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal text-[#251E1F]">
              Users continue through the same authenticated module flow
            </h2>
            <p className="mt-4 text-sm leading-7 text-[#7b6660]">
              The login modal still uses the existing API. After successful authentication,
              saved user data controls Admin, Finance, HR, and Staff access.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {roleItems.map((role) => (
              <motion.div
                key={role}
                className="rounded-2xl border border-[#f0d2ca] bg-[#fff8f5] p-5 shadow-xl shadow-[#f2b5a9]/10 backdrop-blur transition-colors hover:border-[#F38978]/40"
                initial={sectionInitial}
                whileInView={sectionVisible}
                viewport={{ once: true, amount: 0.2 }}
                transition={standardTransition}
                whileHover={shouldReduceMotion ? undefined : { y: -4 }}
              >
                <Users className="text-[#F38978]" size={22} />
                <p className="mt-4 text-base font-semibold text-[#251E1F]">{role}</p>
                <p className="mt-2 text-sm leading-6 text-[#7b6660]">
                  Access is assigned after successful database-backed authentication.
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      <footer id="contact" className="border-t border-[#f0d2ca] bg-[#fff8f5] px-5 py-10 text-[#7b6660] sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#251E1F]">Automated Invoicing & Payroll System</p>
            <p className="mt-1 text-sm text-[#8d7b76]">
              Secure module access for academic FYP business operations.
            </p>
          </div>
          <p className="text-sm text-[#8d7b76]">Built for role-based invoicing and payroll workflows.</p>
        </div>
      </footer>

      <AnimatePresence>
        {isLoginOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#251E1F]/35 px-4 py-6 backdrop-blur-md"
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(12px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.22 }}
          >
            <motion.section
              className="relative w-full max-w-md rounded-3xl border border-[#ead3cc] bg-[#fff8f5]/95 p-6 text-[#251E1F] shadow-2xl shadow-[#f2b5a9]/30 backdrop-blur-xl sm:p-8"
              initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.94, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.97, y: 12 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.24, ease: "easeOut" }}
            >
              <button
                type="button"
                onClick={closeLogin}
                disabled={isLoading}
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-lg text-[#7b6660] transition hover:bg-white/80 hover:text-[#251E1F] disabled:cursor-not-allowed"
                aria-label="Close login"
              >
                <X size={20} />
              </button>

              <div className="pr-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-r from-[#F38978] to-[#e87562] text-sm font-bold text-[#251E1F] shadow-lg shadow-[#F38978]/30">
                  AIP
                </div>
                <h2 className="mt-6 text-2xl font-semibold tracking-normal text-[#251E1F]">
                  Login to System
                </h2>
                <p className="mt-2 text-sm text-[#7b6660]">
                  Use your assigned account to continue to module selection.
                </p>
              </div>

              <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
                <div>
                  <label className="block text-sm font-medium text-[#6f5b55]" htmlFor="email">
                    Email
                  </label>
                  <div className="mt-2 flex transform-gpu rounded-xl border border-[#f0d2ca] bg-[#fff8f5] transition-all duration-300 focus-within:-translate-y-0.5 focus-within:border-[#F38978]/70 focus-within:ring-4 focus-within:ring-[#F38978]/15">
                    <span className="flex items-center px-3 text-[#7b6660]">
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
                      className="min-w-0 flex-1 rounded-r-xl bg-transparent px-1 py-3 pr-4 text-sm text-[#251E1F] outline-none placeholder:text-[#8d7b76]"
                      placeholder="name@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#6f5b55]" htmlFor="password">
                    Password
                  </label>
                  <div className="mt-2 flex transform-gpu rounded-xl border border-[#f0d2ca] bg-[#fff8f5] transition-all duration-300 focus-within:-translate-y-0.5 focus-within:border-[#F38978]/70 focus-within:ring-4 focus-within:ring-[#F38978]/15">
                    <span className="flex items-center px-3 text-[#7b6660]">
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
                      className="min-w-0 flex-1 bg-transparent px-1 py-3 text-sm text-[#251E1F] outline-none placeholder:text-[#8d7b76]"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="flex w-11 items-center justify-center rounded-r-xl text-[#7b6660] transition hover:bg-white/80 hover:text-[#251E1F]"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 text-sm">
                  <label className="flex cursor-pointer items-center gap-2 text-[#7b6660]">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(event) => setRememberMe(event.target.checked)}
                      className="h-4 w-4 rounded border-[#ead3cc] bg-transparent text-[#F38978] focus:ring-[#F38978]"
                    />
                    Remember me
                  </label>
                  <Link className="font-medium text-[#F38978] hover:text-[#6f5b55]" to="/login">
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
                  className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#F38978] via-[#F38978] to-[#e87562] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#F38978]/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-[#dcc8c1] disabled:text-[#514440] disabled:shadow-none"
                  whileHover={!isLoading && !shouldReduceMotion ? { scale: 1.02 } : undefined}
                  whileTap={!isLoading && !shouldReduceMotion ? { scale: 0.98 } : undefined}
                  animate={isLoading && !shouldReduceMotion ? { scale: 0.99 } : { scale: 1 }}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      Logging in
                    </span>
                  ) : (
                    "Login"
                  )}
                </motion.button>
              </form>

              <div className="mt-5 flex items-center gap-2 rounded-xl border border-[#f0d2ca] bg-[#fff8f5] px-4 py-3 text-sm text-[#7b6660]">
                <Bell size={16} className="shrink-0 text-[#F38978]" />
                Role-based access is applied after successful login.
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

