import {
  GroupedCowRecommendation,
  getCategoryIcon,
  getCategoryTranslationKey,
  translateRecommendationTitle,
} from "@/services/recommendation";
import { useLanguage } from "@/context/LanguageContext";

export default function RecommendationsTable({
  data,
  onOpenDetails,
  onRequestCompleteCow,
  onRequestDeleteCow,
}: {
  data: GroupedCowRecommendation[];
  onOpenDetails: (group: GroupedCowRecommendation) => void;
  onRequestCompleteCow: (group: GroupedCowRecommendation) => void;
  onRequestDeleteCow?: (group: GroupedCowRecommendation) => void;
}) {
  const { t } = useLanguage();

  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] p-8 text-center text-slate-600 dark:text-[#A1A1AA]">
        <p className="text-base font-semibold">
          🌱 {t("rec.empty.title", "No recommendations found.")}
        </p>
        <p className="mt-1 text-xs text-slate-400 dark:text-[#A1A1AA]/70">
          {t("rec.empty.subtitle", "No advisory actions currently match your selected filters.")}
        </p>
      </div>
    );
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

  function getPriorityBadge(priority: string) {
    const isCritical = priority === "Critical";
    const isHigh = priority === "High";
    const isMed = priority === "Medium";

    const label =
      isCritical
        ? t("rec.priority.critical", "Critical Priority")
        : isHigh
        ? t("rec.priority.high", "High Priority")
        : isMed
        ? t("rec.priority.medium", "Medium Priority")
        : t("rec.priority.low", "Low Priority");

    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
          isCritical || isHigh
            ? "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40"
            : isMed
            ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40"
            : "bg-slate-100 dark:bg-[#1B1D20] text-slate-700 dark:text-[#A1A1AA] border border-slate-200 dark:border-[#27272A]"
        }`}
      >
        {label}
      </span>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] shadow-sm">
      <table className="w-full table-auto text-left">
        <thead className="bg-slate-50 dark:bg-[#1B1D20] text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#A1A1AA] border-b border-slate-200 dark:border-[#27272A]">
          <tr>
            <th className="px-4 py-3.5 whitespace-nowrap">{t("rec.col.cow", "Subject Cow")}</th>
            <th className="px-4 py-3.5 min-w-[280px]">
              {t("rec.col.action", "Consolidated Action & Categories")}
            </th>
            <th className="px-4 py-3.5 whitespace-nowrap">{t("rec.col.priority", "Priority")}</th>
            <th className="px-4 py-3.5 whitespace-nowrap">
              {t("rec.col.updated", "Latest Update")}
            </th>
            <th className="px-4 py-3.5 whitespace-nowrap">{t("rec.col.status", "Status")}</th>
            <th className="px-4 py-3.5 text-right whitespace-nowrap">
              {t("rec.col.actions", "Actions")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-[#27272A] text-sm text-slate-700 dark:text-[#A1A1AA]">
          {data.map((group) => {
            const rowKey = group.cow_id || "general";
            // Filter out any raw "General" label just in case, ensuring only relevant categories are displayed
            const relevantCategories = group.categories.filter(
              (cat) => cat.toLowerCase() !== "general" && cat.toLowerCase() !== "general farm management"
            );
            const categoriesToDisplay =
              relevantCategories.length > 0 ? relevantCategories : ["Other"];

            return (
              <tr
                key={rowKey}
                data-testid={`cow-recommendation-row-${rowKey}`}
                className="hover:bg-slate-50/70 dark:hover:bg-[#1B1D20]/50 transition-colors"
              >
                {/* 1. Subject Cow */}
                <td className="px-4 py-3.5 font-semibold text-slate-900 dark:text-[#F4F4F5] whitespace-nowrap">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">🐄</span>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-[#F4F4F5]">
                        {group.cow_name}
                      </div>
                      {group.cow_id ? (
                        <div className="text-[11px] font-mono text-slate-400 dark:text-[#A1A1AA]/70">
                          {t("rec.cow_id_prefix", "ID:")} {group.cow_id.slice(0, 8)}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </td>

                {/* 2. Consolidated Action & Relevant Categories */}
                <td className="px-4 py-3.5 max-w-md">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900 dark:text-[#F4F4F5]">
                        {translateRecommendationTitle(group.primary_action_title, t)}
                      </span>
                      {group.action_count > 1 ? (
                        <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-[#27272A] px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-[#A1A1AA] border border-slate-200 dark:border-[#3F3F46]">
                          {group.action_count - 1 === 1
                            ? t("rec.more_actions", `+1 more action`).replace("{count}", "1")
                            : t("rec.more_actions_plural", `+${group.action_count - 1} more actions`).replace(
                                "{count}",
                                String(group.action_count - 1)
                              )}
                        </span>
                      ) : null}
                    </div>

                    {/* Relevant Category Badges (No unnecessary General badge) */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {categoriesToDisplay.map((cat) => (
                        <span
                          key={cat}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/40"
                        >
                          <span>{getCategoryIcon(cat)}</span>
                          <span>{t(getCategoryTranslationKey(cat), cat)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </td>

                {/* 3. Priority */}
                <td className="px-4 py-3.5 whitespace-nowrap">
                  {getPriorityBadge(group.highest_priority)}
                </td>

                {/* 4. Latest Update */}
                <td className="px-4 py-3.5 text-xs text-slate-500 dark:text-[#A1A1AA] whitespace-nowrap">
                  {formatDate(group.latest_created_at)}
                </td>

                {/* 6. Status */}
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      group.is_all_completed
                        ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40"
                        : "bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800/40"
                    }`}
                  >
                    {group.is_all_completed
                      ? t("rec.status.completed", "Completed")
                      : t("rec.status.required", "Action Required")}
                  </span>
                </td>

                {/* 7. Action Controls: Compact, balanced, and aligned */}
                <td className="px-4 py-3.5 text-right whitespace-nowrap">
                  <div className="inline-flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      data-testid={`view-details-${rowKey}`}
                      onClick={() => onOpenDetails(group)}
                      className="view-details-btn inline-flex items-center gap-1 rounded-xl border border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-950/40 px-2.5 py-1 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/50 shadow-sm transition-all"
                    >
                      <span>👁️</span>
                      <span>{t("rec.btn.view_details", "View Details")}</span>
                    </button>

                    {!group.is_all_completed ? (
                      <button
                        type="button"
                        data-testid={`complete-cow-${rowKey}`}
                        onClick={() => onRequestCompleteCow(group)}
                        className="inline-flex items-center gap-1 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 shadow-sm transition-all"
                      >
                        <span>✓</span>
                        <span>{t("rec.btn.complete_all", "Complete All")}</span>
                      </button>
                    ) : null}

                    {onRequestDeleteCow ? (
                      <button
                        type="button"
                        data-testid={`delete-cow-${rowKey}`}
                        onClick={() => onRequestDeleteCow(group)}
                        className="inline-flex items-center gap-1 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-white dark:bg-[#151719] px-2.5 py-1 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 shadow-sm transition-all"
                      >
                        <span>🗑️</span>
                        <span>{t("rec.btn.delete", "Delete")}</span>
                      </button>
                    ) : null}
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
