import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchCows,
  Cow,
  createCow,
  updateCow,
  deleteCow,
} from "@/services/cow";
import { fetchBreeds } from "@/services/breed";
import DashboardLayout from "@/layouts/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import AddCowDialog from "@/components/cows/AddCowDialog";
import EditCowDialog from "@/components/cows/EditCowDialog";
import DeleteCowDialog from "@/components/cows/DeleteCowDialog";

export function formatAge(age_months?: number | null): string {
  if (age_months === undefined || age_months === null || isNaN(Number(age_months))) {
    return "—";
  }
  const total = Math.max(0, Math.floor(Number(age_months)));
  const years = Math.floor(total / 12);
  const months = total % 12;

  if (years > 0 && months > 0) {
    return `${years} yr${years > 1 ? "s" : ""} ${months} mo${months > 1 ? "s" : ""}`;
  }
  if (years > 0) {
    return `${years} year${years > 1 ? "s" : ""}`;
  }
  if (months > 0) {
    return `${months} month${months > 1 ? "s" : ""}`;
  }
  return "0 months";
}

function errorMessage(error: unknown): string {
  const anyErr = error as any;
  return (
    anyErr?.response?.data?.detail ??
    anyErr?.message ??
    "Something went wrong. Please try again."
  );
}

export default function CowListPage() {
  const { currentFarmId } = useAuth();
  const farmId = currentFarmId || localStorage.getItem("current_farm_id");
  const [search, setSearch] = useState("");
  const [breedFilter, setBreedFilter] = useState("");
  const [editing, setEditing] = useState<Cow | null>(null);
  const [deleting, setDeleting] = useState<Cow | null>(null);
  const [adding, setAdding] = useState(false);

  const queryClient = useQueryClient();

  const {
    data: cows = [],
    isLoading,
    isError,
    error,
  } = useQuery<Cow[], Error>({
    queryKey: ["cows", farmId],
    queryFn: () => fetchCows(farmId as string),
    enabled: !!farmId,
  });

  const { data: breedList = [] } = useQuery({
    queryKey: ["breeds"],
    queryFn: fetchBreeds,
  });

  const breedNameById = useMemo(() => {
    const map = new Map<string, string>();
    breedList.forEach((b) => map.set(b.id, b.canonical_name));
    return map;
  }, [breedList]);

  const breedName = (idOrName?: string) =>
    idOrName ? (breedNameById.get(idOrName) ?? idOrName) : undefined;

  const filteredCows = useMemo(() => {
    return cows.filter((cow) => {
      const queryTerm = search.trim().toLowerCase();
      const matchesSearch = queryTerm
        ? [cow.name, cow.tag]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(queryTerm))
        : true;
      const matchesBreed = breedFilter ? cow.breed === breedFilter : true;
      return matchesSearch && matchesBreed;
    });
  }, [cows, search, breedFilter]);

  const breeds = useMemo(() => {
    const set = new Set<string>();
    cows.forEach((c) => c.breed && set.add(c.breed));
    return Array.from(set).sort((a, b) =>
      (breedName(a) ?? a).localeCompare(breedName(b) ?? b),
    );
  }, [cows, breedNameById]);

  const createMut = useMutation<Cow, Error, Partial<Cow>>({
    mutationFn: (payload: Partial<Cow>) => createCow(farmId as string, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cows", farmId] });
      setAdding(false);
    },
  });

  const updateMut = useMutation<Cow, Error, { id: string; data: Partial<Cow> }>(
    {
      mutationFn: ({ id, data }) => updateCow(id, data),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["cows", farmId] });
        setEditing(null);
      },
    },
  );

  const deleteMut = useMutation<void, Error, string>({
    mutationFn: (id: string) => deleteCow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cows", farmId] });
      setDeleting(null);
    },
  });

  if (!farmId) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-7xl rounded-2xl border border-amber-100 bg-amber-50 p-6 shadow-sm text-amber-900">
          No farm is selected. Please choose a farm from the Farms page or
          contact your administrator.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Cows</h2>
          <div>
            <button
              onClick={() => {
                createMut.reset();
                setAdding(true);
              }}
              className="rounded bg-sky-600 px-3 py-1 text-white"
            >
              Add Cow
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or tag"
            className="rounded border px-3 py-2"
          />
          <select
            value={breedFilter}
            onChange={(e) => setBreedFilter(e.target.value)}
            className="rounded border px-3 py-2"
          >
            <option value="">All breeds</option>
            {breeds.map((b) => (
              <option key={b} value={b}>
                {breedName(b)}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 overflow-x-auto">
          {isLoading ? (
            <div className="p-6">Loading cows...</div>
          ) : isError ? (
            <div className="p-6 text-rose-600">
              Error: {(error as any)?.message ?? "Failed to load"}
            </div>
          ) : filteredCows.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-700">
              <p className="mb-3 text-lg font-medium">No cows found</p>
              <p className="mb-4 text-sm text-slate-500">
                Add a new cow or adjust your search and filter criteria.
              </p>
              <button
                onClick={() => {
                  createMut.reset();
                  setAdding(true);
                }}
                className="rounded bg-sky-600 px-4 py-2 text-white"
              >
                Add Cow
              </button>
            </div>
          ) : (
            <table className="w-full min-w-[640px] table-auto rounded-2xl border border-slate-200 bg-white text-sm shadow-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-500">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Tag</th>
                  <th className="px-4 py-3">Breed</th>
                  <th className="px-4 py-3">Weight</th>
                  <th className="px-4 py-3">Age</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCows.map((c) => (
                  <tr key={c.id} className="border-t hover:bg-slate-50">
                    <td className="px-4 py-4">
                      <div className="font-medium text-slate-900">{c.name}</div>
                      <div className="text-xs text-slate-500">ID: {c.id}</div>
                    </td>
                    <td className="px-4 py-4">{c.tag ?? "—"}</td>
                    <td className="px-4 py-4">{breedName(c.breed) ?? "—"}</td>
                    <td className="px-4 py-4">{c.weight_kg ? `${c.weight_kg} kg` : "—"}</td>
                    <td className="px-4 py-4">{formatAge(c.age_months)}</td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          c.status === "active"
                            ? "bg-emerald-100 text-emerald-700"
                            : c.status === "dry" || c.status === "sick"
                              ? "bg-amber-100 text-amber-700"
                              : c.status === "deceased" || c.status === "sold"
                                ? "bg-slate-200 text-slate-700"
                                : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {c.status ?? "unknown"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <details className="relative inline-block">
                        <summary className="cursor-pointer rounded border border-slate-200 bg-slate-100 px-3 py-1 text-slate-700">
                          Actions
                        </summary>
                        <div className="absolute right-0 z-10 mt-2 w-40 rounded border border-slate-200 bg-white shadow-lg">
                          <button
                            onClick={() => {
                              updateMut.reset();
                              setEditing(c);
                            }}
                            className="w-full px-4 py-2 text-left text-slate-700 hover:bg-slate-50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              deleteMut.reset();
                              setDeleting(c);
                            }}
                            className="w-full px-4 py-2 text-left text-rose-700 hover:bg-slate-50"
                          >
                            Delete
                          </button>
                          <Link
                            to={`/cows/${c.id}`}
                            className="block w-full px-4 py-2 text-left text-sky-700 hover:bg-slate-50"
                          >
                            Details
                          </Link>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <AddCowDialog
          open={adding}
          onClose={() => {
            createMut.reset();
            setAdding(false);
          }}
          onCreate={(p) => createMut.mutate(p)}
          isSubmitting={createMut.isPending}
          submitError={createMut.isError ? errorMessage(createMut.error) : null}
        />
        {editing && (
          <EditCowDialog
            cow={editing}
            open={Boolean(editing)}
            onClose={() => {
              updateMut.reset();
              setEditing(null);
            }}
            onSave={(id, data) => updateMut.mutate({ id, data })}
            isSubmitting={updateMut.isPending}
            submitError={updateMut.isError ? errorMessage(updateMut.error) : null}
          />
        )}
        {deleting && (
          <DeleteCowDialog
            cow={deleting}
            onClose={() => {
              deleteMut.reset();
              setDeleting(null);
            }}
            onDelete={(id) => deleteMut.mutate(id)}
            isSubmitting={deleteMut.isPending}
            submitError={deleteMut.isError ? errorMessage(deleteMut.error) : null}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
