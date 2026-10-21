import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import type { ExplainabilityFeature } from "@/services/explainability";
import {
  getFarmerFeatureLabel,
  getFarmerExplanation,
} from "@/utils/featureTranslator";

// Custom Tooltip for SHAP Feature Importance
function CustomShapTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0].payload;
  const shapVal = item.shap_value ?? 0;
  const farmerName = getFarmerFeatureLabel(item.feature, item.display_name);
  const explanation = getFarmerExplanation(
    item.feature,
    shapVal,
    item.value_formatted,
  );

  return (
    <div className="rounded-xl border border-slate-200 dark:border-[#27272A] bg-white/95 dark:bg-[#151719]/95 p-3.5 shadow-md text-xs text-slate-800 dark:text-[#F4F4F5] space-y-2 backdrop-blur-md max-w-xs">
      <div>
        <div className="font-bold text-slate-900 dark:text-[#F4F4F5] text-sm">
          {farmerName}
        </div>
        <div className="text-[10px] font-mono text-slate-400 dark:text-[#71717A]">
          {item.feature}
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 text-slate-600 dark:text-[#A1A1AA] pt-1 border-t border-slate-100 dark:border-[#27272A]">
        <span>Model Adjustment:</span>
        <span
          className={`font-black ${shapVal >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
        >
          {shapVal >= 0 ? `+${shapVal.toFixed(3)}` : shapVal.toFixed(3)} L/day
        </span>
      </div>
      <div className="text-[11px] text-slate-500 dark:text-[#A1A1AA] leading-relaxed pt-0.5">
        {explanation}
      </div>
    </div>
  );
}

export default function FeatureImportanceChart({
  features,
}: {
  features: ExplainabilityFeature[];
}) {
  if (!features || features.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-100 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] p-6 text-slate-600 dark:text-[#A1A1AA] text-sm text-center">
        No feature importance data available.
      </div>
    );
  }

  // Sort features by absolute SHAP impact descending
  const sortedFeatures = [...features].sort(
    (a, b) => Math.abs(b.shap_value ?? 0) - Math.abs(a.shap_value ?? 0),
  );

  const chartData = sortedFeatures.map((f) => ({
    feature: f.feature,
    display_name: getFarmerFeatureLabel(f.feature, f.display_name),
    shap_value: f.shap_value ?? 0,
    value_formatted: f.value_formatted,
  }));

  const dynamicHeight = Math.max(280, chartData.length * 38);

  return (
    <div className="rounded-2xl border border-slate-100 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2 px-2">
        <div>
          <h4 className="text-sm font-semibold text-slate-800 dark:text-[#F4F4F5]">
            Farmer Factor Attribution (SHAP)
          </h4>
          <p className="text-[11px] text-slate-400 dark:text-[#71717A]">
            Model adjustments relative to baseline herd yield.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> + Yield
            Boost
          </span>
          <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
            <span className="h-2 w-2 rounded-full bg-rose-500" /> - Yield
            Penalty
          </span>
        </div>
      </div>

      <div style={{ height: dynamicHeight }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={false}
              stroke="#27272A"
              opacity={0.3}
            />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#A1A1AA" }}
              unit=" L"
            />
            <YAxis
              type="category"
              dataKey="display_name"
              width={190}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#A1A1AA", fontWeight: 500 }}
            />
            <Tooltip content={<CustomShapTooltip />} />
            <Bar
              dataKey="shap_value"
              radius={[0, 4, 4, 0]}
              isAnimationActive={true}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.shap_value >= 0 ? "#10b981" : "#f43f5e"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
