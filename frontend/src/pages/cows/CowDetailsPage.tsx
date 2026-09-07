import { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/layouts/DashboardLayout";
import { useLanguage } from "@/context/LanguageContext";
import { getBreedLabel, getStatusLabel, getSeverityLabel } from "@/lib/i18n-helpers";
import { fetchCow } from "@/services/cow";
import { fetchBreeds } from "@/services/breed";
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
  const { t } = useLanguage();
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

  const { data: breedsList = [] } = useQuery({
    queryKey: ["breeds"],
    queryFn: fetchBreeds,
    staleTime: 1000 * 60 * 5,
  });

  const breedNameById = useMemo(() => {
    const map = new Map<string, string>();
    breedsList.forEach((b: any) => map.set(b.id, b.canonical_name || b.name));
    return map;
  }, [breedsList]);

  const displayBreed = getBreedLabel(
    cow?.breed_name || (cow?.breed ? breedNameById.get(cow.breed) : null) || cow?.breed,
    t
  );

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
            {t("common.loading", "Loading animal profile & AI intelligence...")}
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
            {t("cows.back_to_cows", "Back to Cows")}
          </button>
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-800 shadow-sm">
            {(cowError as any)?.message || t("cows.no_cows_found", "Cow record not found.")}
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
            {t("cows.back_to_cows", "Back to Cows")}
          </button>

          {/* Profile Banner */}
          <div className="rounded-3xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] p-6 shadow-sm flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="text-4xl">🐄</span>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl font-black text-slate-950 dark:text-[#F4F4F5]">{cow.name || t("common.unknown", "Unnamed Cow")}</h1>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      cow.status === "active"
                        ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                        : "bg-slate-100 dark:bg-[#1B1D20] text-slate-600 dark:text-[#A1A1AA]"
                    }`}
                  >
                    ● {getStatusLabel(cow.status, t).toUpperCase()}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-[#A1A1AA] flex flex-wrap items-center gap-2">
                  <span>{t("cows.tag_id", "Tag")}: <strong className="text-slate-700 dark:text-[#F4F4F5]">{cow.tag || cow.id.slice(0, 8)}</strong></span>
                  <span>·</span>
                  <span>{t("cows.breed", "Breed")}: <strong className="text-slate-700 dark:text-[#F4F4F5]">{displayBreed}</strong></span>
                  <span>·</span>
                  <span>{t("cows.age", "Age")}: <strong className="text-slate-700 dark:text-[#F4F4F5]">{formatAge(cow.age_months)}</strong></span>
                </div>
              </div>
            </div>

            {/* Sub-navigation Tabs */}
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
                onClick={() => setActiveTab("observations")}
                className={`rounded-xl px-3 py-1.5 transition ${
                  activeTab === "observations" ? "bg-white dark:bg-[#151719] text-slate-950 dark:text-[#F4F4F5] shadow-xs font-bold" : "text-slate-600 dark:text-[#A1A1AA] hover:text-slate-900 dark:hover:text-[#F4F4F5]"
                }`}
              >
                {t("nav.daily_observations", "Observations")} ({observations.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("predictions")}
                className={`rounded-xl px-3 py-1.5 transition ${
                  activeTab === "predictions" ? "bg-white dark:bg-[#151719] text-slate-950 dark:text-[#F4F4F5] shadow-xs font-bold" : "text-slate-600 dark:text-[#A1A1AA] hover:text-slate-900 dark:hover:text-[#F4F4F5]"
                }`}
              >
                {t("nav.predictions", "Predictions")} ({predictions.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("health")}
                className={`rounded-xl px-3 py-1.5 transition ${
                  activeTab === "health" ? "bg-white dark:bg-[#151719] text-slate-950 dark:text-[#F4F4F5] shadow-xs font-bold" : "text-slate-600 dark:text-[#A1A1AA] hover:text-slate-900 dark:hover:text-[#F4F4F5]"
                }`}
              >
                {t("nav.health_alerts", "Health")} ({activeAlerts.length})
              </button>
            </div>
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* AI Intelligence Actions Bar */}
            <div className="rounded-3xl border border-sky-100 dark:border-sky-900/40 bg-sky-50/40 dark:bg-[#151719] p-5 shadow-xs space-y-3">
              <div className="text-xs font-extrabold uppercase tracking-wider text-sky-900 dark:text-sky-400 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                <span>{t("nav.animal_intelligence", "AI Decision Intelligence Actions")}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <Link
                  to={`/predictions`}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-white dark:bg-[#1B1D20] border border-sky-200 dark:border-[#27272A] px-3.5 py-2 text-xs font-bold text-sky-900 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-[#222428] transition shadow-2xs"
                >
                  <Gauge className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                  <span>{t("nav.predictions", "View Predictions")}</span>
                </Link>

                <Link
                  to={`/explainability`}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-white dark:bg-[#1B1D20] border border-purple-200 dark:border-[#27272A] px-3.5 py-2 text-xs font-bold text-purple-900 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-[#222428] transition shadow-2xs"
                >
                  <Sparkles className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                  <span>{t("explain.title", "Why This Prediction? (SHAP)")}</span>
                </Link>

                <Link
                  to={`/health-alerts`}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-white dark:bg-[#1B1D20] border border-rose-200 dark:border-[#27272A] px-3.5 py-2 text-xs font-bold text-rose-900 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-[#222428] transition shadow-2xs"
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                  <span>{t("nav.health_alerts", "Health Issues")} ({activeAlerts.length})</span>
                </Link>

                <Link
                  to={`/recommendations`}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-white dark:bg-[#1B1D20] border border-emerald-200 dark:border-[#27272A] px-3.5 py-2 text-xs font-bold text-emerald-900 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-[#222428] transition shadow-2xs"
                >
                  <Repeat className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{t("nav.recommendations", "Action Recommendations")} ({pendingRecs.length})</span>
                </Link>

                <Link
                  to={`/simulation`}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-900 dark:bg-emerald-900/60 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:hover:bg-emerald-800/80 transition shadow-2xs"
                >
                  <FlaskConical className="h-3.5 w-3.5 text-sky-400" />
                  <span>{t("twin.run_simulation", "Simulate This Cow (What-If)")}</span>
                </Link>
              </div>
            </div>

            {/* Profile Grid */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {/* Identity & Physical Details */}
              <div className="rounded-3xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-[#F4F4F5] flex items-center gap-2">
                  <Scale className="h-4 w-4 text-slate-500 dark:text-[#A1A1AA]" />
                  {t("cows.cow_details", "Animal Identity & Physical Characteristics")}
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-2xl bg-slate-50 dark:bg-[#1B1D20] p-3 border border-transparent dark:border-[#27272A]">
                    <span className="text-slate-400 dark:text-[#A1A1AA] font-semibold uppercase tracking-wider text-[10px] block">{t("cows.weight", "Weight")}</span>
                    <span className="text-sm font-extrabold text-slate-900 dark:text-[#F4F4F5] mt-0.5 block">{cow.weight_kg ? `${cow.weight_kg} ${t("common.units_kg", "kg")}` : t("common.no_data", "Not recorded")}</span>
                  </div>

                  <div className="rounded-2xl bg-slate-50 dark:bg-[#1B1D20] p-3 border border-transparent dark:border-[#27272A]">
                    <span className="text-slate-400 dark:text-[#A1A1AA] font-semibold uppercase tracking-wider text-[10px] block">{t("cows.age", "Age")}</span>
                    <span className="text-sm font-extrabold text-slate-900 dark:text-[#F4F4F5] mt-0.5 block">{formatAge(cow.age_months)}</span>
                  </div>

                  <div className="rounded-2xl bg-slate-50 dark:bg-[#1B1D20] p-3 border border-transparent dark:border-[#27272A]">
                    <span className="text-slate-400 dark:text-[#A1A1AA] font-semibold uppercase tracking-wider text-[10px] block">{t("cows.breed", "Breed")}</span>
                    <span className="text-sm font-extrabold text-slate-900 dark:text-[#F4F4F5] mt-0.5 block">{displayBreed}</span>
                  </div>

                  <div className="rounded-2xl bg-slate-50 dark:bg-[#1B1D20] p-3 border border-transparent dark:border-[#27272A]">
                    <span className="text-slate-400 dark:text-[#A1A1AA] font-semibold uppercase tracking-wider text-[10px] block">{t("cows.tag_id", "Tag Number")}</span>
                    <span className="text-sm font-extrabold text-slate-900 dark:text-[#F4F4F5] mt-0.5 block">{cow.tag || "—"}</span>
                  </div>
                </div>
              </div>

              {/* Latest AI Prediction Summary */}
              <div className="rounded-3xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-[#F4F4F5] flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                    {t("predictions.title", "Latest Yield Prediction")}
                  </h3>
                  <Link to="/explainability" className="text-xs font-bold text-sky-700 dark:text-sky-400 hover:underline">
                    {t("explain.title", "View SHAP →")}
                  </Link>
                </div>

                {latestPred ? (
                  <div className="rounded-2xl border border-sky-100 dark:border-sky-900/40 bg-sky-50/50 dark:bg-[#1B1D20] p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 dark:text-[#A1A1AA]">{t("predictions.model_target", "Predicted Yield")}</span>
                      <span className="text-2xl font-black text-sky-950 dark:text-sky-300">{latestPred.predicted_milk_yield.toFixed(1)} {t("common.units_l_day", "L/day")}</span>
                    </div>
                    {latestPred.confidence_lower != null && latestPred.confidence_upper != null && (
                      <p className="text-[11px] font-semibold text-slate-600 dark:text-[#A1A1AA]">
                        {t("predictions.confidence_range", "Estimated Range")}: {latestPred.confidence_lower.toFixed(1)} – {latestPred.confidence_upper.toFixed(1)} {t("common.units_l_day", "L/day")}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-100 dark:border-[#27272A] bg-slate-50 dark:bg-[#1B1D20] p-4 text-xs text-slate-500 dark:text-[#A1A1AA] font-medium">
                    {t("predictions.no_predictions_found", "No prediction generated yet for this animal.")}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Daily Observations */}
            <div className="rounded-3xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-[#F4F4F5] flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  {t("obs.title", "Recent Observations")}
                </h3>
                <Link to="/observations" className="text-xs font-bold text-sky-700 dark:text-sky-400 hover:underline">
                  {t("obs.view_all_history", "All Observations →")}
                </Link>
              </div>

              {observations.length === 0 ? (
                <div className="text-xs text-slate-500 dark:text-[#A1A1AA] font-medium p-4 border border-dashed border-slate-200 dark:border-[#27272A] rounded-2xl text-center">
                  {t("obs.no_observations_found", "No observation records logged for this animal yet.")}
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-[#27272A] text-xs">
                  {observations.slice(0, 3).map((obs: any) => (
                    <div key={obs.id} className="py-3 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-[#F4F4F5]">{obs.observation_date}</div>
                        <div className="text-slate-500 dark:text-[#A1A1AA] mt-0.5">
                          {t("obs.milk_yield", "Milk")}: <strong className="text-slate-700 dark:text-[#F4F4F5]">{obs.milk_produced_liters ?? "—"} {t("common.units_l_day", "L")}</strong> · {t("obs.feed_kg", "Feed")}: <strong className="text-slate-700 dark:text-[#F4F4F5]">{obs.feed_quantity_kg ?? "—"} {t("common.units_kg", "kg")}</strong>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-400 dark:text-[#A1A1AA]" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Observations List */}
        {activeTab === "observations" && (
          <div className="rounded-3xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-[#F4F4F5]">{t("obs.title", "Recorded Daily Observations")}</h3>
            {observations.length === 0 ? (
              <div className="text-xs text-slate-500 dark:text-[#A1A1AA] p-6 text-center">{t("obs.no_observations_found", "No observation entries found.")}</div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-[#27272A] text-xs">
                {observations.map((obs: any) => (
                  <div key={obs.id} className="py-3.5 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-[#F4F4F5]">{obs.observation_date}</span>
                      <div className="text-slate-500 dark:text-[#A1A1AA] mt-1">
                        {t("obs.milk_yield", "Milk")}: {obs.milk_produced_liters ? `${obs.milk_produced_liters} L` : "N/A"} · {t("obs.feed_kg", "Feed")}: {obs.feed_quantity_kg ? `${obs.feed_quantity_kg} kg` : "N/A"} · {t("obs.temperature", "Temp")}: {obs.body_temperature_c ? `${obs.body_temperature_c}°C` : "N/A"}
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
          <div className="rounded-3xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-[#F4F4F5]">{t("predictions.history", "Yield Predictions History")}</h3>
            {predictions.length === 0 ? (
              <div className="text-xs text-slate-500 dark:text-[#A1A1AA] p-6 text-center">{t("predictions.no_predictions_found", "No prediction entries found.")}</div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-[#27272A] text-xs">
                {predictions.map((p: any) => (
                  <div key={p.id} className="py-3.5 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-sky-900 dark:text-sky-400">{p.predicted_milk_yield.toFixed(1)} {t("common.units_l_day", "L/day")}</span>
                      <div className="text-slate-500 dark:text-[#A1A1AA] mt-1">
                        {t("predictions.model_engine", "Engine")}: {p.model_version} · {t("common.date", "Date")}: {p.prediction_timestamp ? p.prediction_timestamp.slice(0, 10) : "N/A"}
                      </div>
                    </div>
                    {p.confidence_lower != null && p.confidence_upper != null && (
                      <span className="font-semibold text-slate-600 dark:text-[#F4F4F5] bg-slate-100 dark:bg-[#1B1D20] px-2.5 py-1 rounded-xl border border-transparent dark:border-[#27272A]">
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
          <div className="rounded-3xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-[#F4F4F5]">{t("risk.health_alerts_title", "Health Alerts & Issues")}</h3>
            {alerts.length === 0 ? (
              <div className="text-xs text-slate-500 dark:text-[#A1A1AA] p-6 text-center">{t("risk.no_anomalies_found", "No health alerts recorded.")}</div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-[#27272A] text-xs">
                {alerts.map((a: any) => (
                  <div key={a.id} className="py-3.5 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-[#F4F4F5]">{a.description || a.alert_type}</span>
                      <div className="text-slate-500 dark:text-[#A1A1AA] mt-1">{t("risk.priority_triage", "Level")}: {getSeverityLabel(a.alert_level, t)}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${a.resolved ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300"}`}>
                      {a.resolved ? t("common.success", "Resolved") : getSeverityLabel(a.alert_level, t)}
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
