import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthForm } from "@/components/auth/AuthForm";
import { useAuth } from "@/context/AuthContext";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      navigate("/dashboard");
    } catch (err) {
      setError("Invalid credentials. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue managing your dairy operations."
    >
      <AuthForm
        title="Login"
        subtitle="Use your work email to sign in."
        onSubmit={handleSubmit}
        submitLabel={isSubmitting ? "Signing in..." : "Sign in"}
      >
        {error ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <label className="block text-sm font-medium text-slate-700">
          <span className="mb-1.5 block">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none ring-0 transition focus:border-sky-600"
            placeholder="you@farm.com"
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          <span className="mb-1.5 block">Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-sky-600"
            placeholder="Enter your password"
          />
        </label>

        <div className="flex items-center justify-between text-sm">
          <Link to="/forgot-password" className="text-sky-700 hover:underline">
            Forgot password?
          </Link>
          <Link to="/register" className="text-slate-600 hover:underline">
            Create account
          </Link>
        </div>
      </AuthForm>
    </AuthShell>
  );
}
