import { useEffect, useState } from "react";
import { Check, Download, Eye, EyeOff, Key, Loader2, Shield, Smartphone, X } from "lucide-react";
import { changePassword, fetch2FA, update2FA, generateRecoveryCodes } from "../../../services/settingsService.js";

export default function SecuritySection() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [twoFa, setTwoFa] = useState({ two_fa_enabled: false, two_fa_method: null });
  const [recoveryCodes, setRecoveryCodes] = useState(null);
  const [loadingCodes, setLoadingCodes] = useState(false);

  useEffect(() => {
    load2FA();
  }, []);

  async function load2FA() {
    try {
      const data = await fetch2FA();
      setTwoFa(data);
    } catch (err) { /* ignore */ }
  }

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  function getPasswordStrength(pwd) {
    if (!pwd) return { label: "", color: "", width: "0%" };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    const levels = [
      { label: "Very Weak", color: "bg-rose-500", width: "20%" },
      { label: "Weak", color: "bg-orange-500", width: "40%" },
      { label: "Fair", color: "bg-amber-500", width: "60%" },
      { label: "Strong", color: "bg-emerald-400", width: "80%" },
      { label: "Very Strong", color: "bg-emerald-300", width: "100%" }
    ];
    return levels[Math.min(score, 4)];
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      showToast("Passwords do not match", "error");
      return;
    }
    if (form.newPassword.length < 8) {
      showToast("Password must be at least 8 characters", "error");
      return;
    }
    setSaving(true);
    try {
      await changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      showToast("Password changed successfully");
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle2FA(method) {
    try {
      const newState = { two_fa_enabled: !twoFa.two_fa_enabled, two_fa_method: method };
      await update2FA(newState);
      setTwoFa(newState);
      showToast(newState.two_fa_enabled ? "2FA enabled" : "2FA disabled");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleGenerateCodes() {
    setLoadingCodes(true);
    try {
      const data = await generateRecoveryCodes();
      setRecoveryCodes(data.codes);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoadingCodes(false);
    }
  }

  function downloadCodes() {
    if (!recoveryCodes) return;
    const text = recoveryCodes.join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  const strength = getPasswordStrength(form.newPassword);

  return (
    <div className="space-y-6">
      {toast && <Toast toast={toast} />}

      {/* Change Password */}
      <div className="app-panel rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <Key size={20} className="text-[#F38978]" />
          <h2 className="text-xl font-semibold text-white">Change Password</h2>
        </div>
        <p className="mt-1 text-sm text-[#7b6660]">Ensure your account is using a strong password.</p>

        <form onSubmit={handleChangePassword} className="mt-5 max-w-md space-y-4">
          <PasswordField label="Current Password" value={form.currentPassword}
            onChange={(e) => setForm((p) => ({ ...p, currentPassword: e.target.value }))}
            show={showCurrent} onToggle={() => setShowCurrent(!showCurrent)} />

          <PasswordField label="New Password" value={form.newPassword}
            onChange={(e) => setForm((p) => ({ ...p, newPassword: e.target.value }))}
            show={showNew} onToggle={() => setShowNew(!showNew)} />

          {form.newPassword && (
            <div className="space-y-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div className={`h-full rounded-full transition-all duration-300 ${strength.color}`} style={{ width: strength.width }} />
              </div>
              <p className="text-xs text-[#7b6660]">Strength: {strength.label}</p>
            </div>
          )}

          <PasswordField label="Confirm New Password" value={form.confirmPassword}
            onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))}
            show={showNew} onToggle={() => setShowNew(!showNew)} />

          <button type="submit" disabled={saving}
            className="primary-button inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold disabled:opacity-50">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            Update Password
          </button>
        </form>
      </div>

      {/* Two-Factor Authentication */}
      <div className="app-panel rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <Shield size={20} className="text-[#F38978]" />
          <h2 className="text-xl font-semibold text-white">Two-Factor Authentication</h2>
        </div>
        <p className="mt-1 text-sm text-[#7b6660]">Add an extra layer of security to your account.</p>

        <div className="mt-5 space-y-3">
          {["Google Authenticator", "Microsoft Authenticator", "Email OTP", "SMS OTP"].map((method) => (
            <div key={method} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-3">
                <Smartphone size={18} className="text-[#7b6660]" />
                <span className="text-sm font-medium text-white">{method}</span>
              </div>
              <button type="button" onClick={() => handleToggle2FA(method)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  twoFa.two_fa_enabled && twoFa.two_fa_method === method
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-white/[0.06] text-[#7b6660] hover:bg-white/10 hover:text-white"
                }`}>
                {twoFa.two_fa_enabled && twoFa.two_fa_method === method ? "Enabled" : "Enable"}
              </button>
            </div>
          ))}
        </div>

        {/* Recovery Codes */}
        <div className="mt-5 border-t border-white/10 pt-5">
          <h3 className="text-sm font-semibold text-white">Recovery Codes</h3>
          <p className="mt-1 text-xs text-[#7b6660]">Generate backup codes in case you lose access to your authenticator.</p>
          <div className="mt-3 flex gap-3">
            <button type="button" onClick={handleGenerateCodes} disabled={loadingCodes}
              className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10 disabled:opacity-50">
              {loadingCodes ? "Generating..." : "Generate Recovery Codes"}
            </button>
            {recoveryCodes && (
              <button type="button" onClick={downloadCodes}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10">
                <Download size={13} /> Download
              </button>
            )}
          </div>
          {recoveryCodes && (
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3 sm:grid-cols-4">
              {recoveryCodes.map((code) => (
                <span key={code} className="rounded bg-white/[0.06] px-2 py-1 text-center font-mono text-xs text-[#F38978]">{code}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PasswordField({ label, value, onChange, show, onToggle }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-[#7b6660]">{label}</label>
      <div className="relative">
        <input type={show ? "text" : "password"} value={value} onChange={onChange} required
          className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2.5 pr-10 text-sm text-white outline-none transition focus:border-[#F38978]/50 focus:ring-1 focus:ring-[#F38978]/30" />
        <button type="button" onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7b6660] hover:text-white">
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

function Toast({ toast }) {
  return (
    <div className={`fixed right-6 top-24 z-50 animate-[slideDown_0.3s_ease] rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-xl ${
      toast.type === "error" ? "border-rose-400/20 bg-rose-500/15 text-rose-200" : "border-emerald-400/20 bg-emerald-500/15 text-emerald-200"
    }`}>
      <div className="flex items-center gap-2">
        {toast.type === "error" ? <X size={16} /> : <Check size={16} />}
        <span className="text-sm font-medium">{toast.message}</span>
      </div>
    </div>
  );
}