import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import AuthLayout from "../components/auth/AuthLayout.jsx";
import { resendRegistrationOtp, verifyRegistrationOtp } from "../services/authService.js";

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const challengeId = sessionStorage.getItem("registrationChallengeId");
  const email = sessionStorage.getItem("registrationEmail");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (!challengeId || !email) {
    return <Navigate to="/register" replace />;
  }

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await verifyRegistrationOtp(challengeId, otp);
      sessionStorage.removeItem("registrationChallengeId");
      sessionStorage.removeItem("registrationEmail");
      navigate("/login", {
        replace: true,
        state: { message: data.message || "Email verified. Please log in." }
      });
    } catch (requestError) {
      setError(requestError.message || "Email verification failed.");
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await resendRegistrationOtp(challengeId);
      setOtp("");
      setMessage("A new code was sent. It expires in one minute.");
    } catch (requestError) {
      setError(requestError.message || "Unable to resend the code.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Verify your email" description={`Enter the six-digit code sent to ${email}.`}>
      <form className="space-y-5" onSubmit={submit}>
        <label className="block text-sm font-medium text-[#6f5b55]" htmlFor="registration-otp">
          Verification code
          <input
            id="registration-otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoFocus
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
            className="mt-2 w-full rounded-lg border border-[#f0d2ca] px-4 py-3 text-center text-2xl font-semibold tracking-[0.35em] outline-none focus:border-[#F38978] focus:ring-4 focus:ring-[#F38978]/15"
          />
        </label>
        {message && <p className="text-sm text-[#355f63]">{message}</p>}
        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={loading || otp.length !== 6} className="w-full rounded-lg bg-[#F38978] px-4 py-3 font-semibold text-[#251E1F] disabled:opacity-50">
          {loading ? "Verifying..." : "Verify Email"}
        </button>
        <button type="button" onClick={resend} disabled={loading} className="w-full text-sm font-medium text-[#C55245] hover:underline disabled:opacity-50">
          Resend code
        </button>
      </form>
    </AuthLayout>
  );
}
