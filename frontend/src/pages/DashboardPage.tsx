import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/layouts/DashboardLayout";
import StatCard from "@/components/cards/StatCard";
import MilkProductionChart, { type MilkChartPoint } from "@/components/charts/MilkProductionChart";
import { useAuth } from "@/context/AuthContext";
import {
  fetchDashboardSummary,
  fetchDashboardTrends,
} from "@/services/dashboard";
import { fetchHealthAlerts, HealthAlert } from "@/services/healthAlert";
import ExecutiveReportModal from "@/components/reports/ExecutiveReportModal";
import {
  Users,
  Droplet,
  TrendingUp,
  Bell,
  FileText,
  Thermometer,
  CloudSun,
  Activity,
  ArrowRight,
  Sparkles,
  MousePointer,
  Gauge,
  Layers,
  FlaskConical,
  Dna,
  Repeat,
} from "lucide-react";

function formatTrendLabel(dateString: string) {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

export function DashboardPage() {
  const { user, currentFarmId, currentFarmName } = useAuth();
  const farmId = currentFarmId || localStorage.getItem("current_farm_id");
  const [executiveReportOpen, setExecutiveReportOpen] = useState(false);
  const navigate = useNavigate();

  if (!farmId) {
    return <Navigate to="/select-farm" replace />;
  }

  // 1. Dashboard Summary Query
  const {
    data: summary,
    isLoading: isSummaryLoading,
    isError: isSummaryError,
    error: summaryError,
  } = useQuery({
    queryKey: ["dashboardSummary", farmId],
    queryFn: () => fetchDashboardSummary(farmId as string),
    staleTime: 1000 * 30,
    enabled: !!farmId,
  });

  // 2. Dashboard Trends Query
  const { data: trends } = useQuery({
    queryKey: ["dashboardTrends", farmId],
    queryFn: () => fetchDashboardTrends(farmId as string),
    staleTime: 1000 * 30,
    enabled: !!farmId,
  });

  // 3. Active Health Alerts Query
  const { data: healthAlerts = [] } = useQuery<HealthAlert[]>({
    queryKey: ["healthAlerts", farmId, false],
    queryFn: () => fetchHealthAlerts({ farm_id: farmId as string, resolved: false }),
    staleTime: 1000 * 30,
    enabled: !!farmId,
  });

  // Metrics Calculations
  const activeCowCount = summary?.active_cow_count ?? summary?.total_cow_count ?? 0;
  
  // Today's actual milk produced
  const actualMilkToday = useMemo(() => {
    if (typeof summary?.total_milk_produced === "number" && summary.total_milk_produced > 0) {
      return summary.total_milk_produced;
    }
    const lastObs = trends?.observation_trends?.slice(-1)[0];
    return lastObs?.total_milk_produced ?? 0;
  }, [summary, trends]);

  // Expected milk yield today
  const expectedMilkToday = useMemo(() => {
    if (summary?.todays_milk_predictions && summary.todays_milk_predictions.length > 0) {
      return summary.todays_milk_predictions.reduce((acc, p) => acc + (p.predicted_milk_yield || 0), 0);
    }
    if (typeof summary?.average_predicted_milk_yield === "number" && activeCowCount > 0) {
      return summary.average_predicted_milk_yield * activeCowCount;
    }
    const lastPred = trends?.milk_yield_trends?.slice(-1)[0];
    if (lastPred?.average_predicted_milk_yield && activeCowCount > 0) {
      return lastPred.average_predicted_milk_yield * activeCowCount;
    }
    return 0;
  }, [summary, trends, activeCowCount]);

  // Health alerts count
  const activeAlertsCount = healthAlerts.length || summary?.active_health_alerts?.length || 0;

  // Chart Points (Actual vs Expected)
  const chartPoints = useMemo<MilkChartPoint[]>(() => {
    const obsTrendMap = new Map<string, number>();
    trends?.observation_trends?.forEach((item) => {
      obsTrendMap.set(String(item.date), item.total_milk_produced);
    });

    const predTrendMap = new Map<string, number>();
    trends?.milk_yield_trends?.forEach((item) => {
      const totalPred = (item.average_predicted_milk_yield || 0) * (activeCowCount || 1);
      predTrendMap.set(String(item.date), Number(totalPred.toFixed(1)));
    });

    const allDates = Array.from(new Set([...obsTrendMap.keys(), ...predTrendMap.keys()])).sort();

    if (allDates.length === 0) return [];

    return allDates.map((dateStr) => {
      const act = obsTrendMap.get(dateStr) ?? null;
      const pred = predTrendMap.get(dateStr) ?? null;
      return {
        date: dateStr,
        label: formatTrendLabel(dateStr),
        actual: act !== null ? Number(act.toFixed(1)) : null,
        predicted: pred !== null ? Number(pred.toFixed(1)) : null,
      };
    });
  }, [trends, activeCowCount]);

  // AI Live Insights
  const aiInsights = useMemo(() => {
    const insights: Array<{ icon: string; title: string; text: string; link: string }> = [];

    if (actualMilkToday > 0 && expectedMilkToday > 0) {
      if (actualMilkToday >= expectedMilkToday) {
        insights.push({
          icon: "🥛",
          title: "Milk production",
          text: "Performing on target",
          link: "/predictions",
        });
      } else {
        insights.push({
          icon: "🥛",
          title: "Milk production",
          text: "Slightly below expected target",
          link: "/predictions",
        });
      }
    } else {
      insights.push({
        icon: "🥛",
        title: "Milk production",
        text: `Active herd of ${activeCowCount} cows monitored`,
        link: "/predictions",
      });
    }

    const temp = summary?.todays_weather?.temperature ?? 26.0;
    const humidity = summary?.todays_weather?.humidity ?? 60.0;
    const thi = summary?.todays_weather?.thi ?? ((1.8 * temp + 32.0) - ((0.55 - 0.0055 * humidity) * (1.8 * temp - 26.0)));

    if (thi >= 79) {
      insights.push({
        icon: "🌡️",
        title: "Thermal conditions",
        text: "Heat stress alert zone (THI high)",
        link: "/explainability",
      });
    } else {
      insights.push({
        icon: "🌡️",
        title: "Thermal conditions",
        text: "THI within comfortable zone",
        link: "/explainability",
      });
    }

    if (activeAlertsCount > 0) {
      insights.push({
        icon: "🐄",
        title: "Herd health",
        text: `${activeAlertsCount} ${activeAlertsCount === 1 ? "cow requires" : "cows require"} monitoring`,
        link: "/health-alerts",
      });
    } else {
      insights.push({
        icon: "🐄",
        title: "Herd health",
        text: "All cows pass health checks",
        link: "/health-alerts",
      });
    }

    return insights;
  }, [actualMilkToday, expectedMilkToday, activeCowCount, summary, activeAlertsCount]);

  const displayedFarmName = currentFarmName || summary?.farm?.name || "Luna Farm";
  const displayedUserName = user?.full_name || "Farm Manager";

  const temp = summary?.todays_weather?.temperature ?? 26.0;
  const humidity = summary?.todays_weather?.humidity ?? 60.0;
  const thiValue = summary?.todays_weather?.thi ?? ((1.8 * temp + 32.0) - ((0.55 - 0.0055 * humidity) * (1.8 * temp - 26.0)));
  const thiStatus = thiValue >= 79 ? "Heat Stress" : thiValue >= 72 ? "Mild Stress" : "Comfortable";

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-12 select-none">
        
        {/* ================================================== */}
        {/* SECTION 1 — FARM INTELLIGENCE (UNTOUCHED)         */}
        {/* ================================================== */}
        <section className="space-y-6">
          {/* Header & Greeting */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {getGreeting()}, {displayedUserName} 👋
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Here's what's happening at <strong className="text-slate-800 font-bold">{displayedFarmName}</strong> today.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setExecutiveReportOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200/90 bg-emerald-50/70 px-4 py-2.5 text-xs font-bold text-emerald-900 shadow-2xs hover:bg-emerald-100 hover:border-emerald-300 transition-all duration-200"
              >
                <FileText className="h-4 w-4 text-emerald-600" />
                <span>Executive Report & Export</span>
              </button>
            </div>
          </div>

          {/* Loading / Error States */}
          {isSummaryLoading ? (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-8 text-center text-xs font-semibold text-slate-500 shadow-xs">
              Loading farm intelligence dashboard...
            </div>
          ) : isSummaryError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-xs font-semibold text-rose-800 shadow-xs">
              Unable to load farm intelligence: {(summaryError as any)?.message || "Network Error"}
            </div>
          ) : (
            <>
              {/* Four KPI Cards */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  title="TOTAL COWS"
                  value={activeCowCount}
                  delta="Active herd in workspace"
                  icon={<Users className="h-5 w-5" />}
                  onClick={() => navigate("/cows")}
                />

                <StatCard
                  title="MILK PRODUCED TODAY"
                  value={`${actualMilkToday.toFixed(1)} L`}
                  delta="Today's actual yield"
                  icon={<Droplet className="h-5 w-5" />}
                  onClick={() => navigate("/observations")}
                />

                <StatCard
                  title="EXPECTED YIELD TODAY"
                  value={`${expectedMilkToday.toFixed(1)} L`}
                  delta="AI model yield target"
                  icon={<TrendingUp className="h-5 w-5" />}
                  onClick={() => navigate("/predictions")}
                />

                <StatCard
                  title="ACTIVE HEALTH ALERTS"
                  value={activeAlertsCount}
                  delta={activeAlertsCount > 0 ? `${activeAlertsCount} require attention` : "All checks normal"}
                  icon={<Bell className="h-5 w-5" />}
                  onClick={() => navigate("/health-alerts")}
                />
              </div>

              {/* Milk Production Overview (Visual Hero) & Live Farm Insights */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                {/* Visual Hero Chart (8 cols) */}
                <div className="lg:col-span-8">
                  <MilkProductionChart points={chartPoints} />
                </div>

                {/* AI Monitoring Panel (4 cols) */}
                <div className="lg:col-span-4 flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs hover:shadow-sm transition-shadow duration-200">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                        <Activity className="h-4 w-4" />
                      </div>
                      <h2 className="text-base font-bold text-slate-900 tracking-tight">
                        LIVE FARM INSIGHTS
                      </h2>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Real-time AI monitoring & thermal conditions
                    </p>

                    <div className="mt-5 space-y-3">
                      {aiInsights.map((item, idx) => (
                        <div
                          key={idx}
                          onClick={() => navigate(item.link)}
                          className="group flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 hover:bg-emerald-50/40 hover:border-emerald-300/80 transition-all duration-200 cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{item.icon}</span>
                            <div>
                              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                {item.title}
                              </div>
                              <p className="text-xs font-bold text-slate-800 group-hover:text-emerald-900 transition-colors">
                                {item.text}
                              </p>
                            </div>
                          </div>
                          <ArrowRight className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200 shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 border-t border-slate-100 pt-3.5 text-xs text-slate-500 flex items-center justify-between">
                    <span className="font-medium">Thermal Snapshot:</span>
                    <span className="font-bold text-slate-900">
                      {temp.toFixed(1)}°C • {humidity.toFixed(0)}% Humidity
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        {/* ================================================== */}
        {/* SECTION 2 — FARM ENVIRONMENT, ACTIONS & WORKSPACE */}
        {/* Realistic Agricultural Photographic Atmosphere     */}
        {/* ================================================== */}
        <section className="relative w-full rounded-3xl pt-8 pb-10 px-6 sm:px-8 space-y-8 transition-all duration-300 overflow-hidden">
          
          {/* Realistic Dairy Farm Pasture Photography Background Layer */}
          <div
            className="absolute -top-24 inset-x-0 bottom-0 bg-cover bg-center bg-no-repeat opacity-[0.28] saturate-[0.85] pointer-events-none z-0"
            style={{
              backgroundImage: `url('/images/dairy_farm_pasture_bg.jpg')`,
            }}
          />

          {/* Soft White & Warm Fade Overlays at top and across background */}
          <div className="absolute -top-24 inset-x-0 bottom-0 bg-gradient-to-b from-slate-50/95 via-slate-50/75 to-slate-50/90 pointer-events-none z-0" />
          <div className="absolute top-0 inset-x-0 h-36 bg-gradient-to-b from-slate-50 via-slate-50/90 to-transparent pointer-events-none z-0" />

          <div className="relative z-10 space-y-8">
            
            {/* Section 2 Header */}
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800">
                FARM ENVIRONMENT & ACTIONS
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-0.5">
                Live Environmental Monitoring & AI Guidance
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
                Real-time thermal metrics, active health risks, and intelligent action recommendations.
              </p>
            </div>

            {/* Farm Environment Panel (Crisp White Card Surface) */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-200 space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <CloudSun className="h-5 w-5 text-emerald-600" />
                    FARM ENVIRONMENT
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Live conditions at {displayedFarmName}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-100">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  LIVE METRICS
                </span>
              </div>

              {/* Real Environmental Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 text-xs transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:border-emerald-300 hover:shadow-xs">
                  <div className="flex items-center gap-1.5 text-slate-600 font-bold">
                    <Thermometer className="h-4 w-4 text-amber-600" />
                    <span>Temperature</span>
                  </div>
                  <div className="mt-2.5 text-2xl font-black text-slate-900">{temp.toFixed(1)}°C</div>
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 text-xs transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:border-emerald-300 hover:shadow-xs">
                  <div className="flex items-center gap-1.5 text-slate-600 font-bold">
                    <CloudSun className="h-4 w-4 text-sky-600" />
                    <span>Humidity</span>
                  </div>
                  <div className="mt-2.5 text-2xl font-black text-slate-900">{humidity.toFixed(0)}%</div>
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 text-xs transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:border-emerald-300 hover:shadow-xs">
                  <div className="flex items-center gap-1.5 text-slate-600 font-bold">
                    <Activity className="h-4 w-4 text-purple-600" />
                    <span>THI Status</span>
                  </div>
                  <div className="mt-2.5 text-xl font-black text-slate-900 truncate">{thiStatus}</div>
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 text-xs transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:border-emerald-300 hover:shadow-xs">
                  <div className="flex items-center gap-1.5 text-slate-600 font-bold">
                    <Users className="h-4 w-4 text-emerald-600" />
                    <span>Active Cows</span>
                  </div>
                  <div className="mt-2.5 text-2xl font-black text-slate-900">{activeCowCount}</div>
                </div>
              </div>
            </div>

            {/* Health Alerts & AI Action Recommendations Grid */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              
              {/* Active Health Alerts Card */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Bell className="h-4 w-4 text-amber-500" />
                    Active Health Alerts ({healthAlerts.length})
                  </h3>
                  <Link
                    to="/health-alerts"
                    className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-900"
                  >
                    <span>View All</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                {healthAlerts.length === 0 ? (
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-5 text-center text-xs font-bold text-emerald-900">
                    ✓ All cows passed health & thermal stress evaluation.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {healthAlerts.slice(0, 3).map((alert) => (
                      <div
                        key={alert.id}
                        onClick={() => navigate("/health-alerts")}
                        className="group flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 text-xs hover:bg-white hover:border-emerald-300 hover:shadow-xs transition-all duration-200 cursor-pointer"
                      >
                        <div>
                          <div className="font-bold text-slate-900 group-hover:text-emerald-950 transition-colors">
                            {alert.alert_type}
                          </div>
                          <div className="text-slate-500 mt-0.5">
                            {alert.description || "Health check alert"}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-0.5 font-extrabold text-[11px] ${
                              alert.alert_level === "Critical"
                                ? "bg-rose-100 text-rose-800"
                                : alert.alert_level === "Warning"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {alert.alert_level}
                          </span>
                          <ArrowRight className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* AI Action Recommendations Card */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-emerald-600" />
                      What should you do next?
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">AI Action Recommendations</p>
                  </div>
                  <Link
                    to="/recommendations"
                    className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-900"
                  >
                    <span>View All</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                {!summary?.recent_recommendations || summary.recent_recommendations.length === 0 ? (
                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-5 text-center text-xs text-slate-500 font-medium">
                    No active recommendations generated yet.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {summary.recent_recommendations.slice(0, 3).map((rec, idx) => (
                      <div
                        key={rec.id}
                        onClick={() => navigate("/recommendations")}
                        className="group flex items-start justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 text-xs hover:bg-white hover:border-emerald-300 hover:shadow-xs transition-all duration-200 cursor-pointer"
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-[11px] font-extrabold text-emerald-900">
                            0{idx + 1}
                          </span>
                          <div>
                            <div className="font-bold text-slate-900 group-hover:text-emerald-950 transition-colors">
                              {rec.title}
                            </div>
                            <div className="text-slate-600 mt-0.5 leading-snug">
                              {rec.description}
                            </div>
                          </div>
                        </div>

                        <ArrowRight className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200 shrink-0 mt-1" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Access Workspace Tiles */}
            <div className="space-y-3 pt-2">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                QUICK ACCESS WORKSPACE TILES
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                {[
                  { label: "Cows", icon: MousePointer, to: "/cows" },
                  { label: "Predictions", icon: Gauge, to: "/predictions" },
                  { label: "Alerts", icon: Bell, to: "/health-alerts" },
                  { label: "Digital Twin", icon: Layers, to: "/digital-twin" },
                  { label: "Simulation", icon: FlaskConical, to: "/simulation" },
                  { label: "Explainability", icon: Sparkles, to: "/explainability" },
                  { label: "Genetics", icon: Dna, to: "/genetics" },
                  { label: "Recommendations", icon: Repeat, to: "/recommendations" },
                ].map((tile) => (
                  <button
                    key={tile.to}
                    type="button"
                    onClick={() => navigate(tile.to)}
                    className="group flex flex-col items-center justify-center rounded-xl border border-slate-200/90 bg-white p-3 text-center shadow-2xs hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-xs transition-all duration-200"
                  >
                    <tile.icon className="h-4 w-4 text-slate-600 group-hover:text-emerald-600 transition-colors" />
                    <span className="mt-1.5 text-[11px] font-bold text-slate-800 group-hover:text-emerald-950 transition-colors truncate w-full">
                      {tile.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

          </div>
        </section>

        {/* Executive Report Modal */}
        <ExecutiveReportModal
          open={executiveReportOpen}
          farmId={farmId}
          summary={summary}
          trends={trends}
          healthAlerts={healthAlerts}
          onClose={() => setExecutiveReportOpen(false)}
        />
      </div>
    </DashboardLayout>
  );
}

export default DashboardPage;
