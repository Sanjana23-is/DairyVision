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
import RecommendationsTable from "@/components/recommendations/RecommendationsTable";
import RecommendationDetailsModal from "@/components/recommendations/RecommendationDetailsModal";
import DeleteRecommendationDialog from "@/components/recommendations/DeleteRecommendationDialog";

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
  const [completion, setCompletion] = useState("all");
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
      category: category !== "All" ? category : undefined,
      priority: priority !== "All" ? priority : undefined,
      completed: completion === "all" ? undefined : completion === "completed",
      search: search || undefined,
    }),
    [category, priority, completion, search],
  );

  const {
    data = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["recommendations", filters],
    queryFn: () => fetchRecommendations(filters),
    enabled: !!currentFarmId,
    staleTime: 1000 * 30,
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

  const clearToast = () => setToast(null);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Recommendations</h2>
            <p className="text-sm text-slate-500">
              Manage AI-generated recommendations and keep your herd on track.
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
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded border px-3 py-2"
          >
            {categories.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="rounded border px-3 py-2"
          >
            {priorities.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select
            value={completion}
            onChange={(e) => setCompletion(e.target.value)}
            className="rounded border px-3 py-2"
          >
            {completionStates.map((option) => (
              <option key={option} value={option}>
                {option === "all"
                  ? "All statuses"
                  : option === "pending"
                    ? "Pending"
                    : "Completed"}
              </option>
            ))}
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, category, or priority"
            className="rounded border px-3 py-2"
          />
        </div>

        <div className="mt-6">
          {isLoading ? (
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              Loading recommendations...
            </div>
          ) : isError ? (
            <div className="rounded-2xl border bg-rose-50 p-6 text-rose-700">
              Error loading recommendations. {(error as any)?.message}
            </div>
          ) : (
            <RecommendationsTable
              data={data}
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
