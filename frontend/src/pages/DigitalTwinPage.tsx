import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/layouts/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { fetchHerdDigitalTwin, HerdDigitalTwin, CowDigitalTwin } from "@/services/digitalTwin";
import DigitalTwinCowCard from "@/components/digitalTwin/DigitalTwinCowCard";
import { AlertTriangle, Layers, RefreshCw, SortAsc } from "lucide-react";


type FilterType = "all" | "attention" | "critical" | "heat";
type SortType = "vitality_asc" | "vitality_desc" | "yield_desc" | "name";

export default function DigitalTwinPage() {
  const { currentFarmId } = useAuth();
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
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Digital Twin
              </h1>
              <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Real-Time Live
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Dynamic AI representation combining observations, predictions, health, weather, feed, and key production drivers.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => refetch()}
              disabled={isRefetching}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? "animate-spin text-sky-600" : "text-slate-500"}`} />
              {isRefetching ? "Updating..." : "Refresh Herd State"}
            </button>
          </div>
        </div>

        {/* Attention Banner if cows flagged */}
        {attentionCount > 0 && (
          <div className="flex items-center justify-between rounded-3xl border border-amber-200 bg-gradient-to-r from-amber-50 via-rose-50 to-amber-50 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-sm">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-950">
                  {attentionCount} {attentionCount === 1 ? "Cow Requires" : "Cows Require"} Immediate Monitoring
                </h4>
                <p className="text-xs text-amber-800">
                  Flagged due to active health warnings, critical risk status, or high ambient heat stress.
                </p>
              </div>
            </div>
            <button
              onClick={() => setFilterCategory("attention")}
              className="rounded-xl bg-amber-900 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-amber-950"
            >
              Filter Flagged Cows
            </button>
          </div>
        )}

        {/* Herd Vitality Overview Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-5 shadow-sm">
            <div className="text-xs font-bold text-sky-800 uppercase tracking-wider">
              Herd Vitality Index
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-sky-950">
                {isLoading ? "…" : `${herdSummary?.average_vitality_score.toFixed(0)}%`}
              </span>
              <span className="text-xs font-semibold text-sky-700">Herd Avg</span>
            </div>
            <p className="mt-1 text-xs text-sky-700">
              Overall health & environmental comfort
            </p>
          </div>

          <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm">
            <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
              Daily Milk Production
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-950">
                {isLoading ? "…" : `${herdSummary?.total_daily_yield_l.toFixed(1)} L`}
              </span>
              <span className="text-xs font-semibold text-emerald-700">
                Target: {herdSummary?.total_predicted_yield_l.toFixed(1)} L
              </span>
            </div>
            <p className="mt-1 text-xs text-emerald-700">
              Combined herd milk output vs AI baseline
            </p>
          </div>

          <div className="rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
            <div className="text-xs font-bold text-amber-800 uppercase tracking-wider">
              Health Distribution
            </div>
            <div className="mt-3 flex items-center gap-3">
              <span className="text-2xl font-black text-emerald-700">
                {isLoading ? "…" : herdSummary?.health_distribution["Healthy"] || 0}
                <span className="text-xs font-semibold text-slate-500"> Healthy</span>
              </span>
              <span className="text-2xl font-black text-rose-700">
                {isLoading ? "…" : herdSummary?.attention_cow_count || 0}
                <span className="text-xs font-semibold text-slate-500"> Attention</span>
              </span>
            </div>
            <p className="mt-1 text-xs text-amber-700">
              Distinct cows requiring monitoring
            </p>
          </div>

          <div className="rounded-3xl border border-purple-100 bg-gradient-to-br from-purple-50 to-white p-5 shadow-sm">
            <div className="text-xs font-bold text-purple-800 uppercase tracking-wider">
              Total Active Cows
            </div>
            <div className="mt-3 text-3xl font-black text-purple-950">
              {isLoading ? "…" : herdSummary?.total_cows}
            </div>
            <p className="mt-1 text-xs text-purple-700">
              Digital Twin active models
            </p>
          </div>
        </div>

        {/* Real-Time Herd Triage Grid Header */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-100 pb-5">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers className="h-4 w-4 text-sky-600" />
                Real-Time Herd Triage Grid
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Click any cow card below to inspect its detailed Digital Twin state.
              </p>
            </div>

            {/* Filters & Sorting Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Category Pills */}
              <div className="flex items-center rounded-2xl bg-slate-100 p-1 text-xs font-semibold">
                <button
                  onClick={() => setFilterCategory("all")}
                  className={`rounded-xl px-3 py-1.5 transition ${
                    filterCategory === "all" ? "bg-white text-slate-900 shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  All ({rawCowStates.length})
                </button>
                <button
                  onClick={() => setFilterCategory("attention")}
                  className={`rounded-xl px-3 py-1.5 transition ${
                    filterCategory === "attention" ? "bg-amber-500 text-white shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Attention ({attentionCount})
                </button>
                <button
                  onClick={() => setFilterCategory("critical")}
                  className={`rounded-xl px-3 py-1.5 transition ${
                    filterCategory === "critical" ? "bg-rose-600 text-white shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Health Risk ({rawCowStates.filter((c) => c.health_status !== "Healthy").length})
                </button>
                <button
                  onClick={() => setFilterCategory("heat")}
                  className={`rounded-xl px-3 py-1.5 transition ${
                    filterCategory === "heat" ? "bg-orange-500 text-white shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Heat Stress ({rawCowStates.filter((c) => c.heat_stress_level === "High" || c.heat_stress_level === "Moderate").length})
                </button>
              </div>

              {/* Sort Selector */}
              <div className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs">
                <SortAsc className="h-3.5 w-3.5 text-slate-400" />
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as SortType)}
                  className="bg-transparent border-none text-xs font-bold text-slate-800 focus:outline-none"
                >
                  <option value="vitality_asc">Vitality (Lowest First)</option>
                  <option value="vitality_desc">Vitality (Highest First)</option>
                  <option value="yield_desc">Milk Yield (High to Low)</option>
                  <option value="name">Cow Name</option>
                </select>
              </div>
            </div>
          </div>

          {/* Herd Cards List */}
          {isLoading ? (
            <div className="p-8 text-center text-sm font-semibold text-slate-500">
              Loading real-time herd state grid…
            </div>
          ) : isError ? (
            <div className="p-6 text-center text-sm font-semibold text-rose-600">
              Failed to load herd state records.
            </div>
          ) : sortedCowStates.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
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
                        ? "border-sky-500 bg-sky-50/60 ring-2 ring-sky-400/30"
                        : isCritical
                        ? "border-rose-200 bg-rose-50/40 hover:border-rose-300"
                        : isWarning
                        ? "border-amber-200 bg-amber-50/40 hover:border-amber-300"
                        : "border-slate-100 bg-slate-50/50 hover:border-slate-300 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🐄</span>
                        <div>
                          <h4 className="text-sm font-black text-slate-900 leading-tight">
                            {cow.cow_name}
                          </h4>
                          <span className="text-xs text-slate-500 font-medium">
                            {cow.lactation_stage || "Active Lactation"}
                          </span>
                        </div>
                      </div>

                      {/* Health Badge */}
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-black uppercase tracking-wider ${
                          isCritical
                            ? "bg-rose-100 text-rose-800"
                            : isWarning
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {cow.health_status}
                      </span>
                    </div>

                    {/* Vitality Index Bar */}
                    <div className="mt-3.5 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-500">Vitality Index</span>
                        <span
                          className={`font-black ${
                            cow.vitality_score >= 80
                              ? "text-emerald-700"
                              : cow.vitality_score >= 60
                              ? "text-amber-700"
                              : "text-rose-700"
                          }`}
                        >
                          {cow.vitality_score.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/70">
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
                    <div className="mt-3 flex items-center justify-between border-t border-slate-200/60 pt-2.5 text-xs">
                      <span className="font-medium text-slate-600">
                        Yield: <strong className="text-slate-900">{cow.production.current_yield_l != null ? `${cow.production.current_yield_l} L` : "N/A"}</strong>
                      </span>
                      <span
                        className={`font-medium ${
                          cow.heat_stress_level === "High"
                            ? "text-rose-700 font-bold"
                            : cow.heat_stress_level === "Moderate"
                            ? "text-amber-700"
                            : "text-slate-500"
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
              <h2 className="text-lg font-bold text-slate-900">
                Detailed Digital Twin State — {currentCowState.cow_name}
              </h2>
            </div>
            <DigitalTwinCowCard cowTwin={currentCowState} />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
