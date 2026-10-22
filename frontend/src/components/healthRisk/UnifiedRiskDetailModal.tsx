import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  X,
  Sparkles,
  Gauge,
  Layers,
  ArrowUpRight,
  Info,
  CheckCircle2,
  Calendar,
  ChevronDown,
  Milk,
  Stethoscope,
  Cpu,
  Clock,
  Database,
  AlertCircle,
  ChevronUp,
  ShieldCheck,
} from "lucide-react";
import {
  UnifiedRiskCase,
  RiskSource,
  EventTimeFilter,
  filterEventsByTimeRange,
  calculateHistoricalBaseline,
} from "@/services/riskCorrelation";
import { useLanguage } from "@/context/LanguageContext";
import { LANGUAGE_OPTIONS, SupportedLanguage } from "@/i18n/translations";

interface UnifiedRiskDetailModalProps {
  riskCase?: UnifiedRiskCase | null;
  onClose: () => void;
  onResolve: (item: { alertIds: string[]; anomalyIds: string[] }) => void;
  isResolving?: boolean;
}

export const UnifiedRiskDetailModal: React.FC<UnifiedRiskDetailModalProps> = ({
  riskCase,
  onClose,
  onResolve,
  isResolving,
}) => {
  const { language, setLanguage, t } = useLanguage();
  const [timeFilter, setTimeFilter] = useState<EventTimeFilter>("7d");
  const [productionRange, setProductionRange] = useState<"7d" | "14d" | "30d" | "all">("7d");
  const [showOlderHistory, setShowOlderHistory] = useState<boolean>(false);
  const [showConfirmResolve, setShowConfirmResolve] = useState<boolean>(false);

  // Grouped events filtered by selected time range
  const filteredEvents = useMemo(() => {
    if (!riskCase) return [];
    return filterEventsByTimeRange(riskCase.events, timeFilter);
  }, [riskCase, timeFilter]);

  // Observations sorted descending for production evidence
  const sortedObservations = useMemo(() => {
    if (!riskCase) return [];
    return [...(riskCase.observations || [])].sort(
      (a, b) => new Date(b.observation_date).getTime() - new Date(a.observation_date).getTime()
    );
  }, [riskCase]);

  // Displayed production observations based on filter and inspect older toggle
  const displayedProductionObs = useMemo(() => {
    if (sortedObservations.length === 0) return [];
    if (productionRange === "7d") {
      return showOlderHistory ? sortedObservations : sortedObservations.slice(0, 7);
    }
    if (productionRange === "14d") {
      return sortedObservations.slice(0, 14);
    }
    if (productionRange === "30d") {
      return sortedObservations.slice(0, 30);
    }
    return sortedObservations;
  }, [sortedObservations, productionRange, showOlderHistory]);

  if (!riskCase) return null;

  const cowId = riskCase.cow_id;
  const cowName = riskCase.cow_name;
  const tagId = riskCase.tag_id;
  const breed = riskCase.breed;
  const isResolved = riskCase.case_status === "resolved";

  const isUrgent = riskCase.priority === "urgent" && !isResolved;
  const isAttention = riskCase.priority === "needs_attention" && !isResolved;
  const isMonitor = riskCase.priority === "monitor" && !isResolved;

  const alertIds = riskCase.health_alerts.filter((a) => !a.resolved).map((a) => a.id);
  const anomalyIds = riskCase.anomalies.filter((a) => !a.resolved).map((a) => a.id);

  const localeMap: Record<SupportedLanguage, string> = {
    en: "en-IN",
    hi: "hi-IN",
    mr: "mr-IN",
    pa: "pa-IN",
    gu: "gu-IN",
    kn: "kn-IN",
  };

  // Format date helper
  function formatDate(iso?: string) {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(localeMap[language] || "en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  }

  function handleConfirmResolve() {
    onResolve({ alertIds, anomalyIds });
    setShowConfirmResolve(false);
  }

  function renderPriorityBadge() {
    if (isResolved) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          {t("status.resolved", "RESOLVED")}
        </span>
      );
    }
    if (isUrgent) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-500/40 animate-pulse">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-600 dark:bg-rose-400" />
          {t("priority.urgent", "URGENT")}
        </span>
      );
    }
    if (isAttention) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold bg-orange-100 text-orange-800 border border-orange-300 dark:bg-orange-950/80 dark:text-orange-300 dark:border-orange-500/40">
          <span className="h-1.5 w-1.5 rounded-full bg-orange-600 dark:bg-orange-400" />
          {t("priority.needs_attention", "NEEDS ATTENTION")}
        </span>
      );
    }
    if (isMonitor) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-500/40">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
          {t("priority.monitor", "MONITOR")}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-500/40">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
        {t("priority.routine", "ROUTINE")}
      </span>
    );
  }

  function renderSourceBadge(src: RiskSource) {
    switch (src) {
      case "AI Anomaly":
        return (
          <span
            key={src}
            className="inline-flex items-center gap-1 rounded-md border border-purple-200 bg-purple-50 dark:border-purple-500/30 dark:bg-purple-950/40 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:text-purple-300"
          >
            <span>🤖</span> {t("signals.ai_anomaly", "AI Anomaly")}
          </span>
        );
      case "Health Alert":
        return (
          <span
            key={src}
            className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 dark:border-sky-500/30 dark:bg-sky-950/40 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-300"
          >
            <span>🩺</span> {t("signals.health_alert", "Health Alert")}
          </span>
        );
      case "Environmental":
        return (
          <span
            key={src}
            className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-950/40 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300"
          >
            <span>🌤️</span> {t("signals.environmental", "Environmental")}
          </span>
        );
      default:
        return (
          <span
            key={src}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300"
          >
            <span>📋</span> {t("signals.observation", "Observation")}
          </span>
        );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#121316] shadow-2xl flex flex-col max-h-[92vh]">
        {/* SECTION A: Modal Header & Cow Identity */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4 bg-slate-50/80 dark:bg-[#17191D] shrink-0">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">🐄</span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-[#F4F4F5]">
                    {cowName}
                  </h3>
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                    · {tagId}
                  </span>
                  {breed ? (
                    <span className="rounded-md bg-slate-200/70 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                      {breed}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  <Clock className="h-3 w-3" />
                  <span>
                    {t("modal.last_observation", "Last observation")}: {formatDate(riskCase.last_observation_date)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {renderPriorityBadge()}
            <select
              aria-label={t("nav.switch_language", "Switch language")}
              value={language}
              onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
              data-testid="modal-language-selector"
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-2xs"
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.flag} {opt.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-[#F4F4F5] transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1">
          {/* SECTION A.2: Distinct Log Concept Metric Chips */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 dark:border-slate-800/80 dark:bg-[#181A1F] p-3 text-center">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {t("modal.stat_recent_obs", "Recent Observations")}
              </div>
              <div className="text-lg font-extrabold text-slate-900 dark:text-[#F4F4F5] mt-0.5">
                {riskCase.recent_observations_count}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 dark:border-slate-800/80 dark:bg-[#181A1F] p-3 text-center">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {t("modal.stat_distinct_events", "Distinct Events")}
              </div>
              <div className="text-lg font-extrabold text-slate-900 dark:text-[#F4F4F5] mt-0.5">
                {riskCase.distinct_events_count}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 dark:border-slate-800/80 dark:bg-[#181A1F] p-3 text-center">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {t("modal.stat_active_cases", "Active Cases")}
              </div>
              <div className={`text-lg font-extrabold mt-0.5 ${riskCase.active_cases_count > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                {riskCase.active_cases_count}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 dark:border-slate-800/80 dark:bg-[#181A1F] p-3 text-center">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {t("modal.stat_tech_scans", "Technical Signals")}
              </div>
              <div className="text-lg font-extrabold text-slate-900 dark:text-[#F4F4F5] mt-0.5">
                {riskCase.technical_scans_count}
              </div>
            </div>
          </div>

          {/* SECTION B: WHY IS THIS COW FLAGGED? Farmer-Facing Narrative */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-[#16171B] p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-300">
                <Info className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>{t("modal.why_flagged", "Why is this cow flagged?")}</span>
              </div>
              <div className="flex items-center gap-1">
                {riskCase.sources.map((s) => renderSourceBadge(s))}
              </div>
            </div>

            <p className="text-sm font-semibold text-slate-900 dark:text-[#F4F4F5] leading-relaxed">
              {riskCase.primary_evidence_summary || riskCase.primary_concern}
            </p>

            {/* 3 Core Dimensions Breakdown */}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <div className="rounded-xl bg-white dark:bg-[#1C1E23] p-3 border border-slate-200/80 dark:border-slate-700/60">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <Stethoscope className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                  <span>{t("dimension.recorded_health", "Recorded Health")}</span>
                </div>
                <div className="mt-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                  {riskCase.recorded_health_label}
                </div>
              </div>

              <div className="rounded-xl bg-white dark:bg-[#1C1E23] p-3 border border-slate-200/80 dark:border-slate-700/60">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <Milk className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{t("dimension.milk_production", "Milk Production")}</span>
                </div>
                <div className="mt-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                  {riskCase.milk_production_label}
                </div>
              </div>

              <div className="rounded-xl bg-white dark:bg-[#1C1E23] p-3 border border-slate-200/80 dark:border-slate-700/60">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <Cpu className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                  <span>{t("dimension.ai_monitoring", "AI Monitoring")}</span>
                </div>
                <div className="mt-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                  {riskCase.ai_monitoring_label}
                </div>
              </div>
            </div>

            {riskCase.reasons.length > 1 ? (
              <div className="mt-3.5 space-y-1 pt-3 border-t border-slate-200 dark:border-slate-800">
                {riskCase.reasons.slice(1).map((r, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-slate-400 shrink-0" />
                    <span>{r}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* SECTION C: RECENT ACTIVITY FEED & AUDIT HISTORY WITH TIME FILTERS */}
          <div data-testid="section-recent-activity" className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#16171B] p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-300">
                  {t("modal.recent_activity", "Recent Activity & Clinical Audit")}
                </h4>
                <p className="text-[11px] text-slate-500 font-medium">
                  {t("modal.grouped_events_desc", "Grouped audit feed with occurrence aggregation")}
                </p>
              </div>

              {/* Time Range Tabs */}
              <div className="flex items-center rounded-xl bg-slate-100 dark:bg-[#1E2026] p-1 border border-slate-200 dark:border-slate-700/60">
                {(["3d", "7d", "30d", "all"] as EventTimeFilter[]).map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => setTimeFilter(range)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                      timeFilter === range
                        ? "bg-white text-emerald-700 dark:bg-emerald-600 dark:text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    {range === "3d"
                      ? t("modal.filter_3d", "3 Days")
                      : range === "7d"
                      ? t("modal.filter_7d", "7 Days")
                      : range === "30d"
                      ? t("modal.filter_30d", "30 Days")
                      : t("modal.filter_all", "All")}
                  </button>
                ))}
              </div>
            </div>

            {filteredEvents.length === 0 ? (
              <div className="rounded-xl border border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-[#1A1C21] p-6 text-center text-xs font-medium text-slate-500">
                {t("modal.no_events_in_range", "No clinical events or observations in this selected time range.")}
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredEvents.map((ev) => {
                  const isRoutine = ev.priority === "routine";
                  const isUrgentEv = ev.priority === "urgent";
                  const isAttentionEv = ev.priority === "needs_attention";

                  return (
                    <div
                      key={ev.id}
                      className={`rounded-xl border p-3.5 text-xs transition-all ${
                        isUrgentEv
                          ? "border-rose-200 bg-rose-50/50 dark:border-rose-900/40 dark:bg-rose-950/20"
                          : isAttentionEv
                          ? "border-orange-200 bg-orange-50/50 dark:border-orange-900/40 dark:bg-orange-950/20"
                          : isRoutine
                          ? "border-slate-100 bg-slate-50/70 dark:border-slate-800/80 dark:bg-[#1B1D22]"
                          : "border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20"
                      }`}
                    >
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="font-bold text-slate-900 dark:text-[#F4F4F5]">
                            {ev.event_title}
                          </span>
                          {ev.occurrence_count > 1 ? (
                            <span className="rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                              {ev.occurrence_count} {t("modal.occurrences", "occurrences")}
                            </span>
                          ) : null}
                          {renderSourceBadge(ev.source)}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                            {formatDate(ev.date)}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              ev.status === "resolved"
                                ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            }`}
                          >
                            {ev.status === "resolved" ? t("status.resolved", "Resolved") : t("status.active", "Active")}
                          </span>
                        </div>
                      </div>

                      <p className="mt-2 text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                        {ev.observed_summary}
                      </p>

                      {ev.actual_value && ev.usual_value ? (
                        <div className="mt-2 flex items-center gap-3 text-[11px] font-medium text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                          <span>
                            {t("modal.observed_value", "Observed")}: <strong className="text-slate-900 dark:text-white font-mono">{ev.actual_value}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            {t("modal.usual_baseline", "Usual baseline")}: <strong className="text-slate-900 dark:text-white font-mono">{ev.usual_value}</strong>
                          </span>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION D: HISTORICAL PRODUCTION EVIDENCE */}
          <div data-testid="section-production-evidence" className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#16171B] p-5 space-y-4">
            {/* Header & Date Range Tabs */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Milk className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-300">
                    {t("modal.historical_production", "Historical Production Evidence")}
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  {t("modal.production_evidence_subtitle", "Recent milk yield vs calculated rolling median baseline")}
                </p>
              </div>

              {/* Date Range Filter Tabs */}
              <div className="flex items-center rounded-xl bg-slate-100 dark:bg-[#1E2026] p-1 border border-slate-200 dark:border-slate-700/60">
                {(["7d", "14d", "30d", "all"] as ("7d" | "14d" | "30d" | "all")[]).map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => {
                      setProductionRange(range);
                      setShowOlderHistory(false);
                    }}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                      productionRange === range
                        ? "bg-white text-emerald-700 dark:bg-emerald-600 dark:text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    {range === "7d"
                      ? t("modal.filter_7d", "7 Days")
                      : range === "14d"
                      ? t("modal.filter_14d", "14 Days")
                      : range === "30d"
                      ? t("modal.filter_30d", "30 Days")
                      : t("modal.filter_all_history", "All History")}
                  </button>
                ))}
              </div>
            </div>

            {/* Measurement Period & Data Integrity Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20 px-3.5 py-2.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                  <Database className="h-3 w-3" />
                  {t("modal.actual_recorded_log", "Actual Recorded Daily Log")}
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {t("modal.prod_measurement_label", "Total milk produced per day (litres)")}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>{t("modal.no_baseline_leakage_note", "Baseline is calculated strictly from prior days, excluding the evaluated date.")}</span>
              </div>
            </div>

            {/* Production KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* 1. Latest Recorded Yield */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-[#1A1C21] p-3">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {t("modal.latest_recorded_yield", "Latest Recorded Yield")}
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-xl font-extrabold font-mono text-slate-900 dark:text-white">
                    {sortedObservations.length > 0 && sortedObservations[0].milk_produced_liters != null
                      ? `${sortedObservations[0].milk_produced_liters.toFixed(1)} L`
                      : "—"}
                  </span>
                  {sortedObservations.length > 0 && sortedObservations[0].observation_date && (
                    <span className="text-[11px] text-slate-500 font-mono">
                      {formatDate(sortedObservations[0].observation_date)}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  {sortedObservations.length > 0
                    ? t("modal.actual_recorded_log", "Actual Recorded Daily Log")
                    : t("modal.no_production_records", "No milk production records available")}
                </div>
              </div>

              {/* 2. Cow's Usual Production Baseline */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-[#1A1C21] p-3">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {t("modal.cow_usual_baseline", "Cow's Usual Baseline")}
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  {riskCase.milk_baseline_liters != null ? (
                    <span className="text-xl font-extrabold font-mono text-slate-900 dark:text-white">
                      {riskCase.milk_baseline_liters.toFixed(1)} L
                    </span>
                  ) : sortedObservations.length > 0 ? (
                    <span className="text-sm font-bold text-amber-700 dark:text-amber-400">
                      {t("modal.building_baseline", "Building baseline")}
                    </span>
                  ) : (
                    <span className="text-sm font-semibold text-slate-400">
                      {t("modal.not_enough_records", "Not enough records yet")}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  {riskCase.milk_baseline_liters != null
                    ? t("modal.rolling_median_7d", "Rolling median of prior 7 days")
                    : sortedObservations.length > 0
                    ? t("modal.not_enough_records", "Not enough records yet (need ≥3 prior days)")
                    : t("modal.no_hist_records", "No historical records to build baseline")}
                </div>
              </div>

              {/* 3. Production Difference & Change */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-[#1A1C21] p-3">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {t("modal.change", "Change vs Usual")}
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  {riskCase.milk_baseline_liters != null && riskCase.milk_deviation_liters != null ? (
                    <span
                      className={`text-xl font-extrabold font-mono ${
                        riskCase.milk_deviation_liters < -1.5 && (riskCase.milk_deviation_pct ?? 0) <= -20
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {riskCase.milk_deviation_liters > 0 ? "+" : ""}
                      {riskCase.milk_deviation_liters.toFixed(1)} L
                      {riskCase.milk_deviation_pct != null
                        ? ` (${riskCase.milk_deviation_pct > 0 ? "+" : ""}${riskCase.milk_deviation_pct.toFixed(0)}%)`
                        : ""}
                    </span>
                  ) : (
                    <span className="text-sm font-semibold text-slate-500">
                      {t("modal.not_enough_records", "Not enough records yet")}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-300 truncate">
                  {riskCase.milk_production_label}
                </div>
              </div>
            </div>

            {/* Indigenous Breed Context (Hallikar / Indian Indigenous) */}
            {breed &&
              (breed.toLowerCase().includes("hallikar") ||
                breed.toLowerCase().includes("amrit") ||
                breed.toLowerCase().includes("malnad") ||
                breed.toLowerCase().includes("khillari") ||
                breed.toLowerCase().includes("indigenous")) && (
                <div className="rounded-xl border border-amber-200/70 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-bold">
                      {breed} — {t("modal.breed_context_indigenous", "Indigenous breeds naturally produce 2.5–3.5 L/day. Deviations are evaluated strictly against this cow's own history.")}
                    </span>
                    <p className="text-[11px] text-amber-800/90 dark:text-amber-300/80">
                      {t("modal.indigenous_drop_explanation", "Absolute volume is not treated as a drop. Alarms require a relative drop of ≥25% and ≥1.5 L against {cowName}'s personal verified baseline.", { cowName })}
                    </p>
                  </div>
                </div>
              )}

            {/* Observations Table */}
            {sortedObservations.length === 0 ? (
              <p className="text-xs text-slate-500 p-4 text-center">
                {t("modal.no_production_records", "No milk production records available for this cow.")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                      <th className="py-2.5 px-3">{t("obs_details.recorded_on", "Date")}</th>
                      <th className="py-2.5 px-3">{t("modal.prod_measurement_label", "Total milk produced per day (litres)")}</th>
                      <th className="py-2.5 px-3">{t("modal.historical_baseline_col", "Prior Baseline (L)")}</th>
                      <th className="py-2.5 px-3">{t("modal.status_col", "Status vs Usual")}</th>
                      <th className="py-2.5 px-3">{t("modal.temp_c", "Temp (°C)")}</th>
                      <th className="py-2.5 px-3">{t("modal.feed_kg", "Feed (kg)")}</th>
                      <th className="py-2.5 px-3">{t("modal.condition", "Condition")}</th>
                      <th className="py-2.5 px-3">{t("modal.source_col", "Source")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 font-medium text-slate-700 dark:text-slate-300">
                    {displayedProductionObs.map((obs) => {
                      // Calculate baseline strictly prior to this observation date
                      const priorObs = sortedObservations.filter(
                        (o) => o.observation_date < obs.observation_date
                      );
                      const bResult = calculateHistoricalBaseline(priorObs);
                      const hasBaseline = bResult.status !== "insufficient" && bResult.baseline != null;
                      const yld = obs.milk_produced_liters != null ? Number(obs.milk_produced_liters) : null;

                      let rowDiff: number | null = null;
                      let rowPct: number | null = null;
                      if (hasBaseline && yld != null && bResult.baseline != null) {
                        rowDiff = Number((yld - bResult.baseline).toFixed(1));
                        rowPct = Number(((rowDiff / bResult.baseline) * 100).toFixed(0));
                      }

                      return (
                        <tr key={obs.id} className="hover:bg-slate-50/70 dark:hover:bg-[#1C1E23] transition-colors">
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            {formatDate(obs.observation_date)}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-[#F4F4F5]">
                            {yld != null ? `${yld.toFixed(1)} L` : "—"}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                            {hasBaseline && bResult.baseline != null ? (
                               `${bResult.baseline.toFixed(1)} L`
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">
                                {t("modal.building_baseline", "Building baseline")}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            {hasBaseline && rowDiff != null && rowPct != null ? (
                              rowDiff <= -1.5 && rowPct <= -20 ? (
                                <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                                  {t("modal.table_drop", "Drop ({diff} L, {pct}%)", { diff: rowDiff, pct: rowPct })}
                                </span>
                              ) : rowPct >= 25 ? (
                                <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                                  {t("modal.table_above", "Above (+{diff} L)", { diff: rowDiff })}
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                  {rowDiff !== 0
                                    ? t("modal.table_normal_diff", "Normal ({diff} L)", { diff: `${rowDiff > 0 ? "+" : ""}${rowDiff}` })
                                    : t("modal.table_normal", "Normal")}
                                </span>
                              )
                            ) : (
                              <span className="text-slate-400 text-[11px]">
                                {t("modal.not_enough_records", "Not enough records yet")}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            {obs.body_temperature_c != null ? `${obs.body_temperature_c.toFixed(1)} °C` : "—"}
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            {obs.feed_quantity_kg != null ? `${obs.feed_quantity_kg.toFixed(1)} kg` : "—"}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                obs.health_condition === "critical"
                                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                  : obs.health_condition === "warning" || obs.health_condition === "sick"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                  : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              }`}
                            >
                              {obs.health_condition ? t(`health_cond.${obs.health_condition.toLowerCase()}`, obs.health_condition) : t("status.normal", "normal")}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                              {t("modal.actual_log_badge", "Actual Log")}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Inspect Older History Toggle Button */}
            {sortedObservations.length > 7 && productionRange === "7d" && (
              <div className="pt-2 text-center border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowOlderHistory((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  {showOlderHistory ? (
                    <>
                      <ChevronUp className="h-4 w-4" />
                      {t("modal.show_less_history", "Show latest only (7 days)")}
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      {t("modal.inspect_older_history", "Inspect older history")} ({sortedObservations.length} {t("modal.logs_available", "total daily logs")})
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* SECTION E: TAILORED MANAGEMENT RECOMMENDATIONS */}
          <div className="rounded-2xl border border-sky-200 bg-sky-50/70 dark:border-sky-900/40 dark:bg-sky-950/20 p-5">
            <div className="text-xs font-bold uppercase tracking-wider text-sky-900 dark:text-sky-400 mb-2.5">
              {t("modal.recommendations", "Tailored Management Recommendations")}
            </div>
            <ul className="space-y-2 text-xs font-medium text-sky-950 dark:text-sky-200">
              {riskCase.recommendations.map((action, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-sky-600 dark:text-sky-400 font-bold">•</span>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* SECTION F: TECHNICAL ENGINE DETAILS (COLLAPSED ACCORDION) */}
          <details className="group rounded-2xl border border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-[#16171B] overflow-hidden">
            <summary className="flex cursor-pointer items-center justify-between p-4 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-800/40 transition-colors select-none">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-slate-500" />
                <span>{t("modal.technical_summary", "View Raw Diagnostic & Model Signals")}</span>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400 transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <div className="p-4 pt-1 border-t border-slate-200 dark:border-slate-800 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="p-2.5 rounded-lg bg-white dark:bg-[#1B1D22] border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-400 block">{t("modal.anomaly_score", "Anomaly Score")}</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {riskCase.score != null ? riskCase.score.toFixed(3) : "—"}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-[#1B1D22] border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-400 block">{t("modal.engine_algorithm", "Engine Algorithm")}</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {t("modal.algorithm_name", "Isolation Forest + Baseline Rolling Median")}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-[#1B1D22] border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-400 block">{t("modal.active_alerts", "Active Alerts")}</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {t("modal.alerts_count", "{count} alerts", { count: riskCase.health_alerts.length })}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-[#1B1D22] border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-400 block">{t("modal.active_anomalies", "Active Anomalies")}</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {t("modal.anomalies_count", "{count} anomaly records", { count: riskCase.anomalies.length })}
                  </span>
                </div>
              </div>

              {riskCase.signals.length > 0 ? (
                <div className="space-y-1.5 pt-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400">
                    {t("modal.underlying_signals", "Underlying Diagnostic Signals")}:
                  </span>
                  {riskCase.signals.map((sig) => (
                    <div
                      key={sig.id}
                      className="p-2 rounded bg-white dark:bg-[#1B1D22] text-[11px] text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-800/80"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{sig.concern}</span>
                        <span className="font-mono text-[10px] text-slate-400">{formatDate(sig.date)}</span>
                      </div>
                      {sig.raw_description ? (
                        <p className="mt-1 text-[10px] text-slate-500 font-sans">{sig.raw_description}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </details>

          {/* SECTION G.1: Cross-Feature Navigation Shortcuts */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-[#16171B] p-5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-400 mb-3">
              {t("modal.explore_related", "Explore Related Intelligence")}
            </h4>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Link
                to={`/cows/${cowId}`}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#1B1D22] p-3 text-xs font-bold text-slate-800 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all"
              >
                <span>{t("modal.view_cow_profile", "Cow Profile")}</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>

              <Link
                to="/predictions"
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#1B1D22] p-3 text-xs font-bold text-slate-800 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all"
              >
                <span>{t("modal.view_predictions", "Predictions")}</span>
                <Gauge className="h-3.5 w-3.5" />
              </Link>

              <Link
                to="/explainability"
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#1B1D22] p-3 text-xs font-bold text-slate-800 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all"
              >
                <span>{t("modal.view_explainability", "Why Prediction")}</span>
                <Sparkles className="h-3.5 w-3.5" />
              </Link>

              <Link
                to={`/digital-twin?cowId=${cowId}`}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#1B1D22] p-3 text-xs font-bold text-slate-800 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all"
              >
                <span>{t("modal.view_digital_twin", "Digital Twin")}</span>
                <Layers className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* SECTION G.2: Modal Footer & Case Resolution Workflow */}
        <div className="border-t border-slate-200 dark:border-slate-800 px-6 py-4 bg-slate-50/80 dark:bg-[#17191D] shrink-0">
          {showConfirmResolve ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between animate-in fade-in duration-150">
              <div className="text-xs">
                <span className="font-bold text-slate-900 dark:text-[#F4F4F5] block">
                  {t("modal.resolve_confirm", "Confirm Case Resolution?")}
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  {t("modal.resolve_desc", "This marks active alerts and anomalies for this cow as resolved.")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmResolve(false)}
                  className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  {t("common.cancel", "Cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmResolve}
                  disabled={isResolving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{isResolving ? t("modal.resolving", "Resolving...") : t("modal.confirm_resolve", "Confirm Resolution")}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">
                {t("modal.decision_support", "DairyVision AI Clinical Decision Support")}
              </span>

              <div className="flex items-center gap-3">
                {!isResolved && (alertIds.length > 0 || anomalyIds.length > 0) ? (
                  <button
                    type="button"
                    onClick={() => setShowConfirmResolve(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition-colors cursor-pointer shadow-xs"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>{t("modal.resolve_case", "Resolve Cow Case")}</span>
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/80 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  {t("common.close", "Close")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UnifiedRiskDetailModal;
