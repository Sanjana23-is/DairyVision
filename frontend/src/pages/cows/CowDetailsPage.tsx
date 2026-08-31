import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/layouts/DashboardLayout";
import { fetchCow } from "@/services/cow";
import { fetchObservations } from "@/services/observation";
import { fetchPredictions } from "@/services/prediction";
import { fetchHealthAlerts } from "@/services/healthAlert";
import { fetchRecommendations } from "@/services/recommendation";
import { formatAge } from "@/pages/cows/CowListPage";
import {
  ArrowLeft,
  Gauge,
  Sparkles,
  AlertTriangle,
  Repeat,
  FlaskConical,
  Scale,
  Calendar,
  ChevronRight,
} from "lucide-react";

export default function CowDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"overview" | "observations" | "predictions" | "health" | "recommendations">("overview");

  const {
    data: cow,
    isLoading: isCowLoading,
    isError: isCowError,
    error: cowError,
  } = useQuery({
    queryKey: ["cow", id],
    queryFn: () => fetchCow(id as string),
    enabled: !!id,
  });

  const { data: observations = [] } = useQuery({
    queryKey: ["cowObservations", id],
    queryFn: async () => {
      const all = await fetchObservations(cow?.farm_id);
      return all.filter((o: any) => o.cow_id === id);
    },
    enabled: !!cow?.farm_id && !!id,
  });

  const { data: predictions = [] } = useQuery({
    queryKey: ["cowPredictions", id],
    queryFn: async () => {
      const all = await fetchPredictions(cow?.farm_id);
      return all.filter((p: any) => p.cow_id === id);
    },
    enabled: !!cow?.farm_id && !!id,
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["cowAlerts", id],
    queryFn: () => fetchHealthAlerts({ farm_id: cow?.farm_id, cow_id: id }),
    enabled: !!cow?.farm_id && !!id,
  });

  const { data: recs = [] } = useQuery({
    queryKey: ["cowRecs", id],
    queryFn: async () => {
      const all = await fetchRecommendations({ farm_id: cow?.farm_id });
      return all.filter((r: any) => r.cow_id === id);
    },
    enabled: !!cow?.farm_id && !!id,
  });

  if (isCowLoading) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-5xl">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
            Loading animal profile & AI intelligence...
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (isCowError || !cow) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-5xl space-y-4">
          <button
            onClick={() => navigate("/cows")}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Cows
          </button>
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-800 shadow-sm">
            {(cowError as any)?.message || "Cow record not found."}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const latestPred = predictions[0] || null;
  const activeAlerts = alerts.filter((a: any) => !a.resolved);
  const pendingRecs = recs.filter((r: any) => !r.completed);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Back Link & Header */}
        <div className="space-y-3">
          <button
            onClick={() => navigate("/cows")}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Cows
          </button>

          {/* Profile Banner */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="text-4xl">🐄</span>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl font-black text-slate-950">{cow.name || "Unnamed Cow"}</h1>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      cow.status === "active"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    ● {cow.status ? cow.status.toUpperCase() : "ACTIVE"}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500 flex flex-wrap items-center gap-2">
                  <span>Tag: <strong>{cow.tag || cow.id.slice(0, 8)}</strong></span>
                  <span>·</span>
                  <span>Breed: <strong>{cow.breed || "Standard Breed"}</strong></span>
                  <span>·</span>
                  <span>Age: <strong>{formatAge(cow.age_months)}</strong></span>
                </div>
              </div>
            </div>

            {/* Sub-navigation Tabs */}
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
                onClick={() => setActiveTab("observations")}
                className={`rounded-xl px-3 py-1.5 transition ${
                  activeTab === "observations" ? "bg-white text-slate-950 shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Observations ({observations.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("predictions")}
                className={`rounded-xl px-3 py-1.5 transition ${
                  activeTab === "predictions" ? "bg-white text-slate-950 shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Predictions ({predictions.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("health")}
                className={`rounded-xl px-3 py-1.5 transition ${
                  activeTab === "health" ? "bg-white text-slate-950 shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Health ({activeAlerts.length})
              </button>
            </div>
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* AI Intelligence Actions Bar */}
            <div className="rounded-3xl border border-sky-100 bg-sky-50/40 p-5 shadow-xs space-y-3">
              <div className="text-xs font-extrabold uppercase tracking-wider text-sky-900 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-sky-600" />
                <span>AI Decision Intelligence Actions</span>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <Link
                  to={`/predictions`}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-white border border-sky-200 px-3.5 py-2 text-xs font-bold text-sky-900 hover:bg-sky-50 transition shadow-2xs"
                >
                  <Gauge className="h-3.5 w-3.5 text-sky-600" />
                  <span>View Predictions</span>
                </Link>

                <Link
                  to={`/explainability`}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-white border border-purple-200 px-3.5 py-2 text-xs font-bold text-purple-900 hover:bg-purple-50 transition shadow-2xs"
                >
                  <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                  <span>Why This Prediction? (SHAP)</span>
                </Link>

                <Link
                  to={`/health-alerts`}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-white border border-rose-200 px-3.5 py-2 text-xs font-bold text-rose-900 hover:bg-rose-50 transition shadow-2xs"
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                  <span>Health Issues ({activeAlerts.length})</span>
                </Link>

                <Link
                  to={`/recommendations`}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-white border border-emerald-200 px-3.5 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-50 transition shadow-2xs"
                >
                  <Repeat className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Action Recommendations ({pendingRecs.length})</span>
                </Link>

                <Link
                  to={`/simulation`}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition shadow-2xs"
                >
                  <FlaskConical className="h-3.5 w-3.5 text-sky-400" />
                  <span>Simulate This Cow (What-If)</span>
                </Link>
              </div>
            </div>

            {/* Profile Grid */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {/* Identity & Physical Details */}
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Scale className="h-4 w-4 text-slate-500" />
                  Animal Identity & Physical Characteristics
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] block">Weight</span>
                    <span className="text-sm font-extrabold text-slate-900 mt-0.5 block">{cow.weight_kg ? `${cow.weight_kg} kg` : "Not recorded"}</span>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-3">
                    <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] block">Age</span>
                    <span className="text-sm font-extrabold text-slate-900 mt-0.5 block">{formatAge(cow.age_months)}</span>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-3">
                    <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] block">Breed</span>
                    <span className="text-sm font-extrabold text-slate-900 mt-0.5 block">{cow.breed || "Standard"}</span>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-3">
                    <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] block">Tag Number</span>
                    <span className="text-sm font-extrabold text-slate-900 mt-0.5 block">{cow.tag || "—"}</span>
                  </div>
                </div>
              </div>

              {/* Latest AI Prediction Summary */}
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-sky-600" />
                    Latest Yield Prediction
                  </h3>
                  <Link to="/explainability" className="text-xs font-bold text-sky-700 hover:underline">
                    View SHAP →
                  </Link>
                </div>

                {latestPred ? (
                  <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500">Predicted Yield</span>
                      <span className="text-2xl font-black text-sky-950">{latestPred.predicted_milk_yield.toFixed(1)} L/day</span>
                    </div>
                    {latestPred.confidence_lower != null && latestPred.confidence_upper != null && (
                      <p className="text-[11px] font-semibold text-slate-600">
                        Estimated Range: {latestPred.confidence_lower.toFixed(1)} – {latestPred.confidence_upper.toFixed(1)} L/day
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-500 font-medium">
                    No prediction generated yet for this animal.
                  </div>
                )}
              </div>
            </div>

            {/* Recent Daily Observations */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-emerald-600" />
                  Recent Observations
                </h3>
                <Link to="/observations" className="text-xs font-bold text-sky-700 hover:underline">
                  All Observations →
                </Link>
              </div>

              {observations.length === 0 ? (
                <div className="text-xs text-slate-500 font-medium p-4 border border-dashed border-slate-200 rounded-2xl text-center">
                  No observation records logged for this animal yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {observations.slice(0, 3).map((obs: any) => (
                    <div key={obs.id} className="py-3 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900">{obs.observation_date}</div>
                        <div className="text-slate-500 mt-0.5">
                          Milk: <strong>{obs.milk_produced_liters ?? "—"} L</strong> · Feed: <strong>{obs.feed_quantity_kg ?? "—"} kg</strong>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Observations List */}
        {activeTab === "observations" && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Recorded Daily Observations</h3>
            {observations.length === 0 ? (
              <div className="text-xs text-slate-500 p-6 text-center">No observation entries found.</div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {observations.map((obs: any) => (
                  <div key={obs.id} className="py-3.5 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900">{obs.observation_date}</span>
                      <div className="text-slate-500 mt-1">
                        Milk: {obs.milk_produced_liters ? `${obs.milk_produced_liters} L` : "N/A"} · Feed: {obs.feed_quantity_kg ? `${obs.feed_quantity_kg} kg` : "N/A"} · Temp: {obs.body_temperature_c ? `${obs.body_temperature_c}°C` : "N/A"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Predictions List */}
        {activeTab === "predictions" && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Yield Predictions History</h3>
            {predictions.length === 0 ? (
              <div className="text-xs text-slate-500 p-6 text-center">No prediction entries found.</div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {predictions.map((p: any) => (
                  <div key={p.id} className="py-3.5 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-sky-900">{p.predicted_milk_yield.toFixed(1)} L/day</span>
                      <div className="text-slate-500 mt-1">
                        Engine: {p.model_version} · Date: {p.prediction_timestamp ? p.prediction_timestamp.slice(0, 10) : "N/A"}
                      </div>
                    </div>
                    {p.confidence_lower != null && p.confidence_upper != null && (
                      <span className="font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-xl">
                        {p.confidence_lower.toFixed(1)} – {p.confidence_upper.toFixed(1)} L
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Health Alerts List */}
        {activeTab === "health" && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Health Alerts & Issues</h3>
            {alerts.length === 0 ? (
              <div className="text-xs text-slate-500 p-6 text-center">No health alerts recorded.</div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {alerts.map((a: any) => (
                  <div key={a.id} className="py-3.5 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900">{a.description || a.alert_type}</span>
                      <div className="text-slate-500 mt-1">Level: {a.alert_level}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${a.resolved ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                      {a.resolved ? "Resolved" : a.alert_level}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
