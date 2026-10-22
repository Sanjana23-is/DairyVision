import {
  Recommendation,
  translateRecommendationTitle,
} from "@/services/recommendation";
import { useLanguage } from "@/context/LanguageContext";

export default function DeleteRecommendationDialog({
  recommendation,
  open = true,
  onClose,
  onDelete,
  loading,
}: {
  recommendation: Recommendation;
  open?: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
  loading?: boolean;
}) {
  const { t } = useLanguage();

  if (!open || !recommendation) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#151719] border border-slate-200 dark:border-[#27272A] p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-[#F4F4F5]">
          {t("rec.btn.delete", "Delete")}
        </h3>
        <p className="mt-3 text-sm text-slate-600 dark:text-[#A1A1AA]">
          {t("rec.delete_confirm", "Are you sure you want to delete the recommendation for")}
          {" "}
          <strong className="text-slate-900 dark:text-[#F4F4F5]">
            {translateRecommendationTitle(recommendation.title, t)}
          </strong>?
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] text-slate-700 dark:text-[#F4F4F5] px-4 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-[#151719] transition-all"
            disabled={loading}
          >
            {t("common.cancel", "Cancel")}
          </button>
          <button
            type="button"
            onClick={() => onDelete(recommendation.id)}
            className="h-10 rounded-xl bg-rose-600 hover:bg-rose-700 px-4 text-xs font-semibold text-white shadow-sm transition-all disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "..." : t("rec.btn.delete", "Delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
