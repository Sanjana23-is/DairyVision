import { useState } from "react";
import { Link } from "react-router-dom";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthForm } from "@/components/auth/AuthForm";
import { useAuth } from "@/context/AuthContext";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { forgotPassword } = useAuth();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!email.trim()) {
      setError("Please provide your email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      await forgotPassword({ email });
      setMessage(
        "If that account exists, we have sent a reset link to your inbox.",
      );
    } catch (err) {
      setError("We could not send a password reset request at the moment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Reset password"
      subtitle="We will help you get back into your workspace."
    >
      <AuthForm
        title="Forgot password"
        subtitle="Enter your email for a reset link."
        onSubmit={handleSubmit}
        submitLabel={isSubmitting ? "Sending..." : "Send reset link"}
      >
        {error ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {message}
          </p>
        ) : null}

        <label className="block text-sm font-medium text-slate-700">
          <span className="mb-1.5 block">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-sky-600"
            placeholder="you@farm.com"
          />
        </label>

        <p className="text-sm text-slate-600">
          Remembered your password?{" "}
          <Link to="/login" className="text-sky-700 hover:underline">
            Sign in
          </Link>
        </p>
      </AuthForm>
    </AuthShell>
  );
}
