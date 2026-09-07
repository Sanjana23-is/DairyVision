import { HealthAlert } from "@/services/healthAlert";

export default function ResolveHealthAlertDialog({
  alert,
  open = true,
  loading,
  onClose,
  onConfirm,
}: {
  alert: HealthAlert;
  open?: boolean;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#151719] border border-slate-200 dark:border-[#27272A] p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-[#F4F4F5]">Resolve Health Alert</h3>
        <p className="mt-3 text-sm text-slate-600 dark:text-[#A1A1AA]">
          Mark the alert for <strong>{alert.cow?.name ?? alert.cow_id}</strong>{" "}
          as resolved.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] text-slate-700 dark:text-[#F4F4F5] px-4 text-sm hover:bg-slate-50 dark:hover:bg-[#151719]"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700 px-4 text-sm font-medium text-white"
            disabled={loading}
          >
            {loading ? "Resolving…" : "Resolve Alert"}
          </button>
        </div>
      </div>
    </div>
  );
}
