import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchFarms, Farm } from "@/services/farm";
import { fetchCows } from "@/services/cow";
import { fetchHealthAlerts } from "@/services/healthAlert";
import { fetchObservations } from "@/services/observation";
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/layouts/DashboardLayout";
import {
  ArrowLeft,
  MapPin,
  CheckCircle2,
  Users,
  AlertTriangle,
  Calendar,
  Plus,
  Gauge,
  Activity,
  Sparkles,
} from "lucide-react";

export default function FarmWorkspacePage() {
  const { farmId } = useParams<{ farmId: string }>();
  const navigate = useNavigate();
  const { currentFarmId, setCurrentFarm } = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "cows" | "observations" | "predictions" | "alerts">("overview");

  const { data: farms = [], isLoading: isFarmsLoading } = useQuery({
    queryKey: ["farms"],
    queryFn: fetchFarms,
  });

  const currentFarm = farms.find((f: Farm) => f.id === farmId) || null;

  const { data: cows = [] } = useQuery({
    queryKey: ["cows", farmId],
    queryFn: () => fetchCows(farmId),
    enabled: !!farmId,
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["healthAlerts", farmId],
    queryFn: () => fetchHealthAlerts({ farm_id: farmId }),
    enabled: !!farmId,
  });

  const { data: observations = [] } = useQuery({
    queryKey: ["observations", farmId],
    queryFn: () => fetchObservations(farmId),
    enabled: !!farmId,
  });

  const activeAlerts = alerts.filter((a: any) => !a.resolved);

  if (isFarmsLoading) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
            Loading farm workspace...
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!currentFarm) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-7xl space-y-4">
          <Link to="/farms" className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Back to Farms
          </Link>
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-700 shadow-sm">
            Farm not found.
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const isActive = currentFarmId === currentFarm.id;

  const handleMakeActive = () => {
    setCurrentFarm(currentFarm.id, currentFarm.name ?? null);
  };

  const locationStr =
    currentFarm.location_city || currentFarm.location_country
      ? `${currentFarm.location_city ?? ""}${
          currentFarm.location_city && currentFarm.location_country ? ", " : ""
        }${currentFarm.location_country ?? ""}`
      : "Location not specified";

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Back Link & Header Context */}
        <div className="space-y-3">
          <Link to="/farms" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition">
            <ArrowLeft className="h-4 w-4" />
            Back to Farms
          </Link>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🌾</span>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black text-slate-950">{currentFarm.name}</h1>
                  {isActive ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      ACTIVE FARM
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleMakeActive}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-sky-50 hover:text-sky-700"
                    >
                      Set as Active Farm
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  <span>{locationStr}</span>
                </div>
              </div>
            </div>

            {/* Quick Navigation Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto rounded-2xl bg-slate-100/80 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab("overview")}
                className={`rounded-xl px-3 py-1.5 transition ${
                  activeTab === "overview" ? "bg-white text-slate-950 shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => navigate(`/cows?farm_id=${farmId}`)}
                className="rounded-xl px-3 py-1.5 text-slate-600 hover:text-slate-900 transition"
              >
                Cows ({cows.length})
              </button>
              <button
                type="button"
                onClick={() => navigate(`/observations?farm_id=${farmId}`)}
                className="rounded-xl px-3 py-1.5 text-slate-600 hover:text-slate-900 transition"
              >
                Observations ({observations.length})
              </button>
              <button
                type="button"
                onClick={() => navigate(`/predictions?farm_id=${farmId}`)}
                className="rounded-xl px-3 py-1.5 text-slate-600 hover:text-slate-900 transition"
              >
                Predictions
              </button>
              <button
                type="button"
                onClick={() => navigate(`/health-alerts?farm_id=${farmId}`)}
                className="rounded-xl px-3 py-1.5 text-slate-600 hover:text-slate-900 transition"
              >
                Alerts ({activeAlerts.length})
              </button>
            </div>
          </div>
        </div>

        {/* Overview Tab Content */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Real Metric Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-sky-100 bg-sky-50/40 p-5 shadow-xs flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-sky-800 uppercase tracking-wider">Total Cows</div>
                  <div className="mt-1 text-3xl font-black text-sky-950">{cows.length}</div>
                  <p className="mt-1 text-xs text-sky-700">Registered cattle in herd</p>
                </div>
                <Users className="h-8 w-8 text-sky-600/40" />
              </div>

              <div className="rounded-3xl border border-amber-100 bg-amber-50/40 p-5 shadow-xs flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-amber-800 uppercase tracking-wider">Active Alerts</div>
                  <div className="mt-1 text-3xl font-black text-amber-950">{activeAlerts.length}</div>
                  <p className="mt-1 text-xs text-amber-700">Health issues needing attention</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-amber-600/40" />
              </div>

              <div className="rounded-3xl border border-emerald-100 bg-emerald-50/40 p-5 shadow-xs flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Daily Observations</div>
                  <div className="mt-1 text-3xl font-black text-emerald-950">{observations.length}</div>
                  <p className="mt-1 text-xs text-emerald-700">Production records logged</p>
                </div>
                <Calendar className="h-8 w-8 text-emerald-600/40" />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Quick Actions</h2>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate(`/cows`)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-sky-700 transition"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Cow</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate(`/observations`)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition"
                >
                  <Plus className="h-4 w-4" />
                  <span>Record Observation</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate(`/predictions`)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 hover:bg-slate-50 transition shadow-xs"
                >
                  <Gauge className="h-4 w-4 text-sky-600" />
                  <span>View Milk Predictions</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate(`/explainability`)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 hover:bg-slate-50 transition shadow-xs"
                >
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  <span>AI Decision Intelligence</span>
                </button>
              </div>
            </div>

            {/* Recent Health Alerts Overview */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-rose-600" />
                  Recent Health Alerts & Operational Risks
                </h2>
                <Link to="/health-alerts" className="text-xs font-bold text-sky-700 hover:underline">
                  View All Alerts →
                </Link>
              </div>

              {activeAlerts.length === 0 ? (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 text-xs font-semibold text-emerald-800">
                  ✅ No active health alerts or severe risks recorded for this farm.
                </div>
              ) : (
                <div className="space-y-2">
                  {activeAlerts.slice(0, 5).map((alert: any) => (
                    <div key={alert.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/60 p-3 text-xs">
                      <div>
                        <div className="font-bold text-slate-900">{alert.description || alert.alert_type}</div>
                        <div className="text-slate-500 mt-0.5">Level: {alert.alert_level}</div>
                      </div>
                      <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-800">
                        {alert.alert_level}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
