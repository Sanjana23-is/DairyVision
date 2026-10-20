import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { DairyVideoBackground } from "@/components/auth/DairyVideoBackground";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import {
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
} from "lucide-react";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { resetPassword } = useAuth();

  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpiredOrInvalid, setIsExpiredOrInvalid] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const location = useLocation();

  useEffect(() => {
    // 1. Inspect URL hash and query string (from both React Router location and window.location)
    const rawHash = (location.hash || window.location.hash || "").replace(/^#/, "");
    const rawSearch = (location.search || window.location.search || "").replace(/^\?/, "");

    const hashParams = new URLSearchParams(rawHash);
    const searchParams = new URLSearchParams(rawSearch);

    const errorParam = hashParams.get("error") || searchParams.get("error");
    const errorDescription =
      hashParams.get("error_description") || searchParams.get("error_description");
    const accessToken =
      hashParams.get("access_token") || searchParams.get("access_token");

    if (errorParam || errorDescription) {
      sessionStorage.removeItem("dairyvision_recovery_token");
      if (window.location.hash) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
      setIsExpiredOrInvalid(true);
      setError(
        errorDescription?.replace(/\+/g, " ") ||
          "This password reset link is invalid or has expired. Please request a new one."
      );
      return;
    }

    if (accessToken) {
      sessionStorage.setItem("dairyvision_recovery_token", accessToken);
      setToken(accessToken);
      setIsExpiredOrInvalid(false);
      setError(null);
      // Clean hash from browser address bar to protect token from leaking
      if (window.location.hash) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
      return;
    }

    // Check if recovery token is already stored in sessionStorage (e.g. across StrictMode re-renders or page refresh)
    const storedToken = sessionStorage.getItem("dairyvision_recovery_token");
    if (storedToken) {
      setToken(storedToken);
      setIsExpiredOrInvalid(false);
      setError(null);
      return;
    }

    // No token provided anywhere
    setIsExpiredOrInvalid(true);
    setError(
      "No password reset session was found. Please request a new recovery link."
    );
  }, [location.hash, location.search]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setIsExpiredOrInvalid(true);
      setError("Recovery session is missing or expired. Please request a new reset link.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      await resetPassword(password, token);
      sessionStorage.removeItem("dairyvision_recovery_token");
      setIsSuccess(true);
    } catch (err: any) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;

      if (status === 401) {
        sessionStorage.removeItem("dairyvision_recovery_token");
        setIsExpiredOrInvalid(true);
        setError("This password reset link is invalid or has expired. Please request a new one.");
      } else if (typeof detail === "string" && detail.trim()) {
        setError(detail);
      } else {
        setError("Could not update password at this time. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-950 font-sans text-slate-100 flex items-center justify-center">
      {/* CINEMATIC FULL-VIEWPORT BACKGROUND VIDEO */}
      <DairyVideoBackground />

      {/* MAIN CONTAINER */}
      <div className="relative z-10 w-full max-w-[1440px] mx-auto px-8 sm:px-12 lg:px-16 min-h-screen py-8 lg:py-12 flex flex-col justify-between">
        {/* TOP BRAND HEADER */}
        <div className="w-full flex items-center justify-between pt-2">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
                <svg
                  className="h-5 w-5 text-emerald-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 6c0 0 2-2 5-2s5 2 5 2" />
                  <path d="M20 6c0 0-2-2-5-2s-5 2-5 2" />
                  <path d="M7 10h10" />
                  <path d="M6 8c0 4.5 2 11 6 11s6-6.5 6-11" />
                  <circle cx="9" cy="14" r="1" fill="currentColor" />
                  <circle cx="15" cy="14" r="1" fill="currentColor" />
                </svg>
              </div>
              <span className="text-xl font-bold tracking-tight text-white">
                DairyVision <span className="text-emerald-400">AI</span>
              </span>
            </div>
            <p className="text-xs text-slate-300/80 pl-10 font-normal">
              Smarter decisions. Healthier herds. Better farms.
            </p>
          </div>
        </div>

        {/* CENTER CARD */}
        <div className="w-full my-auto py-8 flex items-center justify-center">
          <div className="w-full max-w-[440px] rounded-[20px] bg-white p-8 sm:p-9 shadow-2xl ring-1 ring-slate-900/5 text-slate-900">
            {isSuccess ? (
              /* SUCCESS STATE */
              <div className="flex flex-col items-center text-center py-2 animate-in fade-in duration-200">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 mb-4 border border-emerald-200">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <span className="text-[11.5px] font-semibold uppercase tracking-wider text-emerald-600">
                  PASSWORD UPDATED
                </span>
                <h2 className="text-[24px] font-bold tracking-tight text-slate-900 mt-1 leading-snug">
                  You're all set!
                </h2>
                <p className="text-[14px] text-slate-600 mt-2 mb-6 leading-relaxed">
                  Your password has been successfully updated. You can now sign in with your new credentials.
                </p>

                <Button
                  onClick={() => navigate("/login")}
                  className="h-12 w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium text-[15px] rounded-xl shadow-sm transition-all duration-150 border-0"
                >
                  Sign in to DairyVision
                </Button>
              </div>
            ) : isExpiredOrInvalid ? (
              /* EXPIRED / INVALID LINK STATE */
              <div className="flex flex-col text-left py-2 animate-in fade-in duration-200">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 mb-3 border border-amber-200">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <span className="text-[11.5px] font-semibold uppercase tracking-wider text-amber-700">
                  RECOVERY LINK EXPIRED
                </span>
                <h2 className="text-[24px] font-bold tracking-tight text-slate-900 mt-1 leading-snug">
                  Invalid recovery link
                </h2>
                <p className="text-[14px] text-slate-600 mt-2 mb-6 leading-relaxed">
                  {error ||
                    "This password reset link is invalid or has expired. For your security, recovery links are time-limited."}
                </p>

                <div className="space-y-3">
                  <Button
                    onClick={() => navigate("/forgot-password")}
                    className="h-12 w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium text-[15px] rounded-xl shadow-sm transition-all duration-150 border-0"
                  >
                    Request a new reset link
                  </Button>

                  <div className="text-center pt-1">
                    <Link
                      to="/login"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-emerald-700 transition-colors"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>Back to sign in</span>
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              /* ACTIVE RESET FORM */
              <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-slate-900 font-sans">
                <FieldGroup>
                  <div className="flex flex-col text-left mb-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 mb-3 border border-emerald-100">
                      <KeyRound className="h-5 w-5" />
                    </div>
                    <span className="text-[11.5px] font-semibold uppercase tracking-wider text-emerald-600">
                      SECURE RECOVERY
                    </span>
                    <h2 className="text-[26px] font-bold tracking-tight text-slate-900 mt-1 leading-snug">
                      Set a new password
                    </h2>
                    <p className="text-[14px] font-normal text-slate-500 mt-1">
                      Choose a secure password for your DairyVision AI account.
                    </p>
                  </div>

                  {error && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-normal text-rose-700 shadow-sm animate-in fade-in">
                      {error}
                    </div>
                  )}

                  <Field>
                    <FieldLabel
                      htmlFor="password"
                      className="text-[13px] font-medium text-slate-700 mb-1.5 block"
                    >
                      New password
                    </FieldLabel>
                    <div className="relative">
                      <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="At least 8 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="new-password"
                        className="h-12 pl-10 pr-10 text-[14px] font-normal bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:border-emerald-600 focus-visible:ring-emerald-600/20 rounded-xl"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </Field>

                  <Field>
                    <FieldLabel
                      htmlFor="confirmPassword"
                      className="text-[13px] font-medium text-slate-700 mb-1.5 block"
                    >
                      Confirm new password
                    </FieldLabel>
                    <div className="relative">
                      <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Re-enter new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        autoComplete="new-password"
                        className="h-12 pl-10 pr-10 text-[14px] font-normal bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:border-emerald-600 focus-visible:ring-emerald-600/20 rounded-xl"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </Field>

                  <Field className="pt-2">
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="h-12 w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium text-[15px] rounded-xl shadow-sm transition-all duration-150 border-0"
                    >
                      {isSubmitting ? "Updating password..." : "Update password"}
                    </Button>
                  </Field>

                  <div className="text-center pt-2">
                    <Link
                      to="/login"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-emerald-700 transition-colors"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>Back to sign in</span>
                    </Link>
                  </div>
                </FieldGroup>
              </form>
            )}
          </div>
        </div>

        {/* BOTTOM FOOTER / STATUS BAR */}
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4 pb-2 text-xs font-normal text-slate-300/80">
          <div className="flex items-center gap-2 text-emerald-400 font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Secure password recovery</span>
          </div>

          <p className="text-slate-300/70 font-normal">
            &copy; {new Date().getFullYear()} DairyVision AI. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
export default ResetPasswordPage;
