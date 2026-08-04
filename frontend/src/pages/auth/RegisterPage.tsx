import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthForm } from "@/components/auth/AuthForm";
import { useAuth } from "@/context/AuthContext";

export function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setIsSubmitting(true);
    try {
      await register({ email, password, full_name: fullName });
      navigate("/dashboard");
    } catch (err) {
      setError("We could not create your account right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Get started"
      subtitle="Create your DairyVision AI workspace in minutes."
    >
      <AuthForm
        title="Register"
        subtitle="Set up your account to access the platform."
        onSubmit={handleSubmit}
        submitLabel={isSubmitting ? "Creating account..." : "Create account"}
      >
        {error ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <label className="block text-sm font-medium text-slate-700">
          <span className="mb-1.5 block">Full name</span>
          <input
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-sky-600"
            placeholder="Ava Johnson"
          />
        </label>

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

        <label className="block text-sm font-medium text-slate-700">
          <span className="mb-1.5 block">Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-sky-600"
            placeholder="Create a strong password"
          />
        </label>

        <p className="text-sm text-slate-600">
          Already have an account?{" "}
          <Link to="/login" className="text-sky-700 hover:underline">
            Sign in
          </Link>
        </p>
      </AuthForm>
    </AuthShell>
  );
}
