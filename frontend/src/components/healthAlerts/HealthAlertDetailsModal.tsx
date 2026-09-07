import { HealthAlert } from "@/services/healthAlert";
import { useLanguage } from "@/context/LanguageContext";
import { getSeverityLabel } from "@/lib/i18n-helpers";

export default function HealthAlertDetailsModal({
  alert,
  cowNameById,
  open = true,
  onClose,
}: {
  alert: HealthAlert;
  cowNameById?: Record<string, string>;
  open?: boolean;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  if (!open) return null;

  function getRiskDisplayName(alertItem: HealthAlert): string {
    if (alertItem.risk_display_name && alertItem.risk_display_name !== "composite") {
      return alertItem.risk_display_name;
    }
    const desc = (alertItem.description || "").toLowerCase();
    const atype = (alertItem.alert_type || "").toLowerCase();

    if (atype.includes("heat") || desc.includes("heat")) return t("risk.heat_stress", "Heat Stress");
    if (atype.includes("temp") || atype.includes("fever") || desc.includes("fever") || desc.includes("temperature")) return t("risk.high_temperature", "High Temperature");
    if (atype.includes("milk") || desc.includes("milk")) return t("risk.milk_drop", "Milk Production Drop");
    return t("obs.health_condition", "Health Condition");
  }

  function getCategoryIcon(riskName: string): string {
    if (riskName.includes("Heat")) return "🚰";
    if (riskName.includes("Temp") || riskName.includes("Fever")) return "🤒";
    if (riskName.includes("Milk")) return "📉";
    return "🩺";
  }

  function formatDate(isoString: string): string {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return isoString;
    }
  }

  const riskTitle = getRiskDisplayName(alert);
  const isCritical = alert.alert_level === "Critical";

  // Strict cow name resolution (Name -> Tag ID -> Map Lookup -> "Unknown cow"). Never UUID!
  const cowDisplayName =
    (alert.cow_name && !alert.cow_name.startsWith("Cow "))
      ? alert.cow_name
      : (alert.cow?.name || (cowNameById && alert.cow_id ? cowNameById[alert.cow_id] : null) || t("common.unknown_cow", "Unknown cow"));

  // Fallback why explanation if not supplied directly by backend response
  let rawWhyText = alert.why_explanation || (
    alert.description && !alert.description.includes("heat_score=")
      ? alert.description
      : `${cowDisplayName} ${t("risk.flagged_because", "was flagged because recent observations indicate elevated risk.")}`
  );

  // Replace any legacy raw UUID references inside text with the farmer-friendly cow display name
  let whyExplanationText = rawWhyText.replace(/Cow\s+[a-f0-9-]{8,}/gi, cowDisplayName);

  // Evidence dictionary items
  const evidenceEntries = alert.evidence ? Object.entries(alert.evidence) : [];

  // Recommended actions
  const actionList = alert.recommended_actions || [
    t("risk.action_observe", "Monitor cow closely during daily observations"),
    t("risk.action_water", "Ensure unhindered access to fresh water and feed"),
    t("risk.action_vet", "Contact a veterinarian if symptoms or stress persist"),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white dark:bg-[#151719] border border-slate-200 dark:border-[#27272A] shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#27272A] px-6 py-5 bg-slate-50/50 dark:bg-[#1B1D20]/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">{getCategoryIcon(riskTitle)}</span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-[#F4F4F5]">
                {riskTitle}
              </h3>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  isCritical
                    ? "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300"
                    : "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                }`}
              >
                {getSeverityLabel(alert.alert_level, t)}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-[#A1A1AA]">
              {t("risk.farmer_summary_title", "Farmer-Facing Health Risk & Evidence Summary")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 dark:text-[#A1A1AA] hover:bg-slate-100 dark:hover:bg-[#1B1D20] hover:text-slate-700 dark:hover:text-[#F4F4F5] cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="space-y-5 p-6 max-h-[80vh] overflow-y-auto">
          {/* SECTION 1: Why is this cow flagged? */}
          <div
            className={`rounded-2xl border p-5 shadow-sm ${
              isCritical
                ? "border-rose-100 dark:border-rose-900/50 bg-rose-50/60 dark:bg-rose-950/30 text-rose-950 dark:text-rose-200"
                : "border-amber-100 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/30 text-amber-950 dark:text-amber-200"
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300">
              <span>💡</span>
              <span>{t("risk.why_flagged", "Why is this cow flagged?")}</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed font-medium">
              "{whyExplanationText}"
            </p>
          </div>

          {/* SECTION 2: Recent Evidence (Only existing metrics) */}
          {evidenceEntries.length > 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-slate-50/60 dark:bg-[#1B1D20]/50 p-5">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-[#F4F4F5] mb-3">
                <span>📊</span>
                <span>{t("risk.recent_evidence", "Recent Evidence")}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {evidenceEntries.map(([key, val]) => (
                  <div key={key} className="rounded-xl border border-slate-100 dark:border-[#27272A] bg-white dark:bg-[#151719] p-3 shadow-2xs">
                    <div className="text-xs font-medium text-slate-500 dark:text-[#A1A1AA]">{key}</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-[#F4F4F5]">
                      {String(val)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* SECTION 3: Recommended Actions */}
          <div className="rounded-2xl border border-sky-100 dark:border-sky-900/50 bg-sky-50/50 dark:bg-sky-950/30 p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-sky-900 dark:text-sky-300 mb-2">
              <span>📋</span>
              <span>{t("risk.recommended_actions", "Recommended Actions")}</span>
            </div>
            <ul className="space-y-1.5 list-disc list-inside text-sm text-sky-950 dark:text-sky-200 font-medium">
              {actionList.map((action, idx) => (
                <li key={idx} className="leading-relaxed">
                  {action}
                </li>
              ))}
            </ul>
          </div>

          {/* SECTION 4: Context Metadata Grid */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] p-4 shadow-sm">
              <div className="text-xs font-semibold text-slate-400 dark:text-[#A1A1AA] uppercase tracking-wider">
                {t("pred.subject_cow", "Subject Cow")}
              </div>
              <div className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-[#F4F4F5] flex items-center gap-1.5">
                <span>🐄</span>
                <span>{cowDisplayName}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] p-4 shadow-sm">
              <div className="text-xs font-semibold text-slate-400 dark:text-[#A1A1AA] uppercase tracking-wider">
                {t("pred.observation_date", "Observation Date")}
              </div>
              <div className="mt-1.5 text-sm font-semibold text-slate-800 dark:text-[#F4F4F5]">
                {alert.observation_date || formatDate(alert.created_at)}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] p-4 shadow-sm">
              <div className="text-xs font-semibold text-slate-400 dark:text-[#A1A1AA] uppercase tracking-wider">
                {t("risk.risk_status", "Risk Status")}
              </div>
              <div className="mt-1.5">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    alert.resolved
                      ? "bg-slate-100 dark:bg-[#151719] text-slate-700 dark:text-[#A1A1AA]"
                      : "bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300"
                  }`}
                >
                  {alert.resolved ? t("common.resolved", "Resolved") : t("risk.active_risk", "Active Risk")}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Close */}
          <div className="flex items-center justify-between border-t border-slate-100 dark:border-[#27272A] pt-4 text-xs text-slate-400 dark:text-[#A1A1AA]">
            <span>{t("risk.powered_by", "Evaluated & Generated by DairyVision AI")}</span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-4 py-2 text-xs font-semibold text-slate-700 dark:text-[#F4F4F5] hover:bg-slate-50 dark:hover:bg-[#151719] cursor-pointer"
            >
              {t("common.close", "Close")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
