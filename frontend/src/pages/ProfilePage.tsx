import { useState, useEffect } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { LANGUAGE_OPTIONS, SupportedLanguage } from "@/i18n/translations";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { User, Shield, Building, LogOut, ArrowLeft, Save, CheckCircle2, AlertCircle, Globe, Sun, Moon, Monitor, Palette } from "lucide-react";

export function ProfilePage() {
  const { user, currentFarmName, logout, updateUserProfile } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState(user?.full_name || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (user?.full_name) {
      setFullName(user.full_name);
    }
  }, [user?.full_name]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setFeedback({ type: "error", message: "Full Name cannot be empty." });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      await updateUserProfile(fullName.trim());
      setFeedback({ type: "success", message: "Profile updated successfully!" });
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err?.response?.data?.detail || "Failed to update profile name.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = () => {
    queryClient.clear();
    logout();
    navigate("/login");
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-8 select-none font-sans text-slate-900 dark:text-[#F4F4F5]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-[#A1A1AA] hover:text-slate-800 dark:hover:text-[#F4F4F5] mb-2 transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>{t("common.back")}</span>
            </button>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#F4F4F5] tracking-tight">
              {t("auth.profile_title")}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-[#A1A1AA] mt-1">
              {t("auth.profile_subtitle")}
            </p>
          </div>
        </div>

        {/* Profile Card */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-[#27272A] bg-white dark:bg-[#151719] p-6 sm:p-8 shadow-xs space-y-6">
          {/* Header Avatar & Identity */}
          <div className="flex items-center gap-4 border-b border-slate-100 dark:border-[#27272A] pb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-black text-2xl">
              {fullName.trim() ? fullName.trim().charAt(0).toUpperCase() : <User className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-[#F4F4F5]">
                {user?.full_name || "Farm Manager"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#A1A1AA] font-medium mt-0.5">{user?.email || "N/A"}</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20 mt-2">
                {t("profile.personal_info")}
              </span>
            </div>
          </div>

          {/* Feedback Alert */}
          {feedback && (
            <div
              className={`flex items-center gap-2 rounded-xl p-3.5 text-xs font-bold ${
                feedback.type === "success"
                  ? "border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/80 dark:bg-emerald-500/10 text-emerald-900 dark:text-emerald-300"
                  : "border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300"
              }`}
            >
              {feedback.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Editable Form */}
          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
              
              {/* Editable Full Name Field */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700 dark:text-[#F4F4F5]">
                  {t("auth.full_name")} <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Sanjana"
                    className="h-11 w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-3.5 text-xs text-slate-900 dark:text-[#F4F4F5] font-semibold focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 transition"
                  />
                </div>
                <p className="text-[11px] text-slate-400 dark:text-[#A1A1AA] font-medium">
                  {t("profile.subtitle")}
                </p>
              </div>

              {/* Read-Only Email Field */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700 dark:text-[#F4F4F5]">
                  {t("auth.email_address")}
                </label>
                <div className="relative">
                  <input
                    type="email"
                    disabled
                    value={user?.email || ""}
                    className="h-11 w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-slate-50/80 dark:bg-[#1B1D20]/80 px-3.5 text-xs text-slate-500 dark:text-[#A1A1AA] font-semibold cursor-not-allowed select-none"
                  />
                </div>
              </div>

              {/* Language Preference Field */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="block font-bold text-slate-700 dark:text-[#F4F4F5]">
                  {t("profile.language_preferences")}
                </label>
                <div className="relative">
                  <Globe className="absolute left-3.5 top-3.5 h-4 w-4 text-emerald-600 dark:text-emerald-400 pointer-events-none" />
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
                    className="h-11 w-full rounded-xl border border-slate-200 dark:border-[#27272A] pl-10 pr-3.5 text-xs text-slate-900 dark:text-[#F4F4F5] font-semibold focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 bg-white dark:bg-[#1B1D20]"
                  >
                    {LANGUAGE_OPTIONS.map((opt) => (
                      <option key={opt.code} value={opt.code} className="dark:bg-[#1B1D20] dark:text-[#F4F4F5]">
                        {opt.flag} {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Theme Preference Card */}
              <div className="space-y-2 sm:col-span-2 rounded-2xl border border-slate-100 dark:border-[#27272A] bg-slate-50/70 dark:bg-[#1B1D20] p-4">
                <div className="flex items-center gap-2 text-slate-700 dark:text-[#F4F4F5] font-bold text-xs">
                  <Palette className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{t("auth.theme_appearance")}</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-[#A1A1AA]">
                  {t("auth.theme_desc")}
                </p>

                <div className="grid grid-cols-3 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setTheme("light")}
                    className={`flex flex-col items-center justify-center gap-2 rounded-xl p-3 border transition-all text-xs font-bold ${
                      theme === "light"
                        ? "bg-white dark:bg-[#151719] border-emerald-500 text-emerald-700 dark:text-emerald-400 shadow-sm ring-2 ring-emerald-500/20"
                        : "bg-white/60 dark:bg-[#151719]/60 border-slate-200 dark:border-[#27272A] text-slate-600 dark:text-[#A1A1AA] hover:bg-white dark:hover:bg-[#151719]"
                    }`}
                  >
                    <Sun className="h-5 w-5 text-amber-500" />
                    <span>Light</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme("dark")}
                    className={`flex flex-col items-center justify-center gap-2 rounded-xl p-3 border transition-all text-xs font-bold ${
                      theme === "dark"
                        ? "bg-white dark:bg-[#151719] border-emerald-500 text-emerald-700 dark:text-emerald-400 shadow-sm ring-2 ring-emerald-500/20"
                        : "bg-white/60 dark:bg-[#151719]/60 border-slate-200 dark:border-[#27272A] text-slate-600 dark:text-[#A1A1AA] hover:bg-white dark:hover:bg-[#151719]"
                    }`}
                  >
                    <Moon className="h-5 w-5 text-emerald-400" />
                    <span>Dark</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme("system")}
                    className={`flex flex-col items-center justify-center gap-2 rounded-xl p-3 border transition-all text-xs font-bold ${
                      theme === "system"
                        ? "bg-white dark:bg-[#151719] border-emerald-500 text-emerald-700 dark:text-emerald-400 shadow-sm ring-2 ring-emerald-500/20"
                        : "bg-white/60 dark:bg-[#151719]/60 border-slate-200 dark:border-[#27272A] text-slate-600 dark:text-[#A1A1AA] hover:bg-white dark:hover:bg-[#151719]"
                    }`}
                  >
                    <Monitor className="h-5 w-5 text-sky-500" />
                    <span>System</span>
                  </button>
                </div>
              </div>

              {/* Active Workspace Info */}
              <div className="rounded-xl border border-slate-100 dark:border-[#27272A] bg-slate-50/60 dark:bg-[#1B1D20] p-4 space-y-1">
                <div className="flex items-center gap-2 text-slate-400 dark:text-[#A1A1AA] font-bold uppercase tracking-wider text-[10px]">
                  <Building className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{t("auth.active_workspace")}</span>
                </div>
                <p className="text-sm font-bold text-slate-900 dark:text-[#F4F4F5] truncate">
                  {currentFarmName || t("farms.no_farms_found")}
                </p>
              </div>

              {/* Account Role Info */}
              <div className="rounded-xl border border-slate-100 dark:border-[#27272A] bg-slate-50/60 dark:bg-[#1B1D20] p-4 space-y-1">
                <div className="flex items-center gap-2 text-slate-400 dark:text-[#A1A1AA] font-bold uppercase tracking-wider text-[10px]">
                  <Shield className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{t("auth.account_role")}</span>
                </div>
                <p className="text-sm font-bold text-slate-900 dark:text-[#F4F4F5]">
                  {(user as any)?.role || "Farm Manager"}
                </p>
              </div>

            </div>

            {/* Form Actions Bar */}
            <div className="border-t border-slate-100 dark:border-[#27272A] pt-5 flex items-center justify-between gap-4">
              <button
                type="submit"
                disabled={isSubmitting || !fullName.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 dark:bg-emerald-500 px-5 py-2.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 dark:hover:bg-emerald-600 active:bg-emerald-800 transition disabled:opacity-50 border-0 cursor-pointer"
              >
                <Save className="h-4 w-4" />
                <span>{t("common.save_changes")}</span>
              </button>

              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/50 px-4 py-2.5 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 hover:border-rose-300 transition"
              >
                <LogOut className="h-4 w-4 text-rose-500 dark:text-rose-400" />
                <span>{t("common.sign_out")}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default ProfilePage;
