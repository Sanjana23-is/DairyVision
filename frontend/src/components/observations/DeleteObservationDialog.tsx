import { useLanguage } from "@/context/LanguageContext";

export default function DeleteObservationDialog({
  observation,
  cowName,
  open = true,
  onClose,
  onDelete,
  loading,
}: {
  observation: {
    id: string;
    observation_date: string;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#151719] border border-slate-200 dark:border-[#27272A] p-6 shadow-xl text-slate-900 dark:text-[#F4F4F5]">
        <h3 className="text-lg font-bold text-slate-900 dark:text-[#F4F4F5]">
          {t("obs.delete_confirm_title", "Delete Daily Observation")}
        </h3>
        <p className="mt-3 text-sm text-slate-600 dark:text-[#A1A1AA]">
          {t("common.confirm_delete", "Are you sure you want to delete this?")}{" "}
          <strong className="text-slate-900 dark:text-[#F4F4F5]">{cowName ?? observation.cow_id}</strong> (
          {t("common.date", "Date")}: <strong className="text-slate-900 dark:text-[#F4F4F5]">{observation.observation_date}</strong>)?
        </p>
        <p className="mt-2 text-xs text-slate-400 dark:text-[#A1A1AA]">
          {t("obs.delete_confirm_desc", "Are you sure you want to delete this observation record? Associated AI prediction baselines will be updated.")}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-4 text-sm font-semibold text-slate-700 dark:text-[#F4F4F5] hover:bg-slate-50 dark:hover:bg-[#222428]"
            disabled={loading}
          >
            {t("common.cancel", "Cancel")}
          </button>
          <button
            type="button"
            onClick={() => onDelete(observation.id)}
            className="h-11 rounded-2xl bg-rose-600 px-4 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-60 shadow-xs"
            disabled={loading}
          >
            {loading ? t("common.deleting", "Deleting…") : t("common.delete", "Delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
