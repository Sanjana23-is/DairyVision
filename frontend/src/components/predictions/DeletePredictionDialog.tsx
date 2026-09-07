import { useLanguage } from "@/context/LanguageContext";

export default function DeletePredictionDialog({
  prediction,
  cowName,
  open = true,
  onClose,
  onDelete,
  loading,
}: {
  prediction: {
    id: string;
    prediction_timestamp: string;
    cow_id: string;
  };
  cowName?: string;
  open?: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
  loading?: boolean;
}) {
  const { t } = useLanguage();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 px-4 py-6 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#151719] p-6 shadow-xl border border-slate-200 dark:border-[#27272A]">
        <h3 className="text-lg font-bold text-slate-900 dark:text-[#F4F4F5]">{t("pred.delete_prediction", "Delete Prediction")}</h3>
        <p className="mt-3 text-sm text-slate-600 dark:text-[#A1A1AA]">
          {t("pred.delete_confirm", "Are you sure you want to delete the prediction for")}{" "}
          <strong className="text-slate-900 dark:text-[#F4F4F5]">{cowName ?? prediction.cow_id}</strong>{" "}
          {t("common.on", "on")}{" "}
          <strong className="text-slate-900 dark:text-[#F4F4F5]">
            {new Date(prediction.prediction_timestamp).toLocaleString()}
          </strong>
          ?
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-4 text-sm font-semibold text-slate-700 dark:text-[#F4F4F5] hover:bg-slate-50 dark:hover:bg-[#151719] cursor-pointer"
            disabled={loading}
          >
            {t("common.cancel", "Cancel")}
          </button>
          <button
            type="button"
            onClick={() => onDelete(prediction.id)}
            className="h-11 rounded-2xl bg-rose-600 dark:bg-rose-600 px-4 text-sm font-bold text-white hover:bg-rose-700 cursor-pointer"
            disabled={loading}
          >
            {loading ? t("common.deleting", "Deleting…") : t("common.delete", "Delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
