import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/layouts/DashboardLayout";
import StatCard from "@/components/cards/StatCard";
import MilkProductionChart, { type MilkChartPoint } from "@/components/charts/MilkProductionChart";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
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
  Activity,
  ArrowRight,
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

export function DashboardPage() {
  const { user, currentFarmId, currentFarmName } = useAuth();
  const { t } = useLanguage();
  const farmId = currentFarmId || localStorage.getItem("current_farm_id");
  const [executiveReportOpen, setExecutiveReportOpen] = useState(false);
  const navigate = useNavigate();

  if (!farmId) {
    return <Navigate to="/select-farm" replace />;
  }

  const getGreetingText = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t("dashboard.good_morning", "Good morning");
    if (hour < 18) return t("dashboard.good_afternoon", "Good afternoon");
    return t("dashboard.good_evening", "Good evening");
  };

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
          title: t("nav.predictions", "Milk production"),
          text: t("dashboard.performing_target", "Performing on target"),
          link: "/predictions",
        });
      } else {
        insights.push({
          icon: "🥛",
          title: t("nav.predictions", "Milk production"),
          text: "Slightly below expected target",
          link: "/predictions",
        });
      }
    } else {
      insights.push({
        icon: "🥛",
        title: t("nav.predictions", "Milk production"),
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
        title: t("dashboard.thermal_conditions", "Thermal Conditions"),
        text: "Heat stress alert zone (THI high)",
        link: "/explainability",
      });
    } else {
      insights.push({
        icon: "🌡️",
        title: t("dashboard.thermal_conditions", "Thermal Conditions"),
        text: t("dashboard.thi_comfortable", "THI within comfortable zone"),
        link: "/explainability",
      });
    }

    if (activeAlertsCount > 0) {
      insights.push({
        icon: "🐄",
        title: t("dashboard.herd_health", "Herd Health"),
        text: `${activeAlertsCount} ${t("dashboard.cows_monitoring", "cows require monitoring")}`,
        link: "/health-alerts",
      });
    } else {
      insights.push({
        icon: "🐄",
        title: t("dashboard.herd_health", "Herd Health"),
        text: "All cows pass health checks",
        link: "/health-alerts",
      });
    }

    return insights;
  }, [actualMilkToday, expectedMilkToday, activeCowCount, summary, activeAlertsCount, t]);

  const displayedFarmName = currentFarmName || summary?.farm?.name || "Luna Farm";
  const displayedUserName = user?.full_name || "Farm Manager";

  const temp = summary?.todays_weather?.temperature ?? 26.0;
  const humidity = summary?.todays_weather?.humidity ?? 60.0;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-12 select-none">
        
        {/* SECTION 1 — FARM INTELLIGENCE */}
        <section className="space-y-6">
          {/* Header & Greeting */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {getGreetingText()}, {displayedUserName} 👋
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                {t("dashboard.heres_happening", "Here's what's happening at")}{" "}
                <strong className="text-slate-800 font-bold">{displayedFarmName}</strong>{" "}
                {t("dashboard.today", "today.")}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setExecutiveReportOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200/90 bg-emerald-50/70 px-4 py-2.5 text-xs font-bold text-emerald-900 shadow-2xs hover:bg-emerald-100 hover:border-emerald-300 transition-all duration-200"
              >
                <FileText className="h-4 w-4 text-emerald-600" />
                <span>{t("dashboard.executive_report", "Executive Report & Export")}</span>
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
                  title={t("dashboard.total_cows", "TOTAL COWS")}
                  value={activeCowCount}
                  delta={t("dashboard.active_herd", "Active herd in workspace")}
                  icon={<Users className="h-5 w-5" />}
                  onClick={() => navigate("/cows")}
                />

                <StatCard
                  title={t("dashboard.milk_today", "MILK PRODUCED TODAY")}
                  value={`${actualMilkToday.toFixed(1)} L`}
                  delta={t("dashboard.today_actual", "Today's actual yield")}
                  icon={<Droplet className="h-5 w-5" />}
                  onClick={() => navigate("/observations")}
                />

                <StatCard
                  title={t("dashboard.expected_yield", "EXPECTED YIELD TODAY")}
                  value={`${expectedMilkToday.toFixed(1)} L`}
                  delta={t("dashboard.ai_yield_target", "AI model yield target")}
                  icon={<TrendingUp className="h-5 w-5" />}
                  onClick={() => navigate("/predictions")}
                />

                <StatCard
                  title={t("dashboard.active_alerts", "ACTIVE HEALTH ALERTS")}
                  value={activeAlertsCount}
                  delta={activeAlertsCount > 0 ? `${activeAlertsCount} ${t("dashboard.require_attention", "require attention")}` : t("status.normal", "Normal")}
                  icon={<Bell className="h-5 w-5" />}
                  onClick={() => navigate("/health-alerts")}
                />
              </div>

              {/* Milk Production Overview & Live Farm Insights */}
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
                        {t("dashboard.live_insights", "LIVE FARM INSIGHTS")}
                      </h2>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {t("dashboard.realtime_monitoring", "Real-time AI monitoring & thermal conditions")}
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
      </div>

      {/* Executive Report Modal */}
      <ExecutiveReportModal
        open={executiveReportOpen}
        onClose={() => setExecutiveReportOpen(false)}
        farmId={farmId}
        summary={summary}
        healthAlerts={healthAlerts}
      />
    </DashboardLayout>
  );
}

export default DashboardPage;
