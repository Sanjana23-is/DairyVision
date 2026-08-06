export default function DeleteFarmDialog({
  open,
  onClose,
  onDelete,
  loading,
  farmName,
}: {
  open: boolean;
  onClose: () => void;
  onDelete: () => void;
  loading?: boolean;
  farmName?: string | null;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-semibold">Delete Farm</h3>
        <p className="mb-4">
          Are you sure you want to delete{" "}
          <strong>{farmName ?? "this farm"}</strong>? This action cannot be
          undone.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded border px-3 py-1">
            Cancel
          </button>
          <button
            onClick={onDelete}
            className="rounded bg-rose-600 px-3 py-1 text-white"
          >
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
