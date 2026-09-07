import React from "react";
import { ShieldCheck, Eye, AlertTriangle, CalendarDays, Check } from "lucide-react";
import { HerdRiskKPIs, SummaryFilterType } from "@/services/riskCorrelation";
import { useLanguage } from "@/context/LanguageContext";

interface RiskKpiRowProps {
  kpis: HerdRiskKPIs;
  activeFilter: SummaryFilterType;
  onSelectFilter: (filter: SummaryFilterType) => void;
  isLoading?: boolean;
}

export const RiskKpiRow: React.FC<RiskKpiRowProps> = ({
  kpis,
  activeFilter,
  onSelectFilter,
  isLoading,
}) => {
  const { t } = useLanguage();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. HEALTHY HERD */}
      <div
        onClick={() => onSelectFilter("healthy")}
        className={`relative flex flex-col justify-between rounded-2xl p-5 transition-all duration-200 cursor-pointer select-none shadow-xs ${
          activeFilter === "healthy"
            ? "border-2 border-emerald-500 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-950/40 ring-4 ring-emerald-500/15 shadow-md"
            : "border border-emerald-200/80 bg-emerald-50/50 hover:border-emerald-300 hover:bg-emerald-50/80 hover:shadow-xs dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:hover:border-emerald-700/60 dark:hover:bg-emerald-950/30"
        }`}
      >
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
              {t("risk.healthy_herd", "Healthy Herd")}
            </span>
            <div className="flex items-center gap-1.5">
              {activeFilter === "healthy" ? (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white dark:bg-emerald-400 dark:text-emerald-950">
                  <Check className="h-3 w-3 stroke-[3]" />
                </span>
              ) : null}
              <div className="rounded-xl bg-emerald-100 dark:bg-emerald-900/40 p-2 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-emerald-950 dark:text-emerald-300">
              {isLoading ? "…" : kpis.healthy}
            </span>
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              {kpis.healthy} {t("risk.stable", "stable")}
            </span>
          </div>
        </div>
        <p className="mt-2 text-xs font-medium text-emerald-800/80 dark:text-emerald-400/70">
          {t("risk.click_view_healthy", "Click to view healthy cows")}
        </p>
      </div>

      {/* 2. MONITOR */}
      <div
        onClick={() => onSelectFilter("monitor")}
        className={`relative flex flex-col justify-between rounded-2xl p-5 transition-all duration-200 cursor-pointer select-none shadow-xs ${
          activeFilter === "monitor"
            ? "border-2 border-amber-500 bg-amber-50 dark:border-amber-400 dark:bg-amber-950/40 ring-4 ring-amber-500/15 shadow-md"
            : "border border-amber-200/80 bg-amber-50/50 hover:border-amber-300 hover:bg-amber-50/80 hover:shadow-xs dark:border-amber-900/40 dark:bg-amber-950/20 dark:hover:border-amber-700/60 dark:hover:bg-amber-950/30"
        }`}
      >
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">
              {t("risk.monitor", "Monitor")}
            </span>
            <div className="flex items-center gap-1.5">
              {activeFilter === "monitor" ? (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-600 text-white dark:bg-amber-400 dark:text-amber-950">
                  <Check className="h-3 w-3 stroke-[3]" />
                </span>
              ) : null}
              <div className="rounded-xl bg-amber-100 dark:bg-amber-900/40 p-2 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
                <Eye className="h-4 w-4" />
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-amber-950 dark:text-amber-300">
              {isLoading ? "…" : kpis.monitor}
            </span>
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
              {kpis.monitor} {t("risk.under_review", "under review")}
            </span>
          </div>
        </div>
        <p className="mt-2 text-xs font-medium text-amber-800/80 dark:text-amber-400/70">
          {t("risk.click_view_moderate", "Click to view moderate variance cows")}
        </p>
      </div>

      {/* 3. HIGH ATTENTION */}
      <div
        onClick={() => onSelectFilter("high_attention")}
        className={`relative flex flex-col justify-between rounded-2xl p-5 transition-all duration-200 cursor-pointer select-none shadow-xs ${
          activeFilter === "high_attention"
            ? "border-2 border-rose-500 bg-rose-50 dark:border-rose-400 dark:bg-rose-950/40 ring-4 ring-rose-500/15 shadow-md"
            : "border border-rose-200/80 bg-rose-50/50 hover:border-rose-300 hover:bg-rose-50/80 hover:shadow-xs dark:border-rose-900/40 dark:bg-rose-950/20 dark:hover:border-rose-700/60 dark:hover:bg-rose-950/30"
        }`}
      >
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-400">
              {t("risk.high_attention", "High Attention")}
            </span>
            <div className="flex items-center gap-1.5">
              {activeFilter === "high_attention" ? (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-white dark:bg-rose-400 dark:text-rose-950">
                  <Check className="h-3 w-3 stroke-[3]" />
                </span>
              ) : null}
              <div className="rounded-xl bg-rose-100 dark:bg-rose-900/40 p-2 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-rose-950 dark:text-rose-300">
              {isLoading ? "…" : kpis.high_attention}
            </span>
            <span className="text-xs font-semibold text-rose-700 dark:text-rose-400">
              {kpis.high_attention} {t("risk.requiring_action", "requiring action")}
            </span>
          </div>
        </div>
        <p className="mt-2 text-xs font-medium text-rose-800/80 dark:text-rose-400/70">
          {t("risk.click_view_critical", "Click to view critical action cows")}
        </p>
      </div>

      {/* 4. COWS FLAGGED (7-DAY) */}
      <div
        onClick={() => onSelectFilter("flagged_7d")}
        className={`relative flex flex-col justify-between rounded-2xl p-5 transition-all duration-200 cursor-pointer select-none shadow-xs ${
          activeFilter === "flagged_7d"
            ? "border-2 border-slate-500 bg-slate-100 dark:border-slate-400 dark:bg-slate-800/60 ring-4 ring-slate-500/15 shadow-md"
            : "border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80 hover:shadow-xs dark:border-slate-800 dark:bg-[#151719] dark:hover:border-slate-700 dark:hover:bg-[#181A1D]"
        }`}
      >
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              {t("risk.flagged_7d", "Cows Flagged (7-Day)")}
            </span>
            <div className="flex items-center gap-1.5">
              {activeFilter === "flagged_7d" ? (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-white dark:bg-slate-300 dark:text-slate-900">
                  <Check className="h-3 w-3 stroke-[3]" />
                </span>
              ) : null}
              <div className="rounded-xl bg-slate-100 dark:bg-slate-800/60 p-2 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                <CalendarDays className="h-4 w-4" />
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-[#F4F4F5]">
              {isLoading ? "…" : kpis.cases_this_week}
            </span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {kpis.cases_this_week} {t("risk.cows_flagged", "cows flagged")}
            </span>
          </div>
        </div>
        <p className="mt-2 text-xs font-medium text-slate-500 dark:text-[#A1A1AA]/70">
          {t("risk.click_view_7d", "Click to view 7-day active cows")}
        </p>
      </div>
    </div>
  );
};

export default RiskKpiRow;
