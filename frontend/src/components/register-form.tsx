import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { Eye, EyeOff, User, Mail, Lock } from "lucide-react";

interface RegisterFormProps extends React.ComponentProps<"form"> {
  onSuccess?: () => void;
}

export function RegisterForm({ className, onSuccess, ...props }: RegisterFormProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!fullName.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      setError(t("auth.error_empty", "Please fill in all fields."));
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError(t("auth.password_mismatch", "Passwords do not match."));
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        email: email.trim(),
        password,
        full_name: fullName.trim(),
      });
      if (onSuccess) {
        onSuccess();
      } else {
        navigate("/select-farm");
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (typeof detail === "string" && detail.trim()) {
        setError(detail);
      } else {
        setError(t("auth.error_invalid", "We could not create your account right now. Please try again."));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className={cn("flex flex-col gap-4 text-slate-900 font-sans", className)} onSubmit={handleSubmit} {...props}>
      <FieldGroup>
        <div className="flex flex-col text-left mb-1">
          <span className="text-[11.5px] font-semibold uppercase tracking-wider text-emerald-600">
            {t("auth.start_free")}
          </span>
          <h2 className="text-[26px] lg:text-[29px] font-bold tracking-tight text-slate-900 mt-1 leading-snug">
            {t("auth.create_account")}
          </h2>
          <p className="text-[14px] font-normal text-slate-500 mt-0.5">
            {t("auth.create_account_subtitle")}
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-normal text-rose-700 shadow-sm animate-in fade-in">
            {error}
          </div>
        )}

        <Field>
          <FieldLabel htmlFor="fullName" className="text-[13px] font-medium text-slate-700 mb-1 block">
            {t("auth.full_name")}
          </FieldLabel>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              id="fullName"
              type="text"
              placeholder="e.g. Ava Johnson"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoComplete="name"
              className="h-11 pl-10 text-[14px] font-normal bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:border-emerald-600 focus-visible:ring-emerald-600/20 rounded-xl"
            />
          </div>
        </Field>

        <Field>
          <FieldLabel htmlFor="email" className="text-[13px] font-medium text-slate-700 mb-1 block">
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
              className="h-11 pl-10 text-[14px] font-normal bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:border-emerald-600 focus-visible:ring-emerald-600/20 rounded-xl"
            />
          </div>
        </Field>

        <Field>
          <FieldLabel htmlFor="password" className="text-[13px] font-medium text-slate-700 mb-1 block">
            {t("auth.password")}
          </FieldLabel>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="h-11 pl-10 pr-10 text-[14px] font-normal bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:border-emerald-600 focus-visible:ring-emerald-600/20 rounded-xl"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
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
          <FieldLabel htmlFor="confirmPassword" className="text-[13px] font-medium text-slate-700 mb-1 block">
            {t("auth.confirm_password")}
          </FieldLabel>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="h-11 pl-10 pr-10 text-[14px] font-normal bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:border-emerald-600 focus-visible:ring-emerald-600/20 rounded-xl"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
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
            {isSubmitting ? t("auth.creating_workspace") : t("auth.create_account_btn")}
          </Button>
        </Field>

        <p className="text-center text-xs font-normal text-slate-500 pt-2">
          {t("auth.already_have_account")}{" "}
          <Link to="/login" className="font-medium text-emerald-600 hover:text-emerald-700 transition-colors">
            {t("auth.sign_in")}
          </Link>
        </p>
      </FieldGroup>
    </form>
  );
}
