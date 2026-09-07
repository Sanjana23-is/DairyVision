import { CowDigitalTwin } from "@/services/digitalTwin";

export default function DigitalTwinCowCard({ cowTwin }: { cowTwin: CowDigitalTwin }) {
  const isHealthy = cowTwin.health_status === "Healthy";
  const isCritical = cowTwin.health_status === "Critical";
  const score = cowTwin.vitality_score;

  let scoreBg = "bg-emerald-50 text-emerald-700 border-emerald-200";
  let scoreBar = "bg-emerald-500";
  if (score < 65 || isCritical) {
    scoreBg = "bg-rose-50 text-rose-700 border-rose-200";
    scoreBar = "bg-rose-500";
  } else if (score < 80 || !isHealthy) {
    scoreBg = "bg-amber-50 text-amber-700 border-amber-200";
    scoreBar = "bg-amber-500";
  }

  function formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] p-6 shadow-xl space-y-6 transition-all hover:shadow-2xl">
      {/* Top Banner & Vitality Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 dark:border-[#27272A] pb-5">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 dark:bg-emerald-500/10 text-2xl shadow-inner">
            🐄
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-slate-900 dark:text-[#F4F4F5]">{cowTwin.cow_name}</h3>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  isCritical
                    ? "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300"
                    : isHealthy
                    ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                    : "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                }`}
              >
                {cowTwin.health_status}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  cowTwin.heat_stress_level === "High"
                    ? "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300"
                    : cowTwin.heat_stress_level === "Comfort"
                    ? "bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300"
                    : "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                }`}
              >
                THI: {cowTwin.heat_stress_level}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-[#A1A1AA] font-medium">
              {cowTwin.breed ? <span>Breed: {cowTwin.breed}</span> : null}
              {cowTwin.age_display ? <span>• Age: {cowTwin.age_display}</span> : null}
              {cowTwin.lactation_stage ? <span>• {cowTwin.lactation_stage}</span> : null}
              {cowTwin.weight_kg ? <span>• {cowTwin.weight_kg} kg</span> : null}
            </div>
          </div>
        </div>

        {/* Vitality Score Gauge Badge */}
        <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-xs ${scoreBg} dark:bg-[#1B1D20] dark:border-[#27272A]`}>
          <div className="text-right">
            <div className="text-2xl font-black text-slate-900 dark:text-[#F4F4F5]">{score.toFixed(0)}%</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#A1A1AA]">Digital Twin Vitality</div>
          </div>
          <div className="h-10 w-2.5 rounded-full bg-slate-200 dark:bg-[#151719] overflow-hidden flex flex-col justify-end">
            <div className={`w-full ${scoreBar} transition-all duration-500`} style={{ height: `${score}%` }} />
          </div>
        </div>
      </div>

      {/* Summary Text Banner */}
      <div className="rounded-2xl bg-slate-50 dark:bg-[#1B1D20] border border-slate-100 dark:border-[#27272A] p-4 text-xs font-medium text-slate-700 dark:text-[#A1A1AA] leading-relaxed">
        💡 <span className="font-semibold text-slate-900 dark:text-[#F4F4F5]">Current Digital Twin State:</span> {cowTwin.status_summary}
      </div>

      {/* Grid Section 1: Vital Signs & Environmental Meters */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-[#A1A1AA] mb-3">
          🩺 Real-Time Vital Signs & Ambient Stress
        </h4>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cowTwin.vital_signs.map((vs, i) => (
            <div
              key={i}
              className={`rounded-2xl border p-3.5 shadow-2xs ${
                vs.status === "critical"
                  ? "border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20"
                  : vs.status === "warning"
                  ? "border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20"
                  : "border-slate-100 dark:border-[#27272A] bg-white dark:bg-[#1B1D20]"
              }`}
            >
              <div className="text-xs font-medium text-slate-500 dark:text-[#A1A1AA]">{vs.name}</div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-lg font-bold text-slate-900 dark:text-[#F4F4F5]">{vs.value}</span>
                {vs.unit ? <span className="text-xs font-semibold text-slate-500 dark:text-[#A1A1AA]">{vs.unit}</span> : null}
              </div>
              {vs.description ? (
                <div className="mt-1 text-[11px] text-slate-500 dark:text-[#A1A1AA] truncate">{vs.description}</div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {/* Grid Section 2: Milk Production Performance vs Predicted */}
      <div className="rounded-2xl border border-sky-100 dark:border-[#27272A] bg-sky-50/40 dark:bg-[#1B1D20]/60 p-5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-sky-900 dark:text-sky-300 mb-3 flex items-center justify-between">
          <span>📈 Milk Yield Performance vs AI Prediction Baseline</span>
          <span className="rounded-full bg-sky-100 dark:bg-sky-950/60 px-2.5 py-0.5 text-[11px] font-bold text-sky-800 dark:text-sky-300">
            {cowTwin.production.baseline_status}
          </span>
        </h4>
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-white dark:border-[#27272A] bg-white/80 dark:bg-[#151719] p-3 shadow-2xs">
            <div className="text-xs font-medium text-slate-500 dark:text-[#A1A1AA]">Current Yield</div>
            <div className="mt-1 text-lg font-bold text-slate-900 dark:text-[#F4F4F5]">
              {cowTwin.production.current_yield_l !== null ? `${cowTwin.production.current_yield_l} L/day` : "N/A"}
            </div>
          </div>
          <div className="rounded-xl border border-white dark:border-[#27272A] bg-white/80 dark:bg-[#151719] p-3 shadow-2xs">
            <div className="text-xs font-medium text-slate-500 dark:text-[#A1A1AA]">AI Predicted Target</div>
            <div className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-400">
              {cowTwin.production.predicted_yield_l !== null ? `${cowTwin.production.predicted_yield_l} L/day` : "N/A"}
            </div>
          </div>
          <div className="rounded-xl border border-white dark:border-[#27272A] bg-white/80 dark:bg-[#151719] p-3 shadow-2xs">
            <div className="text-xs font-medium text-slate-500 dark:text-[#A1A1AA]">Production Efficiency</div>
            <div className="mt-1 text-lg font-bold text-slate-900 dark:text-[#F4F4F5]">
              {cowTwin.production.efficiency_pct !== null ? `${cowTwin.production.efficiency_pct}%` : "N/A"}
            </div>
          </div>
          <div className="rounded-xl border border-white dark:border-[#27272A] bg-white/80 dark:bg-[#151719] p-3 shadow-2xs">
            <div className="text-xs font-medium text-slate-500 dark:text-[#A1A1AA]">7-Day Trend</div>
            <div className="mt-1 text-lg font-bold text-slate-900 dark:text-[#F4F4F5]">
              {cowTwin.production.trend_7d_l_day !== undefined && cowTwin.production.trend_7d_l_day !== null
                ? `${cowTwin.production.trend_7d_l_day > 0 ? "+" : ""}${cowTwin.production.trend_7d_l_day} L/day`
                : "Stable"}
            </div>
          </div>
        </div>
      </div>

      {/* Grid Section 3: Top Production & Health Drivers */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-[#A1A1AA] mb-3">
          ⚡ Key Production & Health Drivers
        </h4>
        <div className="space-y-2">
          {cowTwin.top_drivers.map((drv, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 rounded-2xl border border-slate-100 dark:border-[#27272A] bg-slate-50/70 dark:bg-[#1B1D20] p-3.5"
            >
              <span className="text-base">
                {drv.type === "positive" ? "🟢" : drv.type === "negative" ? "🔴" : "🔵"}
              </span>
              <div className="flex-1 text-xs">
                <div className="flex items-center justify-between font-bold text-slate-900 dark:text-[#F4F4F5]">
                  <span>{drv.factor}</span>
                  <span className={drv.type === "positive" ? "text-emerald-700 dark:text-emerald-400" : drv.type === "negative" ? "text-rose-700 dark:text-rose-400" : "text-slate-600 dark:text-[#A1A1AA]"}>
                    {drv.impact}
                  </span>
                </div>
                <p className="mt-0.5 text-slate-600 dark:text-[#A1A1AA] font-medium">{drv.explanation}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Grid Section 4: Recommended Actions */}
      {cowTwin.recommended_actions.length > 0 ? (
        <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-500/[0.08] p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 dark:text-emerald-300 mb-2">
            <span>📋</span>
            <span>Digital Twin Recommended Guidance</span>
          </div>
          <ul className="space-y-1 text-xs text-emerald-950 dark:text-emerald-200 font-medium list-disc list-inside">
            {cowTwin.recommended_actions.map((rec, i) => (
              <li key={i}>{rec}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex items-center justify-between border-t border-slate-100 dark:border-[#27272A] pt-3 text-[11px] text-slate-400 dark:text-[#A1A1AA] font-medium">
        <span>State updated: {formatDate(cowTwin.last_updated)}</span>
        <span>Digital Twin Engine • DairyVision AI</span>
      </div>
    </div>
  );
}
