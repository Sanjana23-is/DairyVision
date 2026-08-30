import { useMemo } from "react";
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

export default function ExplainabilityPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryPredId = searchParams.get("predictionId");
  const queryAnomId = searchParams.get("anomalyId");
  const { currentFarmId } = useAuth();

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

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">
              AI Decision Explainability
            </h2>
            <p className="text-sm text-slate-500">
              SHAP feature attributions and natural language driver analysis for predictions and anomaly alerts.
            </p>
          </div>

          {/* Context Selector */}
          <div className="flex items-center gap-2">
            <label htmlFor="explain-select" className="text-xs font-medium text-slate-500">
              Select Record:
            </label>
            <select
              id="explain-select"
              value={selectedItemKey}
              onChange={(e) => handleSelectChange(e.target.value)}
              disabled={isHistoryLoading || historyItems.length === 0}
              className="rounded-2xl border bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
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
          <div className="rounded-2xl border bg-white p-8 text-center text-slate-600">
            <p className="text-base font-medium">🌾 No predictions or anomalies recorded yet.</p>
            <p className="mt-1 text-sm text-slate-400">
              Record a daily observation to generate predictions and AI explanations.
            </p>
          </div>
        ) : isExplainLoading ? (
          <div className="rounded-2xl border bg-white p-8 text-center text-slate-500">
            Computing SHAP feature attributions and natural language narrative...
          </div>
        ) : isError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
            Error loading explainability: {(error as any)?.message || "Unknown error"}
          </div>
        ) : explainData ? (
          <div className="space-y-6">
            {/* Natural Language Narrative Card */}
            {explainData.summary_narrative ? (
              <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-5 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-800">
                  <span>💡 AI Plain-English Insight Narrative</span>
                </div>
                <p className="mt-2 text-base font-medium leading-relaxed text-sky-950">
                  {explainData.summary_narrative}
                </p>
              </div>
            ) : null}

            {/* Context Summary Header */}
            <div className="rounded-2xl border bg-white p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs text-slate-400">Subject Cow</div>
                <div className="text-lg font-bold text-slate-900">
                  🐄 {explainData.cow_name || "Herd Cow"}
                </div>
              </div>

              {explainData.observation_date ? (
                <div>
                  <div className="text-xs text-slate-400">Observation Date</div>
                  <div className="text-sm font-semibold text-slate-800">
                    {explainData.observation_date}
                  </div>
                </div>
              ) : null}

              {explainData.predicted_yield != null ? (
                <div>
                  <div className="text-xs text-slate-400">Predicted Yield</div>
                  <div className="text-lg font-bold text-sky-700">
                    {explainData.predicted_yield.toFixed(1)} L/day
                  </div>
                </div>
              ) : null}

              {explainData.anomaly_severity ? (
                <div>
                  <div className="text-xs text-slate-400">Anomaly Severity</div>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                      explainData.anomaly_severity === "Critical"
                        ? "bg-rose-100 text-rose-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {explainData.anomaly_severity}
                  </span>
                </div>
              ) : null}

              {explainData.model_version ? (
                <div>
                  <div className="text-xs text-slate-400">Model Version</div>
                  <div className="text-xs font-mono text-slate-600">
                    {explainData.model_version}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Main Visualizations Grid */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-4">
                <div className="rounded-2xl border bg-white p-5 shadow-sm">
                  <h3 className="text-base font-semibold text-slate-900 mb-2">
                    SHAP Feature Contribution Waterfall
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Horizontal bar length indicates feature impact on prediction/anomaly score.
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
        ) : null}
      </div>
    </DashboardLayout>
  );
}
