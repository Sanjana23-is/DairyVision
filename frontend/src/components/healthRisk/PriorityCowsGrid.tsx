import React from "react";
import { ShieldCheck, MoreHorizontal, Eye, Sparkles, CheckCircle2 } from "lucide-react";
import { UnifiedRiskCase, RiskSource, SummaryFilterType } from "@/services/riskCorrelation";
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

  function getSourceBadge(src: RiskSource) {
    switch (src) {
      case "AI Anomaly":
        return (
          <span
            key={src}
            className="inline-flex items-center gap-1 rounded-md border border-purple-200 bg-purple-50 dark:border-purple-500/30 dark:bg-purple-950/40 px-2 py-0.5 text-[11px] font-semibold text-purple-700 dark:text-purple-300"
          >
            <span>🤖</span> {t("signals.ai_anomaly", "AI Anomaly")}
          </span>
        );
      case "Health Alert":
        return (
          <span
            key={src}
            className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 dark:border-sky-500/30 dark:bg-sky-950/40 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:text-sky-300"
          >
            <span>🩺</span> {t("signals.health_alert", "Health Alert")}
          </span>
        );
      case "Environmental":
        return (
          <span
            key={src}
            className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-950/40 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300"
          >
            <span>🌤️</span> {t("signals.environmental", "Environmental")}
          </span>
        );
      default:
        return (
          <span
            key={src}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300"
          >
            <span>📋</span> {t("signals.observation", "Observation")}
          </span>
        );
    }
  }

  function getPriorityBadge(item: UnifiedRiskCase) {
    if (item.case_status === "resolved") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
          <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
          {t("status.resolved", "RESOLVED")}
        </span>
      );
    }

    switch (item.priority) {
      case "urgent":
        return (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-extrabold bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-500/40 animate-pulse">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-600 dark:bg-rose-400" />
            {t("priority.urgent", "URGENT")}
          </span>
        );
      case "needs_attention":
        return (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-extrabold bg-orange-100 text-orange-800 border border-orange-300 dark:bg-orange-950/80 dark:text-orange-300 dark:border-orange-500/40">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-600 dark:bg-orange-400" />
            {t("priority.needs_attention", "NEEDS ATTENTION")}
          </span>
        );
      case "monitor":
        return (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-extrabold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-500/40">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
            {t("priority.monitor", "MONITOR")}
          </span>
        );
      case "routine":
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-500/40">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
            {t("priority.routine", "ROUTINE")}
          </span>
        );
    }
  }

  function getHealthChip(status: UnifiedRiskCase["recorded_health_status"]) {
    switch (status) {
      case "no_recorded_concern":
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/40 dark:bg-emerald-950/20 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
            🩺 {t("health_status.no_recorded_concern", "Health: Normal")}
          </span>
        );
      case "concern_reported":
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50/80 dark:border-amber-900/40 dark:bg-amber-950/20 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
            🩺 {t("health_status.concern_reported", "Health: Concern")}
          </span>
        );
      case "vet_recommended":
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50/80 dark:border-rose-900/40 dark:bg-rose-950/20 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:text-rose-300">
            🩺 {t("health_status.vet_recommended", "Health: Vet Check")}
          </span>
        );
      case "assessment_unavailable":
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            🩺 {t("health_status.assessment_unavailable", "Health: Unrecorded")}
          </span>
        );
    }
  }

  function getMilkChip(item: UnifiedRiskCase) {
    const { milk_production_status, milk_recorded_liters, milk_deviation_pct } = item;
    switch (milk_production_status) {
      case "within_usual_range":
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/40 dark:bg-emerald-950/20 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
            🥛 {milk_recorded_liters != null ? t("milk_status.chip_normal", "Milk: {yield} L (Normal)", { yield: milk_recorded_liters.toFixed(1) }) : t("milk_status.chip_normal_empty", "Milk: Normal")}
          </span>
        );
      case "below_usual_range":
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50/80 dark:border-amber-900/40 dark:bg-amber-950/20 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
            🥛 {milk_deviation_pct != null ? t("milk_status.chip_drop", "Milk: -{pct}% Drop", { pct: Math.abs(milk_deviation_pct) }) : t("milk_status.chip_drop_empty", "Milk: Drop")}
          </span>
        );
      case "above_usual_range":
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/40 dark:bg-emerald-950/20 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
            🥛 {t("milk_status.chip_above", "Milk: +{pct}% Above", { pct: milk_deviation_pct ?? 0 })}
          </span>
        );
      case "insufficient_history":
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            🥛 {t("milk_status.insufficient_history", "Milk: Baseline Setup")}
          </span>
        );
      case "today_unrecorded":
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            🥛 {t("milk_status.today_unrecorded", "Milk: Unrecorded")}
          </span>
        );
    }
  }

  function getAiChip(status: UnifiedRiskCase["ai_monitoring_status"]) {
    switch (status) {
      case "no_unusual_pattern":
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/40 dark:bg-emerald-950/20 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
            🤖 {t("ai_status.no_unusual_pattern", "AI: Normal Pattern")}
          </span>
        );
      case "unusual_pattern":
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-purple-200 bg-purple-50 dark:border-purple-500/30 dark:bg-purple-950/40 px-2 py-0.5 text-[11px] font-semibold text-purple-700 dark:text-purple-300">
            🤖 {t("ai_status.unusual_pattern", "AI: Unusual Pattern")}
          </span>
        );
      case "insufficient_data":
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-800 dark:bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            🤖 {t("ai_status.insufficient_data", "AI: Learning")}
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
            const isUrgent = item.priority === "urgent" && item.case_status !== "resolved";
            const isAttention = item.priority === "needs_attention" && item.case_status !== "resolved";
            const isMonitor = item.priority === "monitor" && item.case_status !== "resolved";

            return (
              <div
                key={item.cow_id}
                data-testid={`cow-card-${item.tag_id}`}
                className={`group relative flex flex-col justify-between rounded-2xl border p-5 transition-all duration-200 shadow-xs ${
                  isUrgent
                    ? "border-rose-200 bg-white dark:border-rose-900/50 dark:bg-[#161214] hover:border-rose-400 dark:hover:border-rose-600/70 hover:shadow-md dark:hover:shadow-rose-950/30"
                    : isAttention
                    ? "border-orange-200 bg-white dark:border-orange-900/50 dark:bg-[#171412] hover:border-orange-400 dark:hover:border-orange-600/70 hover:shadow-md dark:hover:shadow-orange-950/30"
                    : isMonitor
                    ? "border-amber-200 bg-white dark:border-amber-900/40 dark:bg-[#161512] hover:border-amber-400 dark:hover:border-amber-600/70 hover:shadow-md dark:hover:shadow-amber-950/30"
                    : "border-emerald-200/80 bg-white dark:border-emerald-900/40 dark:bg-[#121614] hover:border-emerald-400 dark:hover:border-emerald-600/70 hover:shadow-md"
                }`}
              >
                <div>
                  {/* Top row: Cow Identity & Priority Badge */}
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
                          {item.breed}
                        </div>
                      ) : null}
                    </div>

                    <div>{getPriorityBadge(item)}</div>
                  </div>

                  {/* 3 Core Dimensions Badges */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {getHealthChip(item.recorded_health_status)}
                    {getMilkChip(item)}
                    {getAiChip(item.ai_monitoring_status)}
                  </div>

                  {/* Evidence Narrative */}
                  <div className="mt-3.5 border-t border-slate-100 dark:border-slate-800/80 pt-3">
                    <p className="text-xs font-medium text-slate-700 dark:text-[#D4D4D8] leading-relaxed">
                      {item.primary_evidence_summary || item.primary_concern}
                    </p>

                    {item.reasons.length > 1 ? (
                      <div className="mt-2 space-y-1">
                        {item.reasons.slice(1, 3).map((reason, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-400 leading-snug"
                          >
                            <span
                              className={`mt-1.5 h-1 w-1 rounded-full shrink-0 ${
                                isUrgent
                                  ? "bg-rose-500"
                                  : isAttention
                                  ? "bg-orange-500"
                                  : isMonitor
                                  ? "bg-amber-500"
                                  : "bg-emerald-500"
                              }`}
                            />
                            <span className="line-clamp-2">{reason}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Bottom row: Detected Signal Sources & Action Buttons */}
                <div className="mt-4 border-t border-slate-100 dark:border-slate-800/80 pt-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    {item.sources.length > 0 ? t("signals.sources_title", "Signals:") : t("signals.status_title", "Status:")}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1">
                      {item.sources.length > 0 ? (
                        item.sources.map((s) => getSourceBadge(s))
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-950/40 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                          <Sparkles className="h-3 w-3" /> {t("signals.normal_baseline", "Normal Baseline")}
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
                        <span>{t("common.view_cow", "View Cow")}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenMore(item)}
                        title={t("common.more_details", "More details & signals")}
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
