import { MilkPrediction } from "@/services/prediction";

export default function PredictionDetailsModal({
  prediction,
  open = true,
  onClose,
}: {
  prediction: MilkPrediction;
  open?: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold">Prediction Details</h3>
            <p className="text-sm text-slate-500">
              Review the prediction metadata and summary.
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
              <div className="text-sm font-medium text-slate-600">
                Predicted Milk Yield
              </div>
              <div className="mt-2 text-3xl font-semibold text-sky-600">
                {prediction.predicted_milk_yield.toFixed(2)} L/day
              </div>
            </div>
            <div className="rounded-2xl border bg-slate-50 p-4">
              <div className="text-sm font-medium text-slate-600">
                Confidence
              </div>
              <div className="mt-2 text-3xl font-semibold text-slate-700">
                {prediction.confidence_score != null
                  ? `${(prediction.confidence_score * 100).toFixed(1)}%`
                  : "N/A"}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border bg-slate-50 p-4">
              <div className="text-sm font-medium text-slate-600">
                Prediction Time
              </div>
              <div className="mt-2 text-sm text-slate-700">
                {prediction.prediction_timestamp
                  ? new Date(prediction.prediction_timestamp).toLocaleString()
                  : "N/A"}
              </div>
            </div>
            <div className="rounded-2xl border bg-slate-50 p-4">
              <div className="text-sm font-medium text-slate-600">
                Health Status
              </div>
              <div className="mt-2 text-sm text-slate-700">
                {prediction.health_status != null
                  ? prediction.health_status
                  : "N/A"}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-slate-50 p-4">
            <div className="text-sm font-medium text-slate-600">
              Recommendation Summary
            </div>
            <div className="mt-2 text-sm text-slate-700">
              {prediction.recommendation_summary
                ? prediction.recommendation_summary
                : prediction.recommendations?.length
                  ? prediction.recommendations.join("; ")
                  : "No recommendations available."}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border bg-slate-50 p-4">
              <div className="text-sm font-medium text-slate-600">
                Observation
              </div>
              <div className="mt-2 text-sm text-slate-700">
                {prediction.observation_id ?? "N/A"}
              </div>
            </div>
            <div className="rounded-2xl border bg-slate-50 p-4">
              <div className="text-sm font-medium text-slate-600">
                Model Version
              </div>
              <div className="mt-2 text-sm text-slate-700">
                {prediction.model_version ?? "N/A"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
