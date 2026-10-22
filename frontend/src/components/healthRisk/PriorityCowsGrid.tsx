import React from "react";
import { ShieldCheck, MoreHorizontal, Eye, CheckCircle2 } from "lucide-react";
import { UnifiedRiskCase, SummaryFilterType } from "@/services/riskCorrelation";
import { useLanguage } from "@/context/LanguageContext";

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
          title: t("health.high_attention_title", "High Attention Cows"),
          subtitle: t("health.high_attention_subtitle", "Cows requiring immediate clinical inspection or management intervention."),
          emptyText: t("health.high_attention_empty", "No high attention cows currently identified. The herd is in good health."),
        };
      case "monitor":
        return {
          icon: "⚠️",
          title: t("health.surveillance_title", "Cows Under Surveillance"),
          subtitle: t("health.surveillance_subtitle", "Cows showing moderate variance in yield, biometrics, or feed intake."),
          emptyText: t("health.surveillance_empty", "No cows currently in warning/monitoring status."),
        };
      case "healthy":
        return {
          icon: "🐄",
          title: t("health.healthy_title", "Healthy & Stable Herd"),
          subtitle: t("health.healthy_subtitle", "Cows operating within normal expected baselines and healthy biometrics."),
          emptyText: t("health.healthy_empty", "No cows currently categorized under normal baseline."),
        };
      case "flagged_7d":
        return {
          icon: "📅",
          title: t("health.flagged_7d_title", "Cows Flagged (Past 7 Days)"),
          subtitle: t("health.flagged_7d_subtitle", "Unique cows with active or recent health signals recorded in the last 7 days."),
          emptyText: t("health.flagged_7d_empty", "No health alerts or anomalies recorded across the herd in the last 7 days."),
        };
      case "all_attention":
      default:
        return {
          icon: "🚨",
          title: t("health.attention_title", "Cows Requiring Attention"),
          subtitle: t("health.attention_subtitle", "Aggregated cow-level cases prioritizing highest urgency (1 card per cow)."),
          emptyText: t("health.all_healthy", "All cows healthy and stable. No active attention cases."),
        };
    }
  }

  const { icon, title, subtitle, emptyText } = getSectionHeader();

  function getPriorityBadge(item: UnifiedRiskCase) {
    if (item.case_status === "resolved") {
      return (
        <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
          {t("status.resolved", "RESOLVED")}
        </span>
      );
    }

    switch (item.priority) {
      case "urgent":
        return (
          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/40">
            {t("priority.urgent", "URGENT")}
          </span>
        );
      case "needs_attention":
        return (
          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900/40">
            {t("priority.needs_attention", "ATTENTION")}
          </span>
        );
      case "monitor":
        return (
          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40">
            {t("priority.monitor", "MONITOR")}
          </span>
        );
      case "routine":
      default:
        return (
          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40">
            {t("priority.routine", "ROUTINE")}
          </span>
        );
    }
  }

  function getHealthStatus(status: UnifiedRiskCase["recorded_health_status"]) {
    switch (status) {
      case "no_recorded_concern":
        return {
          text: t("health_status.normal", "Normal"),
          className: "text-emerald-600 dark:text-emerald-400 font-medium",
        };
      case "concern_reported":
        return {
          text: t("health_status.concern", "Concern reported"),
          className: "text-amber-600 dark:text-amber-400 font-medium",
        };
      case "vet_recommended":
        return {
          text: t("health_status.vet_check", "Vet check recommended"),
          className: "text-rose-600 dark:text-rose-400 font-medium",
        };
      case "assessment_unavailable":
      default:
        return {
          text: t("health_status.unrecorded", "Unrecorded"),
          className: "text-slate-500 dark:text-slate-400 font-medium",
        };
    }
  }

  function getMilkYield(item: UnifiedRiskCase) {
    const { milk_production_status, milk_recorded_liters, milk_deviation_pct } = item;
    if (milk_recorded_liters != null) {
      const yieldStr = `${milk_recorded_liters.toFixed(1)} L`;
      switch (milk_production_status) {
        case "within_usual_range":
          return `${yieldStr} (Normal)`;
        case "below_usual_range":
          return `${yieldStr} (${milk_deviation_pct != null ? `-${Math.abs(milk_deviation_pct)}% drop` : "Drop"})`;
        case "above_usual_range":
          return `${yieldStr} (${milk_deviation_pct != null ? `+${milk_deviation_pct}%` : "Above"})`;
        default:
          return yieldStr;
      }
    }
    switch (milk_production_status) {
      case "within_usual_range":
        return "Normal";
      case "insufficient_history":
        return "Baseline setup";
      case "today_unrecorded":
      default:
        return "Unrecorded";
    }
  }

  function getAiSignal(status: UnifiedRiskCase["ai_monitoring_status"]) {
    switch (status) {
      case "unusual_pattern":
        return {
          text: t("ai_status.unusual_pattern_text", "Unusual pattern"),
          className: "text-purple-600 dark:text-purple-400 font-medium",
        };
      case "no_unusual_pattern":
        return {
          text: t("ai_status.normal_pattern_text", "Normal pattern"),
          className: "text-emerald-600 dark:text-emerald-400 font-medium",
        };
      case "insufficient_data":
      default:
        return {
          text: t("ai_status.learning_text", "Learning"),
          className: "text-slate-500 dark:text-slate-400 font-medium",
        };
    }
  }

  function getInlineSignals(item: UnifiedRiskCase) {
    if (!item.sources || item.sources.length === 0) {
      return t("signals.normal_baseline", "Normal baseline");
    }
    return item.sources
      .map((src) => {
        switch (src) {
          case "Health Alert":
            return t("signals.health_alert", "Health alert");
          case "AI Anomaly":
            return t("signals.ai_anomaly", "AI anomaly");
          case "Environmental":
            return t("signals.environmental", "Environmental");
          default:
            return t("signals.observation", "Observation");
        }
      })
      .join(" · ");
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
          {t("health.showing_cows", "Showing {count} cows", { count: cases.length })}
        </span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-56 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900/30 p-5"
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
            {t("health.select_other_filter", "Select another summary block above to view cows in other risk categories.")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cases.map((item) => {
            const healthStatus = getHealthStatus(item.recorded_health_status);
            const milkYieldText = getMilkYield(item);
            const aiSignal = getAiSignal(item.ai_monitoring_status);
            const inlineSignalsText = getInlineSignals(item);

            return (
              <div
                key={item.cow_id}
                data-testid={`cow-card-${item.tag_id}`}
                className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 dark:border-[#27272A] bg-white dark:bg-[#151719] p-5 transition-all duration-150 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs"
              >
                <div>
                  {/* Top row: Cow Identity (Left) & Monitoring Status Badge (Right) */}
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-[#F4F4F5] truncate">
                      {item.cow_name}{" "}
                      <span className="text-xs font-normal text-slate-400 dark:text-slate-500 font-mono">
                        · {item.tag_id}
                      </span>
                    </h4>
                    <div className="shrink-0">{getPriorityBadge(item)}</div>
                  </div>

                  {/* Compact 3-row key-value section */}
                  <div className="mt-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400 font-normal">
                        {t("health.label_health_status", "Health status")}
                      </span>
                      <span className={healthStatus.className}>
                        {healthStatus.text}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400 font-normal">
                        {t("health.label_milk_yield", "Milk yield")}
                      </span>
                      <span className="text-slate-900 dark:text-[#F4F4F5] font-medium">
                        {milkYieldText}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400 font-normal">
                        {t("health.label_ai_signal", "AI signal")}
                      </span>
                      <span className={aiSignal.className}>
                        {aiSignal.text}
                      </span>
                    </div>
                  </div>

                  {/* Subtle horizontal divider & Alert description */}
                  <div className="mt-4 border-t border-slate-100 dark:border-[#27272A] pt-3">
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {item.primary_evidence_summary || item.primary_concern}
                    </p>
                  </div>
                </div>

                {/* Footer: Quiet Signals (Left) & Actions (Right) */}
                <div className="mt-4 border-t border-slate-100 dark:border-[#27272A] pt-3 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-xs text-slate-400 dark:text-slate-500 truncate block font-normal">
                      {inlineSignalsText}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onSelectCase(item)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-[#27272A] bg-slate-50/80 dark:bg-[#1B1D20] px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-100 dark:hover:bg-[#222529] transition cursor-pointer"
                    >
                      <Eye className="h-3 w-3 text-slate-500 dark:text-slate-400" />
                      <span>{t("common.view_cow", "View Cow")}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenMore(item)}
                      title={t("common.more_details", "More details & signals")}
                      className="rounded-lg border border-slate-200 dark:border-[#27272A] bg-slate-50/80 dark:bg-[#1B1D20] p-1 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 transition cursor-pointer"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
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
