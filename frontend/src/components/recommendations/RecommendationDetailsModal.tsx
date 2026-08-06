import { Recommendation } from "@/services/recommendation";

export default function RecommendationDetailsModal({
  recommendation,
  open = true,
  onClose,
}: {
  recommendation: Recommendation;
  open?: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold">Recommendation details</h3>
            <p className="text-sm text-slate-500">
              Review the recommendation and related context.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-slate-600"
          >
            Close
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border bg-slate-50 p-4">
              <div className="text-sm font-medium text-slate-600">Title</div>
              <div className="mt-2 text-slate-800">{recommendation.title}</div>
            </div>
            <div className="rounded-2xl border bg-slate-50 p-4">
              <div className="text-sm font-medium text-slate-600">Category</div>
              <div className="mt-2 text-slate-800">
                {recommendation.category}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border bg-slate-50 p-4">
              <div className="text-sm font-medium text-slate-600">Priority</div>
              <div className="mt-2 text-slate-800">
                {recommendation.priority}
              </div>
            </div>
            <div className="rounded-2xl border bg-slate-50 p-4">
              <div className="text-sm font-medium text-slate-600">Status</div>
              <div className="mt-2 text-slate-800">
                {recommendation.completed ? "Completed" : "Pending"}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border bg-slate-50 p-4">
              <div className="text-sm font-medium text-slate-600">Cow</div>
              <div className="mt-2 text-slate-800">
                {recommendation.cow?.name ?? recommendation.cow_id ?? "N/A"}
              </div>
            </div>
            <div className="rounded-2xl border bg-slate-50 p-4">
              <div className="text-sm font-medium text-slate-600">
                Prediction
              </div>
              <div className="mt-2 text-slate-800">
                {recommendation.prediction_id ?? "N/A"}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-slate-50 p-4">
            <div className="text-sm font-medium text-slate-600">
              Description
            </div>
            <div className="mt-2 text-slate-800 whitespace-pre-wrap">
              {recommendation.description ?? "No additional details available."}
            </div>
          </div>

          <div className="rounded-2xl border bg-slate-50 p-4">
            <div className="text-sm font-medium text-slate-600">Created</div>
            <div className="mt-2 text-slate-800">
              {new Date(recommendation.created_at).toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
