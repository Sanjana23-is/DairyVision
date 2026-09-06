import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Bell, Check, Clock, AlertTriangle, Info, ShieldAlert } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import api from "@/services/api";
import { useLanguage } from "@/context/LanguageContext";

interface HealthAlert {
  id: string;
  cow_id: string;
  alert_level: "low" | "medium" | "high" | "critical";
  message: string;
  resolved: boolean;
  created_at: string;
}

export function NotificationDropdown() {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const { data: alerts = [], isLoading, isError } = useQuery<HealthAlert[]>({
    queryKey: ["health-alerts"],
    queryFn: async () => {
      const res = await api.get("/api/v1/health-alerts");
      return res.data;
    },
    refetchInterval: 30000,
  });

  const unreadAlerts = alerts.filter(a => !a.resolved);
  const hasUnread = unreadAlerts.length > 0;
  
  // Show only 5 most recent alerts in dropdown
  const recentAlerts = [...alerts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);

  const resolveMut = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/api/v1/health-alerts/${id}`, { resolved: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["health-alerts"] });
    },
  });

  const getAlertIcon = (level: string) => {
    switch (level) {
      case "critical": return <ShieldAlert className="h-4 w-4 text-rose-600" />;
      case "high": return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case "medium": return <Clock className="h-4 w-4 text-amber-500" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getAlertBg = (level: string, resolved: boolean) => {
    if (resolved) return "bg-slate-50";
    switch (level) {
      case "critical": return "bg-rose-50/50";
      case "high": return "bg-orange-50/50";
      case "medium": return "bg-amber-50/50";
      default: return "bg-blue-50/50";
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
        title={t("notifications.title", "Notifications")}
        aria-label={t("notifications.title", "Notifications")}
        aria-expanded={isOpen}
      >
        <Bell className="h-4 w-4" />
        {hasUnread && (
          <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-2xl border border-slate-200/90 bg-white shadow-xl ring-1 ring-slate-900/5 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-sm font-bold text-slate-900">
              {t("notifications.title", "Notifications")}
            </h3>
            {hasUnread && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                {unreadAlerts.length} {t("notifications.new", "New")}
              </span>
            )}
          </div>

          <div className="max-h-[320px] overflow-y-auto">
            {isLoading ? (
              <div className="px-4 py-8 text-center text-xs text-slate-500 flex justify-center">
                <svg className="animate-spin h-5 w-5 text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            ) : isError ? (
              <div className="px-4 py-6 text-center text-xs text-rose-500">
                {t("notifications.error", "Failed to load notifications.")}
              </div>
            ) : recentAlerts.length === 0 ? (
              <div className="px-4 py-8 flex flex-col items-center justify-center text-center">
                <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center mb-2">
                  <Bell className="h-5 w-5 text-slate-300" />
                </div>
                <p className="text-sm font-medium text-slate-600">
                  {t("notifications.empty", "You're all caught up!")}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {t("notifications.empty_sub", "No new alerts at the moment.")}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentAlerts.map(alert => (
                  <div 
                    key={alert.id} 
                    className={`p-4 flex gap-3 transition-colors ${getAlertBg(alert.alert_level, alert.resolved)}`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {getAlertIcon(alert.alert_level)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs ${alert.resolved ? "text-slate-600" : "font-semibold text-slate-900"} line-clamp-2`}>
                        {alert.message}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1.5 flex items-center justify-between">
                        <span>{formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}</span>
                        {!alert.resolved && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              resolveMut.mutate(alert.id);
                            }}
                            disabled={resolveMut.status === "pending"}
                            className="text-emerald-600 font-semibold hover:text-emerald-700 flex items-center gap-1"
                          >
                            <Check className="h-3 w-3" />
                            {t("action.mark_read", "Mark read")}
                          </button>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-2 border-t border-slate-100 bg-slate-50">
            <Link
              to="/health-alerts"
              onClick={() => setIsOpen(false)}
              className="block w-full rounded-lg py-2 text-center text-xs font-bold text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition"
            >
              {t("notifications.view_history", "View Notification History")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
