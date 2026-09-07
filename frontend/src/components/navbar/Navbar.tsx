import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User, ChevronDown, Check, Plus, LogOut, UserCheck, Globe, Moon, Sun, Monitor } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { LANGUAGE_OPTIONS } from "@/i18n/translations";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchFarms, Farm, createFarm } from "@/services/farm";
import AddFarmDialog from "@/components/farms/AddFarmDialog";
import { NotificationDropdown } from "@/components/navbar/NotificationDropdown";

export default function Navbar() {
  const { user, currentFarmId, currentFarmName, setCurrentFarm, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [isFarmOpen, setIsFarmOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Close dropdowns on Escape keypress
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsFarmOpen(false);
        setIsUserMenuOpen(false);
        setIsLangOpen(false);
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
  const activeLangOption = LANGUAGE_OPTIONS.find((l) => l.code === language) || LANGUAGE_OPTIONS[0];

  return (
    <div className="flex items-center justify-between px-6 py-3 select-none border-b border-slate-100 dark:border-[#27272A] bg-white/80 dark:bg-[#0D0E10]/90 backdrop-blur-md sticky top-0 z-30 font-sans text-slate-900 dark:text-[#F4F4F5] transition-colors duration-200">
      {/* Farm Selector Dropdown */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setIsUserMenuOpen(false);
              setIsLangOpen(false);
              setIsFarmOpen(!isFarmOpen);
            }}
            className="flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] px-3.5 py-1.5 text-xs font-bold text-slate-800 dark:text-[#F4F4F5] shadow-2xs hover:border-emerald-300 dark:hover:border-emerald-500 hover:bg-slate-50 dark:hover:bg-[#1B1D20] transition"
          >
            <span>🌾</span>
            <span className="max-w-[180px] truncate">
              {currentFarmName ?? t("action.select_farm")}
            </span>
            <ChevronDown className={`h-3.5 w-3.5 text-slate-400 dark:text-[#A1A1AA] transition-transform duration-200 ${isFarmOpen ? "rotate-180 text-emerald-600 dark:text-emerald-400" : ""}`} />
          </button>

          {isFarmOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsFarmOpen(false)}
              />
              <div className="absolute left-0 top-11 z-50 w-64 rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] py-2 shadow-xl ring-1 ring-black/20 text-xs">
                <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-[#71717A]">
                  {t("farms.switch_workspace")}
                </div>

                <div className="mt-1 space-y-0.5 max-h-56 overflow-y-auto">
                  {farms.length === 0 ? (
                    <div className="px-3 py-2 text-slate-500 dark:text-[#71717A] italic">{t("farms.no_farms_found")}</div>
                  ) : (
                    farms.map((f: Farm) => {
                      const isSelected = f.id === currentFarmId;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => handleSelectFarm(f)}
                          className={`w-full flex items-center justify-between px-3 py-2 text-left font-semibold hover:bg-slate-50 dark:hover:bg-[#1B1D20] transition ${
                            isSelected ? "text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50/60 dark:bg-emerald-500/[0.08]" : "text-slate-700 dark:text-[#F4F4F5]"
                          }`}
                        >
                          <span className="truncate">🌾 {f.name}</span>
                          {isSelected && <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="mt-1 border-t border-slate-100 dark:border-[#27272A] pt-1.5 px-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsFarmOpen(false);
                      setIsCreating(true);
                    }}
                    className="w-full flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-left font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/[0.08] transition"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{t("nav.create_farm")}</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right Actions & User Profile Bar */}
      <div className="flex items-center gap-3">
        {/* Language Switcher Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setIsFarmOpen(false);
              setIsUserMenuOpen(false);
              setIsLangOpen(!isLangOpen);
            }}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-[#F4F4F5] hover:border-emerald-300 dark:hover:border-emerald-500 hover:bg-slate-50 dark:hover:bg-[#1B1D20] transition shadow-2xs"
            title="Switch Language"
          >
            <Globe className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{activeLangOption.code.toUpperCase()}</span>
            <ChevronDown className={`h-3 w-3 text-slate-400 dark:text-[#A1A1AA] transition-transform duration-200 ${isLangOpen ? "rotate-180 text-emerald-600 dark:text-emerald-400" : ""}`} />
          </button>

          {isLangOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsLangOpen(false)} />
              <div className="absolute right-0 top-11 z-50 w-44 rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] p-1.5 shadow-xl text-xs space-y-0.5 select-none ring-1 ring-black/20">
                <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-[#71717A]">
                  {t("profile.language_preferences")}
                </div>
                {LANGUAGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={() => {
                      setLanguage(opt.code);
                      setIsLangOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left font-semibold transition ${
                      language === opt.code
                        ? "bg-emerald-50 dark:bg-emerald-500/[0.08] text-emerald-900 dark:text-emerald-400 font-bold"
                        : "text-slate-700 dark:text-[#F4F4F5] hover:bg-slate-50 dark:hover:bg-[#1B1D20]"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{opt.flag}</span>
                      <span>{opt.label}</span>
                    </span>
                    {language === opt.code && <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Notification Dropdown */}
        <NotificationDropdown />

        {/* User Account Popover Dropdown */}
        <div className="relative border-l border-slate-200 dark:border-[#27272A] pl-3">
          <button
            type="button"
            tabIndex={0}
            aria-haspopup="menu"
            aria-expanded={isUserMenuOpen}
            onClick={() => {
              setIsFarmOpen(false);
              setIsLangOpen(false);
              setIsUserMenuOpen(!isUserMenuOpen);
            }}
            className="group flex items-center gap-2.5 rounded-full p-1 transition-all duration-150 hover:bg-slate-100 dark:hover:bg-[#151719] focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          >
            <div className="hidden sm:block text-xs font-bold text-slate-800 dark:text-[#F4F4F5] group-hover:text-emerald-800 dark:group-hover:text-emerald-400 transition-colors pl-1">
              {user?.full_name || user?.email || "Farm Manager"}
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-extrabold text-xs transition-all duration-150 group-hover:scale-105 group-hover:border-emerald-400 group-hover:bg-emerald-500/20">
              {initialLetter || <User className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />}
            </div>
            <ChevronDown className={`h-3 w-3 text-slate-400 dark:text-[#A1A1AA] transition-transform duration-200 hidden sm:block ${isUserMenuOpen ? "rotate-180 text-emerald-600 dark:text-emerald-400" : ""}`} />
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
                className="absolute right-0 top-11 z-50 w-64 rounded-2xl border border-slate-200/90 dark:border-[#27272A] bg-white dark:bg-[#151719] p-3 shadow-xl ring-1 ring-black/20 text-xs space-y-2 select-none"
              >
                {/* Authenticated User Header Info */}
                <div className="flex items-center gap-3 p-1">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-extrabold text-sm border border-emerald-100 dark:border-emerald-500/20">
                    {initialLetter || <User className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900 dark:text-[#F4F4F5] truncate">
                      {user?.full_name || "Farm Manager"}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-[#A1A1AA] truncate font-medium mt-0.5">
                      {user?.email || "user@farm.com"}
                    </p>
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-[#27272A]" />

                {/* Profile Action */}
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleGoToProfile}
                  className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-left font-bold text-slate-700 dark:text-[#F4F4F5] hover:bg-emerald-50/70 dark:hover:bg-emerald-500/[0.08] hover:text-emerald-800 dark:hover:text-emerald-400 transition duration-150"
                >
                  <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{t("profile.title")}</span>
                </button>

                <div className="border-t border-slate-100 dark:border-[#27272A]" />

                {/* Theme Selector */}
                <div className="px-3 py-2">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-[#71717A] mb-1.5">
                    {t("profile.theme_preferences")}
                  </div>
                  <div className="flex items-center gap-1 bg-slate-50 dark:bg-[#0F1012] p-1 rounded-xl border border-slate-100 dark:border-[#27272A]">
                    <button
                      type="button"
                      onClick={() => setTheme("light")}
                      className={`flex-1 flex justify-center py-1.5 rounded-lg transition-all ${
                        theme === "light"
                          ? "bg-white dark:bg-[#151719] shadow-sm text-emerald-600 dark:text-emerald-400 font-bold"
                          : "text-slate-500 dark:text-[#71717A] hover:text-slate-700 dark:hover:text-[#F4F4F5] hover:bg-slate-200/50 dark:hover:bg-[#151719]/50"
                      }`}
                      title="Light"
                    >
                      <Sun className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setTheme("dark")}
                      className={`flex-1 flex justify-center py-1.5 rounded-lg transition-all ${
                        theme === "dark"
                          ? "bg-white dark:bg-[#151719] shadow-sm text-emerald-600 dark:text-emerald-400 font-bold"
                          : "text-slate-500 dark:text-[#71717A] hover:text-slate-700 dark:hover:text-[#F4F4F5] hover:bg-slate-200/50 dark:hover:bg-[#151719]/50"
                      }`}
                      title="Dark"
                    >
                      <Moon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setTheme("system")}
                      className={`flex-1 flex justify-center py-1.5 rounded-lg transition-all ${
                        theme === "system"
                          ? "bg-white dark:bg-[#151719] shadow-sm text-emerald-600 dark:text-emerald-400 font-bold"
                          : "text-slate-500 dark:text-[#71717A] hover:text-slate-700 dark:hover:text-[#F4F4F5] hover:bg-slate-200/50 dark:hover:bg-[#151719]/50"
                      }`}
                      title="System"
                    >
                      <Monitor className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-[#27272A]" />

                {/* Sign Out Action */}
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-left font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition duration-150"
                >
                  <LogOut className="h-4 w-4 text-rose-500 dark:text-rose-400" />
                  <span>{t("common.sign_out")}</span>
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
