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
    queryFn: () => fetchObservations(),
    enabled: !!farmId,
    refetchInterval: 15000,
  });

  const { data: cows = [] } = useQuery<Cow[], Error>({
    queryKey: ["cows", farmId],
    queryFn: () => fetchCows(farmId as string),
    enabled: !!farmId,
    refetchInterval: 30000,
  });

  const filteredObservations = useMemo(() => {
    const term = search.trim().toLowerCase();
    return observations.filter((obs) => {
      const matchesCow = selectedCow ? obs.cow_id === selectedCow : true;
      const matchesSearch = term
        ? [obs.notes, obs.observation_date, obs.cow?.name]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(term))
        : true;
      return matchesCow && matchesSearch;
    });
  }, [observations, search, selectedCow]);

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
      .map((cow) => ({ id: cow.id, name: cow.name || cow.id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [cows]);

  const clearToast = () => setToast(null);

  if (!farmId) {
    // If no farm is selected, try to fetch farms to determine if we should prompt creation
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
          <button
            onClick={() => setAdding(true)}
            className="rounded bg-sky-600 px-4 py-2 text-white"
          >
            Add Observation
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes, date, or cow"
            className="rounded border px-3 py-2"
          />
          <select
            value={selectedCow}
            onChange={(e) => setSelectedCow(e.target.value)}
            className="rounded border px-3 py-2"
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
              className="mb-4 rounded-2xl border px-4 py-3 text-sm shadow-sm"
              style={{
                backgroundColor:
                  toast.type === "success" ? "#ecfdf5" : "#fee2e2",
                borderColor: toast.type === "success" ? "#a7f3d0" : "#fecaca",
                color: toast.type === "success" ? "#14532d" : "#991b1b",
              }}
            >
              <div className="flex items-center justify-between gap-4">
                <span>{toast.message}</span>
                <button
                  type="button"
                  onClick={clearToast}
                  className="text-sm font-semibold underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
          {isLoading ? (
            <div className="p-6">Loading observations...</div>
          ) : isError ? (
            <div className="p-6 text-rose-600">
              Error: {(error as any)?.message ?? "Failed to load observations"}
            </div>
          ) : filteredObservations.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-700">
              <p className="mb-3 text-lg font-medium">No observations found</p>
              <p className="mb-4 text-sm text-slate-500">
                Create an observation to start tracking daily cow data.
              </p>
              <button
                onClick={() => setAdding(true)}
                className="rounded bg-sky-600 px-4 py-2 text-white"
              >
                Add Observation
              </button>
            </div>
          ) : (
            <table className="w-full min-w-[720px] table-auto rounded-2xl border border-slate-200 bg-white text-sm shadow-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-500">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Cow</th>
                  <th className="px-4 py-3">Milk Yield</th>
                  <th className="px-4 py-3">Feed Intake</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredObservations.map((obs) => (
                  <tr key={obs.id} className="border-t hover:bg-slate-50">
                    <td className="px-4 py-4">{obs.observation_date}</td>
                    <td className="px-4 py-4">{obs.cow?.name ?? obs.cow_id}</td>
                    <td className="px-4 py-4">
                      {obs.milk_produced_liters ?? "—"}
                    </td>
                    <td className="px-4 py-4">{obs.feed_quantity_kg ?? "—"}</td>
                    <td className="px-4 py-4">
                      {obs.notes ? obs.notes.slice(0, 40) : "—"}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to={`/observations/${obs.id}`}
                          className="rounded border border-sky-200 bg-sky-50 px-3 py-1 text-sky-700"
                        >
                          View
                        </Link>
                        <button
                          onClick={() => setEditing(obs)}
                          className="rounded border border-slate-200 bg-slate-100 px-3 py-1 text-slate-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleting(obs)}
                          className="rounded border border-rose-200 bg-rose-50 px-3 py-1 text-rose-700"
                          disabled={
                            deleteMut.isPending && deleting?.id === obs.id
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {adding && (
          <ObservationForm
            open={adding}
            cowOptions={cowOptions}
            onClose={() => setAdding(false)}
            onSave={(payload) =>
              createMut.mutateAsync({ ...payload, farm_id: farmId as string })
            }
          />
        )}

        {editing && (
          <ObservationForm
            open={Boolean(editing)}
            cowOptions={cowOptions}
            observation={editing}
            onClose={() => setEditing(null)}
            onSave={(payload) =>
              updateMut.mutateAsync({ id: editing.id, data: payload })
            }
          />
        )}

        {deleting && (
          <DeleteObservationDialog
            observation={deleting}
            open={Boolean(deleting)}
            onClose={() => setDeleting(null)}
            onDelete={(id) => deleteMut.mutate(id)}
            loading={deleteMut.isPending}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
