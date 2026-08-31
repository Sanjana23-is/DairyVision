import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/layouts/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { fetchObservations } from "@/services/observation";
import { fetchCows, Cow } from "@/services/cow";
import {
  createPredictionForObservation,
  fetchPredictions,
  type MilkPrediction,
} from "@/services/prediction";
import {
  fetchExplainabilityByPrediction,
  type ExplainabilityResponse,
  type ExplainabilityFeature,
} from "@/services/explainability";
import PredictionCard from "@/components/predictions/PredictionCard";
import PredictionListSkeleton from "@/components/predictions/PredictionListSkeleton";
import { HelpCircle, ArrowRight, Sparkles, AlertCircle } from "lucide-react";

export default function PredictionPage() {
  const qc = useQueryClient();
  const { currentFarmId } = useAuth();

  const {
    data: observations = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["observations", currentFarmId],
    queryFn: () => fetchObservations(currentFarmId as string),
    enabled: !!currentFarmId,
  });

  const { data: cows = [] } = useQuery<Cow[], Error>({
    queryKey: ["cows", currentFarmId],
    queryFn: () => fetchCows(currentFarmId as string),
    enabled: !!currentFarmId,
  });

  const cowNameById = useMemo(() => {
    const map = new Map<string, string>();
    cows.forEach((cow) => map.set(cow.id, cow.name || cow.tag_id || "Unknown cow"));
    return map;
  }, [cows]);

  const cowName = (id: string) => cowNameById.get(id) ?? "Unknown cow";

  const { data: predictions = [] } = useQuery({
    queryKey: ["predictions", currentFarmId],
    queryFn: () => fetchPredictions(currentFarmId as string),
    enabled: !!currentFarmId,
  });

  const [selected, setSelected] = useState<string | null>(null);
  const [latestPrediction, setLatestPrediction] = useState<MilkPrediction | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const mutation = useMutation<MilkPrediction, any, string>({
    mutationFn: (obsId: string) => createPredictionForObservation(obsId),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["predictions", currentFarmId] });
      setLatestPrediction(data);
      setToast({
        type: "success",
        message: "Prediction generated successfully.",
      });
    },
    onError: (err) => {
      const detail =
        err?.response?.data?.detail ||
        err?.message ||
        "Unable to generate prediction.";
      const message = typeof detail === "string" ? detail : JSON.stringify(detail);
      setToast({
        type: "error",
        message,
      });
    },
  });

  const generate = (obsId: string) => {
    if (!currentFarmId) {
      setToast({
        type: "error",
        message: "Select a farm before generating predictions.",
      });
      return;
    }
    mutation.mutate(obsId);
  };

  const clearToast = () => setToast(null);

  const obsMap = useMemo(() => {
    const map = new Map<string, any>();
    observations.forEach((o: any) => map.set(o.id, o));
    return map;
  }, [observations]);

  const latest = latestPrediction ?? predictions[0] ?? null;
  const latestObs = latest?.observation_id ? obsMap.get(latest.observation_id) : null;
  const latestCowId = latest?.cow_id || latestObs?.cow_id;
  const latestCowName = latestCowId ? cowName(latestCowId) : undefined;
  const latestObsDate = latestObs?.observation_date ?? undefined;

  // Query actual SHAP Explainability data for the active prediction
  const { data: explainData, isLoading: isExplainLoading } = useQuery<ExplainabilityResponse>({
    queryKey: ["explainabilityData", latest?.id],
    queryFn: () => fetchExplainabilityByPrediction(latest!.id),
    enabled: !!latest?.id,
    staleTime: 1000 * 60,
  });

  // Top features sorted by absolute SHAP impact
  const topFeatures = useMemo(() => {
    if (!explainData?.features) return [];
    return [...explainData.features]
      .sort((a, b) => Math.abs(b.shap_value ?? 0) - Math.abs(a.shap_value ?? 0))
      .slice(0, 5);
  }, [explainData]);

  const maxShap = useMemo(() => {
    if (topFeatures.length === 0) return 1;
    return Math.max(...topFeatures.map((f) => Math.abs(f.shap_value ?? 0))) || 1;
  }, [topFeatures]);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-4 select-none font-sans">
        {/* Page Title Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              Milk Production AI Prediction
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Generate AI-driven daily milk yield forecasts and inspect model feature attributions.
            </p>
          </div>
        </div>

        {/* Toast Feedback Alert */}
        {toast && (
          <div
            className={`rounded-xl border p-3 text-xs font-bold flex items-center justify-between shadow-2xs ${
              toast.type === "success"
                ? "border-emerald-200 bg-emerald-50/80 text-emerald-900"
                : "border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            <div>{toast.message}</div>
            <button
              onClick={clearToast}
              className="text-xs opacity-70 hover:opacity-100 font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 items-start">
          {/* LEFT COLUMN: 1. Select Observation Card + 2. Why this prediction? Card (lg:col-span-2) */}
          <div className="lg:col-span-2 space-y-4">
            {/* 1. Compact Select Daily Observation Card */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4.5 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 hover:border-slate-300 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Select Daily Observation
                </h2>
                <span className="text-[11px] text-slate-400 font-medium">
                  {observations.length} observations recorded
                </span>
              </div>

              {isLoading ? (
                <PredictionListSkeleton />
              ) : isError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-600" />
                  <span>Error loading observations</span>
                </div>
              ) : observations.length === 0 ? (
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center text-xs text-slate-500 font-medium">
                  No observations available for prediction. Record an observation first.
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Observation Context:
                  </label>
                  <select
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs text-slate-900 font-semibold focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 bg-white"
                    value={selected ?? ""}
                    onChange={(e) => setSelected(e.target.value)}
                  >
                    <option value="">Pick an observation to forecast...</option>
                    {observations.map((o: any) => (
                      <option key={o.id} value={o.id}>
                        {o.observation_date} — {cowName(o.cow_id)} (Yield: {o.milk_produced_liters ?? "—"} L)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  disabled={!selected || mutation.isPending}
                  onClick={() => selected && generate(selected)}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 active:bg-emerald-800 transition disabled:opacity-50 border-0 cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{mutation.isPending ? "Generating Forecast..." : "Generate Prediction"}</span>
                </button>
              </div>
            </div>

            {/* 2. Compact Why This Prediction? (SHAP Feature Attribution Panel) */}
            {latest && (
              <div className="rounded-2xl border border-slate-200/90 bg-white p-4.5 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 hover:border-slate-300 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="h-4 w-4 text-emerald-600" />
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Why this prediction?</h3>
                  </div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                    SHAP Attribution
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 font-medium leading-tight">
                  Yield forecast factors derived from herd measurements, feed intake, health, and weather.
                </p>

                {/* Plain-Language Narrative */}
                {explainData?.summary_narrative && (
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-2.5 text-xs font-semibold text-emerald-950 leading-snug">
                    {explainData.summary_narrative}
                  </div>
                )}

                {/* Top Influential Factors Horizontal Contribution Visualization */}
                {isExplainLoading ? (
                  <div className="py-3 text-center text-xs text-slate-400 font-medium">
                    Calculating model feature importance...
                  </div>
                ) : topFeatures.length > 0 ? (
                  <div className="space-y-2.5 pt-0.5">
                    <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                      Key Influential Factors
                    </div>
                    <div className="space-y-2">
                      {topFeatures.map((f: ExplainabilityFeature, idx: number) => {
                        const isPos = (f.shap_value ?? 0) >= 0;
                        const shapVal = Math.abs(f.shap_value ?? 0);
                        const pct = Math.min(100, Math.max(12, (shapVal / maxShap) * 100));

                        return (
                          <div key={idx} className="space-y-0.5 text-xs">
                            <div className="flex items-center justify-between font-semibold">
                              <span className="text-slate-800 font-bold truncate max-w-[280px]">
                                {f.display_name || f.feature}
                                {f.value_formatted ? (
                                  <span className="ml-1 font-normal text-slate-500 text-[11px]">
                                    ({f.value_formatted})
                                  </span>
                                ) : f.value != null ? (
                                  <span className="ml-1 font-normal text-slate-500 text-[11px]">
                                    ({f.value})
                                  </span>
                                ) : null}
                              </span>
                              <span
                                className={`font-black text-[11px] ${
                                  isPos ? "text-emerald-700" : "text-rose-700"
                                }`}
                              >
                                {isPos ? `+${shapVal.toFixed(2)} L` : `-${shapVal.toFixed(2)} L`}
                              </span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  isPos ? "bg-emerald-500" : "bg-rose-500"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {/* View Detailed SHAP Explanation Interaction Link */}
                <div className="border-t border-slate-100 pt-2 flex justify-end">
                  <Link
                    to={`/explainability?predictionId=${latest.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-900 transition"
                  >
                    <span>View detailed SHAP explanation</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: 1. Compact Latest Prediction Result Card (lg:col-span-1) */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4.5 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 hover:border-slate-300 space-y-3">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
                Latest Prediction Result
              </div>
              <div>
                {latest ? (
                  <PredictionCard
                    prediction={latest}
                    cowName={latestCowName}
                    observationDate={latestObsDate}
                  />
                ) : (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-5 text-center text-xs text-slate-500 font-medium">
                    No prediction generated yet. Select an observation to generate your first forecast.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
