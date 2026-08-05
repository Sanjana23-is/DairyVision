import DashboardLayout from "@/layouts/DashboardLayout";
import StatCard from "@/components/cards/StatCard";
import PlaceholderChart from "@/components/charts/PlaceholderChart";
import { fetchDashboardSummary } from "@/services/dashboard";
import { useQuery } from "@tanstack/react-query";
import { Activity, Droplet, CloudSun, Package } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export function DashboardPage() {
  const { currentFarmId } = useAuth();
  const farmId = currentFarmId || localStorage.getItem("current_farm_id");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["dashboardSummary", farmId],
    queryFn: () => fetchDashboardSummary(farmId as string),
    staleTime: 1000 * 30,
    enabled: !!farmId,
  });

  const totalCows = data?.totalCows ?? data?.total_cows ?? "-";
  const todaysPrediction =
    data?.todaysPrediction ?? data?.todays_prediction ?? "-";
  const activeAlerts = data?.activeAlerts ?? data?.active_alerts ?? "-";
  const currentWeather = data?.currentWeather ??
    data?.current_weather ?? { temp: "-" };

  const recentPredictions =
    data?.recentPredictions ?? data?.recent_predictions ?? [];
  const recentAlerts = data?.recentAlerts ?? data?.recent_alerts ?? [];
  const recommendations = data?.recommendations ?? [];

  if (!farmId) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-7xl rounded-2xl border border-amber-100 bg-amber-50 p-6 shadow-sm text-amber-900">
          No farm is selected. Please choose a farm from the Farms page or
          contact your administrator.
        </div>
      </DashboardLayout>
    );
  }

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
                    ? `${todaysPrediction} L`
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
                value={`${currentWeather.temp} °C`}
                icon={<CloudSun />}
              />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <PlaceholderChart title="Milk Yield Trend" />
              </div>

              <div className="space-y-6">
                <PlaceholderChart title="Weather Summary" />
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="text-sm font-medium text-slate-700">
                    Recent Health Alerts
                  </div>
                  <ul className="mt-3 space-y-2 text-sm text-slate-600">
                    {recentAlerts.map((a: any) => (
                      <li
                        key={a.id}
                        className="flex items-start justify-between"
                      >
                        <div>
                          <div className="font-medium text-slate-800">
                            {a.cow}
                          </div>
                          <div className="text-xs text-slate-500">
                            {a.message}
                          </div>
                        </div>
                        <div className="text-xs text-rose-600">{a.level}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="text-sm font-medium text-slate-700">
                    Recent Predictions
                  </div>
                  <ul className="mt-3 divide-y divide-slate-100 text-sm text-slate-600">
                    {recentPredictions.map((p: any) => (
                      <li
                        key={p.id}
                        className="flex items-center justify-between py-3"
                      >
                        <div>
                          <div className="font-medium text-slate-800">
                            {p.cow}
                          </div>
                          <div className="text-xs text-slate-500">
                            Predicted: {p.predicted} L
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div>
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="text-sm font-medium text-slate-700">
                    AI Recommendations
                  </div>
                  <ul className="mt-3 space-y-3 text-sm text-slate-600">
                    {recommendations.map((r: any) => (
                      <li
                        key={r.id}
                        className="flex items-start justify-between"
                      >
                        <div>
                          <div className="font-medium text-slate-800">
                            {r.title}
                          </div>
                          <div className="text-xs text-slate-500">
                            Priority: {r.priority}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
