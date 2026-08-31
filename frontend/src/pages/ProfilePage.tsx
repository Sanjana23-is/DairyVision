import { useState, useEffect } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { User, Shield, Building, LogOut, ArrowLeft, Save, CheckCircle2, AlertCircle } from "lucide-react";

export function ProfilePage() {
  const { user, currentFarmName, logout, updateUserProfile } = useAuth();
  const navigate = useNavigate();

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
      setFeedback({ type: "success", message: "Profile name updated successfully!" });
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err?.response?.data?.detail || "Failed to update profile name.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const queryClient = useQueryClient();

  const handleSignOut = () => {
    queryClient.clear();
    logout();
    navigate("/login");
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-8 select-none font-sans">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 mb-2 transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back</span>
            </button>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              User Profile & Account Settings
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Manage your personal identity, display name, and active workspace preferences.
            </p>
          </div>
        </div>

        {/* Profile Card */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs space-y-6">
          {/* Header Avatar & Identity */}
          <div className="flex items-center gap-4 border-b border-slate-100 pb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 font-black text-2xl">
              {fullName.trim() ? fullName.trim().charAt(0).toUpperCase() : <User className="h-8 w-8 text-emerald-600" />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {user?.full_name || "Farm Manager"}
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">{user?.email || "N/A"}</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 border border-emerald-200 mt-2">
                Authenticated Account
              </span>
            </div>
          </div>

          {/* Feedback Alert */}
          {feedback && (
            <div
              className={`flex items-center gap-2 rounded-xl p-3.5 text-xs font-bold ${
                feedback.type === "success"
                  ? "border border-emerald-200 bg-emerald-50/80 text-emerald-900"
                  : "border border-rose-200 bg-rose-50 text-rose-800"
              }`}
            >
              {feedback.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Editable Form */}
          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
              
              {/* Editable Full Name Field */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Sanjana"
                    className="h-11 w-full rounded-xl border border-slate-200 px-3.5 text-xs text-slate-900 font-semibold focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 transition"
                  />
                </div>
                <p className="text-[11px] text-slate-400 font-medium">
                  This name will be displayed across dashboard greetings and reports.
                </p>
              </div>

              {/* Read-Only Email Field */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">
                  Email Address <span className="text-slate-400 font-normal">(Primary)</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    disabled
                    value={user?.email || ""}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 text-xs text-slate-500 font-semibold cursor-not-allowed select-none"
                  />
                </div>
                <p className="text-[11px] text-slate-400 font-medium">
                  Email is linked to your authentication credentials.
                </p>
              </div>

              {/* Active Workspace Info */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 space-y-1">
                <div className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <Building className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Active Workspace</span>
                </div>
                <p className="text-sm font-bold text-slate-900 truncate">
                  {currentFarmName || "No farm selected"}
                </p>
              </div>

              {/* Account Role Info */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 space-y-1">
                <div className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <Shield className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Account Role</span>
                </div>
                <p className="text-sm font-bold text-slate-900">
                  {(user as any)?.role || "Farm Manager"}
                </p>
              </div>

            </div>

            {/* Form Actions Bar */}
            <div className="border-t border-slate-100 pt-5 flex items-center justify-between gap-4">
              <button
                type="submit"
                disabled={isSubmitting || !fullName.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 active:bg-emerald-800 transition disabled:opacity-50 border-0 cursor-pointer"
              >
                <Save className="h-4 w-4" />
                <span>{isSubmitting ? "Saving Changes..." : "Save Changes"}</span>
              </button>

              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 hover:border-rose-300 transition"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default ProfilePage;
