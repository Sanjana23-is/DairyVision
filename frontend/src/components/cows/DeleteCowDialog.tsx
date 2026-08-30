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
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold">Delete Cow</h3>
        <p>
          Are you sure you want to delete <strong>{cow.name}</strong> (tag:{" "}
          {cow.tag})?
        </p>
        {submitError && (
          <div className="mt-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {submitError}
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded border px-3 py-1"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={() => onDelete(cow.id)}
            className="rounded bg-rose-600 px-3 py-1 text-white disabled:opacity-60"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
