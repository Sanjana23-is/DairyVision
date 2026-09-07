import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchFarms, Farm } from "@/services/farm";
import { fetchCows } from "@/services/cow";
import { fetchHealthAlerts } from "@/services/healthAlert";
import { fetchObservations } from "@/services/observation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
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
  const { t } = useLanguage();
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
          <div className="rounded-3xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] p-8 text-center text-slate-500 dark:text-[#A1A1AA] shadow-sm">
            {t("status.loading", "Loading farm workspace...")}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!currentFarm) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-7xl space-y-4">
          <Link to="/farms" className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 dark:text-sky-400 hover:underline">
            <ArrowLeft className="h-4 w-4" />
            {t("farms.back_to_farms", "Back to Farms")}
          </Link>
          <div className="rounded-3xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] p-8 text-center text-slate-700 dark:text-[#F4F4F5] shadow-sm">
            {t("status.not_found", "Farm not found.")}
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
          <Link to="/farms" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-[#A1A1AA] hover:text-slate-800 dark:hover:text-[#F4F4F5] transition">
            <ArrowLeft className="h-4 w-4" />
            {t("farms.back_to_farms", "Back to Farms")}
          </Link>

          <div className="rounded-3xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] p-6 shadow-sm flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🌾</span>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black text-slate-950 dark:text-[#F4F4F5]">{currentFarm.name}</h1>
                  {isActive ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      {t("farms.active_farm", "ACTIVE FARM")}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleMakeActive}
                      className="rounded-full bg-slate-100 dark:bg-[#1B1D20] border border-slate-200 dark:border-[#27272A] px-3 py-1 text-xs font-bold text-slate-700 dark:text-[#F4F4F5] hover:bg-sky-50 dark:hover:bg-sky-950/40 hover:text-sky-700 dark:hover:text-sky-300"
                    >
                      {t("farms.set_as_active", "Set as Active Farm")}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-[#A1A1AA] mt-1">
                  <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>{locationStr}</span>
                </div>
              </div>
            </div>

            {/* Quick Navigation Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto rounded-2xl bg-slate-100/80 dark:bg-[#1B1D20] p-1 text-xs font-semibold border border-transparent dark:border-[#27272A]">
              <button
                type="button"
                onClick={() => setActiveTab("overview")}
                className={`rounded-xl px-3 py-1.5 transition ${
                  activeTab === "overview" ? "bg-white dark:bg-[#151719] text-slate-950 dark:text-[#F4F4F5] shadow-xs font-bold" : "text-slate-600 dark:text-[#A1A1AA] hover:text-slate-900 dark:hover:text-[#F4F4F5]"
                }`}
              >
                {t("nav.overview", "Overview")}
              </button>
              <button
                type="button"
                onClick={() => navigate(`/cows?farm_id=${farmId}`)}
                className="rounded-xl px-3 py-1.5 text-slate-600 dark:text-[#A1A1AA] hover:text-slate-900 dark:hover:text-[#F4F4F5] transition"
              >
                {t("nav.cows", "Cows")} ({cows.length})
              </button>
              <button
                type="button"
                onClick={() => navigate(`/observations?farm_id=${farmId}`)}
                className="rounded-xl px-3 py-1.5 text-slate-600 dark:text-[#A1A1AA] hover:text-slate-900 dark:hover:text-[#F4F4F5] transition"
              >
                {t("nav.daily_observations", "Observations")} ({observations.length})
              </button>
              <button
                type="button"
                onClick={() => navigate(`/predictions?farm_id=${farmId}`)}
                className="rounded-xl px-3 py-1.5 text-slate-600 dark:text-[#A1A1AA] hover:text-slate-900 dark:hover:text-[#F4F4F5] transition"
              >
                {t("nav.predictions", "Predictions")}
              </button>
              <button
                type="button"
                onClick={() => navigate(`/health-alerts?farm_id=${farmId}`)}
                className="rounded-xl px-3 py-1.5 text-slate-600 dark:text-[#A1A1AA] hover:text-slate-900 dark:hover:text-[#F4F4F5] transition"
              >
                {t("health.alerts", "Alerts")} ({activeAlerts.length})
              </button>
            </div>
          </div>
        </div>

        {/* Overview Tab Content */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Real Metric Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-sky-100 dark:border-[#27272A] bg-sky-50/40 dark:bg-[#151719] p-5 shadow-xs flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-sky-800 dark:text-sky-300 uppercase tracking-wider">{t("dashboard.total_cows", "Total Cows")}</div>
                  <div className="mt-1 text-3xl font-black text-sky-950 dark:text-[#F4F4F5]">{cows.length}</div>
                  <p className="mt-1 text-xs text-sky-700 dark:text-sky-400">Registered cattle in herd</p>
                </div>
                <Users className="h-8 w-8 text-sky-600/40 dark:text-sky-400/40" />
              </div>

              <div className="rounded-3xl border border-amber-100 dark:border-[#27272A] bg-amber-50/40 dark:bg-[#151719] p-5 shadow-xs flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">{t("dashboard.active_alerts", "Active Alerts")}</div>
                  <div className="mt-1 text-3xl font-black text-amber-950 dark:text-[#F4F4F5]">{activeAlerts.length}</div>
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">Health issues needing attention</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-amber-600/40 dark:text-amber-400/40" />
              </div>

              <div className="rounded-3xl border border-emerald-100 dark:border-[#27272A] bg-emerald-50/40 dark:bg-[#151719] p-5 shadow-xs flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">{t("nav.daily_observations", "Daily Observations")}</div>
                  <div className="mt-1 text-3xl font-black text-emerald-950 dark:text-[#F4F4F5]">{observations.length}</div>
                  <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">Production records logged</p>
                </div>
                <Calendar className="h-8 w-8 text-emerald-600/40 dark:text-emerald-400/40" />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="rounded-3xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] p-6 shadow-sm space-y-3">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#A1A1AA]">{t("dashboard.quick_actions", "Quick Actions")}</h2>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate(`/cows`)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-sky-700 transition"
                >
                  <Plus className="h-4 w-4" />
                  <span>{t("cows.add_cow", "Add Cow")}</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate(`/observations`)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition"
                >
                  <Plus className="h-4 w-4" />
                  <span>{t("obs.record_observation", "Record Observation")}</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate(`/predictions`)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-[#F4F4F5] hover:bg-slate-50 dark:hover:bg-[#151719] transition shadow-xs"
                >
                  <Gauge className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                  <span>{t("pred.view_predictions", "View Milk Predictions")}</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate(`/explainability`)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-[#F4F4F5] hover:bg-slate-50 dark:hover:bg-[#151719] transition shadow-xs"
                >
                  <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <span>{t("explain.title", "AI Yield Intelligence")}</span>
                </button>
              </div>
            </div>

            {/* Recent Health Alerts Overview */}
            <div className="rounded-3xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 dark:text-[#F4F4F5] flex items-center gap-2">
                  <Activity className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  {t("health.recent_alerts", "Recent Health Alerts & Operational Risks")}
                </h2>
                <Link to="/health-alerts" className="text-xs font-bold text-sky-700 dark:text-sky-400 hover:underline">
                  {t("health.view_all", "View All Alerts →")}
                </Link>
              </div>

              {activeAlerts.length === 0 ? (
                <div className="rounded-2xl border border-emerald-100 dark:border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-500/10 p-4 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                  ✅ {t("health.no_active_alerts", "No active health alerts or severe risks recorded for this farm.")}
                </div>
              ) : (
                <div className="space-y-2">
                  {activeAlerts.slice(0, 5).map((alert: any) => (
                    <div key={alert.id} className="flex items-center justify-between rounded-2xl border border-slate-100 dark:border-[#27272A] bg-slate-50/60 dark:bg-[#1B1D20] p-3 text-xs">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-[#F4F4F5]">{alert.description || alert.alert_type}</div>
                        <div className="text-slate-500 dark:text-[#A1A1AA] mt-0.5">Level: {alert.alert_level}</div>
                      </div>
                      <span className="rounded-full bg-rose-100 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 px-2.5 py-0.5 text-[11px] font-bold text-rose-800 dark:text-rose-300">
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

