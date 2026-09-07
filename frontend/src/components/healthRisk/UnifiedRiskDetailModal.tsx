import React from "react";
import { Link } from "react-router-dom";
import {
  X,
  Sparkles,
  Gauge,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  AlertTriangle,
  Info,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import { UnifiedRiskCase, RiskSource, SeverityLevel } from "@/services/riskCorrelation";

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
  if (!riskCase) return null;

  const cowId = riskCase.cow_id;
  const cowName = riskCase.cow_name;
  const tagId = riskCase.tag_id;
  const breed = riskCase.breed;
  const severity = riskCase.highest_severity;
  const isCritical = severity === "Critical";
  const isWarning = severity === "Warning";
  const isResolved = riskCase.is_resolved;

  const alertIds = riskCase.health_alerts.filter((a) => !a.resolved).map((a) => a.id);
  const anomalyIds = riskCase.anomalies.filter((a) => !a.resolved).map((a) => a.id);

  // Recommended actions
  const actionList: string[] = [];
  for (const h of riskCase.health_alerts) {
    if (h.recommended_actions) {
      actionList.push(...h.recommended_actions);
    }
  }
  if (actionList.length === 0) {
    actionList.push(
      "Perform physical observation during next milking cycle",
      "Check body temperature and hydration levels",
      "Verify daily feed dry matter intake and ration quality"
    );
  }
  const uniqueActions = Array.from(new Set(actionList));

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

  function renderSourceBadge(src: RiskSource) {
    switch (src) {
      case "AI Anomaly":
        return (
          <span
            key={src}
            className="inline-flex items-center gap-1 rounded-md border border-purple-200 bg-purple-50 dark:border-purple-500/30 dark:bg-purple-950/40 px-2 py-0.5 text-[11px] font-semibold text-purple-700 dark:text-purple-300"
          >
            🤖 AI Anomaly
          </span>
        );
      case "Health Alert":
        return (
          <span
            key={src}
            className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 dark:border-sky-500/30 dark:bg-sky-950/40 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:text-sky-300"
          >
            🩺 Health Alert
          </span>
        );
      case "Environmental":
        return (
          <span
            key={src}
            className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-950/40 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300"
          >
            🌤️ Environmental
          </span>
        );
    }
  }

  function renderSeverityBadge(sev: SeverityLevel) {
    switch (sev) {
      case "Critical":
        return (
          <span className="inline-flex items-center rounded-full border border-rose-300 bg-rose-100 dark:border-rose-500/40 dark:bg-rose-950/70 px-2.5 py-0.5 text-xs font-bold text-rose-800 dark:text-rose-300">
            Critical
          </span>
        );
      case "Warning":
        return (
          <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-100 dark:border-amber-500/40 dark:bg-amber-950/70 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:text-amber-300">
            Warning
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-950/50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
            Normal
          </span>
        );
    }
  }

  function handleResolveAll() {
    onResolve({ alertIds, anomalyIds });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#121316] shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-5 bg-slate-50/70 dark:bg-[#17191D]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🐄</span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-[#F4F4F5]">
                {cowName}
              </h3>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Tag: {tagId}
              </span>
              {breed ? (
                <span className="rounded-md bg-slate-200 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                  {breed}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Aggregated Risk Case & Full Underlying Signal History
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-[#F4F4F5] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="max-h-[75vh] overflow-y-auto p-6 space-y-6">
          {/* SECTION 1: Current Risk Status Banner */}
          <div
            className={`rounded-2xl border p-4 flex items-center justify-between ${
              isCritical
                ? "border-rose-200 bg-rose-50/80 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
                : isWarning
                ? "border-amber-200 bg-amber-50/80 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300"
                : "border-emerald-200 bg-emerald-50/80 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
            }`}
          >
            <div className="flex items-center gap-3">
              {isCritical ? (
                <AlertTriangle className="h-6 w-6 text-rose-600 dark:text-rose-400 shrink-0" />
              ) : isWarning ? (
                <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400 shrink-0" />
              ) : (
                <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
              )}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider">
                  Current Risk Level: {severity}
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-[#F4F4F5] mt-0.5">
                  {isResolved ? "Resolved — Health Status Verified Normal" : "Active Case Requiring Farmer Attention"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  isResolved
                    ? "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    : isCritical
                    ? "bg-rose-200 text-rose-900 border border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-600/50"
                    : "bg-amber-200 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-600/50"
                }`}
              >
                {isResolved ? "Resolved" : "Active Case"}
              </span>
            </div>
          </div>

          {/* SECTION 2: WHY? Combined Reasons & Sources */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-[#16171B] p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-300">
                <Info className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Why is this cow flagged?</span>
              </div>
              <div className="flex items-center gap-1">
                {riskCase.sources.map((s) => renderSourceBadge(s))}
              </div>
            </div>

            <div className="space-y-2">
              {riskCase.reasons.map((reason, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm font-medium text-slate-800 dark:text-[#F4F4F5] leading-relaxed">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 shrink-0" />
                  <span>{reason}</span>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 3: UNDERLYING SIGNALS LOG (CHRONOLOGICAL) */}
          <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#16171B] p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-300">
                Recent Signals Log ({riskCase.signals.length})
              </h4>
              <span className="text-[11px] text-slate-500 font-medium">
                Detailed engine evidence & records
              </span>
            </div>

            {riskCase.signals.length === 0 ? (
              <p className="text-xs text-slate-500">No raw signal records found.</p>
            ) : (
              <div className="space-y-2.5">
                {riskCase.signals.map((sig) => (
                  <div
                    key={sig.id}
                    className="rounded-xl border border-slate-100 bg-slate-50 dark:border-slate-800/80 dark:bg-[#1B1D22] p-3 text-xs"
                  >
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span className="font-bold text-slate-800 dark:text-[#F4F4F5]">{sig.concern}</span>
                        {renderSourceBadge(sig.source)}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 dark:text-slate-400 font-mono">{formatDate(sig.date)}</span>
                        {renderSeverityBadge(sig.severity)}
                      </div>
                    </div>

                    {sig.raw_description ? (
                      <p className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                        {sig.raw_description}
                      </p>
                    ) : null}

                    {sig.metrics && Object.keys(sig.metrics).length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                        {Object.entries(sig.metrics).map(([k, v]) => (
                          <span key={k} className="rounded bg-white dark:bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {k}: {String(v)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 4: Recommended Actions */}
          <div className="rounded-2xl border border-sky-200 bg-sky-50/70 dark:border-sky-900/40 dark:bg-sky-950/20 p-5">
            <div className="text-xs font-bold uppercase tracking-wider text-sky-900 dark:text-sky-400 mb-2.5">
              Recommended Management Actions
            </div>
            <ul className="space-y-2 text-xs font-medium text-sky-950 dark:text-sky-200">
              {uniqueActions.map((action, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-sky-600 dark:text-sky-400 font-bold">•</span>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* SECTION 5: Cross-Feature Navigation Shortcuts */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-[#16171B] p-5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-400 mb-3">
              Explore Related Intelligence
            </h4>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Link
                to={`/cows/${cowId}`}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#1B1D22] p-3 text-xs font-bold text-slate-800 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all"
              >
                <span>Cow Profile</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>

              <Link
                to="/predictions"
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#1B1D22] p-3 text-xs font-bold text-slate-800 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all"
              >
                <span>Predictions</span>
                <Gauge className="h-3.5 w-3.5" />
              </Link>

              <Link
                to="/explainability"
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#1B1D22] p-3 text-xs font-bold text-slate-800 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all"
              >
                <span>Why Prediction</span>
                <Sparkles className="h-3.5 w-3.5" />
              </Link>

              <Link
                to={`/digital-twin?cowId=${cowId}`}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#1B1D22] p-3 text-xs font-bold text-slate-800 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all"
              >
                <span>Digital Twin</span>
                <Layers className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 px-6 py-4 bg-slate-50/70 dark:bg-[#17191D]">
          <span className="text-xs font-medium text-slate-500">
            Powered by DairyVision AI Decision Support
          </span>

          <div className="flex items-center gap-3">
            {!isResolved ? (
              <button
                type="button"
                onClick={handleResolveAll}
                disabled={isResolving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Resolve Cow Case</span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/80 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnifiedRiskDetailModal;
