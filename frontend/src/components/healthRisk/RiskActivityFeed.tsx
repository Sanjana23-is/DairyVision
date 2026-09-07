import React, { useMemo, useState } from "react";
import { Search, Eye, MoreHorizontal } from "lucide-react";
import { UnifiedRiskCase, RiskSource, SeverityLevel } from "@/services/riskCorrelation";
import { useLanguage } from "@/context/LanguageContext";
import { getSeverityLabel } from "@/lib/i18n-helpers";

interface RiskActivityFeedProps {
  cases: UnifiedRiskCase[];
  onSelectCase: (riskCase: UnifiedRiskCase) => void;
  onOpenMore: (riskCase: UnifiedRiskCase) => void;
  onResolveCase: (riskCase: UnifiedRiskCase) => void;
  isResolving?: boolean;
}

type FeedTab = "all" | "health_alerts" | "anomalies" | "resolved";

export const RiskActivityFeed: React.FC<RiskActivityFeedProps> = ({
  cases,
  onSelectCase,
  onOpenMore,
  onResolveCase,
  isResolving,
}) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<FeedTab>("all");
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      // Tab filter
      if (activeTab === "health_alerts" && !c.sources.includes("Health Alert")) {
        return false;
      }
      if (activeTab === "anomalies" && !c.sources.includes("AI Anomaly")) {
        return false;
      }
      if (activeTab === "resolved" && !c.is_resolved) {
        return false;
      }

      // Severity filter
      if (severityFilter !== "All" && c.highest_severity !== severityFilter) {
        return false;
      }

      // Status filter
      if (activeTab !== "resolved" && statusFilter !== "all") {
        if (statusFilter === "active" && c.is_resolved) return false;
        if (statusFilter === "resolved" && !c.is_resolved) return false;
      }

      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = c.cow_name.toLowerCase().includes(q);
        const matchTag = c.tag_id.toLowerCase().includes(q);
        const matchConcern = c.primary_concern.toLowerCase().includes(q);
        const matchReason = c.reasons.some((r) => r.toLowerCase().includes(q));
        if (!matchName && !matchTag && !matchConcern && !matchReason) return false;
      }

      return true;
    });
  }, [cases, activeTab, search, severityFilter, statusFilter]);

  function formatDate(iso: string) {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  }

  function renderSourceBadges(sources: RiskSource[]) {
    return (
      <div className="flex flex-wrap gap-1">
        {sources.map((src) => {
          switch (src) {
            case "AI Anomaly":
              return (
                <span
                  key={src}
                  className="inline-flex items-center gap-1 rounded-md border border-purple-200 bg-purple-50 dark:border-purple-500/30 dark:bg-purple-950/40 px-2 py-0.5 text-[11px] font-semibold text-purple-700 dark:text-purple-300"
                >
                  🤖 {t("risk.ai_anomaly", "AI Anomaly")}
                </span>
              );
            case "Health Alert":
              return (
                <span
                  key={src}
                  className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 dark:border-sky-500/30 dark:bg-sky-950/40 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:text-sky-300"
                >
                  🩺 {t("risk.health_alert", "Health Alert")}
                </span>
              );
            case "Environmental":
              return (
                <span
                  key={src}
                  className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-950/40 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300"
                >
                  🌤️ {t("risk.environmental", "Environmental")}
                </span>
              );
          }
        })}
      </div>
    );
  }

  function renderSeverityBadge(sev: SeverityLevel) {
    const label = getSeverityLabel(sev, t);
    switch (sev) {
      case "Critical":
        return (
          <span className="inline-flex items-center rounded-full border border-rose-300 bg-rose-100 dark:border-rose-500/40 dark:bg-rose-950/70 px-2.5 py-0.5 text-xs font-bold text-rose-800 dark:text-rose-300">
            {label}
          </span>
        );
      case "Warning":
        return (
          <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-100 dark:border-amber-500/40 dark:bg-amber-950/70 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:text-amber-300">
            {label}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-950/50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
            {label}
          </span>
        );
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#121316] p-5 shadow-xs">
      {/* Header & Feed Tabs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-[#F4F4F5]">
            {t("risk.activity_feed", "Herd Risk Activity Feed")}
          </h3>
          <p className="text-xs text-slate-500 dark:text-[#A1A1AA]">
            {t("risk.activity_subtitle", "Unified cow-level risk tracking (1 row per cow).")}
          </p>
        </div>

        {/* Primary Tabs */}
        <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 dark:bg-[#1A1C20] p-1 border border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              activeTab === "all"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-[#F4F4F5]"
            }`}
          >
            {t("risk.all_cows", "All Cows")} ({cases.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("health_alerts")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              activeTab === "health_alerts"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-[#F4F4F5]"
            }`}
          >
            {t("risk.health_alerts", "Health Alerts")} ({cases.filter((c) => c.sources.includes("Health Alert")).length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("anomalies")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              activeTab === "anomalies"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-[#F4F4F5]"
            }`}
          >
            {t("risk.ai_anomalies", "AI Anomalies")} ({cases.filter((c) => c.sources.includes("AI Anomaly")).length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("resolved")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              activeTab === "resolved"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-[#F4F4F5]"
            }`}
          >
            {t("common.resolved", "Resolved")} ({cases.filter((c) => c.is_resolved).length})
          </button>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("risk.search_placeholder", "Search cow name, tag, or primary concern...")}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-[#181A1D] pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-[#F4F4F5] placeholder-slate-400 dark:placeholder-slate-500 focus:border-emerald-500 focus:outline-hidden"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-[#181A1D] px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 focus:border-emerald-500 focus:outline-hidden"
          >
            <option value="All">{t("common.severity_all", "Severity: All")}</option>
            <option value="Critical">{t("severity.critical", "Critical")}</option>
            <option value="Warning">{t("severity.warning", "Warning")}</option>
            <option value="Normal">{t("severity.normal", "Normal")}</option>
          </select>

          {activeTab !== "resolved" ? (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-[#181A1D] px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 focus:border-emerald-500 focus:outline-hidden"
            >
              <option value="all">{t("common.status_all", "Status: All")}</option>
              <option value="active">{t("common.active_only", "Active Only")}</option>
              <option value="resolved">{t("common.resolved", "Resolved")}</option>
            </select>
          ) : null}
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1012]">
        {filteredCases.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">
            <p className="text-sm font-semibold">{t("risk.no_cases_match", "No cow risk cases match the current filters.")}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{t("risk.try_resetting", "Try resetting search or filter criteria.")}</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-[#15171A] text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">{t("risk.last_signal", "Last Signal")}</th>
                <th className="px-4 py-3">{t("risk.cow_tag_id", "Cow / Tag ID")}</th>
                <th className="px-4 py-3">{t("risk.primary_concern", "Primary Concern")}</th>
                <th className="px-4 py-3">{t("risk.severity", "Severity")}</th>
                <th className="px-4 py-3">{t("risk.detected_by", "Detected By")}</th>
                <th className="px-4 py-3">{t("common.status", "Status")}</th>
                <th className="px-4 py-3 text-right">{t("common.actions", "Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {filteredCases.map((c) => {
                const isActive = !c.is_resolved;
                return (
                  <tr
                    key={c.cow_id}
                    className="hover:bg-slate-50/80 dark:hover:bg-[#181A1E] transition-colors"
                  >
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {formatDate(c.last_detected_date)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-bold text-slate-900 dark:text-[#F4F4F5]">{c.cow_name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{t("cows.tag", "Tag")}: {c.tag_id}</div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                      {c.primary_concern}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {renderSeverityBadge(c.highest_severity)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {renderSourceBadges(c.sources)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          isActive
                            ? "bg-sky-100 text-sky-800 border border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/40"
                            : "bg-slate-100 text-slate-600 border border-slate-300 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700/40"
                        }`}
                      >
                        {isActive ? t("common.active", "Active Case") : t("common.resolved", "Resolved")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSelectCase(c)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800/70 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                        >
                          <Eye className="h-3 w-3" />
                          <span>{t("common.view", "View")}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onOpenMore(c)}
                          title={t("common.more_details", "More details & signal log")}
                          className="rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800/70 p-1 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>

                        {isActive ? (
                          <button
                            type="button"
                            onClick={() => onResolveCase(c)}
                            disabled={isResolving}
                            className="rounded-lg border border-emerald-300 bg-emerald-50 dark:border-emerald-700/60 dark:bg-emerald-950/40 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            {t("risk.resolve", "Resolve")}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default RiskActivityFeed;
