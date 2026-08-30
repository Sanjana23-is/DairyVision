import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/layouts/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { fetchHerdDigitalTwin, HerdDigitalTwin, CowDigitalTwin } from "@/services/digitalTwin";
import DigitalTwinCowCard from "@/components/digitalTwin/DigitalTwinCowCard";

export default function DigitalTwinPage() {
  const { currentFarmId } = useAuth();
  const farmId = currentFarmId || localStorage.getItem("current_farm_id");
  const [selectedCowId, setSelectedCowId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<HerdDigitalTwin>({
    queryKey: ["digitalTwinHerd", farmId],
    queryFn: () => fetchHerdDigitalTwin(farmId || undefined),
  });


  const herdSummary = data?.herd_summary;
  const cowStates = data?.cow_states || [];

  // Default select first cow when data loads
  const currentCowState: CowDigitalTwin | undefined = selectedCowId
    ? cowStates.find((c: CowDigitalTwin) => c.cow_id === selectedCowId)
    : cowStates[0];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Page Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Digital Twin
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Dynamic AI representation combining observations, predictions, health, weather, feed, and key production drivers.
            </p>
          </div>


          {/* Cow Selector Dropdown */}
          {cowStates.length > 0 ? (
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Select Cow:
              </label>
              <select
                value={currentCowState?.cow_id || ""}
                onChange={(e) => setSelectedCowId(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow-sm focus:border-sky-500 focus:ring-sky-500"
              >
                {cowStates.map((c: CowDigitalTwin) => (
                  <option key={c.cow_id} value={c.cow_id}>
                    🐄 {c.cow_name} ({c.health_status} • Vitality {c.vitality_score.toFixed(0)}%)
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

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

        {/* Main Digital Twin State Card */}
        {isLoading ? (
          <div className="rounded-3xl border bg-white p-12 text-center text-slate-500 shadow-sm">
            <p className="text-base font-semibold">🧬 Loading Digital Twin State Models…</p>
          </div>
        ) : isError ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-800">
            Failed to load Digital Twin state models. Please retry.
          </div>
        ) : currentCowState ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                Individual Cow Digital Twin State — {currentCowState.cow_name}
              </h2>
            </div>
            <DigitalTwinCowCard cowTwin={currentCowState} />
          </div>
        ) : (
          <div className="rounded-3xl border bg-white p-12 text-center text-slate-500 shadow-sm">
            No cows found in herd. Register cows and log observations to view Digital Twin states.
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
