import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/layouts/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
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
import { FileSpreadsheet, Plus } from "lucide-react";

type ToastMessage = {
  type: "success" | "error";
  message: string;
};

export default function ObservationListPage() {
  const { currentFarmId } = useAuth();
  const farmId = currentFarmId || localStorage.getItem("current_farm_id");
  const [search, setSearch] = useState("");
  const [selectedCow, setSelectedCow] = useState<string>("");
  const [editing, setEditing] = useState<Observation | null>(null);
  const [adding, setAdding] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [deleting, setDeleting] = useState<Observation | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const queryClient = useQueryClient();

  const {
    data: observations = [],
    isLoading,
    isError,
    error,
  } = useQuery<Observation[], Error>({
    queryKey: ["observations", farmId],
    queryFn: () => fetchObservations(farmId as string),
    enabled: !!farmId,
    refetchInterval: 15000,
  });

  const { data: cows = [] } = useQuery<Cow[], Error>({
    queryKey: ["cows", farmId],
    queryFn: () => fetchCows(farmId as string),
    enabled: !!farmId,
    refetchInterval: 30000,
  });

  const cowNameById = useMemo(() => {
    const map = new Map<string, string>();
    cows.forEach((cow) => map.set(cow.id, cow.name || cow.tag_id || "Unknown cow"));
    return map;
  }, [cows]);

  const cowName = (id: string) => cowNameById.get(id) ?? "Unknown cow";

  const filteredObservations = useMemo(() => {
    const term = search.trim().toLowerCase();
    return observations.filter((obs) => {
      const matchesCow = selectedCow ? obs.cow_id === selectedCow : true;
      const matchesSearch = term
        ? [obs.notes, obs.observation_date, cowName(obs.cow_id)]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(term))
        : true;
      return matchesCow && matchesSearch;
    });
  }, [observations, search, selectedCow, cowNameById]);

  const createMut = useMutation<Observation, Error, Partial<Observation>>({
    mutationFn: (payload) => createObservation(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["observations", farmId] });
      setAdding(false);
      setToast({
        type: "success",
        message: "Observation created successfully.",
      });
    },
    onError: (err) => {
      setToast({
        type: "error",
        message: err.message || "Unable to create observation.",
      });
    },
  });

  const updateMut = useMutation<
    Observation,
    Error,
    { id: string; data: Partial<Observation> }
  >({
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
        <div className="mx-auto max-w-7xl rounded-2xl border border-amber-100 bg-amber-50 p-6 shadow-sm text-amber-900">
          <p className="mb-3">
            No farm selected. Please select a farm before viewing observations.
          </p>
          <p className="mb-3">
            If you don't have a farm yet, create your first farm.
          </p>
          <div>
            <Link
              to="/farms"
              className="rounded bg-sky-600 px-4 py-2 text-white"
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
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Daily Observations</h2>
            <p className="text-sm text-slate-500">
              Track cow performance and health observations over time.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBulkUploading(true)}
              className="flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-800 hover:bg-sky-100 transition shadow-sm"
            >
              <FileSpreadsheet className="h-4 w-4 text-sky-600" />
              Bulk Import CSV
            </button>
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white hover:bg-sky-700 transition shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Add Observation
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes, date, or cow"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
          />
          <select
            value={selectedCow}
            onChange={(e) => setSelectedCow(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
          >
            <option value="">All cows</option>
            {cowOptions.map((cow) => (
              <option key={cow.id} value={cow.id}>
                {cow.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-6 overflow-x-auto">
          {toast && (
            <div
              className={`mb-4 rounded-xl border p-4 text-sm font-semibold flex items-center justify-between ${
                toast.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-rose-200 bg-rose-50 text-rose-900"
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

          {isLoading ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Loading observations…
            </div>
          ) : isError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              Error loading observations: {error?.message}
            </div>
          ) : filteredObservations.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
              No daily observations found. Use <strong className="text-slate-800">Add Observation</strong> or <strong className="text-slate-800">Bulk Import CSV</strong> to create records.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5">Cow</th>
                    <th className="p-3.5">Milk Yield</th>
                    <th className="p-3.5">Feed (kg)</th>
                    <th className="p-3.5">Health Condition</th>
                    <th className="p-3.5">Notes</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                  {filteredObservations.map((obs) => (
                    <tr key={obs.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3.5 font-bold text-slate-900">{obs.observation_date}</td>
                      <td className="p-3.5 font-bold text-sky-900">
                        {cowName(obs.cow_id)}
                      </td>
                      <td className="p-3.5 font-black text-slate-950">
                        {obs.milk_produced_liters != null ? `${obs.milk_produced_liters.toFixed(1)} L` : "-"}
                      </td>
                      <td className="p-3.5 text-slate-700">
                        {obs.feed_quantity_kg != null ? `${obs.feed_quantity_kg.toFixed(1)} kg` : "-"}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize ${
                            obs.health_condition === "fever" || obs.health_condition === "mastitis"
                              ? "bg-rose-100 text-rose-800"
                              : obs.health_condition === "lameness"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {obs.health_condition || "normal"}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-500 max-w-xs truncate">
                        {obs.notes || obs.health_notes || "-"}
                      </td>
                      <td className="p-3.5 text-right space-x-2">
                        <button
                          onClick={() => setEditing(obs)}
                          className="font-bold text-sky-700 hover:text-sky-900"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleting(obs)}
                          className="font-bold text-rose-600 hover:text-rose-800"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
