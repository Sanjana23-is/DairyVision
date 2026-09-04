import { NavLink } from "react-router-dom";
import {
  Home,
  Calendar,
  MousePointer,
  Gauge,
  Bell,
  Activity,
  Repeat,
  Sparkles,
  Layers,
  Dna,
  FlaskConical,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

interface NavSection {
  titleKey: string;
  items: {
    to: string;
    labelKey: string;
    icon: any;
  }[];
}

const navSections: NavSection[] = [
  {
    titleKey: "nav.overview",
    items: [{ to: "/dashboard", labelKey: "nav.dashboard", icon: Home }],
  },
  {
    titleKey: "nav.farm_management",
    items: [
      { to: "/cows", labelKey: "nav.cows", icon: MousePointer },
      { to: "/observations", labelKey: "nav.daily_observations", icon: Calendar },
    ],
  },
  {
    titleKey: "nav.animal_intelligence",
    items: [
      { to: "/predictions", labelKey: "nav.predictions", icon: Gauge },
      { to: "/health-alerts", labelKey: "nav.health_alerts", icon: Bell },
      { to: "/anomalies", labelKey: "nav.anomaly_detection", icon: Activity },
      { to: "/recommendations", labelKey: "nav.recommendations", icon: Repeat },
    ],
  },
  {
    titleKey: "nav.analysis_twin",
    items: [
      { to: "/digital-twin", labelKey: "nav.digital_twin", icon: Layers },
      { to: "/simulation", labelKey: "nav.simulation", icon: FlaskConical },
      { to: "/explainability", labelKey: "nav.explainability", icon: Sparkles },
      { to: "/genetics", labelKey: "nav.genetics", icon: Dna },
    ],
  },
];

export default function Sidebar() {
  const { currentFarmName } = useAuth();
  const { t } = useLanguage();

  return (
    <div className="w-64 h-screen border-r border-slate-200/80 bg-white px-3 py-5 flex flex-col overflow-y-auto select-none font-sans">
      {/* Brand Header */}
      <div className="px-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-600 font-bold text-sm shadow-2xs">
            🥛
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 tracking-tight leading-none">
              DairyVision <span className="text-emerald-600">AI</span>
            </div>
            <div className="mt-1 text-[11px] font-normal text-slate-500">
              Farm intelligence workspace
            </div>
          </div>
        </div>
      </div>

      {/* Current Active Farm Context Indicator */}
      <div className="mx-2 mb-5 rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-2.5 flex items-center gap-2 text-xs">
        <span className="text-base">🌾</span>
        <div className="truncate">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800 block leading-none">
            {t("status.active_farm", "Active Farm")}
          </span>
          <span className="font-semibold text-slate-900 truncate block mt-0.5">
            {currentFarmName || "No Farm Selected"}
          </span>
        </div>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 space-y-4" aria-label="Primary navigation">
        {navSections.map((section) => (
          <div key={section.titleKey} className="space-y-1">
            <div className="px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {t(section.titleKey)}
            </div>
            <div className="space-y-0.5 mt-1">
              {section.items.map((it) => (
                <NavLink
                  key={it.to}
                  to={it.to}
                  className={({ isActive }) =>
                    `group flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-150 ${
                      isActive
                        ? "bg-emerald-50/80 text-emerald-900 font-bold shadow-2xs border-l-2 border-emerald-600"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium"
                    }`
                  }
                >
                  <it.icon className="h-4 w-4 shrink-0 transition-colors duration-150 text-slate-400 group-hover:text-slate-600" />
                  <span className="truncate">{t(it.labelKey)}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}
