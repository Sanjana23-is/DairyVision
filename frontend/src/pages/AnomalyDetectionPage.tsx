import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import DashboardLayout from "@/layouts/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import {
  fetchAnomalySummary,
  fetchAnomalies,
  triggerAnomalyScan,
  resolveAnomaly,
  type AnomalyRecord,
} from "@/services/anomaly";
import { fetchCows } from "@/services/cow";

export default function AnomalyDetectionPage() {
  const { currentFarmId } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [severityFilter, setSeverityFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("unresolved");
  const [search, setSearch] = useState<string>("");
  const [selectedRecord, setSelectedRecord] = useState<AnomalyRecord | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const filters = useMemo(() => {
    return {
      severity: severityFilter !== "All" ? severityFilter : undefined,
      resolved:
        statusFilter === "all"
          ? undefined
          : statusFilter === "resolved"
          ? true
          : false,
      search: search || undefined,
    };
  }, [severityFilter, statusFilter, search]);

  const { data: summaryData, isLoading: isSummaryLoading } = useQuery({
    queryKey: ["anomalySummary", currentFarmId],
    queryFn: () => fetchAnomalySummary(currentFarmId || undefined),
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
    data: anomalies = [],
    isLoading: isTableLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["anomalies", filters, currentFarmId],
    queryFn: () => fetchAnomalies(filters),
    staleTime: 1000 * 30,
  });

  const scanMutation = useMutation({
    mutationFn: () => triggerAnomalyScan(currentFarmId || undefined),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["anomalySummary"] });
      qc.invalidateQueries({ queryKey: ["anomalies"] });
      setToast({
        type: "success",
        message: `Herd scan completed! Evaluated ${res.scanned_observations} observations.`,
      });
    },
    onError: (err: any) => {
      setToast({
        type: "error",
        message: err?.message || "Failed to trigger anomaly scan.",
      });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => resolveAnomaly(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["anomalySummary"] });
      qc.invalidateQueries({ queryKey: ["anomalies"] });
      setToast({
        type: "success",
        message: "Anomaly marked as resolved.",
      });
      setSelectedRecord(null);
    },
    onError: (err: any) => {
      setToast({
        type: "error",
        message: err?.message || "Failed to resolve anomaly.",
      });
    },
  });

  const summary = summaryData?.summary || {
    total_scanned: 0,
    normal: 0,
    warning: 0,
    critical: 0,
    unresolved_anomalies: 0,
  };

  const topCows = summaryData?.top_anomalous_cows || [];

  function getCowDisplayName(cowId: string): string {
    if (cowNameById[cowId]) return cowNameById[cowId];
    return `Cow ${cowId.slice(0, 8)}`;
  }

  function formatDate(isoString: string): string {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return isoString;
    }
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">
              Herd Anomaly Detection
            </h2>
            <p className="text-sm text-slate-500">
              AI & behavioral outlier monitoring for milk yield, feed intake, and heat stress.
            </p>
          </div>
          <button
            type="button"
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending}
            className="inline-flex items-center justify-center rounded-2xl bg-sky-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
          >
            {scanMutation.isPending ? "Scanning Herd..." : "🔍 Run Anomaly Scan"}
          </button>
        </div>

        {toast ? (
          <div className="rounded-2xl border bg-white p-4 shadow-sm flex items-center justify-between">
            <span
              className={`text-sm ${
                toast.type === "success" ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {toast.message}
            </span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-xs text-slate-500 underline"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-medium text-slate-500">Scanned Cows</div>
            <div className="mt-2 text-3xl font-bold text-slate-900">
              {isSummaryLoading ? "…" : summary.total_scanned}
            </div>
            <p className="mt-1 text-xs text-slate-400">Total herd baseline</p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5 shadow-sm">
            <div className="text-xs font-medium text-emerald-800">Normal Patterns</div>
            <div className="mt-2 text-3xl font-bold text-emerald-950">
              {isSummaryLoading ? "…" : summary.normal}
            </div>
            <p className="mt-1 text-xs text-emerald-700">Expected baseline behavior</p>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-5 shadow-sm">
            <div className="text-xs font-medium text-amber-800">Anomaly Warnings</div>
            <div className="mt-2 text-3xl font-bold text-amber-950">
              {isSummaryLoading ? "…" : summary.warning}
            </div>
            <p className="mt-1 text-xs text-amber-700">Moderate behavioral outliers</p>
          </div>

          <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-5 shadow-sm">
            <div className="text-xs font-medium text-rose-800">Critical Anomalies</div>
            <div className="mt-2 text-3xl font-bold text-rose-950">
              {isSummaryLoading ? "…" : summary.critical}
            </div>
            <p className="mt-1 text-xs text-rose-700">High deviation outliers</p>
          </div>
        </div>

        {/* Top Anomalous Cows Section */}
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Top Anomalous Cows
              </h3>
              <p className="text-xs text-slate-500">
                Cows showing significant productivity or heat stress deviations
              </p>
            </div>
            <Link to="/cows" className="text-xs font-medium text-sky-600 hover:underline">
              View Herd →
            </Link>
          </div>

          {topCows.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-slate-500">
              <p className="text-sm font-medium">🌾 No anomalies detected!</p>
              <p className="text-xs text-slate-400 mt-1">
                All cow productivity and behavior patterns match normal expectations.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {topCows.map((c) => {
                const scorePct = Math.round(c.anomaly_score * 100);
                const isCritical = c.severity === "Critical";
                return (
                  <div
                    key={c.cow_id}
                    onClick={() => navigate("/cows")}
                    className="cursor-pointer rounded-2xl border bg-slate-50/50 p-4 transition-all hover:border-sky-300 hover:shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">
                        🐄 {c.cow_name}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          isCritical
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {c.severity}
                      </span>
                    </div>

                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Anomaly Risk Score</span>
                        <span className="font-bold text-slate-800">{scorePct}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`h-full ${
                            isCritical ? "bg-rose-500" : "bg-amber-500"
                          }`}
                          style={{ width: `${Math.max(5, scorePct)}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {c.issue_tags.map((t) => (
                        <span
                          key={t}
                          className="rounded-lg bg-white px-2 py-0.5 text-xs font-medium text-slate-600 border border-slate-200 shadow-2xs"
                        >
                          {t}
                        </span>
                      ))}
                    </div>

                    {c.last_observed_date ? (
                      <div className="mt-3 text-xs text-slate-400">
                        Last observed: {c.last_observed_date}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Filters & Anomaly Records Table */}
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-semibold text-slate-900">
              Recent Anomaly Detections
            </h3>
            <div className="flex flex-wrap gap-2">
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="rounded-2xl border bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
              >
                {["All", "Normal", "Warning", "Critical"].map((s) => (
                  <option key={s} value={s}>
                    Severity: {s}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-2xl border bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
              >
                <option value="unresolved">Active Anomalies</option>
                <option value="resolved">Resolved Anomalies</option>
                <option value="all">All Statuses</option>
              </select>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="rounded-2xl border bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
            {isTableLoading ? (
              <div className="p-8 text-center text-slate-500">Loading anomalies...</div>
            ) : isError ? (
              <div className="p-6 text-rose-700">
                Error loading anomalies: {(error as any)?.message}
              </div>
            ) : anomalies.length === 0 ? (
              <div className="p-8 text-center text-slate-600">
                <p className="text-base font-medium">🌾 No anomalies detected!</p>
                <p className="mt-1 text-sm text-slate-500">
                  All cow productivity and behavior patterns match normal expectations.
                </p>
              </div>
            ) : (
              <table className="w-full table-auto">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3.5">Cow</th>
                    <th className="px-4 py-3.5">Severity</th>
                    <th className="px-4 py-3.5">Risk Score</th>
                    <th className="px-4 py-3.5">Issue Tags</th>
                    <th className="px-4 py-3.5">Detected Date</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-sm text-slate-700">
                  {anomalies.map((a) => {
                    const isCritical = a.severity === "Critical";
                    const isWarning = a.severity === "Warning";
                    const scorePct = Math.round(a.anomaly_score * 100);
                    return (
                      <tr key={a.id} className="hover:bg-slate-50">
                        <td className="px-4 py-4 font-semibold text-slate-900">
                          {getCowDisplayName(a.cow_id)}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              isCritical
                                ? "bg-rose-100 text-rose-800"
                                : isWarning
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {a.severity}
                          </span>
                        </td>
                        <td className="px-4 py-4 font-medium text-slate-800">
                          {scorePct}%
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-1">
                            {(a.issue_tags || []).map((t) => (
                              <span
                                key={t}
                                className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-slate-500">
                          {formatDate(a.detected_at)}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              a.resolved
                                ? "bg-slate-100 text-slate-600"
                                : "bg-sky-100 text-sky-800"
                            }`}
                          >
                            {a.resolved ? "Resolved" : "Active"}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedRecord(a)}
                              className="rounded-2xl border bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                            >
                              Details
                            </button>
                            {!a.resolved ? (
                              <button
                                type="button"
                                onClick={() => resolveMutation.mutate(a.id)}
                                disabled={resolveMutation.isPending}
                                className="rounded-2xl border border-sky-600 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100"
                              >
                                Resolve
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Details Modal */}
      {selectedRecord ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                Anomaly Details
              </h3>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="text-sm text-slate-500"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 text-sm text-slate-700">
              <div className="rounded-2xl border bg-slate-50 p-4 space-y-2">
                <div>
                  <span className="text-xs text-slate-400">Cow: </span>
                  <span className="font-semibold">{getCowDisplayName(selectedRecord.cow_id)}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Severity: </span>
                  <span className="font-semibold">{selectedRecord.severity}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Score: </span>
                  <span className="font-semibold">{Math.round(selectedRecord.anomaly_score * 100)}%</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Description: </span>
                  <p className="mt-1 font-medium">{selectedRecord.description || "No description."}</p>
                </div>
              </div>

              {selectedRecord.details ? (
                <div className="rounded-2xl border bg-slate-50 p-4 space-y-1">
                  <div className="text-xs font-semibold text-slate-500 mb-2">Metrics Snapshot</div>
                  {Object.entries(selectedRecord.details).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs">
                      <span className="text-slate-500">{k}:</span>
                      <span className="font-mono text-slate-800">{v != null ? String(v) : "—"}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              {!selectedRecord.resolved ? (
                <button
                  type="button"
                  onClick={() => resolveMutation.mutate(selectedRecord.id)}
                  disabled={resolveMutation.isPending}
                  className="rounded-2xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700"
                >
                  Mark as Resolved
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="rounded-2xl border px-4 py-2 text-xs text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
