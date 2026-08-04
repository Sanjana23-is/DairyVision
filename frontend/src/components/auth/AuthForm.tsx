import { FormEvent, ReactNode } from "react";

interface AuthFormProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitLabel: string;
}

export function AuthForm({
  title,
  subtitle,
  children,
  onSubmit,
  submitLabel,
}: AuthFormProps) {
  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-600">{subtitle}</p>
      </div>

      {children}

      <button
        type="submit"
        className="w-full rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-800"
      >
        {submitLabel}
      </button>
    </form>
  );
}
