import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export type SimpleLineChartPoint = {
  label: string;
  value: number | null;
};

function SimpleTooltip({ active, payload, valueLabel }: any) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0].payload;
  const val = item.value;

  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 p-2.5 shadow-md text-xs text-slate-800 backdrop-blur-md">
      <div className="font-semibold text-slate-900 mb-1">{item.label}</div>
      <div className="text-slate-600">
        {valueLabel}:{" "}
        <span className="font-bold text-emerald-700">
          {val !== null && val !== undefined ? val : "N/A"}
        </span>
      </div>
    </div>
  );
}

export default function SimpleLineChart({
  title,
  data,
  valueLabel,
  color = "#0f766e",
}: {
  title: string;
  data: SimpleLineChartPoint[];
  valueLabel: string;
  color?: string;
}) {
  const chartData = data.map((d) => ({
    label: d.label,
    value: d.value ?? 0,
  }));

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-sm font-medium text-slate-700">{title}</div>
          <div className="mt-0.5 text-xs text-slate-500">{valueLabel}</div>
        </div>
        <div className="text-xs text-slate-400">Last {data.length} days</div>
      </div>

      <div className="h-56 w-full mt-2">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            No data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id={`gradient-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "#64748b" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "#64748b" }}
              />
              <Tooltip content={<SimpleTooltip valueLabel={valueLabel} />} />

              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                fill={`url(#gradient-${color.replace("#", "")})`}
                isAnimationActive={true}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500 border-t border-slate-100 pt-2">
        {data.slice(0, 4).map((point, idx) => (
          <div key={`${point.label}-${idx}`} className="truncate">
            <span className="font-semibold text-slate-800">{point.label}</span>:{" "}
            {point.value ?? "-"}
          </div>
        ))}
      </div>
    </div>
  );
}
