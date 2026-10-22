import { ExplainabilityFeature } from "@/services/explainability";
import { useLanguage } from "@/context/LanguageContext";
import {
  getFarmerFeatureLabel,
  getFarmerExplanation,
  getFarmerCategory,
} from "@/utils/featureTranslator";

export default function TopContributorsCard({
  title,
  items,
  showTechnical = false,
}: {
  title: string;
  items: ExplainabilityFeature[];
  showTechnical?: boolean;
}) {
  const { t } = useLanguage();

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] p-5 shadow-sm">
      <div className="text-sm font-semibold text-slate-800 dark:text-[#F4F4F5]">
        {title}
      </div>
      <ul className="mt-4 space-y-3.5 text-sm text-slate-600 dark:text-[#A1A1AA]">
        {items.length === 0 ? (
          <li className="text-xs text-slate-400 dark:text-[#A1A1AA]/70">
            {t("explain.no_factors", "No significant factors")}
          </li>
        ) : (
          items.slice(0, 5).map((f) => {
            const isPositive = (f.shap_value ?? 0) >= 0;
            const farmerName = getFarmerFeatureLabel(f.feature, f.display_name, t);
            const { icon, category } = getFarmerCategory(f.feature, t);
            const explanation = getFarmerExplanation(
              f.feature,
              f.shap_value,
              f.value_formatted,
              t,
            );

            return (
              <li
                key={f.feature}
                className="border-b border-slate-100 dark:border-[#27272A] pb-3 last:border-0 last:pb-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-slate-900 dark:text-[#F4F4F5] flex items-center gap-1.5">
                      <span>{icon}</span>
                      <span>{farmerName}</span>
                      {showTechnical && (
                        <span className="text-[10px] font-mono text-slate-400 dark:text-[#71717A] bg-slate-100 dark:bg-[#27272A] px-1.5 py-0.2 rounded">
                          {f.feature}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-[#A1A1AA]">
                      {t("explain.observed", "Observed:")}{" "}
                      <strong className="text-slate-700 dark:text-slate-300">
                        {f.value_formatted || String(f.value ?? "—")}
                      </strong>
                      <span className="mx-1.5 text-slate-300 dark:text-zinc-700">
                        •
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                        {category}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={`text-xs font-bold inline-flex items-center gap-1 ${
                        isPositive
                          ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-0.5 rounded-full"
                          : "text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 px-2.5 py-0.5 rounded-full"
                      }`}
                    >
                      <span>{isPositive ? "▲" : "▼"}</span>
                      <span>
                        {isPositive
                          ? `+${f.shap_value.toFixed(2)}`
                          : `${f.shap_value.toFixed(2)}`}{" "}
                        L/day
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">
                      {isPositive
                        ? t("explain.model_boost", "Model Boost")
                        : t("explain.model_penalty", "Model Penalty")}
                    </div>
                  </div>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500 dark:text-[#A1A1AA] leading-relaxed bg-slate-50/70 dark:bg-[#151719] p-2 rounded-lg border border-slate-100 dark:border-[#27272A]">
                  {explanation}
                </p>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
