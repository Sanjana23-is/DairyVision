import { Recommendation } from "@/services/recommendation";
import { useLanguage } from "@/context/LanguageContext";
import { getSeverityLabel } from "@/lib/i18n-helpers";

export default function RecommendationDetailsModal({
  recommendation,
  cowNameById = {},
  open = true,
  onClose,
}: {
  recommendation: Recommendation;
  cowNameById?: Record<string, string>;
  open?: boolean;
  onClose: () => void;
}) {
  const { t } = useLanguage();

  if (!open || !recommendation) return null;

  function getCowDisplayName(rec: Recommendation): string {
    if (rec.cow?.name) return rec.cow.name;
    if (rec.cow_id && cowNameById[rec.cow_id]) return cowNameById[rec.cow_id];
    if (rec.cow_id) return `${t("common.cow", "Cow")} ${rec.cow_id.slice(0, 8)}`;
    return t("recommendations.herd_general", "Herd / General");
  }

  function getCategoryIcon(cat?: string | null): string {
    if (!cat) return "💡";
    if (cat.includes("Water") || cat.includes("Heat")) return "🚰";
    if (cat.includes("Feed") || cat.includes("Nutrition")) return "🌾";
    if (cat.includes("Veterinary")) return "🩺";
    if (cat.includes("Observation")) return "👁️";
    return "💡";
  }

  function formatDate(isoString?: string | null): string {
    if (!isoString) return "—";
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return String(isoString);
      return d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return String(isoString);
    }
  }

  function getWhyExplanation(rec: Recommendation): string {
    if (rec.why_reason && rec.why_reason.trim()) {
      return rec.why_reason;
    }
    const cat = (rec.category || "").toLowerCase();
    const title = (rec.title || "").toLowerCase();
    const cowName = getCowDisplayName(rec);

    if (cat.includes("veterinary") || title.includes("veterinary")) {
      return `The cow (${cowName}) was recorded with an abnormal health condition or temperature elevation during recent monitoring. This may indicate an illness that should be diagnosed promptly.`;
    }
    if (cat.includes("heat")) {
      return `Recent weather & temperature monitoring indicates elevated heat stress risk. Heat stress can lower feed intake, reduce milk yield, and impact herd health.`;
    }
    if (cat.includes("feed") || cat.includes("nutrition")) {
      return `Milk production or feed intake measurements for ${cowName} deviated from expected baselines. Adjusting diet composition helps support yield recovery.`;
    }
    return `Automated farm monitoring identified operational or environmental metrics requiring advisory attention for ${cowName}.`;
  }

  const priorityVal = recommendation.priority || "Medium";
  const categoryText = recommendation.category || "General Farm Management";
  const titleText = recommendation.title || t("recommendations.title", "Advisory Action");
  const isHigh = priorityVal === "High" || priorityVal === "Critical";
  const isMed = priorityVal === "Medium";
  const cowDisplayName = getCowDisplayName(recommendation);
  const whyText = getWhyExplanation(recommendation);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white dark:bg-[#151719] border border-slate-200 dark:border-[#27272A] shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#27272A] px-6 py-5 bg-slate-50/50 dark:bg-[#1B1D20]/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">{getCategoryIcon(categoryText)}</span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-[#F4F4F5]">
                {titleText}
              </h3>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-[#A1A1AA]">
              {t("recommendations.context_breakdown", "Advisory Details & Contextual Signal Breakdown")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 dark:text-[#A1A1AA] hover:bg-slate-100 dark:hover:bg-[#1B1D20] hover:text-slate-700 dark:hover:text-[#F4F4F5]"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="space-y-5 p-6">
          {/* SECTION 1: Why this recommendation? */}
          <div className="rounded-2xl border border-sky-100 dark:border-sky-900/50 bg-sky-50/60 dark:bg-sky-950/30 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold text-sky-900 dark:text-sky-300">
              <span>💡</span>
              <span>{t("recommendations.why_this", "Why this recommendation?")}</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-sky-950 dark:text-sky-200 font-medium">
              {whyText}
            </p>
          </div>

          {/* SECTION 2: Recommended Action */}
          <div className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-slate-50/60 dark:bg-[#1B1D20]/50 p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-[#F4F4F5]">
              <span>📋</span>
              <span>{t("recommendations.recommended_action", "Recommended Action")}</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-[#A1A1AA] whitespace-pre-wrap font-medium">
              {recommendation.description || t("common.no_data", "No specific action text provided.")}
            </p>
          </div>

          {/* SECTION 3: Context Metrics Grid */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] p-4 shadow-sm">
              <div className="text-xs font-semibold text-slate-400 dark:text-[#A1A1AA] uppercase tracking-wider">
                {t("recommendations.subject_cow", "Subject Cow")}
              </div>
              <div className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-[#F4F4F5] flex items-center gap-1.5">
                <span>🐄</span>
                <span>{cowDisplayName}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] p-4 shadow-sm">
              <div className="text-xs font-semibold text-slate-400 dark:text-[#A1A1AA] uppercase tracking-wider">
                {t("recommendations.category", "Category")}
              </div>
              <div className="mt-1.5 text-sm font-semibold text-slate-800 dark:text-[#F4F4F5] flex items-center gap-1.5">
                <span>{getCategoryIcon(categoryText)}</span>
                <span>{categoryText}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] p-4 shadow-sm">
              <div className="text-xs font-semibold text-slate-400 dark:text-[#A1A1AA] uppercase tracking-wider">
                {t("recommendations.priority", "Priority Level")}
              </div>
              <div className="mt-1.5">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
                    isHigh
                      ? "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300"
                      : isMed
                      ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                      : "bg-slate-100 dark:bg-[#151719] text-slate-700 dark:text-[#A1A1AA]"
                  }`}
                >
                  {getSeverityLabel(priorityVal, t)}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] p-4 shadow-sm">
              <div className="text-xs font-semibold text-slate-400 dark:text-[#A1A1AA] uppercase tracking-wider">
                {t("common.status", "Status")}
              </div>
              <div className="mt-1.5">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
                    recommendation.completed
                      ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                      : "bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300"
                  }`}
                >
                  {recommendation.completed ? t("recommendations.status_applied", "Completed") : t("recommendations.action_required", "Action Required")}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Date */}
          <div className="flex items-center justify-between border-t border-slate-100 dark:border-[#27272A] pt-4 text-xs text-slate-400 dark:text-[#A1A1AA]">
            <span>{t("recommendations.evaluated_generated", "Evaluated & Generated")}: {formatDate(recommendation.created_at)}</span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-4 py-2 text-xs font-semibold text-slate-700 dark:text-[#F4F4F5] hover:bg-slate-50 dark:hover:bg-[#151719]"
            >
              {t("common.close", "Close")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
