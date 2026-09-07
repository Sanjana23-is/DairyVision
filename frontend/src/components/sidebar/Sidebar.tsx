import { NavLink } from "react-router-dom";
import {
  Home,
  Calendar,
  MousePointer,
  Gauge,
  Activity,
  Repeat,
  Sparkles,
  Layers,
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
      { to: "/health-alerts", labelKey: "nav.health_and_risk", icon: Activity },
      { to: "/recommendations", labelKey: "nav.recommendations", icon: Repeat },
    ],
  },
  {
    titleKey: "nav.analysis_twin",
    items: [
      { to: "/digital-twin", labelKey: "nav.digital_twin", icon: Layers },
      { to: "/simulation", labelKey: "nav.simulation", icon: FlaskConical },
      { to: "/explainability", labelKey: "nav.explainability", icon: Sparkles },
    ],
  },
];

export default function Sidebar() {
  const { currentFarmName } = useAuth();
  const { t } = useLanguage();

  return (
    <div className="w-full h-full border-r border-slate-200/80 dark:border-[#27272A] bg-white dark:bg-[#0D0E10] px-3 py-5 flex flex-col overflow-y-auto select-none font-sans text-slate-900 dark:text-[#F4F4F5] transition-colors duration-200">
      {/* Brand Header */}
      <div className="px-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-sm shadow-2xs">
            🥛
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-[#F4F4F5] tracking-tight leading-none">
              DairyVision <span className="text-emerald-600 dark:text-emerald-400">AI</span>
            </div>
            <div className="mt-1 text-[11px] font-normal text-slate-500 dark:text-[#71717A]">
              {t("nav.farm_intelligence_workspace")}
            </div>
          </div>
        </div>
      </div>

      {/* Current Active Farm Context Indicator */}
      <div className="mx-2 mb-5 rounded-xl border border-emerald-200/80 dark:border-[#27272A] bg-emerald-50/60 dark:bg-[#151719] p-2.5 flex items-center gap-2 text-xs">
        <span className="text-base">🌾</span>
        <div className="truncate">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 block leading-none">
            {t("farms.active_farm")}
          </span>
          <span className="font-semibold text-slate-900 dark:text-[#F4F4F5] truncate block mt-0.5">
            {currentFarmName || t("farms.no_farms_found")}
          </span>
        </div>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 space-y-4" aria-label="Primary navigation">
        {navSections.map((section) => (
          <div key={section.titleKey} className="space-y-1">
            <div className="px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#71717A]">
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
                        ? "bg-emerald-50/80 dark:bg-emerald-500/[0.08] text-emerald-900 dark:text-emerald-400 font-bold shadow-2xs border-l-2 border-emerald-600 dark:border-emerald-500"
                        : "text-slate-600 dark:text-[#A1A1AA] hover:bg-slate-50 dark:hover:bg-[#1B1D20] hover:text-slate-900 dark:hover:text-[#F4F4F5] font-medium"
                    }`
                  }
                >
                  <it.icon className="h-4 w-4 shrink-0 transition-colors duration-150 text-slate-400 dark:text-[#71717A] group-hover:text-slate-600 dark:group-hover:text-emerald-400" />
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
