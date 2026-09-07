import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/layouts/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { fetchHerdDigitalTwin, HerdDigitalTwin, CowDigitalTwin } from "@/services/digitalTwin";
import DigitalTwinCowCard from "@/components/digitalTwin/DigitalTwinCowCard";
import { AlertTriangle, Layers, RefreshCw, SortAsc } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";


type FilterType = "all" | "attention" | "critical" | "heat";
type SortType = "vitality_asc" | "vitality_desc" | "yield_desc" | "name";

export default function DigitalTwinPage() {
  const { currentFarmId } = useAuth();
  const { t } = useLanguage();
  const farmId = currentFarmId || localStorage.getItem("current_farm_id");
  const [selectedCowId, setSelectedCowId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<FilterType>("all");
  const [sortOption, setSortOption] = useState<SortType>("vitality_asc");

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<HerdDigitalTwin>({
    queryKey: ["digitalTwinHerd", farmId],
    queryFn: () => fetchHerdDigitalTwin(farmId || undefined),
    refetchInterval: 30000, // Real-time 30s polling
  });

  const herdSummary = data?.herd_summary;
  const rawCowStates = data?.cow_states || [];

  // Filter logic
  const filteredCowStates = useMemo(() => {
    return rawCowStates.filter((c) => {
      if (filterCategory === "attention") {
        return c.health_status === "Warning" || c.health_status === "Critical" || c.heat_stress_level === "High";
      }
      if (filterCategory === "critical") {
        return c.health_status === "Critical" || c.health_status === "Warning";
      }
      if (filterCategory === "heat") {
        return c.heat_stress_level === "High" || c.heat_stress_level === "Moderate";
      }
      return true;
    });
  }, [rawCowStates, filterCategory]);

  // Sort logic
  const sortedCowStates = useMemo(() => {
    const list = [...filteredCowStates];
    if (sortOption === "vitality_asc") {
      list.sort((a, b) => a.vitality_score - b.vitality_score);
    } else if (sortOption === "vitality_desc") {
      list.sort((a, b) => b.vitality_score - a.vitality_score);
    } else if (sortOption === "yield_desc") {
      list.sort((a, b) => (b.production.current_yield_l || 0) - (a.production.current_yield_l || 0));
    } else if (sortOption === "name") {
      list.sort((a, b) => a.cow_name.localeCompare(b.cow_name));
    }
    return list;
  }, [filteredCowStates, sortOption]);

  // Default select first cow in sorted list if valid
  const currentCowState: CowDigitalTwin | undefined = useMemo(() => {
    if (selectedCowId) {
      const found = rawCowStates.find((c) => c.cow_id === selectedCowId);
      if (found) return found;
    }
    return sortedCowStates[0] || rawCowStates[0];
  }, [selectedCowId, rawCowStates, sortedCowStates]);

  const attentionCount = herdSummary?.attention_cow_count || 0;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Page Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-[#F4F4F5]">
                {t("twin.title", "Digital Twin")}
              </h1>
              <span className="flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {t("twin.realtime", "Real-Time Live")}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-[#A1A1AA]">
              {t("twin.subtitle", "Dynamic AI representation combining observations, predictions, health, weather, feed, and key production drivers.")}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => refetch()}
              disabled={isRefetching}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-[#F4F4F5] shadow-sm transition hover:bg-slate-50 dark:hover:bg-[#151719] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? "animate-spin text-emerald-600" : "text-slate-500 dark:text-[#A1A1AA]"}`} />
              {isRefetching ? t("twin.updating", "Updating...") : t("twin.refresh", "Refresh Herd State")}
            </button>
          </div>
        </div>

        {/* Attention Banner if cows flagged */}
        {attentionCount > 0 && (
          <div className="flex items-center justify-between rounded-3xl border border-amber-200 dark:border-amber-800/40 bg-gradient-to-r from-amber-50 via-rose-50 to-amber-50 dark:from-amber-950/30 dark:via-rose-950/20 dark:to-amber-950/30 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-sm">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-950 dark:text-amber-200">
                  {attentionCount} {attentionCount === 1 ? t("twin.cow_requires", "Cow Requires") : t("twin.cows_require", "Cows Require")} Immediate Monitoring
                </h4>
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  {t("twin.flagged_reason", "Flagged due to active health warnings, critical risk status, or high ambient heat stress.")}
                </p>
              </div>
            </div>
            <button
              onClick={() => setFilterCategory("attention")}
              className="rounded-xl bg-amber-900 dark:bg-amber-800 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-amber-950"
            >
              {t("twin.filter_flagged", "Filter Flagged Cows")}
            </button>
          </div>
        )}

        {/* Herd Vitality Overview Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl border border-sky-100 dark:border-[#27272A] bg-gradient-to-br from-sky-50 to-white dark:from-[#151719] dark:to-[#1B1D20] p-5 shadow-sm">
            <div className="text-xs font-bold text-sky-800 dark:text-sky-300 uppercase tracking-wider">
              {t("twin.vitality_index", "Herd Vitality Index")}
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-sky-950 dark:text-sky-200">
                {isLoading ? "…" : `${herdSummary?.average_vitality_score.toFixed(0)}%`}
              </span>
              <span className="text-xs font-semibold text-sky-700 dark:text-sky-400">{t("twin.herd_avg", "Herd Avg")}</span>
            </div>
            <p className="mt-1 text-xs text-sky-700 dark:text-sky-400">
              {t("twin.vitality_subtitle", "Overall health & environmental comfort")}
            </p>
          </div>

          <div className="rounded-3xl border border-emerald-100 dark:border-[#27272A] bg-gradient-to-br from-emerald-50 to-white dark:from-[#151719] dark:to-[#1B1D20] p-5 shadow-sm">
            <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
              {t("twin.daily_milk", "Daily Milk Production")}
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-950 dark:text-emerald-200">
                {isLoading ? "…" : `${herdSummary?.total_daily_yield_l.toFixed(1)} L`}
              </span>
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                Target: {herdSummary?.total_predicted_yield_l.toFixed(1)} L
              </span>
            </div>
            <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
              {t("twin.milk_subtitle", "Combined herd milk output vs AI baseline")}
            </p>
          </div>

          <div className="rounded-3xl border border-amber-100 dark:border-[#27272A] bg-gradient-to-br from-amber-50 to-white dark:from-[#151719] dark:to-[#1B1D20] p-5 shadow-sm">
            <div className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
              {t("twin.health_dist", "Health Distribution")}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
                {isLoading ? "…" : herdSummary?.health_distribution["Healthy"] || 0}
                <span className="text-xs font-semibold text-slate-500 dark:text-[#A1A1AA]"> Healthy</span>
              </span>
              <span className="text-2xl font-black text-rose-700 dark:text-rose-400">
                {isLoading ? "…" : herdSummary?.attention_cow_count || 0}
                <span className="text-xs font-semibold text-slate-500 dark:text-[#A1A1AA]"> Attention</span>
              </span>
            </div>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
              {t("twin.health_subtitle", "Distinct cows requiring monitoring")}
            </p>
          </div>

          <div className="rounded-3xl border border-purple-100 dark:border-[#27272A] bg-gradient-to-br from-purple-50 to-white dark:from-[#151719] dark:to-[#1B1D20] p-5 shadow-sm">
            <div className="text-xs font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wider">
              {t("twin.total_active", "Total Active Cows")}
            </div>
            <div className="mt-3 text-3xl font-black text-purple-950 dark:text-purple-200">
              {isLoading ? "…" : herdSummary?.total_cows}
            </div>
            <p className="mt-1 text-xs text-purple-700 dark:text-purple-400">
              {t("twin.active_subtitle", "Digital Twin active models")}
            </p>
          </div>
        </div>

        {/* Real-Time Herd Triage Grid Header */}
        <div className="rounded-3xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] p-6 shadow-sm space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-100 dark:border-[#27272A] pb-5">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-[#F4F4F5] flex items-center gap-2">
                <Layers className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                {t("twin.triage_grid", "Real-Time Herd Triage Grid")}
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#A1A1AA] mt-0.5">
                {t("twin.triage_subtitle", "Click any cow card below to inspect its detailed Digital Twin state.")}
              </p>
            </div>

            {/* Filters & Sorting Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Category Pills */}
              <div className="flex items-center rounded-2xl bg-slate-100 dark:bg-[#1B1D20] p-1 text-xs font-semibold">
                <button
                  onClick={() => setFilterCategory("all")}
                  className={`rounded-xl px-3 py-1.5 transition ${
                    filterCategory === "all" ? "bg-white dark:bg-[#151719] text-slate-900 dark:text-[#F4F4F5] shadow-xs font-bold" : "text-slate-600 dark:text-[#A1A1AA] hover:text-slate-900 dark:hover:text-[#F4F4F5]"
                  }`}
                >
                  All ({rawCowStates.length})
                </button>
                <button
                  onClick={() => setFilterCategory("attention")}
                  className={`rounded-xl px-3 py-1.5 transition ${
                    filterCategory === "attention" ? "bg-amber-500 text-white shadow-xs font-bold" : "text-slate-600 dark:text-[#A1A1AA] hover:text-slate-900 dark:hover:text-[#F4F4F5]"
                  }`}
                >
                  Attention ({attentionCount})
                </button>
                <button
                  onClick={() => setFilterCategory("critical")}
                  className={`rounded-xl px-3 py-1.5 transition ${
                    filterCategory === "critical" ? "bg-rose-600 text-white shadow-xs font-bold" : "text-slate-600 dark:text-[#A1A1AA] hover:text-slate-900 dark:hover:text-[#F4F4F5]"
                  }`}
                >
                  Health Risk ({rawCowStates.filter((c) => c.health_status !== "Healthy").length})
                </button>
                <button
                  onClick={() => setFilterCategory("heat")}
                  className={`rounded-xl px-3 py-1.5 transition ${
                    filterCategory === "heat" ? "bg-orange-500 text-white shadow-xs font-bold" : "text-slate-600 dark:text-[#A1A1AA] hover:text-slate-900 dark:hover:text-[#F4F4F5]"
                  }`}
                >
                  Heat Stress ({rawCowStates.filter((c) => c.heat_stress_level === "High" || c.heat_stress_level === "Moderate").length})
                </button>
              </div>

              {/* Sort Selector */}
              <div className="flex items-center gap-1.5 rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-[#F4F4F5] shadow-xs">
                <SortAsc className="h-3.5 w-3.5 text-slate-400 dark:text-[#A1A1AA]" />
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as SortType)}
                  className="bg-transparent border-none text-xs font-bold text-slate-800 dark:text-[#F4F4F5] focus:outline-none"
                >
                  <option value="vitality_asc" className="dark:bg-[#1B1D20]">Vitality (Lowest First)</option>
                  <option value="vitality_desc" className="dark:bg-[#1B1D20]">Vitality (Highest First)</option>
                  <option value="yield_desc" className="dark:bg-[#1B1D20]">Milk Yield (High to Low)</option>
                  <option value="name" className="dark:bg-[#1B1D20]">Cow Name</option>
                </select>
              </div>
            </div>
          </div>

          {/* Herd Cards List */}
          {isLoading ? (
            <div className="p-8 text-center text-sm font-semibold text-slate-500 dark:text-[#A1A1AA]">
              Loading real-time herd state grid…
            </div>
          ) : isError ? (
            <div className="p-6 text-center text-sm font-semibold text-rose-600 dark:text-rose-400">
              Failed to load herd state records.
            </div>
          ) : sortedCowStates.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-[#A1A1AA]">
              No cows match the selected filter category ({filterCategory}).
            </div>
          ) : (
            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {sortedCowStates.map((cow) => {
                const isSelected = currentCowState?.cow_id === cow.cow_id;
                const isCritical = cow.health_status === "Critical";
                const isWarning = cow.health_status === "Warning";

                return (
                  <div
                    key={cow.cow_id}
                    onClick={() => setSelectedCowId(cow.cow_id)}
                    className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 shadow-2xs hover:shadow-md ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-500/10 ring-2 ring-emerald-400/30"
                        : isCritical
                        ? "border-rose-200 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 hover:border-rose-300"
                        : isWarning
                        ? "border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 hover:border-amber-300"
                        : "border-slate-100 dark:border-[#27272A] bg-slate-50/50 dark:bg-[#1B1D20] hover:border-slate-300 dark:hover:border-slate-600 hover:bg-white dark:hover:bg-[#151719]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🐄</span>
                        <div>
                          <h4 className="text-sm font-black text-slate-900 dark:text-[#F4F4F5] leading-tight">
                            {cow.cow_name}
                          </h4>
                          <span className="text-xs text-slate-500 dark:text-[#A1A1AA] font-medium">
                            {cow.lactation_stage || "Active Lactation"}
                          </span>
                        </div>
                      </div>

                      {/* Health Badge */}
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-black uppercase tracking-wider ${
                          isCritical
                            ? "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300"
                            : isWarning
                            ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                            : "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                        }`}
                      >
                        {cow.health_status}
                      </span>
                    </div>

                    {/* Vitality Index Bar */}
                    <div className="mt-3.5 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-500 dark:text-[#A1A1AA]">Vitality Index</span>
                        <span
                          className={`font-black ${
                            cow.vitality_score >= 80
                              ? "text-emerald-700 dark:text-emerald-400"
                              : cow.vitality_score >= 60
                              ? "text-amber-700 dark:text-amber-400"
                              : "text-rose-700 dark:text-rose-400"
                          }`}
                        >
                          {cow.vitality_score.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-[#151719]">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            cow.vitality_score >= 80
                              ? "bg-emerald-500"
                              : cow.vitality_score >= 60
                              ? "bg-amber-500"
                              : "bg-rose-500"
                          }`}
                          style={{ width: `${Math.max(10, Math.min(100, cow.vitality_score))}%` }}
                        />
                      </div>
                    </div>

                    {/* Footer Metrics */}
                    <div className="mt-3 flex items-center justify-between border-t border-slate-200/60 dark:border-[#27272A] pt-2.5 text-xs">
                      <span className="font-medium text-slate-600 dark:text-[#A1A1AA]">
                        Yield: <strong className="text-slate-900 dark:text-[#F4F4F5]">{cow.production.current_yield_l != null ? `${cow.production.current_yield_l} L` : "N/A"}</strong>
                      </span>
                      <span
                        className={`font-medium ${
                          cow.heat_stress_level === "High"
                            ? "text-rose-700 dark:text-rose-400 font-bold"
                            : cow.heat_stress_level === "Moderate"
                            ? "text-amber-700 dark:text-amber-400"
                            : "text-slate-500 dark:text-[#A1A1AA]"
                        }`}
                      >
                        THI: {cow.heat_stress_level}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Cow Detailed State Card */}
        {currentCowState && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-[#F4F4F5]">
                {t("twin.detailed_state", "Detailed Digital Twin State")} — {currentCowState.cow_name}
              </h2>
            </div>
            <DigitalTwinCowCard cowTwin={currentCowState} />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
