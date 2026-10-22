import {
  GroupedCowRecommendation,
  Recommendation,
  getCategoryIcon,
  getCategoryTranslationKey,
  mapCategoryToLabel,
  translateRecommendationTitle,
  translateRecommendationDescription,
  translateRecommendationWhyReason,
} from "@/services/recommendation";
import { useLanguage } from "@/context/LanguageContext";

export default function RecommendationDetailsModal({
  groupedCow,
  open = true,
  onClose,
  onCompleteAction,
  onCompleteAllCow,
}: {
  groupedCow: GroupedCowRecommendation | null;
  open?: boolean;
  onClose: () => void;
  onCompleteAction: (id: string) => void;
  onCompleteAllCow: (cowId: string | null) => void;
}) {
  const { t } = useLanguage();

  if (!open || !groupedCow) return null;

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
    return translateRecommendationWhyReason(rec.why_reason, groupedCow?.cow_name || "the cow", t);
  }

  const isCriticalOverall = groupedCow.highest_priority === "Critical";
  const isHighOverall = groupedCow.highest_priority === "High";
  const isMedOverall = groupedCow.highest_priority === "Medium";

  const priorityLabel =
    isCriticalOverall
      ? t("rec.priority.critical", "Critical Priority")
      : isHighOverall
      ? t("rec.priority.high", "High Priority")
      : isMedOverall
      ? t("rec.priority.medium", "Medium Priority")
      : t("rec.priority.low", "Low Priority");

  const translatedCategoriesList = groupedCow.categories
    .map((c) => t(getCategoryTranslationKey(c), c))
    .join(", ");

  return (
    <div
      data-testid="recommendation-details-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/75 p-4 backdrop-blur-sm overflow-y-auto"
    >
      <div className="w-full max-w-3xl my-8 overflow-hidden rounded-3xl bg-white dark:bg-[#151719] border border-slate-200 dark:border-[#27272A] shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#27272A] px-6 py-5 bg-slate-50/70 dark:bg-[#1B1D20]/80">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🐄</span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-slate-900 dark:text-[#F4F4F5]">
                  {groupedCow.cow_name}
                </h3>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    isCriticalOverall || isHighOverall
                      ? "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40"
                      : isMedOverall
                      ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40"
                      : "bg-slate-100 dark:bg-[#1B1D20] text-slate-700 dark:text-[#A1A1AA] border border-slate-200 dark:border-[#27272A]"
                  }`}
                >
                  {priorityLabel}
                </span>
                <span className="text-xs text-slate-500 dark:text-[#A1A1AA]">
                  ({t("rec.progress.pending", `${groupedCow.pending_count} pending`).replace("{count}", String(groupedCow.pending_count))} /{" "}
                  {groupedCow.action_count} {t("rec.total_suffix", "total")})
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-[#A1A1AA]">
                {t("rec.modal.title", "Consolidated Advisory Plan & Evidence Breakdown")}
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="close-details-modal-btn"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 dark:text-[#A1A1AA] hover:bg-slate-100 dark:hover:bg-[#1B1D20] hover:text-slate-700 dark:hover:text-[#F4F4F5] transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="max-h-[75vh] overflow-y-auto p-6 space-y-6">
          {/* Consolidated Context Summary Banner */}
          <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/30 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-900 dark:text-emerald-300">
              <span>📋</span>
              <span>{t("rec.modal.overview_title", "Consolidated Advisory Overview")}</span>
            </div>
            <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-emerald-950 dark:text-emerald-200 font-medium">
              {t(
                "rec.modal.overview_body",
                `DairyVision AI combined {count} advisory items for {cow} across {categories}. All underlying health observations, thermal comfort indexes, and milk production signals are preserved below.`
              )
                .replace("{count}", String(groupedCow.action_count))
                .replace("{cow}", groupedCow.cow_name)
                .replace("{categories}", translatedCategoriesList || t("rec.cat.other", "Other"))}
            </p>
          </div>

          {/* Individual Recommended Actions */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-[#A1A1AA]">
              {t("rec.modal.actions_title", `Recommended Actions ({count})`).replace(
                "{count}",
                String(groupedCow.recommendations.length)
              )}
            </h4>

            {groupedCow.recommendations.map((rec) => {
              const recIsHigh = rec.priority === "High" || rec.priority === "Critical";
              const recIsMed = rec.priority === "Medium";
              const why = getWhyExplanation(rec);

              // Map category to meaningful label (omits General Farm Management)
              const mappedLabel = mapCategoryToLabel(rec.category) || "Other";
              const translatedCat = t(getCategoryTranslationKey(mappedLabel), mappedLabel);

              const recPriorityLabel =
                rec.priority === "Critical"
                  ? t("rec.priority.critical", "Critical Priority")
                  : rec.priority === "High"
                  ? t("rec.priority.high", "High Priority")
                  : rec.priority === "Medium"
                  ? t("rec.priority.medium", "Medium Priority")
                  : t("rec.priority.low", "Low Priority");

              return (
                <div
                  key={rec.id}
                  data-testid={`cow-action-card-${rec.id}`}
                  className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] p-5 shadow-sm space-y-4"
                >
                  {/* Action Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 dark:border-[#27272A] pb-3">
                    <div className="flex items-start gap-2.5">
                      <span className="text-2xl mt-0.5">{getCategoryIcon(mappedLabel)}</span>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-[#A1A1AA]">
                          {translatedCat}
                        </div>
                        <h5 className="text-base font-bold text-slate-900 dark:text-[#F4F4F5]">
                          {translateRecommendationTitle(rec.title, t)}
                        </h5>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          recIsHigh
                            ? "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300"
                            : recIsMed
                            ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                            : "bg-slate-100 dark:bg-[#151719] text-slate-700 dark:text-[#A1A1AA]"
                        }`}
                      >
                        {recPriorityLabel}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          rec.completed
                            ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                            : "bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300"
                        }`}
                      >
                        {rec.completed
                          ? `✓ ${t("rec.status.completed", "Completed")}`
                          : t("rec.status.required", "Action Required")}
                      </span>
                    </div>
                  </div>

                  {/* Why this recommendation */}
                  <div className="rounded-xl border border-amber-100 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 p-3.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-300">
                      <span>💡</span>
                      <span>{t("rec.modal.why_title", "Why this recommendation?")}</span>
                    </div>
                    <p className="mt-1 text-xs sm:text-sm leading-relaxed text-amber-950 dark:text-amber-200">
                      {why}
                    </p>
                  </div>

                  {/* Practical Next Steps */}
                  <div className="rounded-xl border border-slate-200/80 dark:border-[#27272A] bg-slate-50/70 dark:bg-[#151719]/60 p-3.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-[#F4F4F5]">
                      <span>🎯</span>
                      <span>{t("rec.modal.next_steps_title", "Practical Next Steps")}</span>
                    </div>
                    <p className="mt-1 text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-[#A1A1AA] whitespace-pre-wrap font-medium">
                      {translateRecommendationDescription(rec.description, t)}
                    </p>
                  </div>

                  {/* Evidence Context & Action Completion */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1 text-xs text-slate-400 dark:text-[#A1A1AA]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>
                        {t("rec.modal.generated", "Generated:")} {formatDate(rec.created_at)}
                      </span>
                      {rec.observation_id ? (
                        <span className="rounded bg-slate-100 dark:bg-[#151719] px-1.5 py-0.5 text-[10px]">
                          {t("rec.modal.obs_prefix", "Obs:")} {rec.observation_id.slice(0, 8)}
                        </span>
                      ) : null}
                      {rec.alert_id ? (
                        <span className="rounded bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 px-1.5 py-0.5 text-[10px]">
                          {t("rec.modal.health_alert", "Health Alert")}
                        </span>
                      ) : null}
                      {rec.anomaly_id ? (
                        <span className="rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 text-[10px]">
                          {t("rec.modal.anomaly_signal", "Anomaly Signal")}
                        </span>
                      ) : null}
                    </div>

                    {!rec.completed ? (
                      <button
                        type="button"
                        data-testid={`complete-action-btn-${rec.id}`}
                        onClick={() => onCompleteAction(rec.id)}
                        className="rounded-xl border border-emerald-600 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 shadow-sm transition-all"
                      >
                        ✓ {t("rec.btn.mark_completed", "Mark Completed")}
                      </button>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-xs flex items-center gap-1">
                        ✓ {t("rec.btn.action_done", "Action Done")}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-[#27272A] px-6 py-4 bg-slate-50/70 dark:bg-[#1B1D20]/80">
          <div>
            {!groupedCow.is_all_completed ? (
              <button
                type="button"
                data-testid="complete-all-cow-modal-btn"
                onClick={() => onCompleteAllCow(groupedCow.cow_id)}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 shadow-sm transition-all"
              >
                ✓ {t("rec.btn.complete_all_cow", "Mark All Actions Completed for Cow")}
              </button>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] px-4 py-2 text-xs font-semibold text-slate-700 dark:text-[#F4F4F5] hover:bg-slate-50 dark:hover:bg-[#1B1D20] shadow-sm transition-all"
          >
            {t("rec.btn.close", "Close")}
          </button>
        </div>
      </div>
    </div>
  );
}
