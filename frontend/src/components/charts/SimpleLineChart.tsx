export type SimpleLineChartPoint = {
  label: string;
  value: number | null;
};

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
  const values = data.map((point) => point.value ?? 0);
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);

  const points = data.map((point, index) => {
    const x = data.length > 1 ? (index / (data.length - 1)) * 100 : 50;
    const value = point.value ?? 0;
    const y = 90 - ((value - minValue) / (maxValue - minValue || 1)) * 80;
    return { x, y, label: point.label, value };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const filledPath = `${linePath} L 100 95 L 0 95 Z`;

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-slate-700">{title}</div>
          <div className="mt-1 text-xs text-slate-500">{valueLabel}</div>
        </div>
        <div className="text-xs text-slate-400">Last {data.length} days</div>
      </div>

      <div className="mt-4 h-56 overflow-hidden">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            No data available
          </div>
        ) : (
          <svg
            viewBox="0 0 100 100"
            className="h-full w-full"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.35" />
                <stop offset="100%" stopColor={color} stopOpacity="0.05" />
              </linearGradient>
            </defs>
            <path d={filledPath} fill="url(#lineGradient)" />
            <path
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            {points.map((point, index) => (
              <circle
                key={`${point.label}-${index}`}
                cx={point.x}
                cy={point.y}
                r="1.6"
                fill={color}
                stroke="#fff"
                strokeWidth="0.8"
              />
            ))}
          </svg>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-500">
        {points.slice(0, 4).map((point) => (
          <div key={point.label} className="truncate">
            <span className="font-semibold text-slate-800">{point.label}</span>:{" "}
            {point.value}
          </div>
        ))}
      </div>
    </div>
  );
}
