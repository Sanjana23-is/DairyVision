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
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-slate-500">{title}</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {value}
          </div>
        </div>
        <div className="h-12 w-12 rounded-lg bg-slate-50 flex items-center justify-center text-slate-700">
          {icon}
        </div>
      </div>

      {delta ? (
        <div className="mt-3 text-sm text-slate-500">{delta}</div>
      ) : null}
    </div>
  );
}
