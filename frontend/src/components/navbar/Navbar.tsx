import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, User, ChevronDown, Check, Plus, LogOut, UserCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchFarms, Farm, createFarm } from "@/services/farm";
import AddFarmDialog from "@/components/farms/AddFarmDialog";

export default function Navbar() {
  const { user, currentFarmId, currentFarmName, setCurrentFarm, logout } = useAuth();
  const [isFarmOpen, setIsFarmOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Close dropdowns on Escape keypress
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsFarmOpen(false);
        setIsUserMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const { data: farms = [] } = useQuery<Farm[]>({
    queryKey: ["farms"],
    queryFn: fetchFarms,
    staleTime: 1000 * 60,
  });

  const createMut = useMutation({
    mutationFn: createFarm,
    onSuccess: (newFarm: Farm) => {
      queryClient.invalidateQueries();
      setCurrentFarm(newFarm.id, newFarm.name ?? null);
      setIsCreating(false);
      setIsFarmOpen(false);
      navigate("/dashboard");
    },
  });

  const handleSelectFarm = (farm: Farm) => {
    setCurrentFarm(farm.id, farm.name ?? null);
    queryClient.invalidateQueries();
    setIsFarmOpen(false);
    navigate("/dashboard");
  };

  const handleSignOut = () => {
    setIsUserMenuOpen(false);
    queryClient.clear();
    logout();
    navigate("/login");
  };

  const handleGoToProfile = () => {
    setIsUserMenuOpen(false);
    navigate("/profile");
  };

  const initialLetter = user?.full_name ? user.full_name.charAt(0).toUpperCase() : null;

  return (
    <div className="flex items-center justify-between px-6 py-3 select-none border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-30">
      {/* Farm Selector Dropdown */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setIsUserMenuOpen(false);
              setIsFarmOpen(!isFarmOpen);
            }}
            className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-800 shadow-2xs hover:border-emerald-300 hover:bg-slate-50 transition"
          >
            <span>🌾</span>
            <span className="max-w-[180px] truncate">
              {currentFarmName ?? "Select Farm"}
            </span>
            <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${isFarmOpen ? "rotate-180" : ""}`} />
          </button>

          {isFarmOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsFarmOpen(false)}
              />
              <div className="absolute left-0 top-11 z-50 w-64 rounded-2xl border border-slate-200 bg-white py-2 shadow-xl ring-1 ring-slate-900/5 text-xs">
                <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Switch Farm Workspace
                </div>

                <div className="mt-1 space-y-0.5 max-h-56 overflow-y-auto">
                  {farms.length === 0 ? (
                    <div className="px-3 py-2 text-slate-500 italic">No farms found</div>
                  ) : (
                    farms.map((f: Farm) => {
                      const isSelected = f.id === currentFarmId;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => handleSelectFarm(f)}
                          className={`w-full flex items-center justify-between px-3 py-2 text-left font-semibold hover:bg-slate-50 transition ${
                            isSelected ? "text-emerald-700 font-bold bg-emerald-50/60" : "text-slate-700"
                          }`}
                        >
                          <span className="truncate">🌾 {f.name}</span>
                          {isSelected && <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="mt-1 border-t border-slate-100 pt-1.5 px-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsFarmOpen(false);
                      setIsCreating(true);
                    }}
                    className="w-full flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-left font-bold text-emerald-700 hover:bg-emerald-50 transition"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Create New Farm</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right User Profile Bar */}
      <div className="flex items-center gap-4">
        {/* Notification Icon */}
        <button
          type="button"
          onClick={() => navigate("/health-alerts")}
          className="relative rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
          title="Notifications & Alerts"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 inline-flex h-2 w-2 rounded-full bg-rose-500" />
        </button>

        {/* User Account Popover Dropdown */}
        <div className="relative border-l border-slate-200 pl-4">
          <button
            type="button"
            tabIndex={0}
            aria-haspopup="menu"
            aria-expanded={isUserMenuOpen}
            onClick={() => {
              setIsFarmOpen(false);
              setIsUserMenuOpen(!isUserMenuOpen);
            }}
            className="group flex items-center gap-2.5 rounded-full p-1 transition-all duration-150 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          >
            <div className="hidden sm:block text-xs font-bold text-slate-800 group-hover:text-emerald-800 transition-colors pl-1">
              {user?.full_name || user?.email || "Farm Manager"}
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 font-extrabold text-xs transition-all duration-150 group-hover:scale-105 group-hover:border-emerald-400 group-hover:bg-emerald-500/20">
              {initialLetter || <User className="h-4 w-4 text-emerald-700" />}
            </div>
            <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform duration-200 hidden sm:block ${isUserMenuOpen ? "rotate-180 text-emerald-600" : ""}`} />
          </button>

          {isUserMenuOpen && (
            <>
              {/* Overlay Backdrop to close menu when clicking outside */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsUserMenuOpen(false)}
              />

              {/* Account Dropdown Card */}
              <div
                role="menu"
                className="absolute right-0 top-11 z-50 w-64 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-xl ring-1 ring-slate-900/5 text-xs space-y-2 select-none"
              >
                {/* Authenticated User Header Info */}
                <div className="flex items-center gap-3 p-1">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 font-extrabold text-sm border border-emerald-100">
                    {initialLetter || <User className="h-5 w-5 text-emerald-600" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-slate-900 truncate">
                      {user?.full_name || "Farm Manager"}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate font-medium mt-0.5">
                      {user?.email || "user@farm.com"}
                    </p>
                  </div>
                </div>

                <div className="border-t border-slate-100" />

                {/* Profile Action */}
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleGoToProfile}
                  className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-left font-bold text-slate-700 hover:bg-emerald-50/70 hover:text-emerald-800 transition duration-150"
                >
                  <UserCheck className="h-4 w-4 text-emerald-600" />
                  <span>Profile & Account</span>
                </button>

                <div className="border-t border-slate-100" />

                {/* Sign Out Action */}
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-left font-bold text-rose-600 hover:bg-rose-50 transition duration-150"
                >
                  <LogOut className="h-4 w-4 text-rose-500" />
                  <span>Sign Out</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Farm Creation Modal */}
      <AddFarmDialog
        open={isCreating}
        onClose={() => {
          createMut.reset();
          setIsCreating(false);
        }}
        loading={createMut.status === "pending"}
        error={createMut.error ? ((createMut.error as any)?.response?.data?.detail || createMut.error.message) : undefined}
        onCreate={(payload) => createMut.mutate(payload)}
      />
    </div>
  );
}
