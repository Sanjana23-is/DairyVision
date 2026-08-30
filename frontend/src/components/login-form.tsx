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
import { Eye, EyeOff, Check, Mail, Lock } from "lucide-react";

interface LoginFormProps extends React.ComponentProps<"form"> {
  onSuccess?: () => void;
}

export function LoginForm({ className, onSuccess, ...props }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Please enter both your email and password.");
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ email, password });
      if (onSuccess) {
        onSuccess();
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      setError("Invalid credentials. Please verify your email and password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className={cn("flex flex-col gap-4.5 text-slate-900 font-sans", className)} onSubmit={handleSubmit} {...props}>
      <FieldGroup>
        <div className="flex flex-col text-left mb-2">
          <span className="text-[11.5px] font-semibold uppercase tracking-wider text-emerald-600">
            WELCOME BACK
          </span>
          <h2 className="text-[28px] lg:text-[31px] font-bold tracking-tight text-slate-900 mt-1 leading-snug">
            Sign in to your account
          </h2>
          <p className="text-[15px] font-normal text-slate-500 mt-1">
            Access your farm intelligence workspace.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-normal text-rose-700 shadow-sm animate-in fade-in">
            {error}
          </div>
        )}

        <Field>
          <FieldLabel htmlFor="email" className="text-[13px] font-medium text-slate-700 mb-1.5 block">
            Email
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
              className="h-12 pl-10 text-[15px] font-normal bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:border-emerald-600 focus-visible:ring-emerald-600/20 rounded-xl"
            />
          </div>
        </Field>

        <Field>
          <FieldLabel htmlFor="password" className="text-[13px] font-medium text-slate-700 mb-1.5 block">
            Password
          </FieldLabel>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="h-12 pl-10 pr-10 text-[15px] font-normal bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:border-emerald-600 focus-visible:ring-emerald-600/20 rounded-xl"
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

        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-normal text-slate-600">
            <div className="relative flex items-center">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="sr-only"
              />
              <div className={cn(
                "h-4 w-4 rounded border transition-colors flex items-center justify-center",
                rememberMe
                  ? "bg-emerald-600 border-emerald-600 text-white"
                  : "border-slate-300 bg-white"
              )}>
                {rememberMe && <Check className="h-3 w-3 stroke-[3]" />}
              </div>
            </div>
            <span>Remember me</span>
          </label>

          <Link
            to="/forgot-password"
            className="text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
          >
            Forgot password?
          </Link>
        </div>

        <Field className="pt-2">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-12 w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium text-[15px] rounded-xl shadow-sm transition-all duration-150 border-0"
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </Field>

        <p className="text-center text-xs font-normal text-slate-500 pt-3">
          Don't have an account?{" "}
          <Link to="/register" className="font-medium text-emerald-600 hover:text-emerald-700 transition-colors">
            Create account
          </Link>
        </p>
      </FieldGroup>
    </form>
  );
}
