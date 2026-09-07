import { useLanguage } from "@/context/LanguageContext";

export default function DeleteCowDialog({
  cow,
  open = true,
  onClose,
  onDelete,
  isSubmitting,
  submitError,
}: {
  cow: any;
  open?: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
  isSubmitting?: boolean;
  submitError?: string | null;
}) {
  const { t } = useLanguage();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#151719] border border-slate-200 dark:border-[#27272A] p-6 shadow-xl text-slate-900 dark:text-[#F4F4F5]">
        <h3 className="mb-3 text-lg font-bold text-slate-900 dark:text-[#F4F4F5]">{t("cows.delete_confirm_title", "Delete Cow Record")}</h3>
        <p className="text-sm text-slate-600 dark:text-[#A1A1AA]">
          {t("common.confirm_delete", "Are you sure you want to delete this?")}{" "}
          <strong className="text-slate-900 dark:text-[#F4F4F5]">{cow.name}</strong> (tag:{" "}
          <strong className="text-slate-900 dark:text-[#F4F4F5]">{cow.tag}</strong>)?
        </p>
        <p className="mt-2 text-xs text-slate-400 dark:text-[#A1A1AA]">
          {t("cows.delete_confirm_desc", "Are you sure you want to remove this cow from the herd? Historical milk records and predictions will remain in archive.")}
        </p>
        {submitError && (
          <div className="mt-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
            {submitError}
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-4 py-2 text-sm font-semibold text-slate-700 dark:text-[#F4F4F5] hover:bg-slate-50 dark:hover:bg-[#222428]"
            disabled={isSubmitting}
          >
            {t("common.cancel", "Cancel")}
          </button>
          <button
            onClick={() => onDelete(cow.id)}
            className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-60 shadow-xs"
            disabled={isSubmitting}
          >
            {isSubmitting ? t("common.deleting", "Deleting...") : t("common.delete", "Delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
