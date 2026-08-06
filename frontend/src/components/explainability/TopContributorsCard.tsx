import { ExplainabilityFeature } from "@/services/explainability";

export default function TopContributorsCard({
  title,
  items,
}: {
  title: string;
  items: ExplainabilityFeature[];
}) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-sm font-medium text-slate-700">{title}</div>
      <ul className="mt-3 space-y-2 text-sm text-slate-600">
        {items.length === 0 ? (
          <li className="text-xs text-slate-400">No contributors</li>
        ) : (
          items.slice(0, 5).map((f, idx) => (
            <li key={f.feature} className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-800">
                  {idx + 1}. {f.feature}
                </div>
                <div className="text-xs text-slate-500">
                  Value: {String(f.value ?? "—")}
                </div>
              </div>
              <div
                className={`text-sm font-semibold ${(f.shap_value ?? 0) >= 0 ? "text-sky-600" : "text-rose-600"}`}
              >
                {(f.shap_value ?? 0).toFixed(3)}
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
