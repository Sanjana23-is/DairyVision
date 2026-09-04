import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchCows,
  Cow,
  createCow,
  updateCow,
  deleteCow,
} from "@/services/cow";
import { fetchBreeds } from "@/services/breed";
import { fetchHealthAlerts } from "@/services/healthAlert";
import DashboardLayout from "@/layouts/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import AddCowDialog from "@/components/cows/AddCowDialog";
import EditCowDialog from "@/components/cows/EditCowDialog";
import DeleteCowDialog from "@/components/cows/DeleteCowDialog";
import {
  Plus,
  ArrowRight,
  MoreVertical,
  Users,
  CheckCircle2,
  Scale,
  AlertTriangle,
  Search,
} from "lucide-react";

export function formatAge(age_months?: number | null): string {
  if (age_months === undefined || age_months === null || isNaN(Number(age_months))) {
    return "—";
  }
  const total = Math.max(0, Math.floor(Number(age_months)));
  const years = Math.floor(total / 12);
  const months = total % 12;

  if (years > 0 && months > 0) {
    return `${years}y ${months}m`;
  }
  if (years > 0) {
    return `${years}y`;
  }
  if (months > 0) {
    return `${months}m`;
  }
  return "0m";
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentFarmId, currentFarmName } = useAuth();
  const { t } = useLanguage();
  const farmId = currentFarmId || localStorage.getItem("current_farm_id");

  const [search, setSearch] = useState("");
  const [breedFilter, setBreedFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Cow | null>(null);
  const [deleting, setDeleting] = useState<Cow | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const displayedFarmName = currentFarmName || "Luna Farm";

  // Data Queries
  const {
    data: cows = [],
    isLoading,
    isError,
    error,
  } = useQuery<Cow[], Error>({
    queryKey: ["cows", farmId],
    queryFn: () => fetchCows(farmId as string),
    enabled: !!farmId,
    staleTime: 1000 * 30,
  });

  const { data: breedsList = [] } = useQuery({
    queryKey: ["breeds"],
    queryFn: fetchBreeds,
    staleTime: 1000 * 60 * 5,
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["healthAlerts", farmId],
    queryFn: () => fetchHealthAlerts({ farm_id: farmId as string }),
    enabled: !!farmId,
    staleTime: 1000 * 30,
  });

  const breedNameById = useMemo(() => {
    const map = new Map<string, string>();
    breedsList.forEach((b: any) => map.set(b.id, b.name));
    return map;
  }, [breedsList]);

  const breedName = (b?: string | null) => {
    if (!b) return null;
    return breedNameById.get(b) ?? b;
  };

  const filteredCows = useMemo(() => {
    const queryTerm = search.trim().toLowerCase();
    return cows.filter((cow) => {
      const matchesSearch = queryTerm
        ? [cow.name, cow.tag, cow.id]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(queryTerm))
        : true;
      const matchesBreed = breedFilter ? cow.breed === breedFilter : true;
      const matchesStatus = statusFilter ? cow.status === statusFilter : true;
      return matchesSearch && matchesBreed && matchesStatus;
    });
  }, [cows, search, breedFilter, statusFilter]);

  const breeds = useMemo(() => {
    const set = new Set<string>();
    cows.forEach((c) => c.breed && set.add(c.breed));
    return Array.from(set).sort((a, b) =>
      (breedName(a) ?? a).localeCompare(breedName(b) ?? b),
    );
  }, [cows, breedNameById]);

  // Metric Summaries (Real Data Only)
  const activeCount = cows.filter((c) => c.status === "active").length;
  const activeAlertsCount = alerts.filter((a: any) => !a.resolved).length;
  const weights = cows.map((c) => c.weight_kg).filter((w): w is number => typeof w === "number" && w > 0);
  const avgWeight = weights.length > 0 ? Math.round(weights.reduce((a, b) => a + b, 0) / weights.length) : null;

  const createMut = useMutation<Cow, Error, Partial<Cow>>({
    mutationFn: (payload: Partial<Cow>) => createCow(farmId as string, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cows", farmId] });
      setAdding(false);
    },
  });

  const updateMut = useMutation<Cow, Error, { id: string; data: Partial<Cow> }>({
    mutationFn: ({ id, data }) => updateCow(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cows", farmId] });
      setEditing(null);
    },
  });

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
        <div className="mx-auto max-w-7xl rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm text-amber-900">
          <p className="font-bold text-sm">No farm is currently active.</p>
          <p className="text-xs text-amber-700 mt-1">
            Please choose a farm from the Farms page to manage cattle.
          </p>
          <Link to="/farms" className="inline-block mt-3 rounded-2xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-sm">
            Go to Farms Page
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              🐄 {t("cows.title", "Cattle Herd")}
            </h1>
            <p className="text-sm text-slate-500">
              {t("cows.subtitle", "Manage cattle in")} <strong className="text-slate-800">{displayedFarmName}</strong>.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              createMut.reset();
              setAdding(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition"
          >
            <Plus className="h-4 w-4" />
            <span>{t("cows.add_cow", "Add Cow")}</span>
          </button>
        </div>

        {/* Real Metric Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl border border-emerald-100 bg-emerald-50/40 p-5 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider">{t("cows.total_cows", "TOTAL COWS")}</div>
              <div className="mt-1 text-3xl font-black text-emerald-950">{cows.length}</div>
              <p className="mt-1 text-xs text-emerald-700">{t("cows.tracked_in_herd", "Tracked in farm herd")}</p>
            </div>
            <Users className="h-7 w-7 text-emerald-600/40" />
          </div>

          <div className="rounded-3xl border border-emerald-100 bg-emerald-50/40 p-5 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider">{t("cows.active_animals", "ACTIVE ANIMALS")}</div>
              <div className="mt-1 text-3xl font-black text-emerald-950">{activeCount}</div>
              <p className="mt-1 text-xs text-emerald-700">{t("cows.in_active_production", "In active production")}</p>
            </div>
            <CheckCircle2 className="h-7 w-7 text-emerald-600/40" />
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t("cows.avg_weight", "AVG WEIGHT")}</div>
              <div className="mt-1 text-3xl font-black text-slate-900">
                {avgWeight ? `${avgWeight} kg` : "—"}
              </div>
              <p className="mt-1 text-xs text-slate-400">{t("cows.herd_weight_estimate", "Herd weight estimate")}</p>
            </div>
            <Scale className="h-7 w-7 text-slate-400/40" />
          </div>

          <div className="rounded-3xl border border-amber-100 bg-amber-50/40 p-5 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-amber-800 uppercase tracking-wider">{t("cows.active_alerts", "ACTIVE ALERTS")}</div>
              <div className="mt-1 text-3xl font-black text-amber-950">{activeAlertsCount}</div>
              <p className="mt-1 text-xs text-amber-700">{t("cows.health_issues_flagged", "Health issues flagged")}</p>
            </div>
            <AlertTriangle className="h-7 w-7 text-amber-600/40" />
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("cows.search_placeholder", "Search cow name or tag ID...")}
              className="w-full rounded-2xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs text-slate-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <select
            value={breedFilter}
            onChange={(e) => setBreedFilter(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">{t("cows.all_breeds", "All Breeds")}</option>
            {breeds.map((b) => (
              <option key={b} value={b}>
                {breedName(b)}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">{t("cows.all_statuses", "All Statuses")}</option>
            <option value="active">Active</option>
            <option value="dry">Dry</option>
            <option value="sick">Sick</option>
            <option value="deceased">Deceased</option>
            <option value="sold">Sold</option>
          </select>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
          {isLoading ? (
            <div className="p-8 text-center text-slate-500 text-xs font-semibold">Loading cattle herd...</div>
          ) : isError ? (
            <div className="p-6 text-rose-600 text-xs font-semibold">
              Error loading cattle: {(error as any)?.message ?? "Failed to load"}
            </div>
          ) : filteredCows.length === 0 ? (
            <div className="p-12 text-center text-slate-600 space-y-3">
              <p className="text-base font-bold text-slate-900">No cattle found</p>
              <p className="text-xs text-slate-500">
                Add a new cow to this farm or adjust your search and breed filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  createMut.reset();
                  setAdding(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4" />
                <span>{t("cows.add_cow", "Add Cow")}</span>
              </button>
            </div>
          ) : (
            <table className="w-full table-auto">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">{t("cows.cow_tag_id", "COW / TAG ID")}</th>
                  <th className="px-4 py-3.5">{t("cows.breed", "BREED")}</th>
                  <th className="px-4 py-3.5">{t("cows.weight", "WEIGHT")}</th>
                  <th className="px-4 py-3.5">{t("cows.age", "AGE")}</th>
                  <th className="px-4 py-3.5">{t("cows.status", "STATUS")}</th>
                  <th className="px-4 py-3.5 text-right">{t("cows.action", "ACTION")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredCows.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-slate-50/80 transition cursor-pointer"
                    onClick={() => navigate(`/cows/${c.id}`)}
                  >
                    <td className="px-5 py-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <span>🐄</span>
                        <div>
                          <div className="text-sm font-bold text-slate-950">{c.name || c.tag || "Unnamed Cow"}</div>
                          <div className="text-[11px] font-mono text-slate-400">Tag: {c.tag || c.id.slice(0, 8)}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4 font-medium text-slate-800">
                      {breedName(c.breed) ?? "—"}
                    </td>

                    <td className="px-4 py-4 font-semibold text-slate-800">
                      {c.weight_kg ? `${c.weight_kg} kg` : "—"}
                    </td>

                    <td className="px-4 py-4 font-medium text-slate-600">
                      {formatAge(c.age_months)}
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          c.status === "active"
                            ? "bg-emerald-100 text-emerald-800"
                            : c.status === "dry" || c.status === "sick"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        ● {c.status ? c.status.toUpperCase() : "ACTIVE"}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/cows/${c.id}`}
                          className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                        >
                          <span>Open</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>

                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
                            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>

                          {openMenuId === c.id && (
                            <>
                              <div
                                className="fixed inset-0 z-10"
                                onClick={() => setOpenMenuId(null)}
                              />
                              <div className="absolute right-0 top-8 z-20 w-32 rounded-2xl border border-slate-200 bg-white py-1 shadow-lg text-xs font-semibold text-slate-700 text-left">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    updateMut.reset();
                                    setEditing(c);
                                  }}
                                  className="w-full px-3 py-2 hover:bg-slate-50 text-slate-800"
                                >
                                  Edit Cow
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    deleteMut.reset();
                                    setDeleting(c);
                                  }}
                                  className="w-full px-3 py-2 hover:bg-rose-50 text-rose-600"
                                >
                                  Delete Cow
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
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
