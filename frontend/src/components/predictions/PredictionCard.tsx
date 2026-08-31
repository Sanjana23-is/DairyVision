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
    <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50/60 via-white to-sky-50/30 p-6 shadow-sm space-y-4">
      {/* Header with Confidence Badge */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-sky-600" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">AI Model Yield Target</span>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-extrabold border ${
            isHistorical
              ? "bg-emerald-100 text-emerald-800 border-emerald-200"
              : "bg-sky-100 text-sky-800 border-sky-200"
          }`}
        >
          {prediction.confidence_score != null
            ? `Confidence: ${Math.round(prediction.confidence_score * 100)}%`
            : "Confidence: Estimated"}
        </span>
      </div>

      {/* Big Yield Number */}
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-black text-slate-950">
          {prediction.predicted_milk_yield.toFixed(2)}
        </span>
        <span className="text-sm font-bold text-slate-500">L/day</span>
      </div>

      {/* Estimated Prediction Range Box */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 space-y-1">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
          <span className="flex items-center gap-1">
            <Activity className="h-3.5 w-3.5 text-sky-600" />
            Estimated Prediction Range
          </span>
        </div>
        <div className="text-lg font-black text-slate-900">
          {hasRange
            ? `${prediction.confidence_lower!.toFixed(2)} – ${prediction.confidence_upper!.toFixed(2)} L/day`
            : "Estimated from baseline error"}
        </div>
        <p className="text-[11px] font-medium text-slate-600">
          {isHistorical
            ? "Historical error-based estimate"
            : "Estimated with limited historical data"}
        </p>
      </div>

      {/* Metadata Footers */}
      <div className="grid gap-1.5 text-xs text-slate-600 pt-1">
        <div className="flex justify-between">
          <span className="text-slate-600 font-bold">Subject Cow:</span>
          <span className="font-bold text-slate-900">{cowName || "—"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600 font-bold">Observation Date:</span>
          <span>{formatDate(observationDate)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600 font-bold">Model Engine:</span>
          <span className="font-mono text-[11px]">{prediction.model_version}</span>
        </div>
      </div>
    </div>
  );
}
