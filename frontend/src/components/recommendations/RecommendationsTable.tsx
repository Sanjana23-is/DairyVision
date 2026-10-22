import {
  GroupedCowRecommendation,
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
      <div className="rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] p-8 text-center text-slate-600 dark:text-[#A1A1AA]">
        <p className="text-base font-semibold">
          {t("rec.empty.title", "No recommendations found.")}
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

    if (isCritical || isHigh) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded border border-rose-200/60 dark:border-rose-900/40">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
          <span>{label}</span>
        </span>
      );
    }

    if (isMed) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200/60 dark:border-amber-900/40">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
          <span>{label}</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-[#A1A1AA] bg-slate-100 dark:bg-[#1B1D20] px-2 py-0.5 rounded border border-slate-200/80 dark:border-[#27272A]">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
        <span>{label}</span>
      </span>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] shadow-sm">
      <table className="w-full text-left border-collapse min-w-[860px]">
        <thead className="bg-slate-50/80 dark:bg-[#181A1D] text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-[#A1A1AA] border-b border-slate-200 dark:border-[#27272A]">
          <tr>
            <th className="px-5 py-3.5 w-[16%] min-w-[130px] whitespace-nowrap">
              {t("rec.col.cow", "Subject Cow")}
            </th>
            <th className="px-5 py-3.5 w-[42%] min-w-[280px]">
              {t("rec.col.recommendation", "Recommendation / Consolidated Actions")}
            </th>
            <th className="px-5 py-3.5 w-[12%] min-w-[110px] whitespace-nowrap">
              {t("rec.col.priority", "Priority")}
            </th>
            <th className="px-5 py-3.5 w-[11%] min-w-[105px] whitespace-nowrap">
              {t("rec.col.updated", "Latest Update")}
            </th>
            <th className="px-5 py-3.5 w-[11%] min-w-[105px] whitespace-nowrap">
              {t("rec.col.status", "Status")}
            </th>
            <th className="px-5 py-3.5 w-[18%] min-w-[170px] text-right whitespace-nowrap">
              {t("rec.col.actions", "Actions")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-[#27272A] text-sm text-slate-700 dark:text-[#A1A1AA]">
          {data.map((group) => {
            const rowKey = group.cow_id || "general";
            const relevantCategories = group.categories.filter(
              (cat) => cat.toLowerCase() !== "general" && cat.toLowerCase() !== "general farm management"
            );
            const categoriesToDisplay =
              relevantCategories.length > 0 ? relevantCategories : ["Other"];

            const pendingText =
              group.pending_count > 0
                ? group.pending_count === 1
                  ? t("rec.actions_pending_single", "1 action pending")
                  : t("rec.actions_pending_count", `${group.pending_count} actions pending`).replace(
                      "{count}",
                      String(group.pending_count)
                    )
                : t("rec.actions_completed_all", "All actions completed");

            return (
              <tr
                key={rowKey}
                data-testid={`cow-recommendation-row-${rowKey}`}
                className="hover:bg-slate-50/70 dark:hover:bg-[#1B1D20]/50 transition-colors"
              >
                {/* 1. Subject Cow */}
                <td className="px-5 py-4 whitespace-nowrap align-top">
                  <div className="font-semibold text-slate-900 dark:text-[#F4F4F5]">
                    {group.cow_name}
                  </div>
                  {group.cow_id ? (
                    <div className="text-xs text-slate-400 dark:text-[#A1A1AA]/70 font-mono mt-0.5">
                      {t("rec.cow_id_prefix", "ID:")} {group.cow_id.slice(0, 8)}
                    </div>
                  ) : null}
                </td>

                {/* 2. Recommendation / Consolidated Actions */}
                <td className="px-5 py-4 align-top">
                  <div className="space-y-1">
                    <div className="font-medium text-slate-900 dark:text-[#F4F4F5] leading-snug">
                      {translateRecommendationTitle(group.primary_action_title, t)}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-[#A1A1AA] flex flex-wrap items-center gap-1.5 leading-normal">
                      {categoriesToDisplay.map((cat) => (
                        <span key={cat} className="inline-flex items-center gap-1.5">
                          <span>{t(getCategoryTranslationKey(cat), cat)}</span>
                          <span className="text-slate-300 dark:text-[#3F3F46] select-none">·</span>
                        </span>
                      ))}
                      <span
                        className={
                          group.pending_count > 0
                            ? "text-slate-500 dark:text-[#A1A1AA]"
                            : "text-emerald-600 dark:text-emerald-400 font-medium"
                        }
                      >
                        {pendingText}
                      </span>
                    </div>
                  </div>
                </td>

                {/* 3. Priority */}
                <td className="px-5 py-4 whitespace-nowrap align-top">
                  {getPriorityBadge(group.highest_priority)}
                </td>

                {/* 4. Latest Update */}
                <td className="px-5 py-4 text-xs text-slate-600 dark:text-[#A1A1AA] whitespace-nowrap align-top">
                  {formatDate(group.latest_created_at)}
                </td>

                {/* 5. Status */}
                <td className="px-5 py-4 whitespace-nowrap align-top">
                  {group.is_all_completed ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span>{t("rec.status.completed", "Completed")}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-[#A1A1AA]">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                      <span>{t("rec.status.required", "Action Required")}</span>
                    </span>
                  )}
                </td>

                {/* 6. Actions */}
                <td className="px-5 py-4 text-right whitespace-nowrap align-top">
                  <div className="inline-flex items-center justify-end gap-2">
                    <button
                      type="button"
                      data-testid={`view-details-${rowKey}`}
                      onClick={() => onOpenDetails(group)}
                      className="view-details-btn inline-flex items-center justify-center rounded-md border border-slate-300 dark:border-[#3F3F46] bg-white dark:bg-[#1B1D20] px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#27272A] hover:border-slate-400 dark:hover:border-[#52525B] transition-colors shadow-none"
                    >
                      {t("rec.btn.view_details", "View Details")}
                    </button>

                    {!group.is_all_completed ? (
                      <button
                        type="button"
                        data-testid={`complete-cow-${rowKey}`}
                        onClick={() => onRequestCompleteCow(group)}
                        className="inline-flex items-center justify-center rounded-md border border-emerald-300/80 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 hover:border-emerald-400 dark:hover:border-emerald-700 transition-colors shadow-none"
                      >
                        {t("rec.btn.complete_all", "Complete All")}
                      </button>
                    ) : null}

                    {onRequestDeleteCow ? (
                      <button
                        type="button"
                        data-testid={`delete-cow-${rowKey}`}
                        onClick={() => onRequestDeleteCow(group)}
                        className="inline-flex items-center justify-center rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-rose-600 dark:text-[#A1A1AA] dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                      >
                        {t("rec.btn.delete", "Delete")}
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
