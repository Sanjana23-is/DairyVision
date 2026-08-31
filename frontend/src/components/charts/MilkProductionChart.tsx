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
    <div className="rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur-md text-xs text-slate-800 space-y-1.5 min-w-[160px]">
      <div className="font-semibold text-slate-900 border-b border-slate-100 pb-1">
        {label}
      </div>

      {actualVal !== null ? (
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="h-2 w-2 rounded-full bg-sky-600 inline-block" />
            Actual Milk:
          </span>
          <span className="font-semibold text-sky-700">{actualVal.toFixed(1)} L</span>
        </div>
      ) : (
        <div className="flex items-center justify-between text-slate-400">
          <span>Actual Milk:</span>
          <span>No log</span>
        </div>
      )}

      {predVal !== null ? (
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
            Predicted Target:
          </span>
          <span className="font-semibold text-emerald-700">{predVal.toFixed(1)} L</span>
        </div>
      ) : (
        <div className="flex items-center justify-between text-slate-400">
          <span>Predicted Target:</span>
          <span>No target</span>
        </div>
      )}

      {diff !== null && (
        <div className="flex items-center justify-between border-t border-slate-100 pt-1.5 text-[11px]">
          <span className="text-slate-500">Variance:</span>
          <span className={`font-semibold ${diff >= 0 ? "text-emerald-600" : "text-amber-600"}`}>
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

  const displayedPoints = points.slice(-range);

  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">
            Milk Production Overview
          </h3>
          <p className="text-xs text-slate-500">
            Actual vs expected milk production
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 font-medium text-slate-700">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-600"></span>
              Actual Milk
            </span>
            <span className="flex items-center gap-1.5 font-medium text-slate-700">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 border border-emerald-600"></span>
              Predicted Target
            </span>
          </div>

          <div className="flex items-center rounded-xl bg-slate-100 p-1 text-xs font-medium text-slate-600">
            <button
              onClick={() => setRange(7)}
              className={`rounded-lg px-2.5 py-1 transition ${
                range === 7 ? "bg-white text-slate-900 shadow-sm" : "hover:text-slate-900"
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setRange(30)}
              className={`rounded-lg px-2.5 py-1 transition ${
                range === 30 ? "bg-white text-slate-900 shadow-sm" : "hover:text-slate-900"
              }`}
            >
              30 Days
            </button>
          </div>
        </div>
      </div>

      <div className="h-64 w-full">
        {displayedPoints.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            No milk production history available for this timeframe.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={displayedPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0284c7" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="predGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.0} />
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
                stroke="#10b981"
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
                stroke="#0284c7"
                strokeWidth={2.5}
                fill="url(#actualGradient)"
                isAnimationActive={true}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
        <div>
          Showing last <span className="font-semibold text-slate-700">{displayedPoints.length} days</span>
        </div>
        <div className="flex gap-4">
          {displayedPoints.slice(-4).map((p) => (
            <div key={p.label} className="truncate">
              <span className="font-semibold text-slate-700">{p.label}:</span>{" "}
              <span className="text-sky-700 font-medium">{p.actual !== null ? `${p.actual}L` : "-"} actual</span>{" "}
              <span className="text-slate-400">/</span>{" "}
              <span className="text-emerald-700 font-medium">{p.predicted !== null ? `${p.predicted}L` : "-"} exp</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
