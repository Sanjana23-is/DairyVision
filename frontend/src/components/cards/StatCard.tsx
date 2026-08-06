import type { ReactNode } from "react";

export default function StatCard({
  title,
  value,
  delta,
  icon,
}: {
  title: string;
  value: ReactNode;
  delta?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="group rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            {title}
          </div>
          <div className="mt-3 text-3xl font-semibold text-slate-900">
            {value}
          </div>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-slate-50 text-slate-700 transition group-hover:bg-sky-50">
          {icon}
        </div>
      </div>

      {delta ? (
        <div className="mt-4 text-sm text-slate-500">{delta}</div>
      ) : null}
    </div>
  );
}
