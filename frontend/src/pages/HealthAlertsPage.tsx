import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import DashboardLayout from "@/layouts/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import {
  fetchHealthAlerts,
  fetchHealthSummary,
  resolveHealthAlert,
  type HealthAlert,
} from "@/services/healthAlert";
import { fetchCows } from "@/services/cow";
import HealthAlertsTable from "@/components/healthAlerts/HealthAlertsTable";
import HealthAlertDetailsModal from "@/components/healthAlerts/HealthAlertDetailsModal";
import ResolveHealthAlertDialog from "@/components/healthAlerts/ResolveHealthAlertDialog";
import { useLanguage } from "@/context/LanguageContext";

export default function HealthAlertsPage() {
  const { currentFarmId } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const queryPredictionId = searchParams.get("predictionId");

  const [alertLevel, setAlertLevel] = useState<string>("All");
  const [resolvedFilter, setResolvedFilter] = useState<string>("unresolved");
  const [search, setSearch] = useState("");
  const [detailsAlert, setDetailsAlert] = useState<HealthAlert | null>(null);
  const [resolveAlert, setResolveAlert] = useState<HealthAlert | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const filters = useMemo(() => {
    return {
      alert_level: alertLevel !== "All" ? alertLevel : undefined,
      resolved:
        resolvedFilter === "all"
          ? undefined
          : resolvedFilter === "resolved"
          ? true
          : false,
      prediction_id: queryPredictionId ?? undefined,
      search: search || undefined,
    };
  }, [alertLevel, resolvedFilter, search, queryPredictionId]);

  const { data: summaryData, isLoading: isSummaryLoading } = useQuery({
    queryKey: ["healthSummary", currentFarmId],
    queryFn: () => fetchHealthSummary(currentFarmId || undefined),
    staleTime: 1000 * 30,
  });

  const { data: cows = [] } = useQuery({
    queryKey: ["cows", currentFarmId],
    queryFn: () => fetchCows(currentFarmId || undefined),
    staleTime: 1000 * 60,
  });

  const cowNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of cows) {
      map[c.id] = c.name || c.tag_id || "Unknown cow";
    }
    return map;
  }, [cows]);


  const {
    data = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["healthAlerts", filters, currentFarmId],
    queryFn: () => fetchHealthAlerts(filters),
    staleTime: 1000 * 30,
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => resolveHealthAlert(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["healthAlerts"] });
      qc.invalidateQueries({ queryKey: ["healthSummary"] });
      setToast({
        type: "success",
        message: "Health alert marked as resolved.",
      });
      setResolveAlert(null);
    },
    onError: (err: any) => {
      setToast({
        type: "error",
        message: err?.message || "Unable to resolve health alert.",
      });
    },
  });

  const clearToast = () => setToast(null);

  const summary = summaryData?.summary || {
    healthy: 0,
    warning: 0,
    critical: 0,
    needs_attention: 0,
    no_recent_data: 0,
    total_cows: 0,
  };


  const riskBreakdown = summaryData?.risk_breakdown || [];
  const attentionCows = summaryData?.attention_cows || [];

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-[#F4F4F5]">
              {t("health.title", "Herd Health Overview")}
            </h2>
            <p className="text-sm text-slate-500 dark:text-[#A1A1AA]">
              {t("health.subtitle", "Real-time health status, risk alerts, and herd monitoring.")}
            </p>
          </div>
        </div>

        {toast ? (
          <div className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] p-4 shadow-sm">
            <div
              className={`text-sm ${
                toast.type === "success" ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
              }`}
            >
              {toast.message}
            </div>
            <button
              type="button"
              onClick={clearToast}
              className="mt-2 text-xs text-slate-500 dark:text-[#A1A1AA] underline"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {/* Health Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-500/[0.08] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                🐄 {t("health.healthy", "Healthy")}
              </span>
              <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                {t("health.normal", "Normal")}
              </span>
            </div>
            <div className="mt-3 text-3xl font-bold text-emerald-950 dark:text-emerald-200">
              {isSummaryLoading ? "…" : summary.healthy}
            </div>
            <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
              {t("health.verified_data", "Verified recent health data")}
            </p>
          </div>

          <div className="rounded-2xl border border-amber-100 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
                ⚠️ {t("health.warning", "Warning")}
              </span>
              <span className="rounded-full bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                {t("health.moderate_risk", "Moderate Risk")}
              </span>
            </div>
            <div className="mt-3 text-3xl font-bold text-amber-950 dark:text-amber-200">
              {isSummaryLoading ? "…" : summary.warning}
            </div>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{t("health.cows_monitoring", "Cows require monitoring")}</p>
          </div>

          <div className="rounded-2xl border border-rose-100 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-rose-800 dark:text-rose-300">
                🔴 {t("health.critical", "Critical")}
              </span>
              <span className="rounded-full bg-rose-100 dark:bg-rose-900/60 px-2 py-0.5 text-xs font-semibold text-rose-800 dark:text-rose-300">
                {t("health.action_required", "Action Required")}
              </span>
            </div>
            <div className="mt-3 text-3xl font-bold text-rose-950 dark:text-rose-200">
              {isSummaryLoading ? "…" : summary.critical}
            </div>
            <p className="mt-1 text-xs text-rose-700 dark:text-rose-400">{t("health.high_severity", "High severity health risks")}</p>
          </div>

          <div className="rounded-2xl border border-sky-100 dark:border-sky-900/40 bg-sky-50/50 dark:bg-sky-950/20 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-sky-800 dark:text-sky-300">
                🩺 {t("health.needs_attention", "Needs Attention")}
              </span>
              <span className="rounded-full bg-sky-100 dark:bg-sky-900/60 px-2 py-0.5 text-xs font-semibold text-sky-800 dark:text-sky-300">
                {t("health.total", "Total")}
              </span>
            </div>
            <div className="mt-3 text-3xl font-bold text-sky-950 dark:text-sky-200">
              {isSummaryLoading ? "…" : summary.needs_attention}
            </div>
            <p className="mt-1 text-xs text-sky-700 dark:text-sky-400">{t("health.warning_critical", "Warning + Critical cows")}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-slate-50/50 dark:bg-[#151719] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700 dark:text-[#F4F4F5]">
                ❓ {t("health.no_recent", "No Recent Data")}
              </span>
              <span className="rounded-full bg-slate-200 dark:bg-[#1B1D20] px-2 py-0.5 text-xs font-semibold text-slate-700 dark:text-[#A1A1AA]">
                {t("health.unverified", "Unverified")}
              </span>
            </div>
            <div className="mt-3 text-3xl font-bold text-slate-900 dark:text-[#F4F4F5]">
              {isSummaryLoading ? "…" : summary.no_recent_data}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-[#A1A1AA]">{t("health.no_observation", "No observation in 14 days")}</p>
          </div>
        </div>


        {/* Middle Row: Risk Breakdown & Attention Cows */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Health Risk Breakdown Card */}
          <div className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900 dark:text-[#F4F4F5]">
              {t("health.risks", "Health Risks")}
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#A1A1AA] mb-4">
              {t("health.risks_subtitle", "Current active health alert breakdown")}
            </p>
            <div className="space-y-3">
              {riskBreakdown.map((r) => {
                let icon = "🩺";
                if (r.risk_type.includes("Heat")) icon = "🌡️";
                if (r.risk_type.includes("Milk")) icon = "📉";
                if (r.risk_type.includes("Temp") || r.risk_type.includes("Fever")) icon = "🤒";

                return (
                  <div
                    key={r.risk_type}
                    className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-[#27272A] bg-slate-50 dark:bg-[#1B1D20] p-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">{icon}</span>
                      <span className="text-sm font-medium text-slate-800 dark:text-[#F4F4F5]">
                        {r.risk_type}
                      </span>
                    </div>
                    <span className="rounded-full bg-slate-200/60 dark:bg-[#151719] px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:text-[#A1A1AA]">
                      {r.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cows Needing Attention */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-[#F4F4F5]">
                  {t("health.cows_attention", "Cows Needing Attention")}
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#A1A1AA]">
                  {t("health.cows_attention_subtitle", "Cows currently flagged with health alerts")}
                </p>
              </div>
              <Link
                to="/cows"
                className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline"
              >
                {t("health.view_herd", "View Herd →")}
              </Link>
            </div>

            {attentionCows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-[#27272A] p-6 text-center text-slate-500 dark:text-[#A1A1AA]">
                <p className="text-sm font-medium">🌱 {t("health.all_healthy", "All cows look healthy!")}</p>
                <p className="text-xs text-slate-400 dark:text-[#A1A1AA]/70 mt-1">
                  {t("health.no_attention", "No cows currently require health attention.")}
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {attentionCows.map((c) => (
                  <div
                    key={c.cow_id}
                    onClick={() => navigate(`/cows`)}
                    className="cursor-pointer rounded-2xl border border-slate-200 dark:border-[#27272A] p-4 transition-all hover:border-sky-300 dark:hover:border-sky-600 hover:shadow-md bg-slate-50/50 dark:bg-[#1B1D20]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900 dark:text-[#F4F4F5]">
                        🐄 {c.cow_name}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          c.alert_level === "Critical"
                            ? "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300"
                            : "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                        }`}
                      >
                        {c.alert_level}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-slate-700 dark:text-[#A1A1AA]">
                      {c.risk_type}
                    </div>
                    {c.last_observed_date ? (
                      <div className="mt-2 text-xs text-slate-400 dark:text-[#A1A1AA]/60">
                        Last observed: {c.last_observed_date}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Filter Controls & Recent Health Alerts Table */}
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-[#F4F4F5]">
              {t("health.recent_alerts", "Recent Health Alerts")}
            </h3>
            <div className="flex flex-wrap gap-2">
              <select
                value={alertLevel}
                onChange={(e) => setAlertLevel(e.target.value)}
                className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-3 py-2 text-xs text-slate-700 dark:text-[#F4F4F5] shadow-sm"
              >
                {["All", "Healthy", "Warning", "Critical"].map((lvl) => (
                  <option key={lvl} value={lvl}>
                    Severity: {lvl}
                  </option>
                ))}
              </select>

              <select
                value={resolvedFilter}
                onChange={(e) => setResolvedFilter(e.target.value)}
                className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-3 py-2 text-xs text-slate-700 dark:text-[#F4F4F5] shadow-sm"
              >
                <option value="unresolved">Active Alerts</option>
                <option value="resolved">Resolved Alerts</option>
                <option value="all">All Alerts</option>
              </select>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-3 py-2 text-xs text-slate-700 dark:text-[#F4F4F5] placeholder-slate-400 dark:placeholder-slate-500 shadow-sm"
              />
            </div>
          </div>

          <div>
            {isLoading ? (
              <div className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] p-8 text-center text-slate-500 dark:text-[#A1A1AA] shadow-sm">
                Loading health alerts...
              </div>
            ) : isError ? (
              <div className="rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30 p-6 text-rose-700 dark:text-rose-300">
                Error loading health alerts. {(error as any)?.message}
              </div>
            ) : (
              <HealthAlertsTable
                data={data}
                cowNameById={cowNameById}
                onOpenDetails={setDetailsAlert}
                onOpenResolve={setResolveAlert}
              />
            )}
          </div>
        </div>
      </div>

      {detailsAlert ? (
        <HealthAlertDetailsModal
          alert={detailsAlert}
          cowNameById={cowNameById}
          onClose={() => setDetailsAlert(null)}
        />
      ) : null}


      {resolveAlert ? (
        <ResolveHealthAlertDialog
          alert={resolveAlert}
          loading={resolveMutation.isPending}
          onClose={() => setResolveAlert(null)}
          onConfirm={() => resolveMutation.mutate(resolveAlert.id)}
        />
      ) : null}
    </DashboardLayout>
  );
}

