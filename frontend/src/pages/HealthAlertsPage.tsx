import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import DashboardLayout from "@/layouts/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import {
  fetchHealthAlerts,
  resolveHealthAlert,
  type HealthAlert,
} from "@/services/healthAlert";
import HealthAlertsTable from "@/components/healthAlerts/HealthAlertsTable";
import HealthAlertDetailsModal from "@/components/healthAlerts/HealthAlertDetailsModal";
import ResolveHealthAlertDialog from "@/components/healthAlerts/ResolveHealthAlertDialog";

const alertLevels = ["All", "Healthy", "Warning", "Critical"] as const;

export default function HealthAlertsPage() {
  const { currentFarmId } = useAuth();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const queryPredictionId = searchParams.get("predictionId");

  const [alertLevel, setAlertLevel] = useState<string>("All");
  const [resolvedFilter, setResolvedFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedCow, setSelectedCow] = useState("");
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
        resolvedFilter === "all" ? undefined : resolvedFilter === "resolved",
      prediction_id: queryPredictionId ?? undefined,
      search: search || undefined,
      cow_id: selectedCow || undefined,
    };
  }, [alertLevel, resolvedFilter, search, selectedCow, queryPredictionId]);

  const {
    data = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["healthAlerts", filters],
    queryFn: () => fetchHealthAlerts(filters),
    enabled: !!currentFarmId,
    staleTime: 1000 * 30,
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => resolveHealthAlert(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["healthAlerts"] });
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

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Health Alerts</h2>
            <p className="text-sm text-slate-500">
              Monitor alert levels and resolve risks for your herd.
            </p>
          </div>
        </div>

        {toast ? (
          <div className="mt-4 rounded-2xl border bg-white p-4 shadow-sm">
            <div
              className={`text-sm ${toast.type === "success" ? "text-sky-700" : "text-rose-700"}`}
            >
              {toast.message}
            </div>
            <button
              type="button"
              onClick={clearToast}
              className="mt-3 text-xs text-slate-500 underline"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <select
            value={alertLevel}
            onChange={(e) => setAlertLevel(e.target.value)}
            className="rounded border px-3 py-2"
          >
            {alertLevels.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
          <select
            value={resolvedFilter}
            onChange={(e) => setResolvedFilter(e.target.value)}
            className="rounded border px-3 py-2"
          >
            <option value="all">All statuses</option>
            <option value="resolved">Resolved</option>
            <option value="unresolved">Unresolved</option>
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cow, description, or type"
            className="rounded border px-3 py-2"
          />
          <input
            value={selectedCow}
            onChange={(e) => setSelectedCow(e.target.value)}
            placeholder="Filter by cow id"
            className="rounded border px-3 py-2"
          />
        </div>

        <div className="mt-6">
          {isLoading ? (
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              Loading health alerts...
            </div>
          ) : isError ? (
            <div className="rounded-2xl border bg-rose-50 p-6 text-rose-700">
              Error loading health alerts. {(error as any)?.message}
            </div>
          ) : (
            <HealthAlertsTable
              data={data}
              onOpenDetails={setDetailsAlert}
              onOpenResolve={setResolveAlert}
            />
          )}
        </div>
      </div>

      {detailsAlert ? (
        <HealthAlertDetailsModal
          alert={detailsAlert}
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
