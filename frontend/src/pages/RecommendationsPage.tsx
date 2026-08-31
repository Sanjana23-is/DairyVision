import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/layouts/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import {
  fetchRecommendations,
  completeRecommendation,
  deleteRecommendation,
  type Recommendation,
} from "@/services/recommendation";
import { fetchCows } from "@/services/cow";
import { fetchObservations } from "@/services/observation";
import RecommendationsTable from "@/components/recommendations/RecommendationsTable";
import RecommendationDetailsModal from "@/components/recommendations/RecommendationDetailsModal";
import DeleteRecommendationDialog from "@/components/recommendations/DeleteRecommendationDialog";
import api from "@/services/api";

const categories = [
  "All",
  "Water Management",
  "Feeding Strategy",
  "Heat Stress Management",
  "Observation Frequency",
  "Veterinary Attention",
  "General Farm Management",
] as const;
const priorities = ["All", "Low", "Medium", "High"] as const;
const completionStates = ["all", "pending", "completed"] as const;

export default function RecommendationsPage() {
  const { currentFarmId } = useAuth();
  const qc = useQueryClient();
  const [category, setCategory] = useState("All");
  const [priority, setPriority] = useState("All");
  const [completion, setCompletion] = useState("pending");
  const [search, setSearch] = useState("");
  const [detailsRecommendation, setDetailsRecommendation] =
    useState<Recommendation | null>(null);
  const [deleteRecommendationTarget, setDeleteRecommendationTarget] =
    useState<Recommendation | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const filters = useMemo(
    () => ({
      farm_id: currentFarmId || undefined,
      category: category !== "All" ? category : undefined,
      priority: priority !== "All" ? priority : undefined,
      completed: completion === "all" ? undefined : completion === "completed",
      search: search || undefined,
    }),
    [currentFarmId, category, priority, completion, search],
  );

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
    queryKey: ["recommendations", filters, currentFarmId],
    queryFn: () => fetchRecommendations(filters),
    staleTime: 1000 * 30,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      // Fetch latest farm observations and generate recommendations
      const obsList = await fetchObservations(currentFarmId || undefined);
      let count = 0;
      for (const obs of (obsList || []).slice(0, 5)) {
        try {
          await api.post('/api/v1/recommendations/generate', { observation_id: obs.id });
          count++;
        } catch {
          // ignore duplicate / skip errors
        }
      }
      return count;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recommendations"] });
      setToast({
        type: "success",
        message: "Herd advisory recommendations evaluated & updated!",
      });
    },
    onError: (err: any) => {
      setToast({
        type: "error",
        message: err?.message || "Failed to generate herd recommendations.",
      });
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => completeRecommendation(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recommendations"] });
      setToast({
        type: "success",
        message: "Recommendation marked completed.",
      });
      setDetailsRecommendation(null);
    },
    onError: (err: any) => {
      setToast({
        type: "error",
        message: err?.message || "Unable to mark recommendation completed.",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRecommendation(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recommendations"] });
      setToast({
        type: "success",
        message: "Recommendation deleted successfully.",
      });
      setDeleteRecommendationTarget(null);
    },
    onError: (err: any) => {
      setToast({
        type: "error",
        message: err?.message || "Unable to delete recommendation.",
      });
    },
  });

  const counts = useMemo(() => {
    let pending = 0;
    let high = 0;
    let completed = 0;
    for (const r of data) {
      if (r.completed) completed++;
      else {
        pending++;
        if (r.priority === "High" || r.priority === "Critical") high++;
      }
    }
    return { total: data.length, pending, high, completed };
  }, [data]);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">
              Actionable Herd Recommendations
            </h2>
            <p className="text-sm text-slate-500">
              AI-guided advisory actions for heat stress, ration adjustments, and veterinary care.
            </p>
          </div>
          <button
            type="button"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="inline-flex items-center justify-center rounded-2xl bg-sky-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
          >
            {generateMutation.isPending ? "Evaluating Herd..." : "💡 Evaluate Herd Recommendations"}
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
          <div className="rounded-2xl border border-sky-100 bg-sky-50/40 p-5 shadow-sm">
            <div className="text-xs font-medium text-sky-800">Pending Actions</div>
            <div className="mt-2 text-3xl font-bold text-sky-950">
              {counts.pending}
            </div>
            <p className="mt-1 text-xs text-sky-700">Advisory items needing attention</p>
          </div>

          <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-5 shadow-sm">
            <div className="text-xs font-medium text-rose-800">High Priority</div>
            <div className="mt-2 text-3xl font-bold text-rose-950">
              {counts.high}
            </div>
            <p className="mt-1 text-xs text-rose-700">Urgent health & feed actions</p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5 shadow-sm">
            <div className="text-xs font-medium text-emerald-800">Completed Actions</div>
            <div className="mt-2 text-3xl font-bold text-emerald-950">
              {counts.completed}
            </div>
            <p className="mt-1 text-xs text-emerald-700">Actioned herd advisories</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-medium text-slate-500">Total Advisories</div>
            <div className="mt-2 text-3xl font-bold text-slate-900">
              {counts.total}
            </div>
            <p className="mt-1 text-xs text-slate-400">Total recommendations tracked</p>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-2xl border bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
          >
            {categories.map((option) => (
              <option key={option} value={option}>
                Category: {option}
              </option>
            ))}
          </select>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="rounded-2xl border bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
          >
            {priorities.map((option) => (
              <option key={option} value={option}>
                Priority: {option}
              </option>
            ))}
          </select>
          <select
            value={completion}
            onChange={(e) => setCompletion(e.target.value)}
            className="rounded-2xl border bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
          >
            {completionStates.map((option) => (
              <option key={option} value={option}>
                {option === "all"
                  ? "All Statuses"
                  : option === "pending"
                    ? "Pending Only"
                    : "Completed Only"}
              </option>
            ))}
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search action title or category..."
            className="rounded-2xl border bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
          />
        </div>

        {/* Table */}
        <div>
          {isLoading ? (
            <div className="rounded-2xl border bg-white p-8 text-center text-slate-500">
              Loading recommendations...
            </div>
          ) : isError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
              Error loading recommendations: {(error as any)?.message}
            </div>
          ) : (
            <RecommendationsTable
              data={data}
              cowNameById={cowNameById}
              onOpenDetails={setDetailsRecommendation}
              onRequestComplete={(recommendation) =>
                completeMutation.mutate(recommendation.id)
              }
              onRequestDelete={setDeleteRecommendationTarget}
            />
          )}
        </div>
      </div>

      {detailsRecommendation ? (
        <RecommendationDetailsModal
          recommendation={detailsRecommendation}
          cowNameById={cowNameById}
          onClose={() => setDetailsRecommendation(null)}
        />
      ) : null}

      {deleteRecommendationTarget ? (
        <DeleteRecommendationDialog
          recommendation={deleteRecommendationTarget}
          open={true}
          loading={deleteMutation.isPending}
          onClose={() => setDeleteRecommendationTarget(null)}
          onDelete={(id) => deleteMutation.mutate(id)}
        />
      ) : null}
    </DashboardLayout>
  );
}
