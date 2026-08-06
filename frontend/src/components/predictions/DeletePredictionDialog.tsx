export default function DeletePredictionDialog({
  prediction,
  open = true,
  onClose,
  onDelete,
  loading,
}: {
  prediction: {
    id: string;
    prediction_timestamp: string;
    cow?: { name?: string };
    cow_id: string;
  };
  open?: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
  loading?: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold">Delete Prediction</h3>
        <p className="mt-3 text-sm text-slate-600">
          Are you sure you want to delete the prediction for{" "}
          <strong>{prediction.cow?.name ?? prediction.cow_id}</strong> on{" "}
          <strong>
            {new Date(prediction.prediction_timestamp).toLocaleString()}
          </strong>
          ?
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
            onClick={() => onDelete(prediction.id)}
            className="h-11 rounded-2xl bg-rose-600 px-4 text-sm text-white"
            disabled={loading}
          >
            {loading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
