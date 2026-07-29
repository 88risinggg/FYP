/**
 * EVALUATION HEADER
 * FEATURE: SHARED / APPLICATION CORE
 * PURPOSE: Implements the Registration Page screen and its page-level interactions.
 * LAYER: Frontend page - renders a complete screen and coordinates its user interactions.
 * FIND RELATED CODE: Trace its imports for UI components and frontend services used by this screen.
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import AuthLayout from "../components/auth/AuthLayout.jsx";
import { startRegistration } from "../services/authService.js";

const initialForm = {
  fullName: "",
  workEmail: "",
  password: "",
  confirmPassword: "",
  termsAccepted: false,
  privacyAccepted: false
};

export default function RegistrationPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await startRegistration(form);
      sessionStorage.setItem("registrationChallengeId", data.challengeId);
      sessionStorage.setItem("registrationEmail", data.email);
      navigate("/verify-email");
    } catch (requestError) {
      setError(requestError.message || "Registration could not be started.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Create account" description="Register with your email, then verify the OTP sent to your inbox.">
      <form className="space-y-4" onSubmit={submit}>
        <Field label="Full name" value={form.fullName} onChange={(value) => update("fullName", value)} autoComplete="name" />
        <Field label="Email" type="email" value={form.workEmail} onChange={(value) => update("workEmail", value)} autoComplete="email" />
        <Field label="Password" type="password" minLength={8} value={form.password} onChange={(value) => update("password", value)} autoComplete="new-password" />
        <Field label="Confirm password" type="password" minLength={8} value={form.confirmPassword} onChange={(value) => update("confirmPassword", value)} autoComplete="new-password" />
        <label className="flex items-start gap-3 text-sm leading-6 text-[#6f5b55]">
          <input
            type="checkbox"
            required
            checked={form.termsAccepted}
            onChange={(event) => update("termsAccepted", event.target.checked)}
            className="mt-1 h-4 w-4 accent-[#F38978]"
          />
          I accept the Terms of Service.
        </label>
        <label className="flex items-start gap-3 text-sm leading-6 text-[#6f5b55]">
          <input
            type="checkbox"
            required
            checked={form.privacyAccepted}
            onChange={(event) => update("privacyAccepted", event.target.checked)}
            className="mt-1 h-4 w-4 accent-[#F38978]"
          />
          I accept the Privacy Policy.
        </label>
        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={loading} className="w-full rounded-lg bg-[#F38978] px-4 py-3 font-semibold text-[#251E1F] disabled:opacity-50">
          {loading ? "Sending verification code..." : "Continue"}
        </button>
        <p className="text-center text-sm text-[#7b6660]">
          Already have an account? <Link to="/login" className="font-medium text-[#C55245] hover:underline">Log In</Link>
        </p>
      </form>
    </AuthLayout>
  );
}

function Field({ label, type = "text", value, onChange, minLength, autoComplete }) {
  const id = `registration-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <label className="block text-sm font-medium text-[#6f5b55]" htmlFor={id}>
      {label}
      <input
        id={id}
        type={type}
        required
        minLength={minLength}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-lg border border-[#f0d2ca] px-4 py-3 text-[#251E1F] outline-none focus:border-[#F38978] focus:ring-4 focus:ring-[#F38978]/15"
      />
    </label>
  );
}
