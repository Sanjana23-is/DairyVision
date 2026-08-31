import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import { Users, Droplet, TrendingUp, Bell, FileText } from "lucide-react";

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
  const { currentFarmId } = useAuth();
  const farmId = currentFarmId || localStorage.getItem("current_farm_id");
  const [executiveReportOpen, setExecutiveReportOpen] = useState(false);

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
    queryFn: () => fetchHealthAlerts({ resolved: false }),
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

  // Compact AI Insights
  const aiInsights = useMemo(() => {
    const insights: Array<{ icon: string; text: string }> = [];

    if (actualMilkToday > 0 && expectedMilkToday > 0) {
      if (actualMilkToday >= expectedMilkToday) {
        insights.push({
          icon: "🥛",
          text: "Milk production is performing on target",
        });
      } else {
        insights.push({
          icon: "🥛",
          text: "Milk yield is currently slightly below expected target",
        });
      }
    } else {
      insights.push({
        icon: "🥛",
        text: `Active herd of ${activeCowCount} cows monitored`,
      });
    }

    const temp = summary?.todays_weather?.temperature ?? 26.0;
    const humidity = summary?.todays_weather?.humidity ?? 60.0;
    const thi = summary?.todays_weather?.thi ?? ((1.8 * temp + 32.0) - ((0.55 - 0.0055 * humidity) * (1.8 * temp - 26.0)));

    if (thi >= 79) {
      insights.push({
        icon: "🌡️",
        text: "THI has increased into heat stress zone",
      });
    } else {
      insights.push({
        icon: "🌡️",
        text: "THI is within comfortable thermal zone",
      });
    }

    if (activeAlertsCount > 0) {
      insights.push({
        icon: "🐄",
        text: `${activeAlertsCount} ${activeAlertsCount === 1 ? "cow requires" : "cows require"} health monitoring`,
      });
    } else {
      insights.push({
        icon: "🐄",
        text: "All cows pass health checks",
      });
    }

    return insights;
  }, [actualMilkToday, expectedMilkToday, activeCowCount, summary, activeAlertsCount]);

  if (!farmId) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-7xl rounded-2xl border border-amber-100 bg-amber-50 p-6 shadow-sm text-amber-900">
          <p className="mb-3">
            No farm selected. Please select a farm before viewing the dashboard.
          </p>
          <div>
            <Link
              to="/farms"
              className="rounded bg-sky-600 px-4 py-2 text-white"
            >
              Select Farm
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        {/* 1. HEADER */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-sm text-slate-500">
              Farm overview and real-time performance indicators
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs font-semibold text-slate-500 hidden sm:block">
              Farm: <span className="text-sky-700 font-bold">{summary?.farm?.name || "Luna"}</span>
            </div>
            <button
              onClick={() => setExecutiveReportOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-bold text-sky-800 hover:bg-sky-100 transition shadow-sm"
            >
              <FileText className="h-4 w-4 text-sky-600" />
              Executive Report & Export
            </button>
          </div>
        </div>

        {/* Loading / Error States */}
        {isSummaryLoading ? (
          <div className="rounded-3xl border border-slate-100 bg-white p-8 text-center text-slate-500 shadow-sm">
            Loading dashboard...
          </div>
        ) : isSummaryError ? (
          <div className="rounded-3xl border border-rose-100 bg-rose-50 p-6 text-rose-700 shadow-sm">
            Unable to load dashboard: {(summaryError as any)?.message || "Network Error"}
          </div>
        ) : (
          <>
            {/* 2. FOUR KPI CARDS */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="TOTAL COWS"
                value={activeCowCount}
                delta="Active herd"
                icon={<Users className="h-5 w-5 text-sky-600" />}
              />

              <StatCard
                title="MILK PRODUCED TODAY"
                value={`${actualMilkToday.toFixed(1)} L`}
                delta="Today's actual yield"
                icon={<Droplet className="h-5 w-5 text-sky-600" />}
              />

              <StatCard
                title="EXPECTED YIELD TODAY"
                value={`${expectedMilkToday.toFixed(1)} L`}
                delta="AI model target"
                icon={<TrendingUp className="h-5 w-5 text-sky-600" />}
              />

              <StatCard
                title="ACTIVE HEALTH ALERTS"
                value={activeAlertsCount}
                delta={activeAlertsCount > 0 ? "Action required" : "All checks normal"}
                icon={<Bell className="h-5 w-5 text-amber-500" />}
              />
            </div>

            {/* 3. MAIN SECTION: MILK YIELD CHART & QUICK INSIGHTS */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-8">
                <MilkProductionChart points={chartPoints} />
              </div>

              <div className="lg:col-span-4 flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Live Farm Insights
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Real-time AI monitoring & thermal conditions
                  </p>

                  <div className="mt-6 space-y-4">
                    {aiInsights.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3.5"
                      >
                        <span className="text-lg">{item.icon}</span>
                        <p className="text-xs font-semibold text-slate-800 leading-snug">
                          {item.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-500 flex items-center justify-between">
                  <span>Weather Snapshot:</span>
                  <span className="font-bold text-slate-800">
                    {summary?.todays_weather?.temperature ?? 26}°C • {summary?.todays_weather?.humidity ?? 60}% Humidity
                  </span>
                </div>
              </div>
            </div>

            {/* 4. LOWER SECTION: HEALTH ALERTS & RECOMMENDATIONS SUMMARY */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Active Alerts List */}
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Bell className="h-4 w-4 text-amber-500" />
                    Active Health Alerts ({healthAlerts.length})
                  </h3>
                  <Link
                    to="/health-alerts"
                    className="text-xs font-bold text-sky-700 hover:text-sky-900"
                  >
                    View All →
                  </Link>
                </div>

                {healthAlerts.length === 0 ? (
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-6 text-center text-xs font-semibold text-emerald-900">
                    ✓ All cows passed health & thermal stress evaluation.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {healthAlerts.slice(0, 3).map((alert) => (
                      <div
                        key={alert.id}
                        className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-3.5 text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-900">{alert.alert_type}</div>
                          <div className="text-slate-500 mt-0.5">{alert.description || "Health check alert"}</div>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-0.5 font-bold ${
                            alert.alert_level === "Critical"
                              ? "bg-rose-100 text-rose-800"
                              : alert.alert_level === "Warning"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {alert.alert_level}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recommendations Summary */}
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    ✨ AI Action Recommendations
                  </h3>
                  <Link
                    to="/recommendations"
                    className="text-xs font-bold text-sky-700 hover:text-sky-900"
                  >
                    View All →
                  </Link>
                </div>

                {!summary?.recent_recommendations || summary.recent_recommendations.length === 0 ? (
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6 text-center text-xs text-slate-500">
                    No active recommendations generated yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {summary.recent_recommendations.slice(0, 3).map((rec) => (
                      <div
                        key={rec.id}
                        className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5 text-xs"
                      >
                        <div className="font-bold text-slate-900">{rec.title}</div>
                        <div className="text-slate-600 mt-0.5">{rec.description}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

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
