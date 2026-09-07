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
import { useLanguage } from "@/context/LanguageContext";

// Custom Tooltip for SHAP Feature Importance
function CustomShapTooltip({ active, payload }: any) {
  const { t } = useLanguage();
  if (!active || !payload || !payload.length) return null;
  const item = payload[0].payload;
  const shapVal = item.shap_value ?? 0;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-[#27272A] bg-white/95 dark:bg-[#151719]/95 p-3 shadow-md text-xs text-slate-800 dark:text-[#F4F4F5] space-y-1 backdrop-blur-md">
      <div className="font-semibold text-slate-900 dark:text-[#F4F4F5]">{item.display_name || item.feature}</div>
      <div className="flex items-center justify-between gap-4 text-slate-600 dark:text-[#A1A1AA]">
        <span>SHAP Impact:</span>
        <span className={`font-bold ${shapVal >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
          {shapVal >= 0 ? `+${shapVal.toFixed(3)}` : shapVal.toFixed(3)} L
        </span>
      </div>
      <div className="text-[11px] text-slate-500 dark:text-[#A1A1AA]/70 pt-0.5">
        {shapVal >= 0
          ? t("explain.supporting", "Increases predicted milk yield")
          : t("explain.lowering", "Decreases predicted milk yield")}
      </div>
    </div>
  );
}

export default function FeatureImportanceChart({
  features,
}: {
  features: ExplainabilityFeature[];
}) {
  const { t } = useLanguage();

  if (!features || features.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-100 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] p-6 text-slate-600 dark:text-[#A1A1AA] text-sm text-center">
        {t("status.no_data", "No feature importance data available.")}
      </div>
    );
  }

  // Sort features by absolute SHAP impact descending
  const sortedFeatures = [...features].sort(
    (a, b) => Math.abs(b.shap_value ?? 0) - Math.abs(a.shap_value ?? 0)
  );

  const chartData = sortedFeatures.map((f) => ({
    feature: f.feature,
    display_name: f.display_name || f.feature,
    shap_value: f.shap_value ?? 0,
  }));

  const dynamicHeight = Math.max(260, chartData.length * 36);

  return (
    <div className="rounded-2xl border border-slate-100 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2 px-2">
        <h4 className="text-sm font-semibold text-slate-800 dark:text-[#F4F4F5]">Feature Attribution (SHAP)</h4>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> + {t("explain.supporting", "Yield Boost")}
          </span>
          <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
            <span className="h-2 w-2 rounded-full bg-rose-500" /> - {t("explain.lowering", "Yield Penalty")}
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
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#27272A" opacity={0.3} />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#A1A1AA" }}
            />
            <YAxis
              type="category"
              dataKey="display_name"
              width={160}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: "#A1A1AA", fontWeight: 500 }}
            />
            <Tooltip content={<CustomShapTooltip />} />
            <Bar dataKey="shap_value" radius={[0, 4, 4, 0]} isAnimationActive={true}>
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

