import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowLeft, Smartphone, RefreshCw } from "lucide-react";

import { saveSession } from "../services/sessionService.js";
import { startHealthCheck } from "../services/apiClient.js";

/**
 * Singpass QR Login Page (Demo)
 *
 * Simulates the real Singpass QR login flow for FYP demonstration.
 * Shows a QR code that the user "scans" with the Singpass app.
 * For demo purposes, clicking the QR or waiting triggers the login.
 */
export default function SingpassLoginPage() {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const [status, setStatus] = useState("scanning"); // scanning | verifying | success | error
  const [countdown, setCountdown] = useState(120);
  const [error, setError] = useState("");

  // Countdown timer for QR expiry
  useEffect(() => {
    if (status !== "scanning") return;
    if (countdown <= 0) {
      setStatus("error");
      setError("QR code expired. Please refresh.");
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, status]);

  async function handleQrScanned() {
    setStatus("verifying");

    // Simulate verification delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
      const response = await fetch(`${API_BASE}/api/auth/singpass/demo`, {
        method: "POST"
      });
      const data = await response.json();

      if (data.token) {
        setStatus("success");
        await new Promise((resolve) => setTimeout(resolve, 1000));
        saveSession(data.token, data.user, true);
        startHealthCheck();
        navigate("/module-selection", { replace: true });
      } else {
        setStatus("error");
        setError(data.message || "Verification failed.");
      }
    } catch {
      setStatus("error");
      setError("Connection failed. Please try again.");
    }
  }

  function handleRefresh() {
    setStatus("scanning");
    setCountdown(120);
    setError("");
  }

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0d0d1a] p-4">
      <motion.div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1a1a2e] p-8 shadow-2xl"
        initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.3 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/login")}
            className="flex items-center gap-1 text-sm text-slate-400 transition hover:text-white"
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <div className="flex items-center gap-2">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="24" height="24" rx="4" fill="#F4333D"/>
              <path d="M7 8.5C7 7.67 7.67 7 8.5 7H11V10H8.5C7.67 10 7 9.33 7 8.5Z" fill="white"/>
              <path d="M13 7H15.5C16.33 7 17 7.67 17 8.5C17 9.33 16.33 10 15.5 10H13V7Z" fill="white"/>
              <path d="M7 12C7 11.17 7.67 10.5 8.5 10.5H11V13.5H8.5C7.67 13.5 7 12.83 7 12Z" fill="white"/>
              <path d="M13 10.5H15.5C16.33 10.5 17 11.17 17 12C17 12.83 16.33 13.5 15.5 13.5H13V10.5Z" fill="white"/>
              <path d="M7 15.5C7 14.67 7.67 14 8.5 14H11V17H8.5C7.67 17 7 16.33 7 15.5Z" fill="white"/>
              <path d="M13 14H15.5C16.33 14 17 14.67 17 15.5C17 16.33 16.33 17 15.5 17H13V14Z" fill="white"/>
            </svg>
            <span className="text-lg font-semibold text-white">Singpass</span>
          </div>
        </div>

        {/* QR Section */}
        <div className="mt-8 text-center">
          <AnimatePresence mode="wait">
            {status === "scanning" && (
              <motion.div
                key="scanning"
                initial={shouldReduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0 }}
              >
                <h2 className="text-xl font-semibold text-white">Scan with Singpass app</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Open your Singpass app and scan the QR code below
                </p>

                {/* QR Code (mock) */}
                <motion.div
                  className="mx-auto mt-6 flex h-52 w-52 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-[#F4333D]/40 bg-white p-4 transition hover:border-[#F4333D]"
                  onClick={handleQrScanned}
                  whileHover={!shouldReduceMotion ? { scale: 1.03 } : undefined}
                  whileTap={!shouldReduceMotion ? { scale: 0.97 } : undefined}
                  title="Click to simulate scan (demo)"
                >
                  {/* Stylized QR pattern */}
                  <svg viewBox="0 0 200 200" className="h-full w-full">
                    {/* Corner squares */}
                    <rect x="10" y="10" width="50" height="50" rx="4" fill="#1a1a2e" />
                    <rect x="15" y="15" width="40" height="40" rx="2" fill="white" />
                    <rect x="22" y="22" width="26" height="26" rx="2" fill="#1a1a2e" />

                    <rect x="140" y="10" width="50" height="50" rx="4" fill="#1a1a2e" />
                    <rect x="145" y="15" width="40" height="40" rx="2" fill="white" />
                    <rect x="152" y="22" width="26" height="26" rx="2" fill="#1a1a2e" />

                    <rect x="10" y="140" width="50" height="50" rx="4" fill="#1a1a2e" />
                    <rect x="15" y="145" width="40" height="40" rx="2" fill="white" />
                    <rect x="22" y="152" width="26" height="26" rx="2" fill="#1a1a2e" />

                    {/* Data modules */}
                    <rect x="70" y="10" width="12" height="12" fill="#1a1a2e" />
                    <rect x="90" y="10" width="12" height="12" fill="#1a1a2e" />
                    <rect x="110" y="10" width="12" height="12" fill="#1a1a2e" />
                    <rect x="70" y="30" width="12" height="12" fill="#1a1a2e" />
                    <rect x="110" y="30" width="12" height="12" fill="#1a1a2e" />
                    <rect x="70" y="50" width="12" height="12" fill="#1a1a2e" />
                    <rect x="90" y="50" width="12" height="12" fill="#1a1a2e" />

                    <rect x="10" y="70" width="12" height="12" fill="#1a1a2e" />
                    <rect x="30" y="70" width="12" height="12" fill="#1a1a2e" />
                    <rect x="50" y="70" width="12" height="12" fill="#1a1a2e" />
                    <rect x="70" y="70" width="12" height="12" fill="#F4333D" />
                    <rect x="90" y="70" width="12" height="12" fill="#1a1a2e" />
                    <rect x="110" y="70" width="12" height="12" fill="#F4333D" />
                    <rect x="130" y="70" width="12" height="12" fill="#1a1a2e" />
                    <rect x="150" y="70" width="12" height="12" fill="#1a1a2e" />
                    <rect x="170" y="70" width="12" height="12" fill="#1a1a2e" />

                    <rect x="10" y="90" width="12" height="12" fill="#1a1a2e" />
                    <rect x="50" y="90" width="12" height="12" fill="#1a1a2e" />
                    <rect x="70" y="90" width="12" height="12" fill="#1a1a2e" />
                    <rect x="90" y="90" width="20" height="20" rx="4" fill="#F4333D" />
                    <rect x="130" y="90" width="12" height="12" fill="#1a1a2e" />
                    <rect x="170" y="90" width="12" height="12" fill="#1a1a2e" />

                    <rect x="10" y="110" width="12" height="12" fill="#1a1a2e" />
                    <rect x="30" y="110" width="12" height="12" fill="#1a1a2e" />
                    <rect x="50" y="110" width="12" height="12" fill="#1a1a2e" />
                    <rect x="70" y="110" width="12" height="12" fill="#F4333D" />
                    <rect x="110" y="110" width="12" height="12" fill="#F4333D" />
                    <rect x="130" y="110" width="12" height="12" fill="#1a1a2e" />
                    <rect x="150" y="110" width="12" height="12" fill="#1a1a2e" />
                    <rect x="170" y="110" width="12" height="12" fill="#1a1a2e" />

                    <rect x="70" y="140" width="12" height="12" fill="#1a1a2e" />
                    <rect x="90" y="140" width="12" height="12" fill="#1a1a2e" />
                    <rect x="110" y="140" width="12" height="12" fill="#1a1a2e" />
                    <rect x="130" y="140" width="12" height="12" fill="#1a1a2e" />
                    <rect x="150" y="140" width="12" height="12" fill="#1a1a2e" />
                    <rect x="170" y="140" width="12" height="12" fill="#1a1a2e" />
                    <rect x="70" y="160" width="12" height="12" fill="#1a1a2e" />
                    <rect x="110" y="160" width="12" height="12" fill="#1a1a2e" />
                    <rect x="150" y="160" width="12" height="12" fill="#1a1a2e" />
                    <rect x="170" y="160" width="12" height="12" fill="#1a1a2e" />
                    <rect x="70" y="178" width="12" height="12" fill="#1a1a2e" />
                    <rect x="90" y="178" width="12" height="12" fill="#1a1a2e" />
                    <rect x="130" y="178" width="12" height="12" fill="#1a1a2e" />
                    <rect x="170" y="178" width="12" height="12" fill="#1a1a2e" />
                  </svg>
                </motion.div>

                <p className="mt-4 text-xs text-slate-500">
                  QR expires in {minutes}:{seconds.toString().padStart(2, "0")}
                </p>

                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
                  <Smartphone size={14} />
                  <span>Don&apos;t have the app? <a href="https://app.singpass.gov.sg" target="_blank" rel="noopener noreferrer" className="text-[#F4333D] hover:underline">Download Singpass</a></span>
                </div>

                <p className="mt-6 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  Demo: Click the QR code to simulate scanning
                </p>
              </motion.div>
            )}

            {status === "verifying" && (
              <motion.div
                key="verifying"
                initial={shouldReduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0 }}
                className="py-12"
              >
                <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-600 border-t-[#F4333D]" />
                <h2 className="mt-6 text-xl font-semibold text-white">Verifying identity...</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Authenticating with Singpass
                </p>
              </motion.div>
            )}

            {status === "success" && (
              <motion.div
                key="success"
                initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-12"
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h2 className="mt-4 text-xl font-semibold text-white">Identity verified</h2>
                <p className="mt-2 text-sm text-slate-400">Redirecting...</p>
              </motion.div>
            )}

            {status === "error" && (
              <motion.div
                key="error"
                initial={shouldReduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-12"
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </div>
                <h2 className="mt-4 text-xl font-semibold text-white">{error}</h2>
                <button
                  onClick={handleRefresh}
                  className="mt-4 flex items-center gap-2 mx-auto rounded-lg bg-[#F4333D]/20 px-4 py-2 text-sm text-white transition hover:bg-[#F4333D]/30"
                >
                  <RefreshCw size={14} />
                  Get new QR code
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="mt-8 border-t border-white/10 pt-4 text-center text-xs text-slate-500">
          Secured by Singpass · National Digital Identity
        </div>
      </motion.div>
    </main>
  );
}
