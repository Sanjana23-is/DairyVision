import { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { TrendingUp, Calendar } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

export type MilkChartPoint = {
  date: string;
  label: string;
  actual: number | null;
  predicted: number | null;
};

// Custom Glassmorphism Hover Tooltip
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  const actualObj = payload.find((p: any) => p.dataKey === "actual");
  const predObj = payload.find((p: any) => p.dataKey === "predicted");

  const actualVal = actualObj?.value !== undefined && actualObj?.value !== null ? Number(actualObj.value) : null;
  const predVal = predObj?.value !== undefined && predObj?.value !== null ? Number(predObj.value) : null;

  const diff = actualVal !== null && predVal !== null ? actualVal - predVal : null;

  return (
    <div className="rounded-xl border border-slate-200/90 bg-white/95 p-3.5 shadow-xl backdrop-blur-md text-xs text-slate-800 space-y-2 min-w-[170px] select-none">
      <div className="font-bold text-slate-900 border-b border-slate-100 pb-1.5 flex items-center justify-between">
        <span>{label}</span>
        <span className="text-[10px] text-slate-400 font-normal">Daily Yield</span>
      </div>

      {actualVal !== null ? (
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-slate-600 font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-600 inline-block" />
            Actual Milk:
          </span>
          <span className="font-bold text-slate-950">{actualVal.toFixed(1)} L</span>
        </div>
      ) : (
        <div className="flex items-center justify-between text-slate-400">
          <span>Actual Milk:</span>
          <span className="italic">No log</span>
        </div>
      )}

      {predVal !== null ? (
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-slate-600 font-medium">
            <span className="h-2 w-2 rounded-full bg-sky-500 inline-block" />
            Predicted Target:
          </span>
          <span className="font-bold text-sky-700">{predVal.toFixed(1)} L</span>
        </div>
      ) : (
        <div className="flex items-center justify-between text-slate-400">
          <span>Predicted Target:</span>
          <span className="italic">No target</span>
        </div>
      )}

      {diff !== null && (
        <div className="flex items-center justify-between border-t border-slate-100 pt-1.5 text-[11px]">
          <span className="text-slate-500 font-medium">Variance:</span>
          <span className={`font-bold ${diff >= 0 ? "text-emerald-600" : "text-amber-600"}`}>
            {diff >= 0 ? `+${diff.toFixed(1)} L` : `${diff.toFixed(1)} L`}
          </span>
        </div>
      )}
    </div>
  );
}

export default function MilkProductionChart({
  points,
}: {
  points: MilkChartPoint[];
}) {
  const [range, setRange] = useState<7 | 30>(7);
  const { t } = useLanguage();

  const displayedPoints = points.slice(-range);

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs hover:shadow-sm transition-shadow duration-200 font-sans">
      {/* Header Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
              <TrendingUp className="h-4 w-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              {t("dashboard.milk_overview", "Milk Production Overview")}
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {t("dashboard.actual_vs_predicted", "Actual daily output vs AI-predicted yield targets")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Legend */}
          <div className="flex items-center gap-3 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-slate-700">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-600"></span>
              Actual Milk
            </span>
            <span className="flex items-center gap-1.5 text-slate-700">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-500 border border-sky-600"></span>
              Predicted Target
            </span>
          </div>

          {/* Timeframe Toggle */}
          <div className="flex items-center rounded-xl bg-slate-100/90 p-1 text-xs font-bold text-slate-600">
            <button
              type="button"
              onClick={() => setRange(7)}
              className={`rounded-lg px-3 py-1 transition-all duration-150 ${
                range === 7 ? "bg-white text-slate-950 shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              7 Days
            </button>
            <button
              type="button"
              onClick={() => setRange(30)}
              className={`rounded-lg px-3 py-1 transition-all duration-150 ${
                range === 30 ? "bg-white text-slate-950 shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              30 Days
            </button>
          </div>
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="h-72 w-full">
        {displayedPoints.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-400 font-medium">
            No milk production data available for this timeframe.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={displayedPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#059669" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#059669" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="predGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0284c7" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "#64748b" }}
                dy={6}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "#64748b" }}
                unit="L"
              />
              <Tooltip content={<CustomTooltip />} />

              {/* Predicted Target Area & Dashed Line */}
              <Area
                type="monotone"
                dataKey="predicted"
                name="Predicted Target"
                stroke="#0284c7"
                strokeWidth={2}
                strokeDasharray="4 4"
                fill="url(#predGradient)"
                isAnimationActive={true}
              />

              {/* Actual Milk Area & Solid Line */}
              <Area
                type="monotone"
                dataKey="actual"
                name="Actual Milk"
                stroke="#059669"
                strokeWidth={2.5}
                fill="url(#actualGradient)"
                isAnimationActive={true}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer Summary */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <span>{t("dashboard.showing_last", "Showing last")} <strong className="text-slate-800">{displayedPoints.length} {t("dashboard.days", "days")}</strong></span>
        </div>
        <div className="flex flex-wrap gap-4 text-xs">
          {displayedPoints.slice(-4).map((p) => (
            <div key={p.label} className="truncate">
              <span className="font-bold text-slate-800">{p.label}:</span>{" "}
              <span className="text-emerald-700 font-bold">{p.actual !== null ? `${p.actual}L` : "-"}</span>{" "}
              <span className="text-slate-300">/</span>{" "}
              <span className="text-sky-700 font-semibold">{p.predicted !== null ? `${p.predicted}L` : "-"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
