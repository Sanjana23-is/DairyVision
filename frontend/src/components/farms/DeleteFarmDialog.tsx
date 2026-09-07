import { useLanguage } from "@/context/LanguageContext";

export default function DeleteFarmDialog({
  open,
  onClose,
  onDelete,
  loading,
  farmName,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onDelete: () => void;
  loading?: boolean;
  farmName?: string | null;
  error?: string;
}) {
  const { t } = useLanguage();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-semibold">{t("farms.delete_farm")}</h3>
        <p className="mb-4">
          {t("farms.delete_confirm")}{" "}
          <strong>{farmName ?? t("farms.active_farm")}</strong>? {t("farms.cannot_undone")}
        </p>

        {error && <div className="text-rose-600 text-sm mb-4">{error}</div>}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded border px-3 py-1"
            disabled={loading}
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={onDelete}
            className="rounded bg-rose-600 px-3 py-1 text-white"
            disabled={loading}
          >
            {loading ? t("common.deleting") : t("common.delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
