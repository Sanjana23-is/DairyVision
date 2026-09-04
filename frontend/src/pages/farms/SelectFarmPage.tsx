import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchFarms, Farm, createFarm, CreateFarmPayload } from "@/services/farm";
import { fetchCows } from "@/services/cow";
import { fetchHealthAlerts } from "@/services/healthAlert";
import { useAuth } from "@/context/AuthContext";
import AddFarmDialog from "@/components/farms/AddFarmDialog";
import {
  Plus,
  Users,
  AlertTriangle,
  MapPin,
  ArrowRight,
} from "lucide-react";

export default function SelectFarmPage() {
  const { user, setCurrentFarm } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [isCreatingModal, setIsCreatingModal] = useState(false);

  // Form state for onboarding (0 farms)
  const [farmName, setFarmName] = useState("");
  const [locationCity, setLocationCity] = useState("");
  const [locationCountry, setLocationCountry] = useState("India");
  const [description, setDescription] = useState("");

  const { data: farms = [], isLoading: isFarmsLoading } = useQuery<Farm[]>({
    queryKey: ["farms"],
    queryFn: fetchFarms,
  });

  const { data: allCows = [] } = useQuery({
    queryKey: ["allCowsForFarms"],
    queryFn: () => fetchCows(),
    staleTime: 1000 * 60,
    enabled: farms.length > 0,
  });

  const { data: allAlerts = [] } = useQuery({
    queryKey: ["allAlertsForFarms"],
    queryFn: () => fetchHealthAlerts(),
    staleTime: 1000 * 60,
    enabled: farms.length > 0,
  });

  const cowsCountByFarm = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of allCows) {
      if (c.farm_id) {
        map[c.farm_id] = (map[c.farm_id] || 0) + 1;
      }
    }
    return map;
  }, [allCows]);

  const alertsCountByFarm = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of allAlerts) {
      if (a.farm_id && !a.resolved) {
        map[a.farm_id] = (map[a.farm_id] || 0) + 1;
      }
    }
    return map;
  }, [allAlerts]);

  const createMut = useMutation({
    mutationFn: createFarm,
    onSuccess: (newFarm: Farm) => {
      queryClient.invalidateQueries();
      setCurrentFarm(newFarm.id, newFarm.name ?? null);
      setIsCreatingModal(false);
      navigate("/dashboard");
    },
  });

  const handleSelectFarm = (farm: Farm) => {
    setCurrentFarm(farm.id, farm.name ?? null);
    queryClient.invalidateQueries();
    navigate("/dashboard");
  };

  const handleOnboardingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmName.trim()) return;
    const payload: CreateFarmPayload = {
      name: farmName.trim(),
      location_city: locationCity.trim() || undefined,
      location_country: locationCountry.trim() || undefined,
      description: description.trim() || undefined,
    };
    createMut.mutate(payload);
  };

  if (isFarmsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200 text-xs font-semibold">
        Loading farm workspaces...
      </div>
    );
  }

  return (
    <div
      className="relative min-h-screen w-full bg-cover bg-center bg-no-repeat flex flex-col justify-between p-6 sm:p-10 select-none font-sans"
      style={{
        backgroundImage: `url('/images/dairy_farm_pasture_bg.jpg')`,
      }}
    >
      {/* Subtle translucent dark overlay matching login page mood */}
      <div className="absolute inset-0 bg-slate-950/30 backdrop-blur-[2px]" />

      {/* Top Brand Header Bar */}
      <div className="relative z-10 w-full max-w-[1440px] mx-auto flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 backdrop-blur-md">
              <svg
                className="h-5 w-5 text-emerald-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 6c0 0 2-2 5-2s5 2 5 2" />
                <path d="M20 6c0 0-2-2-5-2s-5 2-5 2" />
                <path d="M7 10h10" />
                <path d="M6 8c0 4.5 2 11 6 11s6-6.5 6-11" />
                <circle cx="9" cy="14" r="1" fill="currentColor" />
                <circle cx="15" cy="14" r="1" fill="currentColor" />
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight text-white drop-shadow-xs">
              DairyVision <span className="text-emerald-400">AI</span>
            </span>
          </div>
          <p className="text-xs text-slate-200/90 font-normal pl-10">
            Smarter decisions. Healthier herds. Better farms.
          </p>
        </div>
      </div>

      {/* Center Content Card */}
      <div className="relative z-10 w-full my-auto py-8 flex items-center justify-center">
        {farms.length === 0 ? (
          /* CASE 1: First-Time User / 0 Farms (Onboarding View) */
          <div className="w-full max-w-[480px] rounded-[24px] bg-white p-8 sm:p-9 shadow-2xl ring-1 ring-slate-900/5 space-y-6">
            <div className="space-y-1 text-left">
              <span className="text-[11.5px] font-semibold uppercase tracking-wider text-emerald-600">
                WELCOME TO DAIRYVISION AI
              </span>
              <h1 className="text-[26px] sm:text-[28px] font-bold tracking-tight text-slate-900 leading-snug mt-1">
                Let's set up your farm
              </h1>
              <p className="text-[14px] font-normal text-slate-500 mt-1">
                Enter your dairy farm details to activate yield predictions, cattle health alerts, and daily tracking.
              </p>
            </div>

            <form onSubmit={handleOnboardingSubmit} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
                  Farm Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={farmName}
                  onChange={(e) => setFarmName(e.target.value)}
                  placeholder="e.g. Luna Dairy Farm"
                  className="h-11 w-full rounded-xl border border-slate-200 px-3.5 text-[14px] text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-emerald-600/20 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">City / District</label>
                  <input
                    type="text"
                    value={locationCity}
                    onChange={(e) => setLocationCity(e.target.value)}
                    placeholder="e.g. Anand"
                    className="h-11 w-full rounded-xl border border-slate-200 px-3.5 text-[14px] text-slate-900 focus:border-emerald-600 focus:ring-emerald-600/20"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">Country</label>
                  <input
                    type="text"
                    value={locationCountry}
                    onChange={(e) => setLocationCountry(e.target.value)}
                    placeholder="e.g. India"
                    className="h-11 w-full rounded-xl border border-slate-200 px-3.5 text-[14px] text-slate-900 focus:border-emerald-600 focus:ring-emerald-600/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-slate-700 mb-1.5">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short notes about your dairy herd..."
                  className="w-full rounded-xl border border-slate-200 p-3 text-[14px] text-slate-900 focus:border-emerald-600 focus:ring-emerald-600/20 resize-none"
                />
              </div>

              {createMut.isError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-normal text-rose-700">
                  {(createMut.error as any)?.response?.data?.detail || createMut.error.message}
                </div>
              )}

              <button
                type="submit"
                disabled={createMut.isPending || !farmName.trim()}
                className="h-12 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium text-[15px] shadow-sm transition-all duration-150 border-0 disabled:opacity-50"
              >
                <span>{createMut.isPending ? "Creating Farm Workspace..." : "Create Farm & Continue →"}</span>
              </button>
            </form>
          </div>
        ) : (
          /* CASE 2: Returning User with 1+ Farms (Single Main Centered Container Card) */
          <div className="w-full max-w-[760px] rounded-[24px] bg-white p-7 sm:p-9 shadow-2xl ring-1 ring-slate-900/5 space-y-6">
            {/* Header inside parent card */}
            <div className="space-y-1">
              <span className="text-[11.5px] font-semibold uppercase tracking-wider text-emerald-600">
                WELCOME BACK, {user?.full_name?.toUpperCase() || "FARM MANAGER"}
              </span>
              <h1 className="text-[26px] sm:text-[30px] font-bold tracking-tight text-slate-900 leading-snug">
                Choose a farm to continue
              </h1>
              <p className="text-[15px] font-normal text-slate-500">
                Select an active farm workspace or create a new dairy farm location.
              </p>
            </div>

            {/* Real Farm Cards Grid inside parent card */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {farms.map((farm: Farm) => {
                const cowCount = cowsCountByFarm[farm.id] || 0;
                const alertCount = alertsCountByFarm[farm.id] || 0;
                const locationStr =
                  farm.location_city || farm.location_country
                    ? `${farm.location_city ?? ""}${
                        farm.location_city && farm.location_country ? ", " : ""
                      }${farm.location_country ?? ""}`
                    : "Location not specified";

                return (
                  <div
                    key={farm.id}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-slate-50/60 p-4.5 hover:bg-slate-50 hover:border-emerald-500/40 transition-all duration-150 space-y-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start gap-2.5">
                        <span className="text-xl">🌾</span>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-[15px] font-bold text-slate-900 truncate">{farm.name}</h3>
                          <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                            <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                            <span className="truncate">{locationStr}</span>
                          </div>
                        </div>
                      </div>

                      {/* Real Metrics */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 text-xs">
                        <div className="flex items-center gap-1.5 rounded-xl bg-white p-2 border border-slate-100 shadow-2xs">
                          <Users className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          <div>
                            <span className="font-bold text-slate-900">{cowCount}</span>
                            <span className="text-slate-500 ml-1 text-[11px]">cows</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 rounded-xl bg-white p-2 border border-slate-100 shadow-2xs">
                          <AlertTriangle
                            className={`h-3.5 w-3.5 shrink-0 ${
                              alertCount > 0 ? "text-amber-600" : "text-slate-400"
                            }`}
                          />
                          <div>
                            <span className="font-bold text-slate-900">{alertCount}</span>
                            <span className="text-slate-500 ml-1 text-[11px]">alerts</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectFarm(farm)}
                      className="w-full h-10 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium text-xs shadow-sm transition-all duration-150 border-0"
                    >
                      <span>Enter Farm</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Secondary Action: + Create Another Farm inside parent card */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsCreatingModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-700 hover:text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all duration-150 shadow-2xs"
              >
                <Plus className="h-4 w-4 text-emerald-600" />
                <span>Create Another Farm</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Footer Bar */}
      <div className="relative z-10 w-full max-w-[1440px] mx-auto flex items-center justify-between gap-4 text-xs text-slate-300/80">
        <div className="flex items-center gap-2 text-emerald-400 font-medium">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Live farm intelligence</span>
        </div>

        <p className="text-slate-300/70 font-normal">
          &copy; {new Date().getFullYear()} DairyVision AI. All rights reserved.
        </p>
      </div>

      {/* Farm Creation Modal */}
      <AddFarmDialog
        open={isCreatingModal}
        onClose={() => {
          createMut.reset();
          setIsCreatingModal(false);
        }}
        loading={createMut.status === "pending"}
        error={createMut.error ? ((createMut.error as any)?.response?.data?.detail || createMut.error.message) : undefined}
        onCreate={(payload) => createMut.mutate(payload)}
      />
    </div>
  );
}
