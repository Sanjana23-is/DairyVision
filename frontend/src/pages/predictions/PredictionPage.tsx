import { useMemo, useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/layouts/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { fetchObservations, type Observation } from "@/services/observation";
import { fetchCows, Cow } from "@/services/cow";
import {
  createPredictionForObservation,
  fetchCowBaseline,
  type MilkPrediction,
  type CowBaselineSummary,
} from "@/services/prediction";
import {
  fetchExplainabilityByPrediction,
  type ExplainabilityResponse,
} from "@/services/explainability";
import {
  Sparkles,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  Clock,
  ChevronDown,
  Info,
  Milk,
  TrendingUp,
  RotateCcw,
  Loader2,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { useLanguage } from "@/context/LanguageContext";
import { getFarmerFeatureLabel } from "@/utils/featureTranslator";
import ObservationSelector from "@/components/predictions/ObservationSelector";

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

// Custom Glassmorphism Tooltip for Production History Chart
function HistoryChartTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  const actualItem = payload.find((p: any) => p.dataKey === "actual");
  const actualVal =
    actualItem?.value !== undefined && actualItem?.value !== null
      ? Number(actualItem.value)
      : null;

  const baselineItem = payload.find((p: any) => p.dataKey === "baseline");
  const baselineVal =
    baselineItem?.value !== undefined && baselineItem?.value !== null
      ? Number(baselineItem.value)
      : null;

  const diff =
    actualVal !== null && baselineVal !== null ? actualVal - baselineVal : null;

  return (
    <div className="rounded-xl border border-slate-200/90 dark:border-[#27272A] bg-white/95 dark:bg-[#151719]/95 p-3 shadow-xl backdrop-blur-md text-xs text-slate-800 dark:text-[#F4F4F5] space-y-1.5 min-w-[170px] select-none">
      <div className="font-bold text-slate-900 dark:text-[#F4F4F5] border-b border-slate-100 dark:border-[#27272A] pb-1 flex items-center justify-between">
        <span>{label}</span>
        <span className="text-[10px] text-slate-400 dark:text-[#71717A] font-normal">
          Recorded Daily Output
        </span>
      </div>

      {actualVal !== null ? (
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-slate-600 dark:text-[#A1A1AA] font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-600 inline-block" />
            Actual Milk:
          </span>
          <span className="font-bold text-slate-950 dark:text-[#F4F4F5]">
            {actualVal.toFixed(1)} L
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between text-slate-400 dark:text-[#71717A]">
          <span>Actual Milk:</span>
          <span className="italic">Not recorded</span>
        </div>
      )}

      {baselineVal !== null && (
        <div className="flex items-center justify-between gap-3 text-[11px]">
          <span className="flex items-center gap-1.5 text-slate-500 dark:text-[#71717A] font-medium">
            <span className="h-2 w-2 rounded-full bg-sky-500 inline-block" />
            Baseline Target:
          </span>
          <span className="font-semibold text-sky-700 dark:text-sky-400">
            {baselineVal.toFixed(1)} L
          </span>
        </div>
      )}

      {diff !== null && (
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-[#27272A] pt-1 text-[11px]">
          <span className="text-slate-500 dark:text-[#71717A] font-medium">
            Variance:
          </span>
          <span
            className={`font-bold ${
              diff >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {diff >= 0 ? `+${diff.toFixed(1)} L` : `${diff.toFixed(1)} L`}
          </span>
        </div>
      )}
    </div>
  );
}

export default function PredictionPage() {
  const qc = useQueryClient();
  const { currentFarmId } = useAuth();
  const { t } = useLanguage();

  // 1. Data queries
  const {
    data: observations = [],
    isLoading: isObsLoading,
    isError: isObsError,
  } = useQuery({
    queryKey: ["observations", currentFarmId],
    queryFn: () => fetchObservations(currentFarmId as string),
    enabled: !!currentFarmId,
  });

  const {
    data: cows = [],
    isLoading: isCowsLoading,
  } = useQuery<Cow[], Error>({
    queryKey: ["cows", currentFarmId],
    queryFn: () => fetchCows(currentFarmId as string),
    enabled: !!currentFarmId,
  });

  const cowNameById = useMemo(() => {
    const map = new Map<string, string>();
    cows.forEach((cow) =>
      map.set(cow.id, cow.name || cow.tag_id || "Unknown cow"),
    );
    return map;
  }, [cows]);

  const cowName = (id: string) => cowNameById.get(id) ?? "Unknown cow";

  // 2. Component selection state
  const [selectedCowId, setSelectedCowId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [latestPrediction, setLatestPrediction] =
    useState<MilkPrediction | null>(null);
  const isGeneratingRef = useRef(false);

  // History filtering state
  const [historyPreset, setHistoryPreset] = useState<
    "7" | "14" | "30" | "all"
  >("7");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // 3. Observation maps and cow-specific deduplicated observations
  const obsMap = useMemo(() => {
    const map = new Map<string, Observation>();
    observations.forEach((o: Observation) => map.set(o.id, o));
    return map;
  }, [observations]);

  // Observations belonging specifically to the selected cow, deduplicated per date
  const cowObservations = useMemo(() => {
    if (!selectedCowId) return [];
    const list = observations.filter((o: Observation) => o.cow_id === selectedCowId);
    // Sort descending by date, prioritizing latest entry
    list.sort((a: Observation, b: Observation) => {
      const cmp =
        new Date(b.observation_date).getTime() -
        new Date(a.observation_date).getTime();
      if (cmp !== 0) return cmp;
      return (b.created_at || "").localeCompare(a.created_at || "");
    });
    // Deduplicate: keep latest observation per calendar date
    const seenDates = new Set<string>();
    const deduped: Observation[] = [];
    for (const obs of list) {
      if (!seenDates.has(obs.observation_date)) {
        seenDates.add(obs.observation_date);
        deduped.push(obs);
      }
    }
    return deduped;
  }, [observations, selectedCowId]);

  // 4. Cow baseline and today's observation query
  const {
    data: baselineSummary,
    isLoading: isBaselineLoading,
    isError: isBaselineError,
    error: baselineError,
    refetch: refetchBaseline,
  } = useQuery<CowBaselineSummary, Error>({
    queryKey: ["cowBaseline", selectedCowId],
    queryFn: () => fetchCowBaseline(selectedCowId!),
    enabled: !!selectedCowId && cowObservations.length > 0,
  });

  // Available observations to choose from in dropdown
  const availableObservations = useMemo(() => {
    if (selectedCowId) return cowObservations;
    return observations;
  }, [selectedCowId, cowObservations, observations]);

  // Sync selected observation when a cow is chosen or observations finish loading
  useEffect(() => {
    if (isObsLoading) return;
    if (selectedCowId && cowObservations.length > 0) {
      if (!selected || !cowObservations.some((o) => o.id === selected)) {
        mutation.reset();
        isGeneratingRef.current = false;
        setLatestPrediction(null);
        qc.removeQueries({ queryKey: ["explainabilityData"] });
        setSelected(cowObservations[0].id);
      }
    } else if (selectedCowId && cowObservations.length === 0) {
      mutation.reset();
      isGeneratingRef.current = false;
      setLatestPrediction(null);
      qc.removeQueries({ queryKey: ["explainabilityData"] });
      setSelected(null);
    }
  }, [selectedCowId, cowObservations, selected, isObsLoading, qc]);

  // Cow selection handler: resets all previous cow state immediately
  const handleCowSelect = (cowId: string) => {
    mutation.reset();
    isGeneratingRef.current = false;
    setLatestPrediction(null);
    qc.removeQueries({ queryKey: ["explainabilityData"] });
    if (!cowId) {
      setSelectedCowId(null);
      setSelected(null);
      setCustomStartDate("");
      setCustomEndDate("");
      return;
    }
    setSelectedCowId(cowId);
    setSelected(null);
    setCustomStartDate("");
    setCustomEndDate("");
  };

  // Observation selection handler: clears prediction for prior selection
  const handleObservationSelect = (obsId: string) => {
    mutation.reset();
    isGeneratingRef.current = false;
    setLatestPrediction(null);
    qc.removeQueries({ queryKey: ["explainabilityData"] });
    setSelected(obsId);
    const obs = obsMap.get(obsId);
    if (obs && obs.cow_id && obs.cow_id !== selectedCowId) {
      setSelectedCowId(obs.cow_id);
    }
  };

  // 5. Prediction mutation
  const mutation = useMutation<MilkPrediction, any, string>({
    mutationFn: (obsId: string) => createPredictionForObservation(obsId),
    onSettled: () => {
      isGeneratingRef.current = false;
    },
    onSuccess: (data, variables) => {
      // Discard stale asynchronous responses from an earlier selection
      if (variables !== selected || data.cow_id !== selectedCowId) {
        return;
      }
      qc.invalidateQueries({ queryKey: ["cowBaseline", selectedCowId] });
      setLatestPrediction(data);
      setToast({
        type: "success",
        message: "Prediction generated successfully.",
      });
    },
    onError: (err) => {
      setLatestPrediction(null);
      qc.removeQueries({ queryKey: ["explainabilityData"] });
      const detail =
        err?.response?.data?.detail ||
        err?.message ||
        "Unable to generate prediction.";
      const message =
        typeof detail === "string" ? detail : JSON.stringify(detail);
      setToast({
        type: "error",
        message,
      });
    },
  });

  const generate = (obsId: string) => {
    if (isGeneratingRef.current || mutation.isPending) return; // Prevent duplicate submissions synchronously
    isGeneratingRef.current = true;
    setLatestPrediction(null);
    qc.removeQueries({ queryKey: ["explainabilityData"] });
    if (!currentFarmId) {
      isGeneratingRef.current = false;
      setToast({
        type: "error",
        message: "Select a farm before generating predictions.",
      });
      return;
    }
    mutation.mutate(obsId);
  };

  const clearToast = () => setToast(null);

  // Active prediction must strictly match the current selected observation AND current cow, and must be explicitly generated
  const activePrediction = useMemo(() => {
    if (!selected || !selectedCowId || !latestPrediction) return null;
    if (
      latestPrediction.observation_id === selected &&
      latestPrediction.cow_id === selectedCowId
    ) {
      return latestPrediction;
    }
    return null;
  }, [selected, selectedCowId, latestPrediction]);

  const selectedObs = selected ? obsMap.get(selected) : null;
  const activeCow = cows.find((c) => c.id === selectedCowId);
  const activeCowName = activeCow
    ? activeCow.name || activeCow.tag_id || `Cow ${activeCow.id.slice(0, 6)}`
    : selectedCowId
      ? cowName(selectedCowId)
      : undefined;

  const isInsufficientHistory =
    baselineSummary?.baseline_status === "insufficient_history" ||
    activePrediction?.baseline_status === "insufficient_history";

  const isProvisionalBaseline =
    baselineSummary?.baseline_status === "provisional_baseline" ||
    activePrediction?.baseline_status === "provisional_baseline";

  // 6. Production History Filtering & Trend Chart Points
  const filteredHistory = useMemo(() => {
    let list = [...cowObservations];
    if (customStartDate) {
      list = list.filter((o) => o.observation_date >= customStartDate);
    }
    if (customEndDate) {
      list = list.filter((o) => o.observation_date <= customEndDate);
    }
    if (!customStartDate && !customEndDate) {
      if (historyPreset === "7") {
        list = list.slice(0, 7);
      } else if (historyPreset === "14") {
        list = list.slice(0, 14);
      } else if (historyPreset === "30") {
        list = list.slice(0, 30);
      }
    }
    return list;
  }, [cowObservations, historyPreset, customStartDate, customEndDate]);

  // Points for trend chart (ordered chronologically)
  const chartPoints = useMemo(() => {
    const chronological = [...filteredHistory].reverse();
    return chronological.map((obs) => ({
      date: obs.observation_date,
      label: formatDate(obs.observation_date),
      actual:
        obs.milk_produced_liters != null
          ? Number(obs.milk_produced_liters)
          : null,
      baseline: baselineSummary?.expected_baseline ?? null,
    }));
  }, [filteredHistory, baselineSummary]);

  // 7. Explainability query for active prediction
  const { data: explainData } = useQuery<ExplainabilityResponse>({
    queryKey: ["explainabilityData", activePrediction?.id],
    queryFn: () => fetchExplainabilityByPrediction(activePrediction!.id),
    enabled: !!activePrediction?.id && !isInsufficientHistory,
    staleTime: 1000 * 60,
  });

  const displayPositives = useMemo(() => {
    if (!explainData || isInsufficientHistory) return [];
    if (explainData.top_positive && explainData.top_positive.length > 0) {
      return explainData.top_positive
        .filter((f) => (f.shap_value ?? 0) > 0.005)
        .map((f) => ({
          name: getFarmerFeatureLabel(f.feature, f.display_name),
          featureKey: f.feature,
          value: f.value_formatted,
          shap: f.shap_value,
        }));
    }
    if (explainData.features && explainData.features.length > 0) {
      const pos = explainData.features
        .filter((f) => (f.shap_value ?? 0) > 0.005)
        .sort((a, b) => (b.shap_value ?? 0) - (a.shap_value ?? 0));
      if (pos.length > 0) {
        return pos.map((f) => ({
          name: getFarmerFeatureLabel(f.feature, f.display_name),
          featureKey: f.feature,
          value: f.value_formatted,
          shap: f.shap_value,
        }));
      }
    }
    return [];
  }, [explainData, isInsufficientHistory]);

  const displayNegatives = useMemo(() => {
    if (!explainData || isInsufficientHistory) return [];
    if (explainData.top_negative && explainData.top_negative.length > 0) {
      return explainData.top_negative
        .filter((f) => (f.shap_value ?? 0) < -0.005)
        .map((f) => ({
          name: getFarmerFeatureLabel(f.feature, f.display_name),
          featureKey: f.feature,
          value: f.value_formatted,
          shap: f.shap_value,
        }));
    }
    if (explainData.features && explainData.features.length > 0) {
      const neg = explainData.features
        .filter((f) => (f.shap_value ?? 0) < 0)
        .sort(
          (a, b) => Math.abs(b.shap_value ?? 0) - Math.abs(a.shap_value ?? 0),
        );
      if (neg.length > 0) {
        return neg.map((f) => ({
          name: getFarmerFeatureLabel(f.feature, f.display_name),
          featureKey: f.feature,
          value: f.value_formatted,
          shap: f.shap_value,
        }));
      }
    }
    return [];
  }, [explainData, isInsufficientHistory]);

  const maxImpact = useMemo(() => {
    const allVals = [
      ...displayPositives.map((p) => Math.abs(p.shap)),
      ...displayNegatives.map((n) => Math.abs(n.shap)),
    ];
    return Math.max(...allVals, 1);
  }, [displayPositives, displayNegatives]);

  const aiInsightMessage = useMemo(() => {
    if (!activePrediction || isInsufficientHistory) return null;
    if (explainData?.summary_narrative) {
      return explainData.summary_narrative;
    }
    if (
      displayNegatives.length > 0 &&
      Math.abs(displayNegatives[0].shap) > 0.8
    ) {
      return `${displayNegatives[0].name} conditions are currently the strongest factor reducing predicted milk yield by approximately ${Math.abs(displayNegatives[0].shap).toFixed(1)} L/day.`;
    }
    if (displayPositives.length > 0) {
      return `${displayPositives[0].name} and metabolic intake are currently the primary positive drivers supporting forecast.`;
    }
    if (isProvisionalBaseline) {
      return "Preliminary feature attribution derived from initial observation parameters. Additional daily logs will calibrate feature impact precision.";
    }
    return null;
  }, [
    activePrediction,
    isInsufficientHistory,
    explainData,
    displayNegatives,
    displayPositives,
    isProvisionalBaseline,
  ]);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-5 select-none font-sans pb-10">
        {/* 1. PAGE HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-[#F4F4F5] tracking-tight flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              {t("pred.title", "Milk Production AI Prediction")}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-[#A1A1AA] mt-0.5">
              {t(
                "pred.subtitle",
                "Cow-first herd monitoring, expected baseline comparison, and anomaly detection.",
              )}
            </p>
          </div>
          <Link
            to="/predictions/history"
            className="inline-flex items-center gap-1.5 self-start sm:self-auto text-xs font-semibold text-slate-600 dark:text-[#A1A1AA] hover:text-emerald-600 dark:hover:text-emerald-400 transition"
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Prediction History</span>
          </Link>
        </div>

        {/* Toast Feedback Alert */}
        {toast && (
          <div
            className={`rounded-xl border p-3.5 text-xs font-semibold flex items-center justify-between shadow-xs transition-all ${
              toast.type === "success"
                ? "border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/90 dark:bg-emerald-500/10 text-emerald-900 dark:text-emerald-300"
                : "border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === "success" ? (
                <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              )}
              <span>{toast.message}</span>
            </div>
            <div className="flex items-center gap-2">
              {toast.type === "error" && selected && (
                <button
                  type="button"
                  data-testid="prediction-retry-button"
                  onClick={() => generate(selected)}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold transition cursor-pointer"
                >
                  Retry
                </button>
              )}
              <button
                onClick={clearToast}
                className="text-xs opacity-70 hover:opacity-100 font-bold ml-2 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* 2. COW-FIRST SELECTION BAR */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-[#27272A] bg-white dark:bg-[#151719] p-4 sm:p-5 shadow-xs transition-all">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
            {/* Primary Cow Selector */}
            <div className="md:col-span-5 space-y-1.5">
              <label
                htmlFor="cow-selector"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-[#A1A1AA]"
              >
                {t("pred.select_cow", "Select Cow")}
              </label>
              <div className="relative">
                <select
                  id="cow-selector"
                  data-testid="cow-selector"
                  value={selectedCowId || ""}
                  onChange={(e) => handleCowSelect(e.target.value)}
                  disabled={mutation.isPending || isCowsLoading}
                  className="w-full h-11 px-3.5 pr-8 rounded-xl border border-slate-200 dark:border-[#27272A] bg-slate-50/70 dark:bg-[#1B1D20] text-xs sm:text-sm font-semibold text-slate-900 dark:text-[#F4F4F5] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer appearance-none transition"
                >
                  <option value="">
                    {cows.length === 0
                      ? t("pred.no_cows_registered", "No cows registered")
                      : t("pred.all_cows_or_select", "Select a cow...")}
                  </option>
                  {cows.map((c) => (
                    <option
                      key={c.id}
                      value={c.id}
                      className="dark:bg-[#1B1D20]"
                    >
                      🐄 {c.name || c.tag_id || `Cow ${c.id.slice(0, 6)}`}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-[#A1A1AA]" />
              </div>
            </div>

            {/* Scoped Observation Selector */}
            <div className="md:col-span-4 space-y-1.5">
              <label
                id="observation-selector-label"
                htmlFor="observation-selector-trigger"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-[#A1A1AA]"
              >
                {t("pred.select_observation", "Select Daily Observation")}
              </label>
              <ObservationSelector
                observations={availableObservations}
                selectedId={selected}
                onSelect={handleObservationSelect}
                isLoading={isObsLoading}
                isError={isObsError}
                cowName={cowName}
                disabled={mutation.isPending}
              />
            </div>

            {/* Generate Action Button */}
            <div className="md:col-span-3">
              <button
                type="button"
                data-testid="generate-prediction-button"
                disabled={!selected || mutation.isPending}
                onClick={() => selected && generate(selected)}
                className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 px-4 text-xs sm:text-sm font-bold text-white shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="h-4 w-4" />
                <span>
                  {mutation.isPending
                    ? t("pred.generating", "Generating...")
                    : t("pred.generate", "Generate Prediction")}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* 3. CONDITIONAL MAIN CONTENT AREA */}
        {!selectedCowId && !selected ? (
          /* STATE 1: No Cow and No Observation Selected */
          <div
            data-testid="no-cow-selected-state"
            className="rounded-2xl border border-slate-200/90 dark:border-[#27272A] bg-white dark:bg-[#151719] p-10 text-center shadow-xs space-y-2"
          >
            <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-[#F4F4F5]">
              {t("pred.no_cow_selected_title", "No Cow Selected")}
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#A1A1AA] max-w-md mx-auto">
              {t(
                "pred.no_cow_selected_desc",
                "Please select a cow from your herd above to view today's milk production, compare against historical baselines, and inspect production history.",
              )}
            </p>
          </div>
        ) : isObsLoading ? (
          <div className="rounded-2xl border border-slate-200/90 dark:border-[#27272A] bg-white dark:bg-[#151719] p-12 text-center shadow-xs flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          </div>
        ) : selectedCowId && cowObservations.length === 0 ? (
          /* STATE 2: Cow selected, but has zero observations */
          <div
            data-testid="no-historical-observations-state"
            className="rounded-2xl border border-slate-200/90 dark:border-[#27272A] bg-white dark:bg-[#151719] p-10 text-center shadow-xs space-y-3"
          >
            <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-[#F4F4F5]">
                No Historical Observations for {activeCowName || "Selected Cow"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#A1A1AA] max-w-md mx-auto mt-1">
                This cow has no valid historical milk observations recorded yet.
                Baseline calculations and anomaly detection require prior daily
                milk records.
              </p>
            </div>
            <div className="pt-2">
              <Link
                to={`/observations/new?cowId=${selectedCowId}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs transition"
              >
                <span>Log Daily Observation</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        ) : isBaselineLoading ? (
          /* STATE: Loading Cow Baseline */
          <div
            data-testid="prediction-loading-state"
            className="rounded-2xl border border-slate-200/90 dark:border-[#27272A] bg-white dark:bg-[#151719] p-12 text-center shadow-xs space-y-3"
          >
            <Loader2 className="mx-auto h-8 w-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
            <p className="text-xs font-semibold text-slate-600 dark:text-[#A1A1AA]">
              Loading baseline and production insights for {activeCowName}...
            </p>
          </div>
        ) : isBaselineError ? (
          /* STATE: API Error */
          <div
            data-testid="prediction-error-state"
            className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/20 p-8 text-center shadow-xs space-y-3"
          >
            <AlertCircle className="mx-auto h-7 w-7 text-rose-600 dark:text-rose-400" />
            <h3 className="text-base font-bold text-rose-900 dark:text-rose-200">
              Failed to load baseline data
            </h3>
            <p className="text-xs text-rose-700 dark:text-rose-300 max-w-md mx-auto">
              {baselineError?.message ||
                "An unexpected error occurred while communicating with the baseline service."}
            </p>
            <button
              onClick={() => refetchBaseline()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-bold text-white transition"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Retry</span>
            </button>
          </div>
        ) : (
          /* STATE 3: Cow selected and observations exist -> Show Hero Insights & History */
          <div className="space-y-6">
            {/* HERO INSIGHT: TODAY'S PRODUCTION & HISTORICAL BASELINE COMPARISON */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-[#27272A] pb-2">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#F4F4F5] flex items-center gap-2">
                    <Milk className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    <span>Daily Milk Production & Baseline Comparison</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-[#A1A1AA]">
                    Target Date:{" "}
                    <strong className="text-slate-800 dark:text-[#F4F4F5]">
                      {formatDate(baselineSummary?.target_date)}
                    </strong>{" "}
                    • Evaluation for{" "}
                    <strong className="text-slate-800 dark:text-[#F4F4F5]">
                      {activeCowName}
                    </strong>
                  </p>
                </div>
              </div>

              {/* THREE METRIC HERO TILES: Expected Baseline, Actual Recorded, Deviation & Status */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Tile 1: Expected Daily Baseline */}
                <div
                  data-testid="expected-baseline-tile"
                  className="rounded-2xl border border-slate-200/90 dark:border-[#27272A] bg-gradient-to-br from-white via-slate-50/40 to-emerald-50/20 dark:from-[#151719] dark:via-[#1B1D20] dark:to-[#151719] p-5 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-[#A1A1AA]">
                        EXPECTED DAILY BASELINE
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isInsufficientHistory
                            ? "text-slate-600 dark:text-[#A1A1AA] bg-slate-100 dark:bg-[#1B1D20] border-slate-200 dark:border-[#27272A]"
                            : isProvisionalBaseline
                              ? "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20"
                              : "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200/80 dark:border-emerald-500/20"
                        }`}
                      >
                        {isInsufficientHistory
                          ? "Insufficient History"
                          : isProvisionalBaseline
                            ? "Provisional Baseline"
                            : "Prior < Date"}
                      </span>
                    </div>

                    {isInsufficientHistory ||
                    baselineSummary?.expected_baseline == null ? (
                      <div className="my-3">
                        <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-400 dark:text-[#71717A]">
                          Unavailable
                        </span>
                        <p className="text-xs font-semibold text-slate-400 dark:text-[#71717A] mt-1">
                          Requires &ge;2 prior records
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-2 my-3">
                        <span className="text-4xl sm:text-5xl font-black tracking-tight text-slate-950 dark:text-[#F4F4F5]">
                          {baselineSummary.expected_baseline.toFixed(2)}
                        </span>
                        <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                          L
                        </span>
                        <span className="text-xs font-semibold text-slate-400 dark:text-[#A1A1AA]">
                          /day
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-[#27272A] text-xs text-slate-500 dark:text-[#A1A1AA]">
                    {isInsufficientHistory ? (
                      <span className="text-slate-500 dark:text-slate-400 font-medium">
                        At least 2–3 prior daily logs are required for baseline
                        calculation.
                      </span>
                    ) : isProvisionalBaseline ? (
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        Provisional baseline (
                        {baselineSummary?.observations_used ?? 1} prior record
                        {baselineSummary?.observations_used === 1 ? "" : "s"}
                        ). More observations required for reliable assessment.
                      </span>
                    ) : baselineSummary?.baseline_status ===
                      "established_baseline" ? (
                      <span>
                        7-day rolling median (±
                        {(
                          baselineSummary.historical_variability ?? 0.5
                        ).toFixed(2)}{" "}
                        L/day MAD)
                      </span>
                    ) : (
                      <span>Conditioned baseline from prior history</span>
                    )}
                  </div>
                </div>

                {/* Tile 2: Recorded Yield on Target Date */}
                <div
                  data-testid="recorded-actual-yield-tile"
                  className="rounded-2xl border border-slate-200/90 dark:border-[#27272A] bg-white dark:bg-[#151719] p-5 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-[#A1A1AA]">
                        RECORDED ACTUAL YIELD
                      </span>
                      <span className="text-[10px] font-semibold text-slate-600 dark:text-[#A1A1AA] bg-slate-100 dark:bg-[#1B1D20] px-2 py-0.5 rounded-full">
                        {formatDate(baselineSummary?.target_date)}
                      </span>
                    </div>

                    <div className="my-3">
                      {baselineSummary?.has_today_observation &&
                      baselineSummary.actual_yield != null ? (
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-[#F4F4F5]">
                            {baselineSummary.actual_yield.toFixed(2)}
                          </span>
                          <span className="text-xl font-bold text-slate-500 dark:text-slate-400">
                            L
                          </span>
                          <span className="text-xs font-semibold text-slate-400 dark:text-[#A1A1AA]">
                            /day
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <span className="text-lg sm:text-xl font-bold text-amber-600 dark:text-amber-400 block">
                            Today's record is not available.
                          </span>
                          <p className="text-xs text-slate-500 dark:text-[#A1A1AA]">
                            No milk observation recorded for today yet.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-[#27272A] flex items-center justify-between text-xs text-slate-500 dark:text-[#A1A1AA]">
                    {baselineSummary?.has_today_observation ? (
                      <>
                        <span>Cow:</span>
                        <span className="font-bold text-slate-800 dark:text-[#F4F4F5]">
                          {activeCowName}
                        </span>
                      </>
                    ) : (
                      <Link
                        to={`/observations/new?cowId=${selectedCowId}`}
                        className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        <span>Log Today's Production</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                </div>

                {/* Tile 3: Deviation & Anomaly Status */}
                <div
                  data-testid="anomaly-status-tile"
                  className="rounded-2xl border border-slate-200/90 dark:border-[#27272A] bg-white dark:bg-[#151719] p-5 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-[#A1A1AA]">
                        ANOMALY STATUS
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          !baselineSummary?.has_today_observation
                            ? "bg-slate-100 dark:bg-[#1B1D20] border-slate-300 dark:border-[#27272A] text-slate-600 dark:text-[#A1A1AA]"
                            : baselineSummary.anomaly_status === "normal"
                              ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                              : baselineSummary.anomaly_status === "monitor"
                                ? "bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30 text-amber-800 dark:text-amber-400"
                                : baselineSummary.anomaly_status ===
                                    "unusual_drop"
                                  ? "bg-rose-50 dark:bg-rose-500/15 border-rose-300 dark:border-rose-500/30 text-rose-700 dark:text-rose-400"
                                  : baselineSummary.anomaly_status ===
                                      "persistent_drop"
                                    ? "bg-purple-50 dark:bg-purple-500/15 border-purple-300 dark:border-purple-500/30 text-purple-700 dark:text-purple-300"
                                    : "bg-slate-100 dark:bg-[#1B1D20] border-slate-300 dark:border-[#27272A] text-slate-600 dark:text-[#A1A1AA]"
                        }`}
                      >
                        {!baselineSummary?.has_today_observation
                          ? "Pending Today's Record"
                          : baselineSummary.anomaly_status === "normal"
                            ? "Normal Production"
                            : baselineSummary.anomaly_status === "monitor"
                              ? "Moderate Deviation"
                              : baselineSummary.anomaly_status ===
                                  "unusual_drop"
                                ? "Unusual Drop"
                                : baselineSummary.anomaly_status ===
                                    "persistent_drop"
                                  ? "Persistent Drop (2+ days)"
                                  : baselineSummary.anomaly_status ===
                                      "provisional_baseline"
                                    ? "Provisional Baseline"
                                    : baselineSummary.anomaly_status ===
                                        "insufficient_history"
                                      ? "Insufficient History"
                                      : "Monitored"}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-2 my-3">
                      {!baselineSummary?.has_today_observation ? (
                        <div className="space-y-0.5">
                          <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-400 dark:text-[#71717A]">
                            Awaiting Yield
                          </span>
                        </div>
                      ) : isInsufficientHistory ? (
                        <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-400 dark:text-[#71717A]">
                          Pending Baseline
                        </span>
                      ) : baselineSummary?.drop_liters != null ? (
                        <>
                          <span
                            className={`text-4xl sm:text-5xl font-black tracking-tight ${
                              baselineSummary.drop_liters > 1.5
                                ? "text-rose-600 dark:text-rose-400"
                                : baselineSummary.drop_liters > 0.5
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            {baselineSummary.drop_liters > 0
                              ? `-${baselineSummary.drop_liters.toFixed(2)}`
                              : `+${Math.abs(baselineSummary.drop_liters).toFixed(2)}`}
                          </span>
                          <span className="text-xl font-bold text-slate-500 dark:text-slate-400">
                            L
                          </span>
                          <span className="text-xs font-semibold text-slate-500 dark:text-[#A1A1AA]">
                            (
                            {baselineSummary.drop_percentage != null
                              ? `${baselineSummary.drop_percentage > 0 ? "-" : "+"}${Math.abs(
                                  baselineSummary.drop_percentage,
                                ).toFixed(1)}%`
                              : "—"}
                            )
                          </span>
                        </>
                      ) : (
                        <span className="text-2xl font-bold text-slate-400">
                          Baseline Pending
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-[#27272A] text-xs text-slate-500 dark:text-[#A1A1AA]">
                    {!baselineSummary?.has_today_observation
                      ? "Deviation will compute once today's record is logged."
                      : isInsufficientHistory
                        ? "Anomaly assessment requires prior baseline data."
                        : baselineSummary.drop_liters != null &&
                            baselineSummary.drop_liters > 0
                          ? `${baselineSummary.drop_liters.toFixed(2)} L below expected daily baseline`
                          : baselineSummary.drop_liters != null &&
                              baselineSummary.drop_liters < 0
                            ? `${Math.abs(baselineSummary.drop_liters).toFixed(2)} L above expected daily baseline`
                            : "Within expected statistical tolerance"}
                  </div>
                </div>
              </div>

              {/* FARMER GUIDANCE & RECOMMENDED ACTION CARD */}
              {(baselineSummary?.alert_explanation ||
                baselineSummary?.recommended_action) && (
                <div
                  className={`rounded-2xl border p-5 shadow-xs transition-all ${
                    !baselineSummary?.has_today_observation ||
                    isInsufficientHistory
                      ? "border-slate-200 dark:border-[#27272A] bg-slate-50/70 dark:bg-[#1B1D20]/60 text-slate-800 dark:text-slate-200"
                      : isProvisionalBaseline
                        ? "border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200"
                        : baselineSummary?.anomaly_status === "unusual_drop" ||
                            baselineSummary?.anomaly_status ===
                              "persistent_drop"
                          ? "border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200"
                          : baselineSummary?.anomaly_status === "monitor"
                            ? "border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200"
                            : "border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      {!baselineSummary?.has_today_observation ||
                      isInsufficientHistory ? (
                        <Info className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                      ) : isProvisionalBaseline ? (
                        <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      ) : baselineSummary?.anomaly_status === "unusual_drop" ||
                        baselineSummary?.anomaly_status ===
                          "persistent_drop" ? (
                        <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                      ) : (
                        <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      )}
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wide">
                        {!baselineSummary?.has_today_observation
                          ? "Daily Log Pending"
                          : isInsufficientHistory
                            ? "Observation Logged: Baseline History Pending"
                            : isProvisionalBaseline
                              ? "Provisional Assessment: Limited Historical Records"
                              : baselineSummary?.anomaly_status ===
                                  "unusual_drop"
                                ? "Action Needed: Unusual Milk Production Drop"
                                : baselineSummary?.anomaly_status ===
                                    "persistent_drop"
                                  ? "Priority Review: Persistent Milk Production Drop"
                                  : baselineSummary?.anomaly_status ===
                                      "monitor"
                                    ? "Observation Notice: Moderate Deviation"
                                    : "Herd Monitoring Status"}
                      </h4>
                      <p className="text-xs sm:text-sm opacity-90 leading-relaxed">
                        {baselineSummary?.alert_explanation}
                      </p>
                      {baselineSummary?.recommended_action && (
                        <div className="mt-2 pt-2 border-t border-black/5 dark:border-white/10 text-xs font-semibold flex items-center gap-1.5">
                          <span className="font-bold underline">
                            Recommended next step:
                          </span>
                          <span>{baselineSummary.recommended_action}</span>
                        </div>
                      )}
                      <p className="text-[11px] opacity-70 italic pt-1">
                        Note: Anomaly alerts evaluate production trends against
                        historical baselines and do not replace a professional
                        veterinary examination.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 4. PRODUCTION HISTORY SECTION (Date-Range Filtering, Trend Chart & Observation Table) */}
            <div
              data-testid="production-history-section"
              className="rounded-2xl border border-slate-200/90 dark:border-[#27272A] bg-white dark:bg-[#151719] p-5 sm:p-6 shadow-xs space-y-5"
            >
              {/* Header & Filter Controls Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-[#27272A] pb-4">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#F4F4F5] flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    <span>Production History</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-[#A1A1AA] mt-0.5">
                    Historical daily yields and trend records for {activeCowName}.
                  </p>
                </div>

                {/* Filter Controls */}
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Preset Pills */}
                  <div className="flex items-center rounded-xl bg-slate-100/90 dark:bg-[#1B1D20] p-1 text-xs font-bold text-slate-600 dark:text-[#A1A1AA] border border-transparent dark:border-[#27272A]">
                    <button
                      type="button"
                      data-testid="history-range-7"
                      onClick={() => {
                        setHistoryPreset("7");
                        setCustomStartDate("");
                        setCustomEndDate("");
                      }}
                      className={`rounded-lg px-2.5 py-1 transition-all duration-150 cursor-pointer ${
                        historyPreset === "7" &&
                        !customStartDate &&
                        !customEndDate
                          ? "bg-white dark:bg-[#151719] text-slate-950 dark:text-[#F4F4F5] shadow-2xs font-bold"
                          : "text-slate-600 dark:text-[#A1A1AA] hover:text-slate-900 dark:hover:text-[#F4F4F5]"
                      }`}
                    >
                      7 Days
                    </button>
                    <button
                      type="button"
                      data-testid="history-range-14"
                      onClick={() => {
                        setHistoryPreset("14");
                        setCustomStartDate("");
                        setCustomEndDate("");
                      }}
                      className={`rounded-lg px-2.5 py-1 transition-all duration-150 cursor-pointer ${
                        historyPreset === "14" &&
                        !customStartDate &&
                        !customEndDate
                          ? "bg-white dark:bg-[#151719] text-slate-950 dark:text-[#F4F4F5] shadow-2xs font-bold"
                          : "text-slate-600 dark:text-[#A1A1AA] hover:text-slate-900 dark:hover:text-[#F4F4F5]"
                      }`}
                    >
                      14 Days
                    </button>
                    <button
                      type="button"
                      data-testid="history-range-30"
                      onClick={() => {
                        setHistoryPreset("30");
                        setCustomStartDate("");
                        setCustomEndDate("");
                      }}
                      className={`rounded-lg px-2.5 py-1 transition-all duration-150 cursor-pointer ${
                        historyPreset === "30" &&
                        !customStartDate &&
                        !customEndDate
                          ? "bg-white dark:bg-[#151719] text-slate-950 dark:text-[#F4F4F5] shadow-2xs font-bold"
                          : "text-slate-600 dark:text-[#A1A1AA] hover:text-slate-900 dark:hover:text-[#F4F4F5]"
                      }`}
                    >
                      30 Days
                    </button>
                    <button
                      type="button"
                      data-testid="history-range-all"
                      onClick={() => {
                        setHistoryPreset("all");
                        setCustomStartDate("");
                        setCustomEndDate("");
                      }}
                      className={`rounded-lg px-2.5 py-1 transition-all duration-150 cursor-pointer ${
                        historyPreset === "all" &&
                        !customStartDate &&
                        !customEndDate
                          ? "bg-white dark:bg-[#151719] text-slate-950 dark:text-[#F4F4F5] shadow-2xs font-bold"
                          : "text-slate-600 dark:text-[#A1A1AA] hover:text-slate-900 dark:hover:text-[#F4F4F5]"
                      }`}
                    >
                      All
                    </button>
                  </div>

                  {/* Date Pickers for Custom Range */}
                  <div className="flex items-center gap-1.5 text-xs">
                    <input
                      type="date"
                      aria-label="Start Date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="h-8 px-2 rounded-lg border border-slate-200 dark:border-[#27272A] bg-slate-50/70 dark:bg-[#1B1D20] text-xs font-semibold text-slate-800 dark:text-[#F4F4F5]"
                    />
                    <span className="text-slate-400">to</span>
                    <input
                      type="date"
                      aria-label="End Date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="h-8 px-2 rounded-lg border border-slate-200 dark:border-[#27272A] bg-slate-50/70 dark:bg-[#1B1D20] text-xs font-semibold text-slate-800 dark:text-[#F4F4F5]"
                    />
                    {(customStartDate || customEndDate) && (
                      <button
                        type="button"
                        onClick={() => {
                          setCustomStartDate("");
                          setCustomEndDate("");
                        }}
                        className="text-xs font-semibold text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 p-1"
                        title="Clear custom date filter"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Visual Production Trend Chart */}
              {filteredHistory.length === 0 ? (
                <div
                  data-testid="no-history-records"
                  className="rounded-xl border border-dashed border-slate-200 dark:border-[#27272A] p-8 text-center text-xs text-slate-500 dark:text-[#A1A1AA]"
                >
                  No historical observations found for the selected date range.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#A1A1AA]">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-[#F4F4F5]">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 inline-block" />
                        Actual Recorded Yield
                      </span>
                      {baselineSummary?.expected_baseline != null && (
                        <span className="flex items-center gap-1.5 font-semibold text-sky-600 dark:text-sky-400">
                          <span className="h-0.5 w-3 bg-sky-500 inline-block border-t border-dashed" />
                          Expected Baseline (
                          {baselineSummary.expected_baseline.toFixed(1)} L)
                        </span>
                      )}
                    </div>
                    <span>
                      Showing {filteredHistory.length} recorded day
                      {filteredHistory.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={chartPoints}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="actualYieldGrad"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#10b981"
                              stopOpacity={0.25}
                            />
                            <stop
                              offset="100%"
                              stopColor="#10b981"
                              stopOpacity={0.0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#3f3f4625"
                        />
                        <XAxis
                          dataKey="label"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11, fill: "#71717a" }}
                          dy={6}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11, fill: "#71717a" }}
                          unit="L"
                        />
                        <Tooltip content={<HistoryChartTooltip />} />
                        {baselineSummary?.expected_baseline != null && (
                          <ReferenceLine
                            y={baselineSummary.expected_baseline}
                            stroke="#38bdf8"
                            strokeDasharray="4 4"
                            strokeWidth={1.5}
                          />
                        )}
                        <Area
                          type="monotone"
                          dataKey="actual"
                          name="Actual Milk"
                          stroke="#10b981"
                          strokeWidth={2.5}
                          fill="url(#actualYieldGrad)"
                          isAnimationActive={true}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Historical Table */}
                  <div className="overflow-x-auto rounded-xl border border-slate-200/90 dark:border-[#27272A]">
                    <table className="w-full text-left text-xs text-slate-700 dark:text-[#A1A1AA]">
                      <thead className="bg-slate-50 dark:bg-[#1B1D20] text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#A1A1AA] border-b border-slate-200 dark:border-[#27272A]">
                        <tr>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Recorded Yield</th>
                          <th className="py-2.5 px-3">Vs Baseline</th>
                          <th className="py-2.5 px-3">Feed Intake</th>
                          <th className="py-2.5 px-3">Condition</th>
                          <th className="py-2.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-[#27272A]">
                        {filteredHistory.map((obs) => {
                          const diff =
                            obs.milk_produced_liters != null &&
                            baselineSummary?.expected_baseline != null
                              ? obs.milk_produced_liters -
                                baselineSummary.expected_baseline
                              : null;
                          const isSelected = selected === obs.id;

                          return (
                            <tr
                              key={obs.id}
                              className={`transition-colors ${
                                isSelected
                                  ? "bg-emerald-50/60 dark:bg-emerald-500/10 font-medium"
                                  : "hover:bg-slate-50/70 dark:hover:bg-[#1B1D20]/50"
                              }`}
                            >
                              <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-[#F4F4F5] whitespace-nowrap">
                                {formatDate(obs.observation_date)}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                {obs.milk_produced_liters != null ? (
                                  <span className="font-bold text-slate-900 dark:text-[#F4F4F5]">
                                    {obs.milk_produced_liters.toFixed(1)} L
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic">
                                    Not recorded
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                {diff != null ? (
                                  <span
                                    className={`font-semibold ${
                                      diff >= 0
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : "text-rose-600 dark:text-rose-400"
                                    }`}
                                  >
                                    {diff >= 0
                                      ? `+${diff.toFixed(1)} L`
                                      : `${diff.toFixed(1)} L`}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                {obs.feed_quantity_kg != null
                                  ? `${obs.feed_quantity_kg} kg`
                                  : "—"}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-[#27272A] text-slate-700 dark:text-[#F4F4F5]">
                                  {obs.health_condition || "Normal"}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleObservationSelect(obs.id)}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition ${
                                    isSelected
                                      ? "bg-emerald-600 text-white"
                                      : "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                                  }`}
                                >
                                  {isSelected ? "Active" : "Inspect"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* 5. DEEP AI EXPLAINABILITY & FEATURE DRIVERS (WHEN OBSERVATION PREDICTION LOADED) */}
            {mutation.isPending && (
              <div
                data-testid="prediction-generating-loading-state"
                className="rounded-2xl border border-slate-200/90 dark:border-[#27272A] bg-white dark:bg-[#151719] p-8 text-center shadow-xs space-y-3"
              >
                <div className="mx-auto w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
                <div className="text-sm font-semibold text-slate-800 dark:text-[#F4F4F5]">
                  Generating Prediction & AI Explainability...
                </div>
                <p className="text-xs text-slate-500 dark:text-[#A1A1AA] max-w-sm mx-auto">
                  Calculating model yield inference and TreeSHAP feature attributions for {activeCowName || "the selected cow"} on {formatDate(selectedObs?.observation_date)}.
                </p>
              </div>
            )}

            {!activePrediction && !mutation.isPending && selectedObs && (
              <div
                data-testid="prediction-prompt-card"
                className="rounded-2xl border border-dashed border-slate-200 dark:border-[#27272A] bg-slate-50/50 dark:bg-[#151719]/50 p-6 text-center space-y-2"
              >
                <div className="mx-auto w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#1F2226] flex items-center justify-center text-slate-400 dark:text-[#A1A1AA]">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="text-xs font-semibold text-slate-700 dark:text-[#F4F4F5]">
                  Ready to Generate Prediction
                </div>
                <p className="text-[11px] text-slate-500 dark:text-[#A1A1AA] max-w-md mx-auto">
                  Click <strong>Generate Prediction</strong> above to calculate model yield inference, uncertainty bounds, and TreeSHAP explainability drivers for {formatDate(selectedObs.observation_date)}.
                </p>
              </div>
            )}

            {activePrediction && !mutation.isPending && (
              <div className="space-y-4">
                {/* 1. ML Model Prediction Output & Uncertainty Bounds */}
                <div
                  data-testid="ml-prediction-result-card"
                  className="rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-gradient-to-br from-emerald-50/60 via-white to-emerald-50/30 dark:from-[#151719] dark:via-[#1B1D20] dark:to-[#151719] p-5 sm:p-6 shadow-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-100 dark:border-[#27272A] pb-3 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-xs">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-[#F4F4F5]">
                          AI Model Predicted Milk Yield
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-[#A1A1AA]">
                          Generated on-demand via {activePrediction.model_version || "best_milk_model.pkl"} for {formatDate(selectedObs?.observation_date)}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 self-start sm:self-auto">
                      On-Demand Prediction
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Primary Predicted Yield */}
                    <div className="space-y-1">
                      <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-[#A1A1AA]">
                        PREDICTED YIELD
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl sm:text-5xl font-black tracking-tight text-slate-950 dark:text-[#F4F4F5]">
                          {activePrediction.predicted_milk_yield != null
                            ? activePrediction.predicted_milk_yield.toFixed(2)
                            : "—"}
                        </span>
                        <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                          L
                        </span>
                        <span className="text-xs font-semibold text-slate-400 dark:text-[#A1A1AA]">
                          /day
                        </span>
                      </div>
                    </div>

                    {/* Confidence / Uncertainty Display */}
                    <div
                      data-testid="prediction-confidence-display"
                      className="space-y-1"
                    >
                      <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-[#A1A1AA]">
                        CONFIDENCE & UNCERTAINTY
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F4F4F5]">
                          {activePrediction.confidence_score != null
                            ? `${Math.round(activePrediction.confidence_score * 100)}%`
                            : "85%"}
                        </span>
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          {activePrediction.confidence_score != null && activePrediction.confidence_score >= 0.8
                            ? "High Confidence"
                            : "Calibrated"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-[#A1A1AA]">
                        {activePrediction.confidence_lower != null && activePrediction.confidence_upper != null
                          ? `Expected band: ${activePrediction.confidence_lower.toFixed(2)} – ${activePrediction.confidence_upper.toFixed(2)} L/day`
                          : "Band: ±0.50 L/day historical tolerance"}
                      </p>
                    </div>

                    {/* Target Context */}
                    <div className="space-y-1">
                      <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-[#A1A1AA]">
                        EVALUATION CONTEXT
                      </span>
                      <div className="text-sm font-bold text-slate-800 dark:text-[#F4F4F5]">
                        {activeCowName}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-[#A1A1AA]">
                        Target Date: {formatDate(selectedObs?.observation_date)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* System Audit & Metric Metadata Strip */}
                <div className="rounded-2xl border border-slate-200/90 dark:border-[#27272A] bg-white dark:bg-[#151719] p-4 sm:p-5 shadow-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div>
                      <span className="text-slate-400 dark:text-[#A1A1AA] block text-[11px] font-medium">
                        Baseline Methodology
                      </span>
                      <span className="font-bold text-slate-800 dark:text-[#F4F4F5]">
                        {activePrediction.baseline_method ||
                          baselineSummary?.method ||
                          "7-day rolling median"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 dark:text-[#A1A1AA] block text-[11px] font-medium">
                        Observations Used
                      </span>
                      <span className="font-bold text-slate-800 dark:text-[#F4F4F5]">
                        {activePrediction.observations_used != null
                          ? `${activePrediction.observations_used} valid prior records`
                          : baselineSummary?.observations_used != null
                            ? `${baselineSummary.observations_used} valid prior records`
                            : "0 prior records"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 dark:text-[#A1A1AA] block text-[11px] font-medium">
                        Historical Variability
                      </span>
                      <span className="font-bold text-slate-800 dark:text-[#F4F4F5]">
                        {activePrediction.historical_variability != null
                          ? `±${activePrediction.historical_variability.toFixed(2)} L/day (MAD)`
                          : baselineSummary?.historical_variability != null
                            ? `±${baselineSummary.historical_variability.toFixed(2)} L/day (MAD)`
                            : isInsufficientHistory
                              ? "Requires history"
                              : "±0.50 L/day floor"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 dark:text-[#A1A1AA] block text-[11px] font-medium">
                        ML Regression Ref
                      </span>
                      <span className="font-mono text-slate-800 dark:text-[#F4F4F5]">
                        {activePrediction.predicted_milk_yield != null
                          ? `${activePrediction.predicted_milk_yield.toFixed(2)} L/day (${activePrediction.model_version || "best_milk_model.pkl"})`
                          : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Why This Prediction? */}
                {isInsufficientHistory ? (
                  <div className="rounded-2xl border border-slate-200/90 dark:border-[#27272A] bg-white dark:bg-[#151719] p-5 shadow-xs">
                    <div className="flex items-center gap-2 text-slate-700 dark:text-[#F4F4F5] font-bold text-sm">
                      <Info className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>Feature Attributions Unavailable</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-[#A1A1AA] mt-1.5 leading-relaxed">
                      Feature attribution and AI drop explanations require a
                      calibrated baseline and validated prediction. Record
                      additional daily logs for {activeCowName} to unlock detailed
                      AI feature insights.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200/90 dark:border-[#27272A] bg-white dark:bg-[#151719] p-5 sm:p-6 shadow-xs space-y-4">
                    {/* Section Header */}
                    <div className="border-b border-slate-100 dark:border-[#27272A] pb-3">
                      <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#F4F4F5] flex items-center gap-2">
                        <span>🧠</span> Why This Prediction?
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-[#A1A1AA] mt-0.5">
                        Understand which environmental and physiological factors
                        influenced this yield for {formatDate(selectedObs?.observation_date)}.
                      </p>
                    </div>

                    {/* AI Insight Summary */}
                    {aiInsightMessage && (
                      <div className="rounded-xl bg-slate-50/70 dark:bg-[#1B1D20]/60 px-3.5 py-2.5 flex items-start sm:items-center gap-3">
                        <span className="text-base shrink-0 mt-0.5 sm:mt-0">
                          🧠
                        </span>
                        <div className="text-xs sm:text-sm text-slate-700 dark:text-[#F4F4F5]/90 leading-snug">
                          <span className="font-bold text-slate-900 dark:text-[#F4F4F5] mr-1.5">
                            AI Insight
                          </span>
                          {aiInsightMessage}
                        </div>
                      </div>
                    )}

                    {/* Feature Impact Visualization */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 pt-1">
                      {/* Left Column: Increasing Yield */}
                      <div className="space-y-4 lg:pr-4">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-[#34D399] uppercase tracking-wider">
                          <ArrowUp className="h-3.5 w-3.5" />
                          <span>Increasing Predicted Yield</span>
                        </div>

                        <div className="space-y-3.5">
                          {displayPositives.length === 0 ? (
                            <p className="text-xs text-slate-400 dark:text-[#A1A1AA] py-3 italic">
                              No positive SHAP contributions recorded.
                            </p>
                          ) : (
                            displayPositives.map((item, idx) => {
                              const pct = Math.min(
                                100,
                                Math.max(
                                  12,
                                  (Math.abs(item.shap) / maxImpact) * 100,
                                ),
                              );
                              return (
                                <div key={idx} className="space-y-1">
                                  <div className="flex items-baseline justify-between text-xs sm:text-sm">
                                    <span className="font-semibold text-slate-900 dark:text-[#F4F4F5]">
                                      {item.name}
                                    </span>
                                    <span className="font-bold text-emerald-600 dark:text-[#34D399]">
                                      +{item.shap.toFixed(2)} L
                                    </span>
                                  </div>
                                  {item.value && (
                                    <div className="text-[11px] text-slate-400 dark:text-[#A1A1AA] -mt-0.5">
                                      {item.value}
                                    </div>
                                  )}
                                  <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-[#1B1D20] overflow-hidden mt-1">
                                    <div
                                      className="h-full rounded-full bg-[#34D399] transition-all duration-500"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Right Column: Reducing Yield */}
                      <div className="space-y-4 lg:pl-4 lg:border-l lg:border-slate-100 lg:dark:border-[#27272A]">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-rose-500 dark:text-[#FB7185] uppercase tracking-wider">
                          <ArrowDown className="h-3.5 w-3.5" />
                          <span>Reducing Predicted Yield</span>
                        </div>

                        <div className="space-y-3.5">
                          {displayNegatives.length === 0 ? (
                            <p className="text-xs text-slate-400 dark:text-[#A1A1AA] py-3 italic">
                              No negative SHAP contributions recorded.
                            </p>
                          ) : (
                            displayNegatives.map((item, idx) => {
                              const pct = Math.min(
                                100,
                                Math.max(
                                  12,
                                  (Math.abs(item.shap) / maxImpact) * 100,
                                ),
                              );
                              return (
                                <div key={idx} className="space-y-1">
                                  <div className="flex items-baseline justify-between text-xs sm:text-sm">
                                    <span className="font-semibold text-slate-900 dark:text-[#F4F4F5]">
                                      {item.name}
                                    </span>
                                    <span className="font-bold text-rose-500 dark:text-[#FB7185]">
                                      -{Math.abs(item.shap).toFixed(2)} L
                                    </span>
                                  </div>
                                  {item.value && (
                                    <div className="text-[11px] text-slate-400 dark:text-[#A1A1AA] -mt-0.5">
                                      {item.value}
                                    </div>
                                  )}
                                  <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-[#1B1D20] overflow-hidden mt-1">
                                    <div
                                      className="h-full rounded-full bg-[#FB7185] transition-all duration-500"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Footer with CTA */}
                    <div className="border-t border-slate-100 dark:border-[#27272A] pt-3.5 mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                      <span className="text-xs text-slate-400 dark:text-[#A1A1AA]">
                        TreeSHAP analysis based on biometric and weather data.
                      </span>
                      <Link
                        to={`/explainability?predictionId=${activePrediction.id}`}
                        className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-emerald-600 dark:text-[#34D399] hover:text-emerald-700 dark:hover:text-emerald-300 transition group cursor-pointer"
                      >
                        <span>View Detailed SHAP Explanation</span>
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
