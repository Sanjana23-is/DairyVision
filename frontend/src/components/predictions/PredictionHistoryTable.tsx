import { useNavigate } from "react-router-dom";
import { MilkPrediction } from "@/services/prediction";
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

export default function PredictionHistoryTable({
  data,
  cowNameById,
  obsDateById,
  onOpenDetails,
  onRequestDelete,
  deletingId,
}: {
  data: MilkPrediction[];
  cowNameById?: Map<string, string>;
  obsDateById?: Map<string, string>;
  onOpenDetails: (prediction: MilkPrediction) => void;
  onRequestDelete: (prediction: MilkPrediction) => void;
  deletingId?: string;
}) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const cowName = (id?: string) =>
    id ? (cowNameById?.get(id) ?? id) : "—";

  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] p-6 text-slate-600 dark:text-[#A1A1AA]">
        {t("pred.no_history", "No predictions found.")}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] shadow-sm">
      <table className="w-full table-auto text-left">
        <thead className="bg-slate-50 dark:bg-[#1B1D20] text-sm text-slate-600 dark:text-[#A1A1AA] border-b border-slate-200 dark:border-[#27272A]">
          <tr>
            <th className="px-4 py-3">{t("pred.observation_date", "Observation Date")}</th>
            <th className="px-4 py-3">{t("cows.cow", "Cow")}</th>
            <th className="px-4 py-3">{t("dashboard.yield", "Yield")}</th>
            <th className="px-4 py-3">{t("pred.confidence", "Confidence")}</th>
            <th className="px-4 py-3">{t("pred.prediction_time", "Prediction Time")}</th>
            <th className="px-4 py-3">{t("common.actions", "Actions")}</th>
          </tr>
        </thead>
        <tbody className="text-sm text-slate-700 dark:text-[#F4F4F5] divide-y divide-slate-100 dark:divide-[#27272A]">
          {data.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-[#1B1D20]/80 transition">
              <td className="px-4 py-3 text-slate-600 dark:text-[#A1A1AA]">
                {formatDate(p.observation_id ? obsDateById?.get(p.observation_id) : undefined)}
              </td>
              <td className="px-4 py-3 font-semibold text-slate-900 dark:text-[#F4F4F5]">{cowName(p.cow_id)}</td>

              <td className="px-4 py-3 font-bold text-emerald-700 dark:text-emerald-400">
                {p.predicted_milk_yield.toFixed(2)} L
              </td>
              <td className="px-4 py-3 text-slate-700 dark:text-[#A1A1AA]">
                {p.confidence_score != null
                  ? `${(p.confidence_score * 100).toFixed(1)}%`
                  : t("common.na", "N/A")}
              </td>
              <td className="px-4 py-3 text-slate-600 dark:text-[#A1A1AA]">
                {new Date(p.prediction_timestamp).toLocaleString()}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenDetails(p)}
                    className="rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-3 py-1 text-xs font-semibold text-slate-700 dark:text-[#F4F4F5] hover:bg-slate-50 dark:hover:bg-[#151719] cursor-pointer"
                  >
                    {t("common.details", "Details")}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/explainability?predictionId=${p.id}`)
                    }
                    className="rounded-xl border border-purple-200 dark:border-purple-800/60 bg-purple-50 dark:bg-purple-950/40 px-3 py-1 text-xs font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 cursor-pointer"
                  >
                    {t("nav.explainability", "Explainability")}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/health-alerts?predictionId=${p.id}`)
                    }
                    className="rounded-xl border border-sky-200 dark:border-sky-800/60 bg-sky-50 dark:bg-sky-950/40 px-3 py-1 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/40 cursor-pointer"
                  >
                    {t("risk.health_alerts", "Health Alert")}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRequestDelete(p)}
                    className="rounded-xl border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/40 px-3 py-1 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 disabled:opacity-50 cursor-pointer"
                    disabled={deletingId === p.id}
                  >
                    {deletingId === p.id ? t("common.deleting", "Deleting…") : t("common.delete", "Delete")}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
