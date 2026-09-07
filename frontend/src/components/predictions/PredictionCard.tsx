import { MilkPrediction } from "@/services/prediction";
import { Sparkles, Activity } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

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
  const { t } = useLanguage();
  const hasRange = prediction.confidence_lower != null && prediction.confidence_upper != null;
  const isHistorical = prediction.confidence_data_status === "historical";

  return (
    <div className="rounded-2xl border border-slate-200/90 dark:border-[#27272A] bg-gradient-to-br from-slate-50/60 via-white to-emerald-50/20 dark:from-[#151719] dark:via-[#151719] dark:to-emerald-950/20 p-5 shadow-xs space-y-3.5 font-sans text-slate-900 dark:text-[#F4F4F5]">
      {/* Header with Confidence Badge */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#27272A] pb-2.5">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#A1A1AA]">{t("pred.ai_target", "AI Model Yield Target")}</span>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
            isHistorical
              ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20"
              : "bg-slate-100 dark:bg-[#1B1D20] text-slate-700 dark:text-[#A1A1AA] border-slate-200 dark:border-[#27272A]"
          }`}
        >
          {prediction.confidence_score != null
            ? `${t("pred.confidence", "Confidence")}: ${Math.round(prediction.confidence_score * 100)}%`
            : `${t("pred.confidence", "Confidence")}: ${t("pred.estimated", "Estimated")}`}
        </span>
      </div>

      {/* Big Yield Number */}
      <div className="flex items-baseline gap-2">
        <span className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 dark:text-[#F4F4F5]">
          {prediction.predicted_milk_yield.toFixed(2)}
        </span>
        <span className="text-sm font-semibold text-slate-500 dark:text-[#A1A1AA]">L/{t("common.day", "day")}</span>
      </div>

      {/* Estimated Prediction Range Box */}
      <div className="rounded-xl border border-slate-200/80 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] p-3 space-y-1">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-[#A1A1AA] uppercase tracking-wider">
          <span className="flex items-center gap-1">
            <Activity className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            {t("pred.prediction_range", "Estimated Prediction Range")}
          </span>
        </div>
        <div className="text-base font-bold text-slate-900 dark:text-[#F4F4F5]">
          {hasRange
            ? `${prediction.confidence_lower!.toFixed(2)} – ${prediction.confidence_upper!.toFixed(2)} L/${t("common.day", "day")}`
            : t("pred.range_baseline", "Estimated from baseline error")}
        </div>
        <p className="text-[11px] font-normal text-slate-500 dark:text-[#A1A1AA]">
          {isHistorical
            ? t("pred.range_hist_desc", "Historical error-based estimate")
            : t("pred.range_limited_desc", "Estimated with limited historical data")}
        </p>
      </div>

      {/* Metadata Footers */}
      <div className="grid gap-1.5 text-xs text-slate-600 dark:text-[#A1A1AA] pt-0.5">
        <div className="flex justify-between">
          <span className="text-slate-500 dark:text-[#A1A1AA] font-medium">{t("pred.subject_cow", "Subject Cow")}:</span>
          <span className="font-semibold text-slate-900 dark:text-[#F4F4F5]">{cowName || "—"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500 dark:text-[#A1A1AA] font-medium">{t("pred.observation_date", "Observation Date")}:</span>
          <span className="font-medium text-slate-800 dark:text-[#F4F4F5]">{formatDate(observationDate)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500 dark:text-[#A1A1AA] font-medium">{t("pred.model_engine", "Model Engine")}:</span>
          <span className="font-mono text-[11px] text-slate-700 dark:text-[#F4F4F5]">{prediction.model_version}</span>
        </div>
      </div>
    </div>
  );
}
