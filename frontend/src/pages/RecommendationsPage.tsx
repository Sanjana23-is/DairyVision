import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/layouts/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import {
  fetchRecommendations,
  completeRecommendation,
  batchCompleteRecommendations,
  deleteRecommendation,
  groupRecommendationsByCow,
  mapCategoryToLabel,
  type GroupedCowRecommendation,
} from "@/services/recommendation";
import { fetchCows } from "@/services/cow";
import { fetchObservations } from "@/services/observation";
import RecommendationsTable from "@/components/recommendations/RecommendationsTable";
import RecommendationDetailsModal from "@/components/recommendations/RecommendationDetailsModal";
import DeleteRecommendationDialog from "@/components/recommendations/DeleteRecommendationDialog";
import api from "@/services/api";
import { useLanguage } from "@/context/LanguageContext";

const filterCategories = [
  { value: "All", labelKey: "rec.cat.all", defaultLabel: "All Categories" },
  { value: "Nutrition", labelKey: "rec.cat.nutrition", defaultLabel: "Nutrition" },
  { value: "Heat Stress", labelKey: "rec.cat.heat_stress", defaultLabel: "Heat Stress" },
  { value: "Veterinary Care", labelKey: "rec.cat.veterinary", defaultLabel: "Veterinary Care" },
  { value: "Health Monitoring", labelKey: "rec.cat.health", defaultLabel: "Health Monitoring" },
  { value: "Hydration", labelKey: "rec.cat.hydration", defaultLabel: "Hydration" },
  { value: "Other", labelKey: "rec.cat.other", defaultLabel: "Other" },
];

const filterPriorities = [
  { value: "All", labelKey: "rec.filter.all_priorities", defaultLabel: "All Priorities" },
  { value: "High", labelKey: "rec.priority.high", defaultLabel: "High Priority" },
  { value: "Medium", labelKey: "rec.priority.medium", defaultLabel: "Medium Priority" },
  { value: "Low", labelKey: "rec.priority.low", defaultLabel: "Low Priority" },
];

const filterStatuses = [
  { value: "all", labelKey: "rec.filter.all_statuses", defaultLabel: "All Statuses" },
  { value: "pending", labelKey: "rec.filter.pending_only", defaultLabel: "Pending Only" },
  { value: "completed", labelKey: "rec.filter.completed_only", defaultLabel: "Completed Only" },
];

export default function RecommendationsPage() {
  const { currentFarmId } = useAuth();
  const qc = useQueryClient();
  const { t } = useLanguage();
  const [category, setCategory] = useState("All");
  const [priority, setPriority] = useState("All");
  const [completion, setCompletion] = useState("pending");
  const [search, setSearch] = useState("");
  const [selectedCowGroup, setSelectedCowGroup] =
    useState<GroupedCowRecommendation | null>(null);
  const [deleteRecommendationTarget, setDeleteRecommendationTarget] =
    useState<GroupedCowRecommendation | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

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
    queryKey: ["recommendations", currentFarmId],
    queryFn: () => fetchRecommendations({ farm_id: currentFarmId || undefined }),
    staleTime: 1000 * 30,
  });

  // Group raw recommendations into one consolidated entry per cow
  const allGroupedCows = useMemo(() => {
    return groupRecommendationsByCow(data, cowNameById);
  }, [data, cowNameById]);

  // Keep modal in sync when background data updates
  useEffect(() => {
    if (selectedCowGroup) {
      const match = allGroupedCows.find((g) => g.cow_id === selectedCowGroup.cow_id);
      if (match) {
        setSelectedCowGroup(match);
      }
    }
  }, [allGroupedCows]);

  // Filter grouped cows
  const filteredGroupedCows = useMemo(() => {
    return allGroupedCows.filter((g) => {
      // Category filter (omits General Farm Management; uses relevant categories)
      if (category !== "All") {
        if (
          !g.categories.includes(category) &&
          !g.recommendations.some((r) => mapCategoryToLabel(r.category) === category)
        ) {
          return false;
        }
      }
      // Priority filter
      if (
        priority !== "All" &&
        g.highest_priority !== priority &&
        !g.recommendations.some((r) => r.priority === priority)
      ) {
        return false;
      }
      // Completion filter
      if (completion === "pending" && g.pending_count === 0) {
        return false;
      }
      if (completion === "completed" && !g.is_all_completed) {
        return false;
      }
      // Search filter
      if (search.trim()) {
        const term = search.toLowerCase().trim();
        const matchesCow =
          g.cow_name.toLowerCase().includes(term) ||
          (g.cow_id && g.cow_id.toLowerCase().includes(term));
        const matchesCat = g.categories.some((c) => c.toLowerCase().includes(term));
        const matchesAction = g.recommendations.some(
          (r) =>
            r.title.toLowerCase().includes(term) ||
            (r.description && r.description.toLowerCase().includes(term)) ||
            (r.why_reason && r.why_reason.toLowerCase().includes(term))
        );
        if (!matchesCow && !matchesCat && !matchesAction) {
          return false;
        }
      }
      return true;
    });
  }, [allGroupedCows, category, priority, completion, search]);

  // Evaluate herd recommendations without generating duplicates per cow
  const generateMutation = useMutation({
    mutationFn: async () => {
      const obsList = await fetchObservations(currentFarmId || undefined);
      // Group observations by cow_id and pick only the latest observation per cow
      const latestObsByCow = new Map<string, any>();
      for (const obs of obsList || []) {
        if (!obs.cow_id) continue;
        const existing = latestObsByCow.get(obs.cow_id);
        if (
          !existing ||
          new Date(obs.observation_date).getTime() >
            new Date(existing.observation_date).getTime()
        ) {
          latestObsByCow.set(obs.cow_id, obs);
        }
      }
      let count = 0;
      for (const obs of latestObsByCow.values()) {
        try {
          await api.post("/api/v1/recommendations/generate", {
            observation_id: obs.id,
          });
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
        message: t("rec.toast.evaluated", "Herd advisory recommendations evaluated & updated!"),
      });
    },
    onError: (err: any) => {
      setToast({
        type: "error",
        message: err?.message || t("rec.toast.eval_error", "Unable to evaluate recommendations."),
      });
    },
  });

  const completeSingleMutation = useMutation({
    mutationFn: (id: string) => completeRecommendation(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recommendations"] });
      setToast({
        type: "success",
        message: t("rec.toast.action_completed", "Recommended action marked completed."),
      });
    },
    onError: (err: any) => {
      setToast({
        type: "error",
        message: err?.message || t("rec.toast.action_complete_error", "Unable to mark recommendation completed."),
      });
    },
  });

  const completeCowMutation = useMutation({
    mutationFn: (cowId: string | null) =>
      batchCompleteRecommendations({
        cow_id: cowId || undefined,
        farm_id: !cowId ? currentFarmId || undefined : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recommendations"] });
      setToast({
        type: "success",
        message: t("rec.toast.cow_completed", "All recommendations for cow marked completed."),
      });
    },
    onError: (err: any) => {
      setToast({
        type: "error",
        message: err?.message || t("rec.toast.cow_complete_error", "Unable to mark all recommendations completed."),
      });
    },
  });

  const deleteCowMutation = useMutation({
    mutationFn: async (group: GroupedCowRecommendation) => {
      for (const rec of group.recommendations) {
        await deleteRecommendation(rec.id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recommendations"] });
      setToast({
        type: "success",
        message: t("rec.toast.deleted", "Recommendations deleted successfully."),
      });
      setDeleteRecommendationTarget(null);
    },
    onError: (err: any) => {
      setToast({
        type: "error",
        message: err?.message || t("rec.toast.delete_error", "Unable to delete recommendations."),
      });
    },
  });

  const counts = useMemo(() => {
    let pending = 0;
    let high = 0;
    let completed = 0;
    for (const g of allGroupedCows) {
      if (g.is_all_completed) {
        completed++;
      } else {
        pending++;
        if (g.highest_priority === "High" || g.highest_priority === "Critical") {
          high++;
        }
      }
    }
    return { total: allGroupedCows.length, pending, high, completed };
  }, [allGroupedCows]);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-[#F4F4F5]">
              {t("rec.title", "Actionable Herd Recommendations")}
            </h2>
            <p className="text-sm text-slate-500 dark:text-[#A1A1AA]">
              {t(
                "rec.subtitle",
                "Consolidated cow advisory entries combining feeding, hydration, heat stress, and veterinary care."
              )}
            </p>
          </div>
          <button
            type="button"
            data-testid="evaluate-recommendations-btn"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-all"
          >
            {generateMutation.isPending
              ? t("rec.evaluating", "Evaluating Herd...")
              : `💡 ${t("rec.evaluate", "Evaluate Herd Recommendations")}`}
          </button>
        </div>

        {toast ? (
          <div className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] p-4 shadow-sm flex items-center justify-between">
            <span
              className={`text-sm ${
                toast.type === "success"
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-rose-700 dark:text-rose-400"
              }`}
            >
              {toast.message}
            </span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-xs text-slate-500 dark:text-[#A1A1AA] underline"
            >
              {t("common.dismiss", "Dismiss")}
            </button>
          </div>
        ) : null}

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-sky-100 dark:border-sky-900/40 bg-sky-50/40 dark:bg-sky-950/20 p-5 shadow-sm">
            <div className="text-xs font-medium text-sky-800 dark:text-sky-300">
              {t("rec.pending", "Pending Actions")}
            </div>
            <div className="mt-2 text-3xl font-bold text-sky-950 dark:text-sky-200">
              {counts.pending}
            </div>
            <p className="mt-1 text-xs text-sky-700 dark:text-sky-400">
              {t("rec.pending_subtitle", "Cows with actions needing attention")}
            </p>
          </div>

          <div className="rounded-2xl border border-rose-100 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20 p-5 shadow-sm">
            <div className="text-xs font-medium text-rose-800 dark:text-rose-300">
              {t("rec.high_priority", "High Priority")}
            </div>
            <div className="mt-2 text-3xl font-bold text-rose-950 dark:text-rose-200">
              {counts.high}
            </div>
            <p className="mt-1 text-xs text-rose-700 dark:text-rose-400">
              {t("rec.high_subtitle", "Urgent health & ration interventions")}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-500/[0.08] p-5 shadow-sm">
            <div className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
              {t("rec.completed", "Completed Actions")}
            </div>
            <div className="mt-2 text-3xl font-bold text-emerald-950 dark:text-emerald-200">
              {counts.completed}
            </div>
            <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
              {t("rec.completed_subtitle", "Cows with all actions resolved")}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] p-5 shadow-sm">
            <div className="text-xs font-medium text-slate-500 dark:text-[#A1A1AA]">
              {t("rec.total", "Total Advisories")}
            </div>
            <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-[#F4F4F5]">
              {counts.total}
            </div>
            <p className="mt-1 text-xs text-slate-400 dark:text-[#A1A1AA]/70">
              {t("rec.total_subtitle", "Unique cows with advisory plans")}
            </p>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-3 py-2 text-xs text-slate-700 dark:text-[#F4F4F5] shadow-sm"
          >
            {filterCategories.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey, option.defaultLabel)}
              </option>
            ))}
          </select>

          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-3 py-2 text-xs text-slate-700 dark:text-[#F4F4F5] shadow-sm"
          >
            {filterPriorities.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey, option.defaultLabel)}
              </option>
            ))}
          </select>

          <select
            value={completion}
            onChange={(e) => setCompletion(e.target.value)}
            className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-3 py-2 text-xs text-slate-700 dark:text-[#F4F4F5] shadow-sm"
          >
            {filterStatuses.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey, option.defaultLabel)}
              </option>
            ))}
          </select>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("rec.filter.search_placeholder", "Search cow name, action, or category...")}
            className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-3 py-2 text-xs text-slate-700 dark:text-[#F4F4F5] placeholder-slate-400 dark:placeholder-slate-500 shadow-sm"
          />
        </div>

        {/* Table */}
        <div>
          {isLoading ? (
            <div className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] p-8 text-center text-slate-500 dark:text-[#A1A1AA]">
              {t("rec.loading", "Loading recommendations...")}
            </div>
          ) : isError ? (
            <div className="rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30 p-6 text-rose-700 dark:text-rose-300">
              {t("rec.error_loading", "Error loading recommendations:")} {(error as any)?.message}
            </div>
          ) : (
            <RecommendationsTable
              data={filteredGroupedCows}
              onOpenDetails={(group) => setSelectedCowGroup(group)}
              onRequestCompleteCow={(group) =>
                completeCowMutation.mutate(group.cow_id)
              }
              onRequestDeleteCow={(group) => setDeleteRecommendationTarget(group)}
            />
          )}
        </div>
      </div>

      {selectedCowGroup ? (
        <RecommendationDetailsModal
          groupedCow={selectedCowGroup}
          open={true}
          onClose={() => setSelectedCowGroup(null)}
          onCompleteAction={(recId) => completeSingleMutation.mutate(recId)}
          onCompleteAllCow={(cowId) => completeCowMutation.mutate(cowId)}
        />
      ) : null}

      {deleteRecommendationTarget ? (
        <DeleteRecommendationDialog
          recommendation={deleteRecommendationTarget.recommendations[0]}
          open={true}
          loading={deleteCowMutation.isPending}
          onClose={() => setDeleteRecommendationTarget(null)}
          onDelete={() => deleteCowMutation.mutate(deleteRecommendationTarget)}
        />
      ) : null}
    </DashboardLayout>
  );
}
