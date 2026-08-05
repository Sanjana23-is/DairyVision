export default function DeleteCowDialog({
  cow,
  open = true,
  onClose,
  onDelete,
}: {
  cow: any;
  open?: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
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
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded border px-3 py-1">
            Cancel
          </button>
          <button
            onClick={() => {
              onDelete(cow.id);
              onClose();
            }}
            className="rounded bg-rose-600 px-3 py-1 text-white"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
