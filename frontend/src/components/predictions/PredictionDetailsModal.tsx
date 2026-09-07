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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 px-4 py-6 backdrop-blur-xs">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white dark:bg-[#151719] shadow-2xl border border-slate-200 dark:border-[#27272A]">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#27272A] px-6 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-sky-600 dark:text-sky-400" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-[#F4F4F5]">Milk Yield Prediction Intelligence</h3>
              <p className="text-xs text-slate-500 dark:text-[#A1A1AA]">
                Detailed forecast evaluation and uncertainty bounds
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1B1D20] hover:text-slate-700 dark:hover:text-[#F4F4F5]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-slate-50/60 dark:bg-[#1B1D20] p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#A1A1AA]">
                Predicted Milk Yield
              </div>
              <div className="mt-2 text-3xl font-black text-slate-950 dark:text-[#F4F4F5]">
                {prediction.predicted_milk_yield.toFixed(2)} <span className="text-sm font-semibold text-slate-500 dark:text-[#A1A1AA]">L/day</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-slate-50/60 dark:bg-[#1B1D20] p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#A1A1AA]">
                Model Confidence Indicator
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-3xl font-black text-sky-950 dark:text-[#F4F4F5]">
                  {prediction.confidence_score != null
                    ? `${Math.round(prediction.confidence_score * 100)}%`
                    : "Estimated"}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    isHistorical ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20" : "bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60"
                  }`}
                >
                  {isHistorical ? "Historical Fit" : "Limited History"}
                </span>
              </div>
            </div>
          </div>

          {/* Estimated Prediction Range Box */}
          <div className="rounded-2xl border border-sky-100 dark:border-sky-900/40 bg-sky-50/40 dark:bg-sky-950/20 p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-sky-300 uppercase tracking-wider">
              <Activity className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              Estimated Prediction Range
            </div>
            <div className="text-xl font-black text-slate-900 dark:text-[#F4F4F5]">
              {hasRange
                ? `${prediction.confidence_lower!.toFixed(2)} – ${prediction.confidence_upper!.toFixed(2)} L/day`
                : "Estimated from baseline error"}
            </div>
            <p className="text-xs font-medium text-slate-600 dark:text-[#A1A1AA]">
              {isHistorical
                ? "Range estimated from historical prediction errors for this farm."
                : "Range estimated with limited historical data."}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-slate-50/60 dark:bg-[#1B1D20] p-4 text-xs">
              <div className="font-bold text-slate-500 dark:text-[#A1A1AA] uppercase tracking-wider">Subject Cow</div>
              <div className="mt-1 text-sm font-bold text-slate-900 dark:text-[#F4F4F5]">{cowName || "N/A"}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-slate-50/60 dark:bg-[#1B1D20] p-4 text-xs">
              <div className="font-bold text-slate-500 dark:text-[#A1A1AA] uppercase tracking-wider">Observation Date</div>
              <div className="mt-1 text-sm font-bold text-slate-900 dark:text-[#F4F4F5]">{formatDate(observationDate)}</div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-slate-50/60 dark:bg-[#1B1D20] p-4 text-xs">
              <div className="font-bold text-slate-500 dark:text-[#A1A1AA] uppercase tracking-wider">Prediction Timestamp</div>
              <div className="mt-1 font-medium text-slate-800 dark:text-[#F4F4F5]">
                {prediction.prediction_timestamp
                  ? new Date(prediction.prediction_timestamp).toLocaleString()
                  : "N/A"}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-slate-50/60 dark:bg-[#1B1D20] p-4 text-xs">
              <div className="font-bold text-slate-500 dark:text-[#A1A1AA] uppercase tracking-wider">Model Engine Version</div>
              <div className="mt-1 font-mono text-xs text-slate-800 dark:text-emerald-400">
                {prediction.model_version ?? "N/A"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
