import { NavLink } from "react-router-dom";
import {
  Home,
  MapPin,
  MousePointer,
  Calendar,
  Gauge,
  Sparkles,
  Bell,
  Activity,
  Repeat,
} from "lucide-react";

const items = [
  { to: "/dashboard", label: "Dashboard", icon: Home },
  { to: "/farms", label: "Farms", icon: MapPin },
  { to: "/cows", label: "Cows", icon: MousePointer },
  { to: "/observations", label: "Daily Observations", icon: Calendar },
  { to: "/predictions", label: "Predictions", icon: Gauge },
  { to: "/explainability", label: "SHAP Explainability", icon: Sparkles },
  { to: "/health-alerts", label: "Health Alerts", icon: Bell },
  { to: "/anomalies", label: "Anomaly Detection", icon: Activity },
  { to: "/recommendations", label: "Recommendations", icon: Repeat },
];


export default function Sidebar() {
  return (
    <div className="w-64 h-screen border-r border-slate-100 bg-white px-4 py-6">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Workspace
        </div>
        <div className="mt-3 text-sm font-semibold text-sky-700">DairyVision AI</div>
        <div className="mt-2 text-xs text-slate-500">
          Farm intelligence workspace
        </div>
      </div>

      <nav className="space-y-1" aria-label="Primary navigation">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150 ${
                isActive
                  ? "bg-sky-50 text-sky-700"
                  : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
              }`
            }
          >
            <it.icon className="h-4 w-4 transition-colors duration-150" />
            <span className="truncate">{it.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
