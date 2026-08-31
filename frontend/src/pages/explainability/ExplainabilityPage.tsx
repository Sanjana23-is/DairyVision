import { useMemo, useState } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  fetchExplainabilityByPrediction,
  fetchExplainabilityByAnomaly,
  fetchExplainabilityHistory,
  type ExplainabilityResponse,
  type ExplainableItem,
} from "@/services/explainability";
import FeatureImportanceChart from "@/components/explainability/FeatureImportanceChart";
import TopContributorsCard from "@/components/explainability/TopContributorsCard";
import { useAuth } from "@/context/AuthContext";
import { Sparkles, HelpCircle, CheckCircle2, ChevronDown, Activity, Compass } from "lucide-react";

export default function ExplainabilityPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryPredId = searchParams.get("predictionId");
  const queryAnomId = searchParams.get("anomalyId");
  const { currentFarmId } = useAuth();
  const [showTechnical, setShowTechnical] = useState(false);

  const { data: historyItems = [], isLoading: isHistoryLoading } = useQuery<ExplainableItem[]>({
    queryKey: ["explainabilityHistory", currentFarmId],
    queryFn: () => fetchExplainabilityHistory(currentFarmId || undefined),
    staleTime: 1000 * 30,
  });

  const selectedItemKey = useMemo(() => {
    if (queryAnomId) return `anomaly:${queryAnomId}`;
    if (queryPredId) return `prediction:${queryPredId}`;
    if (historyItems.length > 0) {
      const first = historyItems[0];
      return first.prediction_id ? `prediction:${first.prediction_id}` : `anomaly:${first.anomaly_id}`;
    }
    return "";
  }, [queryPredId, queryAnomId, historyItems]);

  const activePredId = selectedItemKey.startsWith("prediction:") ? selectedItemKey.replace("prediction:", "") : null;
  const activeAnomId = selectedItemKey.startsWith("anomaly:") ? selectedItemKey.replace("anomaly:", "") : null;

  const {
    data: explainData,
    isLoading: isExplainLoading,
    isError,
    error,
  } = useQuery<ExplainabilityResponse>({
    queryKey: ["explainabilityData", activePredId, activeAnomId],
    queryFn: () => {
      if (activeAnomId) return fetchExplainabilityByAnomaly(activeAnomId);
      if (activePredId) return fetchExplainabilityByPrediction(activePredId);
      throw new Error("No item selected for explanation");
    },
    enabled: !!(activePredId || activeAnomId),
    staleTime: 1000 * 60,
  });

  function handleSelectChange(val: string) {
    if (val.startsWith("prediction:")) {
      const pId = val.replace("prediction:", "");
      setSearchParams({ predictionId: pId });
    } else if (val.startsWith("anomaly:")) {
      const aId = val.replace("anomaly:", "");
      setSearchParams({ anomalyId: aId });
    }
  }

  const mainPositiveDrivers = (explainData?.top_positive || []).slice(0, 2);
  const mainNegativeDrivers = (explainData?.top_negative || []).slice(0, 2);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-sky-600" />
              AI Yield Intelligence & Decision Factors
            </h1>
            <p className="text-sm text-slate-500">
              Farmer-friendly plain-language explanations of model predictions and operational drivers.
            </p>
          </div>

          {/* Context Selector */}
          <div className="flex items-center gap-2">
            <label htmlFor="explain-select" className="text-xs font-bold text-slate-500">
              Select Record:
            </label>
            <select
              id="explain-select"
              value={selectedItemKey}
              onChange={(e) => handleSelectChange(e.target.value)}
              disabled={isHistoryLoading || historyItems.length === 0}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {historyItems.length === 0 ? (
                <option value="">No items available</option>
              ) : (
                historyItems.map((it) => {
                  const key = it.prediction_id ? `prediction:${it.prediction_id}` : `anomaly:${it.anomaly_id}`;
                  return (
                    <option key={key} value={key}>
                      🐄 {it.cow_name} · {it.date} ({it.label})
                    </option>
                  );
                })
              )}
            </select>
          </div>
        </div>

        {!selectedItemKey && !isHistoryLoading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm">
            <p className="text-base font-bold">🌾 No predictions or anomalies recorded yet.</p>
            <p className="mt-1 text-xs text-slate-500">
              Record a daily observation to generate predictions and plain-language AI explanations.
            </p>
          </div>
        ) : isExplainLoading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
            Loading AI decision factors...
          </div>
        ) : isError ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-800 shadow-sm">
            Error loading explainability: {(error as any)?.message || "Unknown error"}
          </div>
        ) : explainData ? (
          <div className="space-y-6">
            {/* Context Header Summary Bar */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Subject Cow</span>
                <span className="text-xl font-black text-slate-950">🐄 {explainData.cow_name || "Herd Cow"}</span>
              </div>

              {explainData.observation_date && (
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Observation Date</span>
                  <span className="text-sm font-bold text-slate-800">{explainData.observation_date}</span>
                </div>
              )}

              {explainData.predicted_yield != null && (
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Predicted Yield</span>
                  <span className="text-xl font-black text-sky-950">{explainData.predicted_yield.toFixed(1)} L/day</span>
                </div>
              )}

              {explainData.model_version && (
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Model Engine</span>
                  <span className="text-xs font-mono text-slate-600">{explainData.model_version}</span>
                </div>
              )}
            </div>

            {/* 1. WHY THIS PREDICTION? (Headline Summary Narrative) */}
            <div className="rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-sky-50/40 p-6 shadow-sm space-y-2">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-sky-800">
                <HelpCircle className="h-4 w-4 text-sky-600" />
                <span>Why This Prediction?</span>
              </div>
              <p className="text-lg font-bold text-slate-900 leading-snug">
                {explainData.summary_narrative || "Prediction matches expected production baseline."}
              </p>
            </div>

            {/* 2. MAIN DRIVERS (Max 4 concise cards) */}
            <div className="space-y-3">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-slate-600" />
                Main Factors Affecting Prediction
              </h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Positive Supporting Factors */}
                <div className="rounded-3xl border border-emerald-100 bg-emerald-50/40 p-5 space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                    <span>🟢 Supporting Production</span>
                  </div>

                  {mainPositiveDrivers.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No strong positive yield boosts identified for this observation.</p>
                  ) : (
                    <div className="space-y-2">
                      {mainPositiveDrivers.map((driver, idx) => (
                        <div key={idx} className="rounded-2xl border border-emerald-200/60 bg-white p-3.5 shadow-sm text-xs">
                          <div className="font-bold text-slate-900 flex justify-between">
                            <span>{driver.display_name}</span>
                            <span className="text-emerald-700 font-black">+{Math.abs(driver.shap_value).toFixed(2)} L/day</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Model-estimated contribution: +{Math.abs(driver.shap_value).toFixed(2)} L/day relative to baseline
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Negative Lowering Factors */}
                <div className="rounded-3xl border border-rose-100 bg-rose-50/40 p-5 space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                    <span>🔴 Lowering Production</span>
                  </div>

                  {mainNegativeDrivers.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No significant environmental or feed yield penalties detected.</p>
                  ) : (
                    <div className="space-y-2">
                      {mainNegativeDrivers.map((driver, idx) => (
                        <div key={idx} className="rounded-2xl border border-rose-200/60 bg-white p-3.5 shadow-sm text-xs">
                          <div className="font-bold text-slate-900 flex justify-between">
                            <span>{driver.display_name}</span>
                            <span className="text-rose-700 font-black">-{Math.abs(driver.shap_value).toFixed(2)} L/day</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Model-estimated contribution: -{Math.abs(driver.shap_value).toFixed(2)} L/day relative to baseline
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 3. RECOMMENDED MANAGEMENT ACTION */}
            <div className="rounded-3xl border border-sky-200 bg-sky-50/80 p-6 shadow-sm space-y-2">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-sky-900">
                <Compass className="h-4 w-4 text-sky-700" />
                <span>Recommended Management Action</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-sky-700 mt-0.5 flex-shrink-0" />
                <p className="text-sm font-bold text-slate-900 leading-relaxed">
                  {explainData.actionable_advice ||
                    "Production is currently within the model's expected range. Continue monitoring feed, health, and environmental conditions."}
                </p>
              </div>
            </div>

            {/* 4. TECHNICAL EXPLANATION (Collapsible Expander) */}
            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setShowTechnical(!showTechnical)}
                className="w-full p-5 flex items-center justify-between text-left hover:bg-slate-50 transition"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-800">
                    🔬 Optional Technical Explanation (SHAP Attribution Waterfall)
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    Advanced Detail
                  </span>
                </div>
                <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${showTechnical ? "rotate-180" : ""}`} />
              </button>

              {showTechnical && (
                <div className="p-6 border-t border-slate-100 space-y-6">
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-2 space-y-4">
                      <div className="rounded-2xl border border-slate-200 p-4">
                        <h3 className="text-sm font-bold text-slate-900 mb-1">
                          SHAP Feature Contribution Waterfall
                        </h3>
                        <p className="text-xs text-slate-500 mb-4">
                          Horizontal bar length indicates exact SHAP numerical weight on the model prediction.
                        </p>
                        <FeatureImportanceChart features={explainData.features} />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <TopContributorsCard
                        title="🟢 Positive Drivers (+ Boosts)"
                        items={explainData.top_positive ?? []}
                      />
                      <TopContributorsCard
                        title="🔴 Negative Drivers (- Penalties)"
                        items={explainData.top_negative ?? []}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
