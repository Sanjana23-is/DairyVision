import { ReactNode } from "react";

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
          <div className="hidden bg-gradient-to-br from-sky-700 via-blue-700 to-cyan-600 p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.3em] text-sky-100">
                DairyVision AI
              </p>
              <h1 className="mt-4 text-3xl font-semibold">
                Secure access to your dairy intelligence workspace.
              </h1>
              <p className="mt-4 max-w-md text-sm text-sky-100/90">
                Manage your farm operations, monitor cattle health, and make
                data-driven decisions with confidence.
              </p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/10 p-4 text-sm">
              Trusted authentication for modern dairy operations.
            </div>
          </div>

          <div className="flex items-center justify-center p-6 sm:p-10">
            <div className="w-full max-w-md">
              <div className="mb-6 space-y-2">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
                  {title}
                </p>
                <h2 className="text-2xl font-semibold text-slate-900">
                  {subtitle}
                </h2>
              </div>
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
