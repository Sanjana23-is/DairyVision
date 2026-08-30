import { useState, useId } from "react";

export type MilkChartPoint = {
  date: string;
  label: string;
  actual: number | null;
  predicted: number | null;
};

export default function MilkProductionChart({
  points,
}: {
  points: MilkChartPoint[];
}) {
  const [range, setRange] = useState<7 | 30>(7);
  const actualGradientId = `grad-actual-${useId()}`;
  const predGradientId = `grad-pred-${useId()}`;

  const displayedPoints = points.slice(-range);

  const actualValues = displayedPoints.map((p) => p.actual ?? 0);
  const predValues = displayedPoints.map((p) => p.predicted ?? 0);
  const allValues = [...actualValues, ...predValues];

  const maxVal = Math.max(...allValues, 10);
  const minVal = Math.min(...allValues, 0);

  const coords = displayedPoints.map((p, idx) => {
    const x =
      displayedPoints.length > 1
        ? (idx / (displayedPoints.length - 1)) * 100
        : 50;
    const actY =
      p.actual !== null
        ? 90 - (((p.actual ?? 0) - minVal) / (maxVal - minVal || 1)) * 80
        : null;
    const predY =
      p.predicted !== null
        ? 90 - (((p.predicted ?? 0) - minVal) / (maxVal - minVal || 1)) * 80
        : null;
    return { x, actY, predY, label: p.label, actual: p.actual, predicted: p.predicted };
  });

  const actualPath = coords
    .filter((c) => c.actY !== null)
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.actY}`)
    .join(" ");

  const predPath = coords
    .filter((c) => c.predY !== null)
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.predY}`)
    .join(" ");

  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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

      <div className="mt-6 h-64 overflow-hidden">
        {displayedPoints.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            No milk production history available for this timeframe.
          </div>
        ) : (
          <svg
            viewBox="0 0 100 100"
            className="h-full w-full"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id={actualGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0284c7" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id={predGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {actualPath && (
              <path
                d={`${actualPath} L 100 95 L 0 95 Z`}
                fill={`url(#${actualGradientId})`}
              />
            )}

            {/* Predicted Line (Dashed Emerald) */}
            {predPath && (
              <path
                d={predPath}
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
                strokeDasharray="3 3"
                strokeLinecap="round"
              />
            )}

            {/* Actual Line (Solid Sky Blue) */}
            {actualPath && (
              <path
                d={actualPath}
                fill="none"
                stroke="#0284c7"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            )}

            {/* Data Points */}
            {coords.map((c, i) => (
              <g key={`${c.label}-${i}`}>
                {c.actY !== null && (
                  <circle
                    cx={c.x}
                    cy={c.actY}
                    r="1.8"
                    fill="#0284c7"
                    stroke="#ffffff"
                    strokeWidth="1"
                  />
                )}
                {c.predY !== null && (
                  <circle
                    cx={c.x}
                    cy={c.predY}
                    r="1.6"
                    fill="#10b981"
                    stroke="#ffffff"
                    strokeWidth="1"
                  />
                )}
              </g>
            ))}
          </svg>
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
              <span className="text-sky-700 font-medium">{p.actual ?? "-"}L actual</span>{" "}
              <span className="text-slate-400">/</span>{" "}
              <span className="text-emerald-700 font-medium">{p.predicted ?? "-"}L exp</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
