import { MilkPrediction } from "@/services/prediction";
import { Sparkles, Activity, X } from "lucide-react";

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function PredictionDetailsModal({
  prediction,
  cowName,
  observationDate,
  open = true,
  onClose,
}: {
  prediction: MilkPrediction;
  cowName?: string;
  observationDate?: string;
  open?: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  const hasRange = prediction.confidence_lower != null && prediction.confidence_upper != null;
  const isHistorical = prediction.confidence_data_status === "historical";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-sky-600" />
            <div>
              <h3 className="text-base font-bold text-slate-900">Milk Yield Prediction Intelligence</h3>
              <p className="text-xs text-slate-500">
                Detailed forecast evaluation and uncertainty bounds
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Predicted Milk Yield
              </div>
              <div className="mt-2 text-3xl font-black text-slate-950">
                {prediction.predicted_milk_yield.toFixed(2)} <span className="text-sm font-semibold text-slate-500">L/day</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Model Confidence Indicator
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-3xl font-black text-sky-950">
                  {prediction.confidence_score != null
                    ? `${Math.round(prediction.confidence_score * 100)}%`
                    : "Estimated"}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    isHistorical ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800"
                  }`}
                >
                  {isHistorical ? "Historical Fit" : "Limited History"}
                </span>
              </div>
            </div>
          </div>

          {/* Estimated Prediction Range Box */}
          <div className="rounded-2xl border border-slate-200 bg-sky-50/40 p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <Activity className="h-4 w-4 text-sky-600" />
              Estimated Prediction Range
            </div>
            <div className="text-xl font-black text-slate-900">
              {hasRange
                ? `${prediction.confidence_lower!.toFixed(2)} – ${prediction.confidence_upper!.toFixed(2)} L/day`
                : "Estimated from baseline error"}
            </div>
            <p className="text-xs font-medium text-slate-600">
              {isHistorical
                ? "Range estimated from historical prediction errors for this farm."
                : "Range estimated with limited historical data."}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-xs">
              <div className="font-bold text-slate-500 uppercase tracking-wider">Subject Cow</div>
              <div className="mt-1 text-sm font-bold text-slate-900">{cowName || "N/A"}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-xs">
              <div className="font-bold text-slate-500 uppercase tracking-wider">Observation Date</div>
              <div className="mt-1 text-sm font-bold text-slate-900">{formatDate(observationDate)}</div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-xs">
              <div className="font-bold text-slate-500 uppercase tracking-wider">Prediction Timestamp</div>
              <div className="mt-1 font-medium text-slate-800">
                {prediction.prediction_timestamp
                  ? new Date(prediction.prediction_timestamp).toLocaleString()
                  : "N/A"}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-xs">
              <div className="font-bold text-slate-500 uppercase tracking-wider">Model Engine Version</div>
              <div className="mt-1 font-mono text-xs text-slate-800">
                {prediction.model_version ?? "N/A"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
