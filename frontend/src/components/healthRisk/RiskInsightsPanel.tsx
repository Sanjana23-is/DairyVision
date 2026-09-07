import React from "react";
import { Lightbulb, Activity } from "lucide-react";
import { HerdRiskKPIs, UnifiedRiskCase } from "@/services/riskCorrelation";
import { useLanguage } from "@/context/LanguageContext";

interface RiskInsightsPanelProps {
  kpis: HerdRiskKPIs;
  cases: UnifiedRiskCase[];
  totalCows: number;
}

export const RiskInsightsPanel: React.FC<RiskInsightsPanelProps> = ({
  kpis,
  cases,
  totalCows,
}) => {
  const { t } = useLanguage();
  const healthyPct = totalCows > 0 ? Math.round((kpis.healthy / totalCows) * 100) : 100;
  const monitorPct = totalCows > 0 ? Math.round((kpis.monitor / totalCows) * 100) : 0;
  const highAttnPct = totalCows > 0 ? Math.round((kpis.high_attention / totalCows) * 100) : 0;

  // Derive dynamic context tip based on detected patterns
  let tipTitle = t("risk.tip_optimal_title", "Herd Status Optimal");
  let tipText = t("risk.tip_optimal_desc", "Continue routine daily observation and monitor ambient shed temperature during midday peak hours.");

  const hasHeatStress = cases.some((c) =>
    c.sources.includes("Environmental") || c.reasons.some((r) => r.toLowerCase().includes("heat"))
  );
  const hasMilkDrop = cases.some((c) =>
    c.reasons.some((r) => r.toLowerCase().includes("milk") || r.toLowerCase().includes("yield"))
  );

  if (hasHeatStress) {
    tipTitle = t("risk.tip_heat_title", "Heat Mitigation Active");
    tipText = t("risk.tip_heat_desc", "Ensure ventilation fans and water misters run during peak THI hours. Provide fresh cool water stations.");
  } else if (hasMilkDrop) {
    tipTitle = t("risk.tip_yield_title", "Yield Variance Alert");
    tipText = t("risk.tip_yield_desc", "Cross-check feed intake and forage dry matter quality for flagged lactating cows showing negative yield deviation.");
  } else if (kpis.high_attention > 0) {
    tipTitle = t("risk.tip_action_title", "Priority Clinical Action");
    tipText = t("risk.tip_action_desc", "Conduct immediate physical exam on high attention cows to verify temperature, udder health, and rumination rates.");
  }

  return (
    <div className="space-y-4">
      {/* 1. HERD RISK DISTRIBUTION */}
      <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#121316] p-5 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-300">
              {t("risk.herd_risk_distribution", "Herd Risk Distribution")}
            </h4>
          </div>
          <span className="text-xs font-bold text-slate-600 dark:text-slate-400 font-mono">
            {totalCows} {t("cows.cows", "Cows")}
          </span>
        </div>

        {/* Stacked Percentage Bar */}
        <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-transparent">
          <div
            style={{ width: `${healthyPct}%` }}
            className="bg-emerald-500 transition-all duration-500"
            title={`${t("severity.healthy", "Healthy")}: ${healthyPct}%`}
          />
          <div
            style={{ width: `${monitorPct}%` }}
            className="bg-amber-500 transition-all duration-500"
            title={`${t("severity.monitor", "Monitor")}: ${monitorPct}%`}
          />
          <div
            style={{ width: `${highAttnPct}%` }}
            className="bg-rose-500 transition-all duration-500"
            title={`${t("risk.high_attention", "High Attention")}: ${highAttnPct}%`}
          />
        </div>

        {/* Legend */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900/40 p-2">
            <div className="font-extrabold text-emerald-900 dark:text-emerald-300">{healthyPct}%</div>
            <div className="text-emerald-700 dark:text-emerald-400/70 text-[10px] font-semibold">{t("severity.healthy", "Healthy")}</div>
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-900/40 p-2">
            <div className="font-extrabold text-amber-900 dark:text-amber-300">{monitorPct}%</div>
            <div className="text-amber-700 dark:text-amber-400/70 text-[10px] font-semibold">{t("severity.monitor", "Monitor")}</div>
          </div>
          <div className="rounded-lg bg-rose-50 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900/40 p-2">
            <div className="font-extrabold text-rose-900 dark:text-rose-300">{highAttnPct}%</div>
            <div className="text-rose-700 dark:text-rose-400/70 text-[10px] font-semibold">{t("risk.high_attn", "High Attn")}</div>
          </div>
        </div>
      </div>

      {/* 2. 7-DAY RISK TREND */}
      <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#121316] p-5 shadow-xs">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-300 mb-3">
          {t("risk.surveillance_summary", "7-Day Surveillance Summary")}
        </h4>
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-400 font-medium">{t("risk.flagged_active", "Flagged Cows Active")}</span>
            <span className="font-bold text-slate-900 dark:text-[#F4F4F5]">
              {kpis.cases_this_week} {t("cows.cows", "cows")}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-400 font-medium">{t("risk.under_surveillance", "Under Active Surveillance")}</span>
            <span className="font-bold text-rose-700 dark:text-rose-300">
              {kpis.high_attention + kpis.monitor} {t("cows.cows", "cows")}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-400 font-medium">{t("risk.resolved_to_normal", "Resolved to Normal")}</span>
            <span className="font-bold text-emerald-700 dark:text-emerald-300">
              {cases.filter((c) => c.is_resolved).length} {t("cows.cows", "cows")}
            </span>
          </div>
        </div>
      </div>

      {/* 3. FARMER-FRIENDLY ACTIONABLE TIP */}
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/20 p-4 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider">
          <Lightbulb className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span>{tipTitle}</span>
        </div>
        <p className="mt-2 text-xs text-emerald-900/90 dark:text-emerald-300/80 leading-relaxed font-medium">
          {tipText}
        </p>
      </div>
    </div>
  );
};

export default RiskInsightsPanel;
