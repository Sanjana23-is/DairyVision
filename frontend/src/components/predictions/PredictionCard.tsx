import { MilkPrediction } from "@/services/prediction";
import { Sparkles, Activity } from "lucide-react";

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
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

export default function PredictionCard({
  prediction,
  cowName,
  observationDate,
}: {
  prediction: MilkPrediction;
  cowName?: string;
  observationDate?: string;
}) {
  const hasRange = prediction.confidence_lower != null && prediction.confidence_upper != null;
  const isHistorical = prediction.confidence_data_status === "historical";

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-slate-50/60 via-white to-emerald-50/20 p-5 shadow-xs space-y-3.5 font-sans">
      {/* Header with Confidence Badge */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-emerald-600" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">AI Model Yield Target</span>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
            isHistorical
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-slate-100 text-slate-700 border-slate-200"
          }`}
        >
          {prediction.confidence_score != null
            ? `Confidence: ${Math.round(prediction.confidence_score * 100)}%`
            : "Confidence: Estimated"}
        </span>
      </div>

      {/* Big Yield Number */}
      <div className="flex items-baseline gap-2">
        <span className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-950">
          {prediction.predicted_milk_yield.toFixed(2)}
        </span>
        <span className="text-sm font-semibold text-slate-500">L/day</span>
      </div>

      {/* Estimated Prediction Range Box */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-3 space-y-1">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          <span className="flex items-center gap-1">
            <Activity className="h-3.5 w-3.5 text-emerald-600" />
            Estimated Prediction Range
          </span>
        </div>
        <div className="text-base font-bold text-slate-900">
          {hasRange
            ? `${prediction.confidence_lower!.toFixed(2)} – ${prediction.confidence_upper!.toFixed(2)} L/day`
            : "Estimated from baseline error"}
        </div>
        <p className="text-[11px] font-normal text-slate-500">
          {isHistorical
            ? "Historical error-based estimate"
            : "Estimated with limited historical data"}
        </p>
      </div>

      {/* Metadata Footers */}
      <div className="grid gap-1.5 text-xs text-slate-600 pt-0.5">
        <div className="flex justify-between">
          <span className="text-slate-500 font-medium">Subject Cow:</span>
          <span className="font-semibold text-slate-900">{cowName || "—"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500 font-medium">Observation Date:</span>
          <span className="font-medium text-slate-800">{formatDate(observationDate)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500 font-medium">Model Engine:</span>
          <span className="font-mono text-[11px] text-slate-700">{prediction.model_version}</span>
        </div>
      </div>
    </div>
  );
}
