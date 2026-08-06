import DashboardLayout from "@/layouts/DashboardLayout";
import StatCard from "@/components/cards/StatCard";
import SimpleLineChart from "@/components/charts/SimpleLineChart";
import {
  fetchDashboardSummary,
  fetchDashboardTrends,
} from "@/services/dashboard";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Droplet,
  CloudSun,
  Package,
  Sparkles,
  BarChart3,
  Thermometer,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

function formatTrendLabel(dateString: string) {
  try {
    return new Date(dateString).toLocaleDateString(undefined, {
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

  const {
    data: trends,
    isLoading: isTrendsLoading,
    isError: isTrendsError,
    error: trendsError,
  } = useQuery({
    queryKey: ["dashboardTrends", farmId],
    queryFn: () => fetchDashboardTrends(farmId as string),
    staleTime: 1000 * 30,
    enabled: !!farmId,
  });

  const totalCows = summary?.total_cow_count ?? "-";
  const todaysPrediction = summary?.average_predicted_milk_yield ?? "-";
  const activeAlerts = summary?.active_health_alerts?.length ?? 0;
  const currentWeather = summary?.todays_weather ?? { temperature: "-" };
  const totalMilk = summary?.total_milk_produced ?? "-";
  const avgMilkPerCow = summary?.average_milk_per_cow ?? "-";
  const activeRecommendations = summary?.active_recommendations ?? "-";
  const predictionAccuracy = summary?.prediction_accuracy ?? null;

  const recentObservations = summary?.recent_observations ?? [];
  const recentRecommendations = summary?.recent_recommendations ?? [];

  const milkYieldData =
    trends?.milk_yield_trends?.map((item) => ({
      label: formatTrendLabel(item.date),
      value: item.average_predicted_milk_yield,
    })) ?? [];

  const weatherData =
    trends?.weather_trends?.map((item) => ({
      label: formatTrendLabel(item.date),
      value: item.average_temperature,
    })) ?? [];

  const observationData =
    trends?.observation_trends?.map((item) => ({
      label: formatTrendLabel(item.date),
      value: item.total_milk_produced,
    })) ?? [];

  const recommendationCategories =
    trends?.recommendation_category_distribution ?? [];
  const alertDistribution = trends?.health_alert_distribution ?? [];
  const cowStatusDistribution = trends?.cow_health_status_distribution ?? [];

  if (!farmId) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-7xl rounded-2xl border border-amber-100 bg-amber-50 p-6 shadow-sm text-amber-900">
          <p className="mb-3">
            No farm is selected. Please choose a farm from the Farms page or
            contact your administrator.
          </p>
          <div>
            <Link
              to="/farms"
              className="rounded bg-sky-600 px-4 py-2 text-white"
            >
              Create or Select Farm
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const isLoading = isSummaryLoading || isTrendsLoading;
  const isError = isSummaryError || isTrendsError;
  const error = summaryError ?? trendsError;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl">
        {isLoading ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            Loading dashboard...
          </div>
        ) : isError ? (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-6 text-rose-700 shadow-sm">
            Error loading dashboard:{" "}
            {(error as any)?.message ?? "Unknown error"}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-4">
              <StatCard
                title="Total Cows"
                value={totalCows}
                icon={<Activity />}
              />
              <StatCard
                title="Today's Milk Prediction"
                value={
                  typeof todaysPrediction === "number"
                    ? `${todaysPrediction.toFixed(1)} L`
                    : todaysPrediction
                }
                icon={<Package />}
              />
              <StatCard
                title="Active Alerts"
                value={activeAlerts}
                icon={<Droplet />}
              />
              <StatCard
                title="Current Weather"
                value={
                  typeof currentWeather.temperature === "number"
                    ? `${currentWeather.temperature} °C`
                    : "-"
                }
                icon={<CloudSun />}
              />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-4">
              <StatCard
                title="Total Milk Produced"
                value={
                  typeof totalMilk === "number"
                    ? `${totalMilk.toFixed(1)} L`
                    : totalMilk
                }
                icon={<Sparkles />}
              />
              <StatCard
                title="Avg Milk / Cow"
                value={
                  typeof avgMilkPerCow === "number"
                    ? `${avgMilkPerCow.toFixed(1)} L`
                    : avgMilkPerCow
                }
                icon={<BarChart3 />}
              />
              <StatCard
                title="Active Recommendations"
                value={activeRecommendations}
                icon={<ShieldCheck />}
              />
              <StatCard
                title="Prediction Accuracy"
                value={
                  predictionAccuracy !== null
                    ? `${predictionAccuracy.toFixed(1)}%`
                    : "N/A"
                }
                icon={<Thermometer />}
              />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
              <SimpleLineChart
                title="Milk Yield Trend"
                valueLabel="Avg predicted milk yield"
                data={milkYieldData}
                color="#0f766e"
              />
              <SimpleLineChart
                title="Weather Trend"
                valueLabel="Avg temperature"
                data={weatherData}
                color="#1d4ed8"
              />
              <SimpleLineChart
                title="Milk Production"
                valueLabel="Total milk produced"
                data={observationData}
                color="#f59e0b"
              />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="text-sm font-medium text-slate-700">
                  Recommendation Categories
                </div>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  {recommendationCategories.length === 0 ? (
                    <li>No categories available.</li>
                  ) : (
                    recommendationCategories.map((item) => (
                      <li
                        key={item.category}
                        className="flex items-center justify-between"
                      >
                        <div>{item.category}</div>
                        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {item.count}
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="text-sm font-medium text-slate-700">
                  Alert Distribution
                </div>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  {alertDistribution.length === 0 ? (
                    <li>No alerts available.</li>
                  ) : (
                    alertDistribution.map((item) => (
                      <li
                        key={item.category}
                        className="flex items-center justify-between"
                      >
                        <div>{item.category}</div>
                        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {item.count}
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="text-sm font-medium text-slate-700">
                  Cow Status
                </div>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  {cowStatusDistribution.length === 0 ? (
                    <li>No cow statuses available.</li>
                  ) : (
                    cowStatusDistribution.map((item) => (
                      <li
                        key={item.category}
                        className="flex items-center justify-between"
                      >
                        <div>{item.category}</div>
                        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {item.count}
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="text-sm font-medium text-slate-700">
                  Recent Observations
                </div>
                <div className="mt-3 space-y-3 text-sm text-slate-600">
                  {recentObservations.length === 0 ? (
                    <div>No recent observations.</div>
                  ) : (
                    recentObservations.map((observation) => (
                      <div
                        key={observation.id}
                        className="rounded-xl border border-slate-100 bg-slate-50 p-3"
                      >
                        <div className="font-medium text-slate-800">
                          {observation.cow_name ?? observation.cow_id}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {new Date(
                            observation.observation_date,
                          ).toLocaleDateString()}{" "}
                          · {observation.milk_produced_liters ?? "-"} L
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="text-sm font-medium text-slate-700">
                  Recent Recommendations
                </div>
                <ul className="mt-3 space-y-3 text-sm text-slate-600">
                  {recentRecommendations.length === 0 ? (
                    <li>No recent recommendations.</li>
                  ) : (
                    recentRecommendations.map((recommendation) => (
                      <li
                        key={recommendation.id}
                        className="rounded-xl border border-slate-100 bg-slate-50 p-3"
                      >
                        <div className="font-medium text-slate-800">
                          {recommendation.title}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Priority: {recommendation.priority}
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
