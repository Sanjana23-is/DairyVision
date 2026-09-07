import type { ReactNode } from "react";

export default function StatCard({
  title,
  value,
  delta,
  icon,
  onClick,
}: {
  title: string;
  value: ReactNode;
  delta?: string;
  icon?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`group rounded-2xl border border-slate-200/90 dark:border-[#27272A] bg-white dark:bg-[#151719] p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-emerald-300/80 dark:hover:border-emerald-500/40 font-sans ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#71717A]">
            {title}
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-[#F4F4F5] tracking-tight leading-none">
            {value}
          </div>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-colors duration-200 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-500/20 group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
          {icon}
        </div>
      </div>

      {delta ? (
        <div className="mt-2.5 text-xs font-normal text-slate-500 dark:text-[#A1A1AA] leading-normal">
          {delta}
        </div>
      ) : null}
    </div>
  );
}
