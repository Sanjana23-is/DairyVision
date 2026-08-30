import { useMemo } from "react";
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
import { Users, Droplet, TrendingUp, Bell } from "lucide-react";

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
  const {
    data: trends,
    isLoading: isTrendsLoading,
    isError: isTrendsError,
  } = useQuery({
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-sm text-slate-500">
              Farm overview and real-time performance indicators
            </p>
          </div>
          <div className="text-xs font-semibold text-slate-500">
            Farm: <span className="text-sky-700 font-bold">{summary?.farm?.name || "Luna"}</span>
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
                title="EXPECTED MILK TODAY"
                value={`${expectedMilkToday.toFixed(1)} L`}
                delta="Predicted target"
                icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
              />

              <StatCard
                title="HEALTH ALERTS"
                value={activeAlertsCount}
                delta={activeAlertsCount > 0 ? "Requires attention" : "All clear"}
                icon={<Bell className={`h-5 w-5 ${activeAlertsCount > 0 ? "text-rose-600" : "text-emerald-600"}`} />}
              />
            </div>

            {/* 3. MILK PRODUCTION OVERVIEW CHART */}
            <div className="w-full">
              {isTrendsLoading ? (
                <div className="rounded-3xl border border-slate-100 bg-white p-8 text-center text-slate-400">
                  Loading production overview...
                </div>
              ) : isTrendsError ? (
                <div className="rounded-3xl border border-slate-100 bg-white p-6 text-sm text-slate-500">
                  Milk production history is currently offline.
                </div>
              ) : (
                <MilkProductionChart points={chartPoints} />
              )}
            </div>

            {/* 4. AI INSIGHTS — COMPACT OPTIONAL ROW */}
            {aiInsights.length > 0 && (
              <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm space-y-2.5">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  AI Insights
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {aiInsights.map((insight, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-700"
                    >
                      <span className="text-sm">{insight.icon}</span>
                      <span>{insight.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
