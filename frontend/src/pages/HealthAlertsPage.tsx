import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, RefreshCw } from "lucide-react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { fetchHealthAlerts, fetchHealthSummary, resolveHealthAlert } from "@/services/healthAlert";
import { fetchAnomalies, fetchAnomalySummary, triggerAnomalyScan, resolveAnomaly } from "@/services/anomaly";
import { fetchCows } from "@/services/cow";
import { fetchObservations } from "@/services/observation";
import {
  correlateHerdRiskCases,
  calculateHerdRiskKPIs,
  filterCasesBySummaryType,
  exportRiskReportCSV,
  SummaryFilterType,
} from "@/services/riskCorrelation";
import RiskKpiRow from "@/components/healthRisk/RiskKpiRow";
import PriorityCowsGrid from "@/components/healthRisk/PriorityCowsGrid";
import UnifiedRiskDetailModal from "@/components/healthRisk/UnifiedRiskDetailModal";

export default function HealthAlertsPage() {
  const { currentFarmId, currentFarmName } = useAuth();
  const { language, t } = useLanguage();
  const qc = useQueryClient();

  const [activeFilter, setActiveFilter] = useState<SummaryFilterType>("all_attention");
  const [selectedCowId, setSelectedCowId] = useState<string | null>(null);
  const lastUpdated = useMemo(() => {
    const localeMap: Record<string, string> = {
      en: "en-IN",
      hi: "hi-IN",
      mr: "mr-IN",
      pa: "pa-IN",
      gu: "gu-IN",
      kn: "kn-IN",
    };
    return new Date().toLocaleTimeString(localeMap[language] || "en-IN", { hour: "2-digit", minute: "2-digit" });
  }, [language]);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // 1. Fetch Cows for Herd Mapping
  const { data: cows = [], isLoading: isCowsLoading } = useQuery({
    queryKey: ["cows", currentFarmId],
    queryFn: () => fetchCows(currentFarmId || undefined),
    staleTime: 1000 * 60,
  });

  // 2. Fetch Health Alerts & Health Summary
  const { data: healthAlerts = [], isLoading: isAlertsLoading } = useQuery({
    queryKey: ["healthAlerts", currentFarmId],
    queryFn: () => fetchHealthAlerts({ farm_id: currentFarmId || undefined }),
    staleTime: 1000 * 30,
  });

  const { data: healthSummary } = useQuery({
    queryKey: ["healthSummary", currentFarmId],
    queryFn: () => fetchHealthSummary(currentFarmId || undefined),
    staleTime: 1000 * 30,
  });

  // 3. Fetch Anomalies & Anomaly Summary
  const { data: anomalies = [], isLoading: isAnomaliesLoading } = useQuery({
    queryKey: ["anomalies", currentFarmId],
    queryFn: () => fetchAnomalies({ farm_id: currentFarmId || undefined, cow_id: undefined }),
    staleTime: 1000 * 30,
  });

  const { data: anomalySummary } = useQuery({
    queryKey: ["anomalySummary", currentFarmId],
    queryFn: () => fetchAnomalySummary(currentFarmId || undefined),
    staleTime: 1000 * 30,
  });

  // 4. Fetch Observations for Historical Baselines & Evidence
  const { data: observations = [], isLoading: isObsLoading } = useQuery({
    queryKey: ["observations", currentFarmId],
    queryFn: () => fetchObservations(currentFarmId || undefined),
    staleTime: 1000 * 60,
  });

  // 5. Run Risk Scan Mutation
  const scanMutation = useMutation({
    mutationFn: () => triggerAnomalyScan(currentFarmId || undefined),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["anomalySummary"] });
      qc.invalidateQueries({ queryKey: ["anomalies"] });
      qc.invalidateQueries({ queryKey: ["healthSummary"] });
      qc.invalidateQueries({ queryKey: ["healthAlerts"] });
      qc.invalidateQueries({ queryKey: ["observations"] });
      setToast({
        type: "success",
        message: t("health.scan_success", "Herd Risk Scan Complete! Evaluated {count} observations across the herd.", {
          count: res.scanned_observations,
        }),
      });
    },
    onError: (err: any) => {
      setToast({
        type: "error",
        message: err?.message || t("health.scan_failed", "Failed to complete risk scan."),
      });
    },
  });

  // 6. Resolve Cow Risk Case Mutation
  const resolveMutation = useMutation({
    mutationFn: async ({ alertIds, anomalyIds }: { alertIds: string[]; anomalyIds: string[] }) => {
      const promises: Promise<any>[] = [];
      for (const id of alertIds) {
        promises.push(resolveHealthAlert(id));
      }
      for (const id of anomalyIds) {
        promises.push(resolveAnomaly(id));
      }
      return Promise.all(promises);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["healthAlerts"] });
      qc.invalidateQueries({ queryKey: ["healthSummary"] });
      qc.invalidateQueries({ queryKey: ["anomalies"] });
      qc.invalidateQueries({ queryKey: ["anomalySummary"] });
      setToast({
        type: "success",
        message: t("health.resolve_success", "Cow risk case marked as resolved."),
      });
      setSelectedCowId(null);
    },
    onError: (err: any) => {
      setToast({
        type: "error",
        message: err?.message || t("health.resolve_failed", "Unable to resolve risk case."),
      });
    },
  });

  // 7. Risk Correlation Layer (Guaranteed 1 Case Per Cow with 5 Core Dimensions)
  const correlatedCases = useMemo(() => {
    return correlateHerdRiskCases(healthAlerts, anomalies, cows, observations, t);
  }, [healthAlerts, anomalies, cows, observations, t]);

  const kpis = useMemo(() => {
    return calculateHerdRiskKPIs(healthSummary, anomalySummary, correlatedCases, cows);
  }, [healthSummary, anomalySummary, correlatedCases, cows]);

  // Filtered cases based on the selected interactive KPI card
  const filteredCases = useMemo(() => {
    return filterCasesBySummaryType(correlatedCases, activeFilter);
  }, [correlatedCases, activeFilter]);

  // Dynamically resolve active selected case from correlatedCases
  const selectedCase = useMemo(() => {
    if (!selectedCowId) return null;
    return correlatedCases.find((c) => c.cow_id === selectedCowId) || null;
  }, [correlatedCases, selectedCowId]);

  const isInitialLoading = isCowsLoading || isAlertsLoading || isAnomaliesLoading || isObsLoading;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6 font-sans">
        {/* 1. HEADER */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 dark:border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-500/30 dark:text-emerald-400 font-bold text-sm">
                🩺
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-[#F4F4F5]">
                {t("health.center_title", "Herd Health & Risk Center")}
              </h2>
            </div>
            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-[#A1A1AA]">
              {t("health.center_subtitle", "Monitor unusual patterns, health concerns, and cows requiring attention.")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs text-slate-500 dark:text-slate-400 mr-1 font-medium">
              {t("health.updated", "Updated")}: <span className="font-mono">{lastUpdated}</span>
            </span>

            {/* Run Risk Scan Button */}
            <button
              type="button"
              onClick={() => scanMutation.mutate()}
              disabled={scanMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 dark:hover:bg-emerald-500 transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${scanMutation.isPending ? "animate-spin" : ""}`} />
              <span>{scanMutation.isPending ? t("health.scanning", "Scanning Herd...") : t("health.run_scan", "Run Risk Scan")}</span>
            </button>

            {/* Export CSV Button */}
            <button
              type="button"
              onClick={() => exportRiskReportCSV(correlatedCases, currentFarmName || "Herd", t)}
              disabled={correlatedCases.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all disabled:opacity-40 cursor-pointer shadow-2xs"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{t("health.export", "Export")}</span>
            </button>
          </div>
        </div>

        {/* FEEDBACK TOAST */}
        {toast ? (
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#151719] p-4 shadow-sm">
            <span
              className={`text-xs font-bold ${
                toast.type === "success" ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
              }`}
            >
              {toast.message}
            </span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 underline cursor-pointer"
            >
              {t("common.dismiss", "Dismiss")}
            </button>
          </div>
        ) : null}

        {/* 2. INTERACTIVE SUMMARY KPI ROW (CLICKABLE FILTERS) */}
        <RiskKpiRow
          kpis={kpis}
          activeFilter={activeFilter}
          onSelectFilter={(filter) => setActiveFilter(filter)}
          isLoading={isInitialLoading}
        />

        {/* 3. SELECTED COW GROUP CARDS (1 CARD PER COW) */}
        <PriorityCowsGrid
          cases={filteredCases}
          activeFilter={activeFilter}
          onSelectCase={(riskCase) => setSelectedCowId(riskCase.cow_id)}
          onOpenMore={(riskCase) => setSelectedCowId(riskCase.cow_id)}
          isLoading={isInitialLoading}
        />
      </div>

      {/* 4. UNIFIED RISK DETAIL / MORE MODAL (COW-LEVEL) */}
      <UnifiedRiskDetailModal
        riskCase={selectedCase}
        onClose={() => setSelectedCowId(null)}
        onResolve={({ alertIds, anomalyIds }) => {
          resolveMutation.mutate({ alertIds, anomalyIds });
        }}
        isResolving={resolveMutation.isPending}
      />
    </DashboardLayout>
  );
}
