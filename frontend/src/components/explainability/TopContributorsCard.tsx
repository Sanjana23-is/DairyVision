import { ExplainabilityFeature } from "@/services/explainability";

export default function TopContributorsCard({
  title,
  items,
}: {
  title: string;
  items: ExplainabilityFeature[];
}) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="text-sm font-semibold text-slate-800">{title}</div>
      <ul className="mt-4 space-y-3 text-sm text-slate-600">
        {items.length === 0 ? (
          <li className="text-xs text-slate-400">No significant factors</li>
        ) : (
          items.slice(0, 5).map((f, idx) => {
            const isPositive = (f.shap_value ?? 0) >= 0;
            return (
              <li key={f.feature} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                <div>
                  <div className="font-medium text-slate-900">
                    {idx + 1}. {f.display_name || f.feature}
                  </div>
                  <div className="text-xs text-slate-500">
                    Value: {f.value_formatted || String(f.value ?? "—")}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`text-xs font-semibold ${
                      isPositive ? "text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full" : "text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full"
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
