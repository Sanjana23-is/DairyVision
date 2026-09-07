import { useState } from "react";
import { Link } from "react-router-dom";
import { DairyVideoBackground } from "@/components/auth/DairyVideoBackground";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { Mail, ArrowLeft, KeyRound } from "lucide-react";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { forgotPassword } = useAuth();
  const { t } = useLanguage();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!email.trim()) {
      setError(t("auth.error_empty", "Please provide your email address."));
      return;
    }

    setIsSubmitting(true);
    try {
      await forgotPassword({ email: email.trim() });
      setMessage(
        "If an account exists with this email, we have sent a password reset link to your inbox.",
      );
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setError(
        typeof detail === "string" && detail.trim()
          ? detail
          : t("auth.error_invalid", "We could not send a password reset request at the moment. Please try again."),
      );
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
              {t("auth.turn_data_smarter")}
            </p>
          </div>
        </div>

        {/* CENTER CARD */}
        <div className="w-full my-auto py-8 flex items-center justify-center">
          <div className="w-full max-w-[440px] rounded-[20px] bg-white p-8 sm:p-9 shadow-2xl ring-1 ring-slate-900/5 text-slate-900">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-slate-900 font-sans">
              <FieldGroup>
                <div className="flex flex-col text-left mb-1">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 mb-3 border border-emerald-100">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <span className="text-[11.5px] font-semibold uppercase tracking-wider text-emerald-600">
                    {t("auth.recovery_title")}
                  </span>
                  <h2 className="text-[26px] font-bold tracking-tight text-slate-900 mt-1 leading-snug">
                    {t("auth.reset_password_title")}
                  </h2>
                  <p className="text-[14px] font-normal text-slate-500 mt-1">
                    {t("auth.reset_password_subtitle")}
                  </p>
                </div>

                {error && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-normal text-rose-700 shadow-sm animate-in fade-in">
                    {error}
                  </div>
                )}

                {message && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-normal text-emerald-700 shadow-sm animate-in fade-in">
                    {message}
                  </div>
                )}

                <Field>
                  <FieldLabel htmlFor="email" className="text-[13px] font-medium text-slate-700 mb-1.5 block">
                    {t("auth.email_address")}
                  </FieldLabel>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@farm.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="h-12 pl-10 text-[14px] font-normal bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:border-emerald-600 focus-visible:ring-emerald-600/20 rounded-xl"
                    />
                  </div>
                </Field>

                <Field className="pt-2">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-12 w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium text-[15px] rounded-xl shadow-sm transition-all duration-150 border-0"
                  >
                    {isSubmitting ? t("auth.sending_reset_link") : t("auth.send_reset_link")}
                  </Button>
                </Field>

                <div className="text-center pt-2">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-emerald-700 transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>{t("auth.back_to_signin")}</span>
                  </Link>
                </div>
              </FieldGroup>
            </form>
          </div>
        </div>

        {/* BOTTOM FOOTER / STATUS BAR */}
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4 pb-2 text-xs font-normal text-slate-300/80">
          <div className="flex items-center gap-2 text-emerald-400 font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{t("auth.live_farm_intelligence")}</span>
          </div>

          <p className="text-slate-300/70 font-normal">
            &copy; {new Date().getFullYear()} DairyVision AI. All rights reserved.
          </p>
        </div>

      </div>
    </div>
  );
}
