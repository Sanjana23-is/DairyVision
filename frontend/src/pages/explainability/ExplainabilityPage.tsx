import { useMemo, useState, useEffect } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  fetchExplainabilityByPrediction,
  type ExplainabilityResponse,
} from "@/services/explainability";
import { fetchPredictions, type MilkPrediction } from "@/services/prediction";
import { fetchCows, type Cow } from "@/services/cow";
import { fetchObservations, type Observation } from "@/services/observation";
import FeatureImportanceChart from "@/components/explainability/FeatureImportanceChart";
import TopContributorsCard from "@/components/explainability/TopContributorsCard";
import { useAuth } from "@/context/AuthContext";
import {
  Sparkles,
  HelpCircle,
  CheckCircle2,
  ChevronDown,
  Activity,
  Compass,
  Calendar,
  ArrowRight,
  History,
  Info,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

export type CompletePredictionRecord = {
  id: string;
  cow_id: string;
  cow_name: string;
  observation_id?: string | null;
  observation_date_raw: string;
  observation_date_formatted: string;
  predicted_milk_yield: number;
  confidence_score?: number | null;
  confidence_label: string;
  confidence_text: string;
  model_version?: string | null;
  raw: MilkPrediction;
};

function formatPredictionDate(dateStr?: string | null): string {
  if (!dateStr) return "Recent";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function getConfidenceDetails(conf?: number | null) {
  if (conf == null || isNaN(conf)) {
    return { label: "High Confidence", scoreText: "85%" };
  }
  const pct = conf <= 1 ? Math.round(conf * 100) : Math.round(conf);
  if (pct >= 80) {
    return { label: "High Confidence", scoreText: `${pct}%` };
  } else if (pct >= 60) {
    return { label: "Moderate Confidence", scoreText: `${pct}%` };
  } else {
    return { label: "Fair Confidence", scoreText: `${pct}%` };
  }
}

export default function ExplainabilityPage() {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryPredId = searchParams.get("predictionId");
  const { currentFarmId } = useAuth();
  const [showTechnical, setShowTechnical] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);

  // Two dedicated state holders
  const [selectedCowId, setSelectedCowId] = useState<string | null>(null);
  const [selectedPredictionRecord, setSelectedPredictionRecord] = useState<CompletePredictionRecord | null>(null);

  // 1. Fetch Cows
  const { data: cows = [], isLoading: isCowsLoading } = useQuery<Cow[]>({
    queryKey: ["cows", currentFarmId],
    queryFn: () => fetchCows(currentFarmId || undefined),
    staleTime: 1000 * 60,
  });

  // 2. Fetch Milk Yield Predictions
  const { data: rawPredictions = [], isLoading: isPredictionsLoading } = useQuery<MilkPrediction[]>({
    queryKey: ["predictions", currentFarmId],
    queryFn: () => fetchPredictions(currentFarmId || undefined),
    staleTime: 1000 * 30,
  });

  // 3. Fetch Observations for observation_date mapping
  const { data: observations = [] } = useQuery<Observation[]>({
    queryKey: ["observations", currentFarmId],
    queryFn: () => fetchObservations(currentFarmId || undefined),
    staleTime: 1000 * 60,
  });

  // Unified complete prediction records (Enriched with exact cow_name and formatted date)
  const allPredictionRecords = useMemo<CompletePredictionRecord[]>(() => {
    const cowMap = new Map<string, string>();
    for (const c of cows) {
      cowMap.set(c.id, c.name || c.tag || `Cow ${c.id.slice(0, 6)}`);
    }

    const obsMap = new Map<string, string>();
    for (const o of observations) {
      if (o.id && o.observation_date) {
        obsMap.set(o.id, o.observation_date);
      }
    }

    return rawPredictions
      .filter((p) => p && p.id && p.cow_id && p.predicted_milk_yield != null && !isNaN(p.predicted_milk_yield))
      .map((p) => {
        const cowName = cowMap.get(p.cow_id) || `Cow ${p.cow_id.slice(0, 6)}`;
        const obsDateRaw = (p.observation_id && obsMap.get(p.observation_id)) || p.prediction_timestamp || "";
        const conf = getConfidenceDetails(p.confidence_score);

        return {
          id: p.id,
          cow_id: p.cow_id,
          cow_name: cowName,
          observation_id: p.observation_id,
          observation_date_raw: obsDateRaw,
          observation_date_formatted: formatPredictionDate(obsDateRaw),
          predicted_milk_yield: p.predicted_milk_yield,
          confidence_score: p.confidence_score,
          confidence_label: conf.label,
          confidence_text: conf.scoreText,
          model_version: p.model_version,
          raw: p,
        };
      });
  }, [rawPredictions, cows, observations]);

  // Unique cows list for dropdown (display each cow only once)
  const uniqueCows = useMemo(() => {
    if (cows.length > 0) {
      return cows.map((c) => ({
        id: c.id,
        name: c.name || c.tag || `Cow ${c.id.slice(0, 6)}`,
      }));
    }
    const seen = new Set<string>();
    const list: { id: string; name: string }[] = [];
    for (const p of allPredictionRecords) {
      if (!seen.has(p.cow_id)) {
        seen.add(p.cow_id);
        list.push({ id: p.cow_id, name: p.cow_name });
      }
    }
    return list;
  }, [cows, allPredictionRecords]);

  // Filter prediction history strictly for selected cow, sorted newest first
  const cowPredictionHistory = useMemo<CompletePredictionRecord[]>(() => {
    if (!selectedCowId) return [];
    return allPredictionRecords
      .filter((r) => r.cow_id === selectedCowId)
      .sort((a, b) => {
        const timeA = a.observation_date_raw ? new Date(a.observation_date_raw).getTime() : 0;
        const timeB = b.observation_date_raw ? new Date(b.observation_date_raw).getTime() : 0;
        return timeB - timeA;
      });
  }, [allPredictionRecords, selectedCowId]);

  // Synchronize state and default selection
  useEffect(() => {
    if (allPredictionRecords.length === 0) {
      if (uniqueCows.length > 0 && !selectedCowId) {
        setSelectedCowId(uniqueCows[0].id);
      }
      return;
    }

    // 1. If URL has queryPredId, find and set that exact record as source of truth
    if (queryPredId) {
      const matchedRecord = allPredictionRecords.find((r) => r.id === queryPredId);
      if (matchedRecord) {
        if (selectedCowId !== matchedRecord.cow_id) {
          setSelectedCowId(matchedRecord.cow_id);
        }
        if (selectedPredictionRecord?.id !== matchedRecord.id) {
          setSelectedPredictionRecord(matchedRecord);
        }
        return;
      }
    }

    // 2. If no queryPredId or record not yet selected
    if (!selectedCowId) {
      // Find the first cow with prediction history
      const cowWithPreds = uniqueCows.find((c) => allPredictionRecords.some((r) => r.cow_id === c.id));
      const targetCowId = cowWithPreds ? cowWithPreds.id : uniqueCows[0]?.id;
      if (targetCowId) {
        setSelectedCowId(targetCowId);
      }
    } else {
      // We have selectedCowId, check if selectedPredictionRecord belongs to this cow
      if (!selectedPredictionRecord || selectedPredictionRecord.cow_id !== selectedCowId) {
        const forCow = allPredictionRecords
          .filter((r) => r.cow_id === selectedCowId)
          .sort((a, b) => {
            const timeA = a.observation_date_raw ? new Date(a.observation_date_raw).getTime() : 0;
            const timeB = b.observation_date_raw ? new Date(b.observation_date_raw).getTime() : 0;
            return timeB - timeA;
          });

        if (forCow.length > 0) {
          setSelectedPredictionRecord(forCow[0]);
          setSearchParams({ predictionId: forCow[0].id }, { replace: true });
        } else {
          setSelectedPredictionRecord(null);
          setSearchParams({}, { replace: true });
        }
      }
    }
  }, [allPredictionRecords, queryPredId, uniqueCows, selectedCowId, selectedPredictionRecord, setSearchParams]);

  // Handle Cow Selection Change
  function handleCowChange(newCowId: string) {
    setSelectedCowId(newCowId);
    setShowAllHistory(false);

    const forNewCow = allPredictionRecords
      .filter((r) => r.cow_id === newCowId)
      .sort((a, b) => {
        const timeA = a.observation_date_raw ? new Date(a.observation_date_raw).getTime() : 0;
        const timeB = b.observation_date_raw ? new Date(b.observation_date_raw).getTime() : 0;
        return timeB - timeA;
      });

    if (forNewCow.length > 0) {
      const newest = forNewCow[0];
      setSelectedPredictionRecord(newest);
      setSearchParams({ predictionId: newest.id });
    } else {
      setSelectedPredictionRecord(null);
      setSearchParams({});
    }
  }

  // Handle Clicking a Prediction History Row
  function handleSelectPrediction(record: CompletePredictionRecord) {
    setSelectedPredictionRecord(record);
    setSearchParams({ predictionId: record.id });
  }

  // Fetch SHAP explainability strictly for the ONE selectedPredictionRecord
  const {
    data: explainData,
    isLoading: isExplainLoading,
    isError,
    error,
  } = useQuery<ExplainabilityResponse>({
    queryKey: ["explainabilityData", selectedPredictionRecord?.id],
    queryFn: () => {
      if (selectedPredictionRecord?.id) {
        return fetchExplainabilityByPrediction(selectedPredictionRecord.id);
      }
      throw new Error("No prediction record selected");
    },
    enabled: !!selectedPredictionRecord?.id,
    staleTime: 1000 * 60,
  });

  const displayedPredictions = showAllHistory ? cowPredictionHistory : cowPredictionHistory.slice(0, 5);
  const hasMorePredictions = cowPredictionHistory.length > 5;

  const currentCowInfo = useMemo(() => {
    return uniqueCows.find((c) => c.id === selectedCowId) || null;
  }, [uniqueCows, selectedCowId]);

  const mainPositiveDrivers = (explainData?.top_positive || []).slice(0, 2);
  const mainNegativeDrivers = (explainData?.top_negative || []).slice(0, 2);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        {/* TOP BAR / STEP 1: SELECT COW */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-3xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] p-6 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-[#F4F4F5] flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              {t("explain.title", "AI Yield Intelligence & Decision Factors")}
            </h1>
            <p className="text-sm text-slate-500 dark:text-[#A1A1AA] mt-1">
              {t("explain.subtitle", "Farmer-friendly explanations of model predictions and operational drivers.")}
            </p>
          </div>

          {/* Step 1: Compact Cow Selector */}
          <div className="flex items-center gap-3 self-start sm:self-auto bg-slate-50 dark:bg-[#1B1D20] px-4 py-2.5 rounded-2xl border border-slate-200/80 dark:border-[#27272A]">
            <label htmlFor="cow-selector" className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#A1A1AA] whitespace-nowrap">
              {t("explain.select_cow", "Select Cow")}
            </label>
            <div className="relative">
              <select
                id="cow-selector"
                value={selectedCowId || ""}
                onChange={(e) => handleCowChange(e.target.value)}
                disabled={isCowsLoading || uniqueCows.length === 0}
                className="appearance-none rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] pl-3 pr-8 py-1.5 text-xs font-bold text-slate-800 dark:text-[#F4F4F5] shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                {uniqueCows.length === 0 ? (
                  <option value="">No cows found</option>
                ) : (
                  uniqueCows.map((c) => (
                    <option key={c.id} value={c.id} className="dark:bg-[#1B1D20]">
                      🐄 {c.name}
                    </option>
                  ))
                )}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-[#A1A1AA]" />
            </div>
          </div>
        </div>

        {/* STEP 2: PREDICTION HISTORY */}
        <div className="rounded-3xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-[#A1A1AA]">
                {t("explain.prediction_history", "Prediction History")}
              </h2>
            </div>
            {currentCowInfo && (
              <span className="text-xs font-medium text-slate-400 dark:text-[#71717A]">
                Showing history for <span className="font-semibold text-slate-700 dark:text-[#F4F4F5]">🐄 {currentCowInfo.name}</span>
              </span>
            )}
          </div>

          {isPredictionsLoading ? (
            <div className="py-8 text-center text-xs text-slate-500 dark:text-[#A1A1AA]">
              Loading prediction history...
            </div>
          ) : cowPredictionHistory.length === 0 ? (
            /* Clean Empty State */
            <div className="rounded-2xl border border-slate-100 dark:border-[#27272A] bg-slate-50/50 dark:bg-[#1B1D20]/50 p-8 text-center space-y-2">
              <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 dark:bg-[#27272A] flex items-center justify-center text-slate-400 dark:text-[#A1A1AA]">
                <Info className="h-5 w-5" />
              </div>
              <p className="text-sm font-bold text-slate-800 dark:text-[#F4F4F5]">
                {t("explain.no_predictions", "No prediction records available for this cow.")}
              </p>
              <p className="text-xs text-slate-500 dark:text-[#A1A1AA] max-w-md mx-auto">
                Record a daily observation for {currentCowInfo?.name || "this cow"} to generate milk yield predictions and AI decision factors.
              </p>
            </div>
          ) : (
            /* Horizontal Prediction Rows */
            <div className="space-y-2">
              <div className="rounded-2xl border border-slate-200/80 dark:border-[#27272A] overflow-hidden divide-y divide-slate-100 dark:divide-[#27272A]">
                {displayedPredictions.map((pred) => {
                  const isSelected = selectedPredictionRecord?.id === pred.id;

                  return (
                    <div
                      key={pred.id}
                      onClick={() => handleSelectPrediction(pred)}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-emerald-500/[0.08] dark:bg-emerald-500/[0.1] border-l-4 border-l-emerald-500 pl-3.5"
                          : "bg-white dark:bg-[#151719] hover:bg-slate-50 dark:hover:bg-[#1B1D20]/80"
                      }`}
                    >
                      {/* Left: Date */}
                      <div className="flex items-center gap-3 min-w-[180px]">
                        <div className={`p-2 rounded-xl ${isSelected ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-100 dark:bg-[#1B1D20] text-slate-400 dark:text-[#A1A1AA]"}`}>
                          <Calendar className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900 dark:text-[#F4F4F5]">
                            {pred.observation_date_formatted}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-[#71717A]">
                            {pred.confidence_label} · {pred.confidence_text}
                          </div>
                        </div>
                      </div>

                      {/* Middle: Predicted Yield */}
                      <div className="flex items-center gap-2 sm:gap-4">
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#71717A] block">
                            Predicted Yield
                          </span>
                          <span className="text-base font-black text-slate-900 dark:text-[#F4F4F5]">
                            {pred.predicted_milk_yield.toFixed(1)}{" "}
                            <span className="text-xs font-bold text-slate-500 dark:text-[#A1A1AA]">L/day</span>
                          </span>
                        </div>
                      </div>

                      {/* Right: Selection Action */}
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {isSelected ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-3 py-1 text-xs font-bold">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Selected Explanation
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-[#A1A1AA] hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                            View Explanation <ArrowRight className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Load More Toggle */}
              {hasMorePredictions && (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setShowAllHistory(!showAllHistory)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-[#A1A1AA] hover:text-emerald-600 dark:hover:text-emerald-400 py-1.5 px-3 rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] transition shadow-sm"
                  >
                    {showAllHistory ? (
                      <>Show Recent 5 Only</>
                    ) : (
                      <>View More Prediction History ({cowPredictionHistory.length - 5} more) →</>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* STEP 3 & 4: EXPLANATION CONTENT DERIVED STRICTLY FROM selectedPredictionRecord */}
        {!selectedPredictionRecord ? (
          cowPredictionHistory.length === 0 ? null : (
            <div className="rounded-3xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] p-8 text-center text-slate-600 dark:text-[#A1A1AA] shadow-sm">
              <p className="text-base font-bold">Please select a prediction record above to view its AI decision factors.</p>
            </div>
          )
        ) : isExplainLoading ? (
          <div className="rounded-3xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] p-8 text-center text-slate-500 dark:text-[#A1A1AA] shadow-sm">
            Loading AI decision factors for 🐄 {selectedPredictionRecord.cow_name} ({selectedPredictionRecord.observation_date_formatted})...
          </div>
        ) : isError ? (
          <div className="rounded-3xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30 p-6 text-rose-800 dark:text-rose-300 shadow-sm">
            Error loading explainability: {(error as any)?.message || "Unknown error"}
          </div>
        ) : explainData ? (
          <div className="space-y-6">
            {/* Context Header Summary Bar - All derived from selectedPredictionRecord */}
            <div className="rounded-3xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#A1A1AA] block">
                  {t("explain.subject_cow", "Subject Cow")}
                </span>
                <span className="text-xl font-black text-slate-950 dark:text-[#F4F4F5]">
                  🐄 {selectedPredictionRecord.cow_name}
                </span>
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#A1A1AA] block">
                  {t("explain.observation_date", "Observation Date")}
                </span>
                <span className="text-sm font-bold text-slate-800 dark:text-[#F4F4F5]">
                  {selectedPredictionRecord.observation_date_formatted}
                </span>
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#A1A1AA] block">
                  {t("explain.predicted_yield", "Predicted Yield")}
                </span>
                <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                  {selectedPredictionRecord.predicted_milk_yield.toFixed(1)} L/day
                </span>
              </div>

              {(selectedPredictionRecord.model_version || explainData.model_version) && (
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#A1A1AA] block">
                    {t("explain.model_engine", "Model Engine")}
                  </span>
                  <span className="text-xs font-mono text-slate-600 dark:text-[#A1A1AA]">
                    {selectedPredictionRecord.model_version || explainData.model_version}
                  </span>
                </div>
              )}
            </div>

            {/* 1. WHY THIS PREDICTION? (Headline Summary Narrative) */}
            <div className="rounded-3xl border border-sky-100 dark:border-sky-900/50 bg-gradient-to-br from-sky-50 via-white to-sky-50/40 dark:from-[#151719] dark:via-[#1B1D20] dark:to-[#151719] p-6 shadow-sm space-y-2">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-sky-800 dark:text-sky-300">
                <HelpCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>{t("explain.why_prediction", "Why This Prediction?")}</span>
              </div>
              <p className="text-lg font-bold text-slate-900 dark:text-[#F4F4F5] leading-snug">
                {explainData.summary_narrative || "Prediction matches expected production baseline."}
              </p>
            </div>

            {/* 2. MAIN DRIVERS */}
            <div className="space-y-3">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#A1A1AA] flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-slate-600 dark:text-[#A1A1AA]" />
                {t("explain.main_factors", "Main Factors Affecting Prediction")}
              </h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Positive Supporting Factors */}
                <div className="rounded-3xl border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-500/[0.08] p-5 space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <span>🟢 {t("explain.supporting", "Supporting Production")}</span>
                  </div>

                  {mainPositiveDrivers.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-[#A1A1AA] italic">
                      No strong positive yield boosts identified for this observation.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {mainPositiveDrivers.map((driver, idx) => (
                        <div key={idx} className="rounded-2xl border border-emerald-200/60 dark:border-emerald-900/50 bg-white dark:bg-[#151719] p-3.5 shadow-sm text-xs">
                          <div className="font-bold text-slate-900 dark:text-[#F4F4F5] flex justify-between">
                            <span>{driver.display_name}</span>
                            <span className="text-emerald-700 dark:text-emerald-400 font-black">
                              +{Math.abs(driver.shap_value).toFixed(2)} L/day
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-[#A1A1AA] mt-1">
                            Model-estimated contribution: +{Math.abs(driver.shap_value).toFixed(2)} L/day relative to baseline
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Negative Lowering Factors */}
                <div className="rounded-3xl border border-rose-100 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 p-5 space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                    <span>🔴 {t("explain.lowering", "Lowering Production")}</span>
                  </div>

                  {mainNegativeDrivers.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-[#A1A1AA] italic">
                      No significant environmental or feed yield penalties detected.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {mainNegativeDrivers.map((driver, idx) => (
                        <div key={idx} className="rounded-2xl border border-rose-200/60 dark:border-rose-900/50 bg-white dark:bg-[#151719] p-3.5 shadow-sm text-xs">
                          <div className="font-bold text-slate-900 dark:text-[#F4F4F5] flex justify-between">
                            <span>{driver.display_name}</span>
                            <span className="text-rose-700 dark:text-rose-400 font-black">
                              -{Math.abs(driver.shap_value).toFixed(2)} L/day
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-[#A1A1AA] mt-1">
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
            <div className="rounded-3xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/80 dark:bg-emerald-500/10 p-6 shadow-sm space-y-2">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
                <Compass className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                <span>{t("explain.recommended_action", "Recommended Management Action")}</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-700 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm font-bold text-slate-900 dark:text-[#F4F4F5] leading-relaxed">
                  {explainData.actionable_advice ||
                    "Production is currently within the model's expected range. Continue monitoring feed, health, and environmental conditions."}
                </p>
              </div>
            </div>

            {/* 4. TECHNICAL EXPLANATION (Collapsible Expander) */}
            <div className="rounded-3xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setShowTechnical(!showTechnical)}
                className="w-full p-5 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-[#1B1D20] transition"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-800 dark:text-[#F4F4F5]">
                    🔬 {t("explain.tech_exp", "Optional Technical Explanation (SHAP Attribution Waterfall)")}
                  </span>
                  <span className="rounded-full bg-slate-100 dark:bg-[#1B1D20] px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:text-[#A1A1AA]">
                    {t("explain.advanced_detail", "Advanced Detail")}
                  </span>
                </div>
                <ChevronDown className={`h-4 w-4 text-slate-500 dark:text-[#A1A1AA] transition-transform ${showTechnical ? "rotate-180" : ""}`} />
              </button>

              {showTechnical && (
                <div className="p-6 border-t border-slate-100 dark:border-[#27272A] space-y-6">
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-2 space-y-4">
                      <div className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] p-4">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-[#F4F4F5] mb-1">
                          SHAP Feature Contribution Waterfall
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-[#A1A1AA] mb-4">
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
