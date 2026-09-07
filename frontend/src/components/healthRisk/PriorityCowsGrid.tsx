import React from "react";
import { ShieldCheck, MoreHorizontal, Eye, Sparkles } from "lucide-react";
import { UnifiedRiskCase, RiskSource, SummaryFilterType } from "@/services/riskCorrelation";
import { useLanguage } from "@/context/LanguageContext";
import { getBreedLabel, getSeverityLabel } from "@/lib/i18n-helpers";

interface PriorityCowsGridProps {
  cases: UnifiedRiskCase[];
  activeFilter: SummaryFilterType;
  onSelectCase: (riskCase: UnifiedRiskCase) => void;
  onOpenMore: (riskCase: UnifiedRiskCase) => void;
  isLoading?: boolean;
}

export const PriorityCowsGrid: React.FC<PriorityCowsGridProps> = ({
  cases,
  activeFilter,
  onSelectCase,
  onOpenMore,
  isLoading,
}) => {
  const { t } = useLanguage();

  function getSectionHeader() {
    switch (activeFilter) {
      case "high_attention":
        return {
          icon: "🔴",
          title: t("risk.high_attention_cows", "High Attention Cows"),
          subtitle: t("risk.high_attention_desc", "Cows requiring immediate clinical inspection or management intervention."),
          emptyText: t("risk.no_high_attention", "No high attention cows currently identified. The herd is in good health."),
        };
      case "monitor":
        return {
          icon: "⚠️",
          title: t("risk.cows_under_surveillance", "Cows Under Surveillance"),
          subtitle: t("risk.surveillance_desc", "Cows showing moderate variance in yield, biometrics, or feed intake."),
          emptyText: t("risk.no_monitor", "No cows currently in warning/monitoring status."),
        };
      case "healthy":
        return {
          icon: "🐄",
          title: t("risk.healthy_stable_herd", "Healthy & Stable Herd"),
          subtitle: t("risk.healthy_desc", "Cows operating within normal expected baselines and healthy biometrics."),
          emptyText: t("risk.no_healthy", "No cows currently categorized under normal baseline."),
        };
      case "flagged_7d":
        return {
          icon: "📅",
          title: t("risk.flagged_7d_title", "Cows Flagged (Past 7 Days)"),
          subtitle: t("risk.flagged_7d_desc", "Unique cows with active or recent health signals recorded in the last 7 days."),
          emptyText: t("risk.no_7d", "No health alerts or anomalies recorded across the herd in the last 7 days."),
        };
      case "all_attention":
      default:
        return {
          icon: "🚨",
          title: t("risk.cows_requiring_attention", "Cows Requiring Attention"),
          subtitle: t("risk.attention_desc", "Aggregated cow-level cases prioritizing highest urgency (1 card per cow)."),
          emptyText: t("risk.all_healthy", "All cows healthy and stable. No active attention cases."),
        };
    }
  }

  const { icon, title, subtitle, emptyText } = getSectionHeader();

  function getSourceBadge(src: RiskSource) {
    switch (src) {
      case "AI Anomaly":
        return (
          <span
            key={src}
            className="inline-flex items-center gap-1 rounded-md border border-purple-200 bg-purple-50 dark:border-purple-500/30 dark:bg-purple-950/40 px-2 py-0.5 text-[11px] font-semibold text-purple-700 dark:text-purple-300"
          >
            <span>🤖</span> {t("risk.ai_anomaly", "AI Anomaly")}
          </span>
        );
      case "Health Alert":
        return (
          <span
            key={src}
            className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 dark:border-sky-500/30 dark:bg-sky-950/40 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:text-sky-300"
          >
            <span>🩺</span> {t("risk.health_alert", "Health Alert")}
          </span>
        );
      case "Environmental":
        return (
          <span
            key={src}
            className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-950/40 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300"
          >
            <span>🌤️</span> {t("risk.environmental", "Environmental")}
          </span>
        );
    }
  }

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-100 text-sm dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            {icon}
          </span>
          <div>
            <h3 className="text-base font-bold tracking-tight text-slate-900 dark:text-[#F4F4F5]">
              {title}
            </h3>
            <p className="text-xs font-medium text-slate-500 dark:text-[#A1A1AA]">
              {subtitle}
            </p>
          </div>
        </div>
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
          {t("common.showing", "Showing")} {cases.length} {t("cows.cows", "cows")}
        </span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900/30 p-5"
            />
          ))}
        </div>
      ) : cases.length === 0 ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/30 dark:bg-emerald-950/10 p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 mb-3 border border-emerald-200 dark:border-emerald-500/20">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-300">
            {emptyText}
          </h4>
          <p className="mt-1 text-xs font-medium text-emerald-800/80 dark:text-emerald-400/70 max-w-md mx-auto">
            {t("risk.select_another_filter", "Select another summary block above to view cows in other risk categories.")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cases.map((item) => {
            const isCritical = item.highest_severity === "Critical" && !item.is_resolved;
            const isWarning = item.highest_severity === "Warning" && !item.is_resolved;

            return (
              <div
                key={item.cow_id}
                className={`group relative flex flex-col justify-between rounded-2xl border p-5 transition-all duration-200 shadow-xs ${
                  isCritical
                    ? "border-rose-200 bg-white dark:border-rose-900/50 dark:bg-[#161214] hover:border-rose-400 dark:hover:border-rose-600/70 hover:shadow-md dark:hover:shadow-rose-950/30"
                    : isWarning
                    ? "border-amber-200 bg-white dark:border-amber-900/40 dark:bg-[#161512] hover:border-amber-400 dark:hover:border-amber-600/70 hover:shadow-md dark:hover:shadow-amber-950/30"
                    : "border-emerald-200/80 bg-white dark:border-emerald-900/40 dark:bg-[#121614] hover:border-emerald-400 dark:hover:border-emerald-600/70 hover:shadow-md"
                }`}
              >
                <div>
                  {/* Top row: Cow Identity & Severity Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">🐄</span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-[#F4F4F5] group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {item.cow_name}
                        </h4>
                        <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                          · {item.tag_id}
                        </span>
                      </div>
                      {item.breed ? (
                        <div className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-[#A1A1AA]">
                          {getBreedLabel(item.breed, t)}
                        </div>
                      ) : null}
                    </div>

                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
                        isCritical
                          ? "bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-500/40"
                          : isWarning
                          ? "bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-500/40"
                          : "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-500/40"
                      }`}
                    >
                      {getSeverityLabel(item.highest_severity, t).toUpperCase()}
                    </span>
                  </div>

                  {/* Correlated bulleted reasons (Cleaned up, max 3) */}
                  <div className="mt-3.5 space-y-1.5 border-t border-slate-100 dark:border-slate-800/80 pt-3">
                    {item.reasons.map((reason, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-1.5 text-xs font-medium text-slate-700 dark:text-[#D4D4D8] leading-snug"
                      >
                        <span
                          className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${
                            isCritical
                              ? "bg-rose-500 dark:bg-rose-400"
                              : isWarning
                              ? "bg-amber-500 dark:bg-amber-400"
                              : "bg-emerald-500 dark:bg-emerald-400"
                          }`}
                        />
                        <span className="line-clamp-2">{reason}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom row: Signals & Actions (View Cow + More ⋯) */}
                <div className="mt-4 border-t border-slate-100 dark:border-slate-800/80 pt-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    {item.sources.length > 0 ? `${t("risk.signals", "Signals")}:` : `${t("common.status", "Status")}:`}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1">
                      {item.sources.length > 0 ? (
                        item.sources.map((s) => getSourceBadge(s))
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-950/40 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                          <Sparkles className="h-3 w-3" /> {t("risk.normal_baseline", "Normal Baseline")}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onSelectCase(item)}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700/60 dark:bg-[#1B1D20] px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-emerald-500 hover:text-emerald-600 dark:hover:bg-emerald-600 dark:hover:text-white transition-all cursor-pointer"
                      >
                        <Eye className="h-3 w-3" />
                        <span>{t("risk.view_cow", "View Cow")}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenMore(item)}
                        title={t("common.more_details", "More details")}
                        className="rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700/60 dark:bg-[#1B1D20] p-1 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PriorityCowsGrid;
