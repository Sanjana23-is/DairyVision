import { Recommendation } from "@/services/recommendation";
import { useLanguage } from "@/context/LanguageContext";
import { getSeverityLabel } from "@/lib/i18n-helpers";

export default function RecommendationsTable({
  data,
  cowNameById = {},
  onOpenDetails,
  onRequestComplete,
  onRequestDelete,
}: {
  data: Recommendation[];
  cowNameById?: Record<string, string>;
  onOpenDetails: (recommendation: Recommendation) => void;
  onRequestComplete: (recommendation: Recommendation) => void;
  onRequestDelete: (recommendation: Recommendation) => void;
}) {
  const { t } = useLanguage();

  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] p-8 text-center text-slate-600 dark:text-[#A1A1AA]">
        <p className="text-base font-medium">🌱 {t("recommendations.no_recommendations_found", "No recommendations found.")}</p>
        <p className="mt-1 text-xs text-slate-400 dark:text-[#A1A1AA]/70">
          {t("recommendations.no_recommendations_desc", "No advisory actions currently match your selected filters.")}
        </p>
      </div>
    );
  }

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
      });
    } catch {
      return String(isoString);
    }
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] shadow-sm">
      <table className="w-full table-auto">
        <thead className="bg-slate-50 dark:bg-[#1B1D20] text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#A1A1AA]">
          <tr>
            <th className="px-4 py-3.5">{t("recommendations.action_title", "Action Title")}</th>
            <th className="px-4 py-3.5">{t("recommendations.category", "Category")}</th>
            <th className="px-4 py-3.5">{t("recommendations.priority", "Priority")}</th>
            <th className="px-4 py-3.5">{t("recommendations.subject_cow", "Subject Cow")}</th>
            <th className="px-4 py-3.5">{t("recommendations.created_date", "Created Date")}</th>
            <th className="px-4 py-3.5">{t("common.status", "Status")}</th>
            <th className="px-4 py-3.5">{t("common.actions", "Actions")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-[#27272A] text-sm text-slate-700 dark:text-[#A1A1AA]">
          {data.map((rec) => {
            const isHigh = rec.priority === "High" || rec.priority === "Critical";
            const isMed = rec.priority === "Medium";
            const categoryText = rec.category || "General Farm Management";
            return (
              <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-[#1B1D20]/50">
                <td className="px-4 py-4 font-semibold text-slate-900 dark:text-[#F4F4F5]">
                  {rec.title || t("recommendations.title", "Advisory Action")}
                </td>
                <td className="px-4 py-4">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-[#1B1D20] px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-[#A1A1AA]">
                    <span>{getCategoryIcon(categoryText)}</span>
                    <span>{categoryText}</span>
                  </span>
                </td>
                <td className="px-4 py-4">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      isHigh
                        ? "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300"
                        : isMed
                        ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                        : "bg-slate-100 dark:bg-[#1B1D20] text-slate-700 dark:text-[#A1A1AA]"
                    }`}
                  >
                    {getSeverityLabel(rec.priority || "Medium", t)}
                  </span>
                </td>
                <td className="px-4 py-4 font-medium text-slate-800 dark:text-[#F4F4F5]">
                  🐄 {getCowDisplayName(rec)}
                </td>
                <td className="px-4 py-4 text-slate-500 dark:text-[#A1A1AA]">
                  {formatDate(rec.created_at)}
                </td>
                <td className="px-4 py-4">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      rec.completed
                        ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                        : "bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300"
                    }`}
                  >
                    {rec.completed ? t("recommendations.status_applied", "Completed") : t("recommendations.action_required", "Action Required")}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenDetails(rec)}
                      className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-3 py-1 text-xs text-slate-700 dark:text-[#F4F4F5] hover:bg-slate-50 dark:hover:bg-[#151719]"
                    >
                      {t("common.details", "Details")}
                    </button>
                    {!rec.completed ? (
                      <button
                        type="button"
                        onClick={() => onRequestComplete(rec)}
                        className="rounded-2xl border border-emerald-600 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                      >
                        {t("recommendations.mark_completed", "Mark Completed")}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onRequestDelete(rec)}
                      className="rounded-2xl border border-rose-200 dark:border-rose-900/50 px-3 py-1 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      {t("common.delete", "Delete")}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
