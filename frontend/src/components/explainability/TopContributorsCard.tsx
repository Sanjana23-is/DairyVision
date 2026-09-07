import { ExplainabilityFeature } from "@/services/explainability";

export default function TopContributorsCard({
  title,
  items,
}: {
  title: string;
  items: ExplainabilityFeature[];
}) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] p-5 shadow-sm">
      <div className="text-sm font-semibold text-slate-800 dark:text-[#F4F4F5]">{title}</div>
      <ul className="mt-4 space-y-3 text-sm text-slate-600 dark:text-[#A1A1AA]">
        {items.length === 0 ? (
          <li className="text-xs text-slate-400 dark:text-[#A1A1AA]/70">No significant factors</li>
        ) : (
          items.slice(0, 5).map((f, idx) => {
            const isPositive = (f.shap_value ?? 0) >= 0;
            return (
              <li key={f.feature} className="flex items-center justify-between border-b border-slate-100 dark:border-[#27272A] pb-2 last:border-0 last:pb-0">
                <div>
                  <div className="font-medium text-slate-900 dark:text-[#F4F4F5]">
                    {idx + 1}. {f.display_name || f.feature}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-[#A1A1AA]">
                    Value: {f.value_formatted || String(f.value ?? "—")}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`text-xs font-semibold ${
                      isPositive ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full" : "text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded-full"
                    }`}
                  >
                    {f.impact_description || (isPositive ? `+${f.shap_value.toFixed(2)}` : `${f.shap_value.toFixed(2)}`)}
                  </div>
                </div>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
