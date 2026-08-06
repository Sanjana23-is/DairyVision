import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchFarms,
  Farm,
  createFarm,
  updateFarm,
  deleteFarm,
} from "@/services/farm";
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/layouts/DashboardLayout";
import AddFarmDialog from "@/components/farms/AddFarmDialog";
import EditFarmDialog from "@/components/farms/EditFarmDialog";
import DeleteFarmDialog from "@/components/farms/DeleteFarmDialog";

export default function FarmListPage() {
  const { currentFarmId, setCurrentFarm } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery<Farm[], Error>({
    queryKey: ["farms"],
    queryFn: fetchFarms,
  });
  const farms = data ?? [];

  const [creating, setCreating] = React.useState(false);
  const [editingFarm, setEditingFarm] = React.useState<Farm | null>(null);
  const [deletingFarm, setDeletingFarm] = React.useState<Farm | null>(null);

  const createMut = useMutation({
    mutationFn: createFarm,
    onSuccess: (f: Farm) => {
      queryClient.invalidateQueries({ queryKey: ["farms"] });
      // select and navigate
      setCurrentFarm(f.id, f.name ?? null);
      navigate("/dashboard");
      setCreating(false);
    },
    onError: () => setCreating(false),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<any> }) =>
      updateFarm(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["farms"] });
      setEditingFarm(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFarm(id),
    onSuccess: (_data: any, id: string) => {
      queryClient.invalidateQueries({ queryKey: ["farms"] });
      // if deleted farm was selected, choose another or clear
      if (currentFarmId === id) {
        const remaining =
          (queryClient.getQueryData(["farms"]) as Farm[] | undefined) ?? [];
        const other = remaining.find((r) => r.id !== id) ?? null;
        if (other) {
          setCurrentFarm(other.id, other.name ?? null);
        } else {
          setCurrentFarm(null, null);
        }
      }
      setDeletingFarm(null);
    },
  });

  if (isLoading)
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            Loading farms...
          </div>
        </div>
      </DashboardLayout>
    );

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Farms</h2>
            <p className="text-sm text-slate-500">
              Select or manage your farm locations from a single workspace.
            </p>
          </div>
          <div>
            <button
              onClick={() => setCreating(true)}
              className="rounded bg-sky-600 px-4 py-2 text-sm text-white transition hover:bg-sky-700"
            >
              Create Farm
            </button>
          </div>
        </div>

        {farms.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-700">
            <p className="text-lg font-medium">No farms found</p>
            <p className="mt-2 text-sm text-slate-500">
              Create your first farm to start tracking your herd and field data.
            </p>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {farms.map((f: Farm) => (
              <li
                key={f.id}
                className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-semibold text-slate-900">{f.name}</div>
                  <div className="text-sm text-slate-500">
                    {f.location_city || f.location_country
                      ? `${f.location_city ?? ""}${f.location_city && f.location_country ? ", " : ""}${f.location_country ?? ""}`
                      : "Location not specified"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setCurrentFarm(f.id, f.name ?? null)}
                    className={`rounded px-4 py-2 text-sm font-medium transition ${
                      currentFarmId === f.id
                        ? "bg-sky-600 text-white hover:bg-sky-700"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {currentFarmId === f.id ? "Selected" : "Select"}
                  </button>
                  <button
                    onClick={() => setEditingFarm(f)}
                    className="rounded border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeletingFarm(f)}
                    className="rounded border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 transition hover:bg-rose-100"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <AddFarmDialog
          open={creating}
          onClose={() => setCreating(false)}
          loading={createMut.status === "pending"}
          onCreate={(payload) => {
            setCreating(true);
            createMut.mutate(payload);
          }}
        />

        <EditFarmDialog
          open={Boolean(editingFarm)}
          farm={editingFarm}
          onClose={() => setEditingFarm(null)}
          loading={updateMut.status === "pending"}
          onSave={(id, payload) => updateMut.mutate({ id, payload })}
        />

        <DeleteFarmDialog
          open={Boolean(deletingFarm)}
          farmName={deletingFarm?.name ?? null}
          onClose={() => setDeletingFarm(null)}
          loading={deleteMut.status === "pending"}
          onDelete={() => deletingFarm && deleteMut.mutate(deletingFarm.id)}
        />
      </div>
    </DashboardLayout>
  );
}
