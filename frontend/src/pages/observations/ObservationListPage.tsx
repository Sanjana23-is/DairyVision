import { useMemo, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/layouts/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import {
  fetchObservations,
  Observation,
  createObservation,
  updateObservation,
  deleteObservation,
} from "@/services/observation";
import { fetchCows, Cow } from "@/services/cow";
import DeleteObservationDialog from "@/components/observations/DeleteObservationDialog";
import ObservationForm from "@/components/observations/ObservationForm";
import BulkUploadModal from "@/components/observations/BulkUploadModal";
import {
  FileSpreadsheet,
  Plus,
  Search,
  MoreVertical,
  Eye,
  Edit2,
  Trash2,
} from "lucide-react";

type ToastMessage = {
  type: "success" | "error";
  message: string;
};

function formatDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function getHealthBadgeStyle(condition?: string | null) {
  const normalized = (condition || "").toLowerCase().trim();
  if (normalized === "fever" || normalized === "mastitis" || normalized === "critical") {
    return {
      label: condition || "Critical",
      className: "bg-rose-50 text-rose-800 border border-rose-200/80 font-bold",
    };
  }
  if (normalized === "lameness" || normalized === "warning" || normalized === "mild") {
    return {
      label: condition || "Warning",
      className: "bg-amber-50 text-amber-800 border border-amber-200/80 font-bold",
    };
  }
  return {
    label: condition || "Normal",
    className: "bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-bold",
  };
}

export default function ObservationListPage() {
  const { currentFarmId } = useAuth();
  const { t } = useLanguage();
  const farmId = currentFarmId || localStorage.getItem("current_farm_id");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [selectedCow, setSelectedCow] = useState("");
  const [selectedHealth, setSelectedHealth] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [adding, setAdding] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [editing, setEditing] = useState<Observation | null>(null);
  const [deleting, setDeleting] = useState<Observation | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Close overflow actions menu on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveMenuId(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const {
    data: observations = [],
    isLoading,
    isError,
    error,
  } = useQuery<Observation[], Error>({
    queryKey: ["observations", farmId],
    queryFn: () => fetchObservations(farmId as string),
    enabled: !!farmId,
    staleTime: 1000 * 30,
  });

  const { data: cows = [] } = useQuery<Cow[], Error>({
    queryKey: ["cows", farmId],
    queryFn: () => fetchCows(farmId as string),
    enabled: !!farmId,
    staleTime: 1000 * 30,
  });

  const cowNameById = useMemo(() => {
    const map = new Map<string, string>();
    cows.forEach((cow) => map.set(cow.id, cow.name || cow.tag_id || "Unknown cow"));
    return map;
  }, [cows]);

  const cowName = (id: string) => cowNameById.get(id) ?? "Unknown cow";

  const filteredObservations = useMemo(() => {
    let result = [...observations];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((o) => {
        const cName = cowName(o.cow_id).toLowerCase();
        const dateStr = o.observation_date.toLowerCase();
        const notesStr = (o.notes || "").toLowerCase();
        return cName.includes(q) || dateStr.includes(q) || notesStr.includes(q);
      });
    }

    if (selectedCow) {
      result = result.filter((o) => o.cow_id === selectedCow);
    }

    if (selectedHealth) {
      result = result.filter(
        (o) => (o.health_condition || "normal").toLowerCase() === selectedHealth.toLowerCase(),
      );
    }

    result.sort((a, b) => {
      const da = new Date(a.observation_date).getTime();
      const db = new Date(b.observation_date).getTime();
      return sortOrder === "newest" ? db - da : da - db;
    });

    return result;
  }, [observations, search, selectedCow, selectedHealth, sortOrder, cowNameById]);

  const createMut = useMutation<Observation, Error, Partial<Observation>>({
    mutationFn: (payload) => createObservation(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["observations", farmId] });
      setAdding(false);
      setToast({
        type: "success",
        message: "Daily observation added successfully.",
      });
    },
    onError: (err) => {
      setToast({
        type: "error",
        message: err.message || "Unable to add observation.",
      });
    },
  });

  const updateMut = useMutation<Observation, Error, { id: string; data: Partial<Observation> }>({
    mutationFn: ({ id, data }) => {
      const payload = farmId ? { ...data, farm_id: farmId } : data;
      return updateObservation(id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["observations", farmId] });
      setEditing(null);
      setToast({
        type: "success",
        message: "Observation updated successfully.",
      });
    },
    onError: (err) => {
      setToast({
        type: "error",
        message: err.message || "Unable to update observation.",
      });
    },
  });

  const deleteMut = useMutation<void, Error, string>({
    mutationFn: (id) => deleteObservation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["observations", farmId] });
      setDeleting(null);
      setToast({
        type: "success",
        message: "Observation deleted successfully.",
      });
    },
    onError: (err) => {
      setToast({
        type: "error",
        message: err.message || "Unable to delete observation.",
      });
    },
  });

  const cowOptions = useMemo(() => {
    return cows
      .map((cow) => ({ id: cow.id, name: cow.name || cow.tag_id || "Unknown cow" }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [cows]);

  const clearToast = () => setToast(null);

  if (!farmId) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-7xl rounded-2xl border border-amber-100 bg-amber-50 p-6 shadow-sm text-amber-900 font-sans">
          <p className="mb-3 font-semibold">
            No farm selected. Please select a farm before viewing observations.
          </p>
          <p className="mb-3 text-xs">
            If you don't have a farm yet, create your first farm.
          </p>
          <div>
            <Link
              to="/farms"
              className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 transition"
            >
              Create Your First Farm
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6 select-none font-sans">
        {/* Header Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {t("obs.title", "Daily Observations")}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              {t("obs.subtitle", "Track daily milk yield, feed intake, and cattle health observations over time.")}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setBulkUploading(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200/90 bg-emerald-50/70 px-4 py-2.5 text-xs font-bold text-emerald-900 shadow-2xs hover:bg-emerald-100 hover:border-emerald-300 transition-all duration-200"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>{t("action.bulk_import", "Bulk Import CSV")}</span>
            </button>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 active:bg-emerald-800 transition-all duration-200 border-0 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>{t("action.add_observation", "Add Observation")}</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar Card */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("action.search", "Search...")}
                className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 font-medium"
              />
            </div>

            {/* Cow Filter */}
            <div className="relative">
              <select
                value={selectedCow}
                onChange={(e) => setSelectedCow(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs text-slate-900 font-semibold focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 bg-white appearance-none cursor-pointer"
              >
                <option value="">All cows ▾</option>
                {cowOptions.map((cow) => (
                  <option key={cow.id} value={cow.id}>
                    {cow.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Health Filter */}
            <div className="relative">
              <select
                value={selectedHealth}
                onChange={(e) => setSelectedHealth(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs text-slate-900 font-semibold focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 bg-white appearance-none cursor-pointer"
              >
                <option value="">Health: All ▾</option>
                <option value="normal">Health: Normal</option>
                <option value="lameness">Health: Warning / Lameness</option>
                <option value="fever">Health: Critical / Fever</option>
                <option value="mastitis">Health: Critical / Mastitis</option>
              </select>
            </div>

            {/* Sort Date Filter */}
            <div className="relative">
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest")}
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs text-slate-900 font-semibold focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 bg-white appearance-none cursor-pointer"
              >
                <option value="newest">Date: Latest First ▾</option>
                <option value="oldest">Date: Oldest First ▾</option>
              </select>
            </div>
          </div>
        </div>

        {/* Toast Feedback Alert */}
        {toast && (
          <div
            className={`rounded-xl border p-3.5 text-xs font-bold flex items-center justify-between shadow-2xs ${
              toast.type === "success"
                ? "border-emerald-200 bg-emerald-50/80 text-emerald-900"
                : "border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            <div>{toast.message}</div>
            <button
              onClick={clearToast}
              className="text-xs opacity-70 hover:opacity-100 font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Main Data Table Area */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-8 text-center text-xs font-semibold text-slate-500 shadow-xs">
              Loading daily observations...
            </div>
          ) : isError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-xs font-semibold text-rose-800 shadow-xs">
              Error loading observations: {error?.message}
            </div>
          ) : filteredObservations.length === 0 ? (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-12 text-center text-xs text-slate-500 shadow-xs space-y-2">
              <p className="font-bold text-slate-800 text-sm">No daily observations found</p>
              <p>
                Use <strong className="text-slate-800 font-bold">Add Observation</strong> or <strong className="text-slate-800 font-bold">Bulk Import CSV</strong> to create records.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/90 border-b border-slate-200/80 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4 font-extrabold">{t("obs.date", "Date")}</th>
                      <th className="py-3.5 px-4 font-extrabold">{t("obs.cow", "Cow")}</th>
                      <th className="py-3.5 px-4 font-extrabold">{t("obs.milk_yield", "Milk Yield")}</th>
                      <th className="py-3.5 px-4 font-extrabold">{t("obs.feed_kg", "Feed (kg)")}</th>
                      <th className="py-3.5 px-4 font-extrabold">{t("obs.health_condition", "Health Condition")}</th>
                      <th className="py-3.5 px-4 text-right font-extrabold">{t("obs.actions", "Actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                    {filteredObservations.map((obs) => {
                      const badge = getHealthBadgeStyle(obs.health_condition);
                      const isMenuOpen = activeMenuId === obs.id;

                      return (
                        <tr
                          key={obs.id}
                          className="hover:bg-slate-50/80 transition-colors duration-150 group"
                        >
                          {/* Date */}
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            {formatDate(obs.observation_date)}
                          </td>

                          {/* Cow Avatar & Clickable Link */}
                          <td className="py-3.5 px-4">
                            <Link
                              to={`/cows/${obs.cow_id}`}
                              className="inline-flex items-center gap-2 font-bold text-slate-900 hover:text-emerald-700 transition group-hover:text-emerald-900"
                            >
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs">
                                🌾
                              </span>
                              <span className="truncate max-w-[160px]">
                                {cowName(obs.cow_id)}
                              </span>
                            </Link>
                          </td>

                          {/* Milk Yield */}
                          <td className="py-3.5 px-4 font-extrabold text-slate-950">
                            {obs.milk_produced_liters != null
                              ? `${obs.milk_produced_liters.toFixed(1)} L`
                              : "—"}
                          </td>

                          {/* Feed (kg) */}
                          <td className="py-3.5 px-4 text-slate-700 font-semibold">
                            {obs.feed_quantity_kg != null
                              ? `${obs.feed_quantity_kg.toFixed(1)} kg`
                              : "—"}
                          </td>

                          {/* Health Condition Semantic Badge */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] capitalize ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                          </td>

                          {/* Compact Overflow ··· Actions Menu */}
                          <td className="py-3.5 px-4 text-right relative">
                            <div className="relative inline-block text-left">
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveMenuId(isMenuOpen ? null : obs.id)
                                }
                                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 transition-all duration-150"
                                title="Actions menu"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>

                              {isMenuOpen && (
                                <>
                                  <div
                                    className="fixed inset-0 z-20"
                                    onClick={() => setActiveMenuId(null)}
                                  />
                                  <div className="absolute right-0 top-9 z-30 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl ring-1 ring-slate-900/5 text-xs font-semibold text-slate-700 space-y-0.5 select-none">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveMenuId(null);
                                        navigate(`/observations/${obs.id}`);
                                      }}
                                      className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-emerald-50/70 hover:text-emerald-900 transition"
                                    >
                                      <Eye className="h-3.5 w-3.5 text-emerald-600" />
                                      <span>View Details</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveMenuId(null);
                                        setEditing(obs);
                                      }}
                                      className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-slate-100 transition"
                                    >
                                      <Edit2 className="h-3.5 w-3.5 text-slate-600" />
                                      <span>Edit</span>
                                    </button>

                                    <div className="border-t border-slate-100 my-1" />

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveMenuId(null);
                                        setDeleting(obs);
                                      }}
                                      className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left font-bold text-rose-600 hover:bg-rose-50 transition"
                                    >
                                      <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                                      <span>Delete</span>
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modals */}
        <ObservationForm
          open={adding}
          cowOptions={cowOptions}
          onClose={() => setAdding(false)}
          onSave={(data) => createMut.mutateAsync({ ...data, farm_id: farmId })}
        />

        <ObservationForm
          open={!!editing}
          observation={editing}
          cowOptions={cowOptions}
          onClose={() => setEditing(null)}
          onSave={(data) =>
            editing && updateMut.mutateAsync({ id: editing.id, data })
          }
        />

        {deleting && (
          <DeleteObservationDialog
            open={!!deleting}
            observation={deleting}
            cowName={cowName(deleting.cow_id)}
            onClose={() => setDeleting(null)}
            onDelete={(id) => deleteMut.mutate(id)}
            loading={deleteMut.isPending}
          />
        )}

        <BulkUploadModal
          open={bulkUploading}
          farmId={farmId}
          cows={cows}
          onClose={() => setBulkUploading(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["observations", farmId] });
          }}
        />
      </div>
    </DashboardLayout>
  );
}
