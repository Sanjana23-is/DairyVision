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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold">Resolve Health Alert</h3>
        <p className="mt-3 text-sm text-slate-600">
          Mark the alert for <strong>{alert.cow?.name ?? alert.cow_id}</strong>{" "}
          as resolved.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-2xl border px-4 text-sm"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-11 rounded-2xl bg-sky-600 px-4 text-sm text-white"
            disabled={loading}
          >
            {loading ? "Resolving…" : "Resolve Alert"}
          </button>
        </div>
      </div>
    </div>
  );
}
