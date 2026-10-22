import type { SupportedLanguage } from "@/i18n/translations";
import {
  FEATURE_TRANSLATIONS,
  getFarmerFeatureLabel,
  getFarmerCategory,
  getFarmerExplanation,
} from "./featureTranslator";

/**
 * Maps category name to translation key
 */
const CATEGORY_KEY_MAP: Record<string, string> = {
  "Heat & Environment": "feat.cat.heat_env",
  "Nutrition & Feeding": "feat.cat.nutrition",
  "Cow Biometrics": "feat.cat.biometrics",
  "Production History": "feat.cat.history",
  "General Biometrics": "feat.cat.general",
};

/**
 * Maps constraint string to translation key
 */
const CONSTRAINT_KEY_MAP: Record<string, string> = {
  "+1 (Monotonically Increasing)": "explain.constraint_increasing",
  "+1 (Autoregressive Inertia)": "explain.constraint_inertia",
  "+1 (Production Capacity)": "explain.constraint_capacity",
  "+1 (Metabolic Capacity)": "explain.constraint_metabolic",
};

/**
 * Format date localized according to language
 */
export function formatLocalizedPredictionDate(
  dateStr?: string | null,
  language?: SupportedLanguage,
  t?: (key: string, fallback?: string) => string,
): string {
  if (!dateStr) {
    return t ? t("explain.recent", "Recent") : "Recent";
  }
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;

    const localeMap: Record<SupportedLanguage, string> = {
      en: "en-GB",
      hi: "hi-IN",
      mr: "mr-IN",
      pa: "pa-IN",
      gu: "gu-IN",
      kn: "kn-IN",
    };
    const locale = (language && localeMap[language]) || "en-GB";

    return d.toLocaleDateString(locale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Get confidence score and localized label
 */
export function getLocalizedConfidenceDetails(
  conf?: number | null,
  t?: (key: string, fallback?: string) => string,
): { label: string; scoreText: string } {
  if (conf == null || isNaN(conf)) {
    return {
      label: t ? t("explain.conf_estimated", "Estimated") : "Estimated",
      scoreText: "—",
    };
  }
  const pct = conf <= 1 ? Math.round(conf * 100) : Math.round(conf);
  if (pct >= 80) {
    return {
      label: t ? t("explain.conf_high", "High Confidence") : "High Confidence",
      scoreText: `${pct}%`,
    };
  } else if (pct >= 60) {
    return {
      label: t
        ? t("explain.conf_moderate", "Moderate Confidence")
        : "Moderate Confidence",
      scoreText: `${pct}%`,
    };
  } else {
    return {
      label: t ? t("explain.conf_fair", "Fair Confidence") : "Fair Confidence",
      scoreText: `${pct}%`,
    };
  }
}

/**
 * Localized Feature Label
 */
export function getLocalizedFeatureLabel(
  featureKey: string,
  fallbackDisplayName?: string,
  t?: (key: string, fallback?: string) => string,
): string {
  const normalized = featureKey.toLowerCase().trim();
  const defaultLabel = getFarmerFeatureLabel(featureKey, fallbackDisplayName);
  if (!t) return defaultLabel;

  return t(`feat.${normalized}.label`, defaultLabel);
}

/**
 * Localized Feature Category & Icon
 */
export function getLocalizedFeatureCategory(
  featureKey: string,
  t?: (key: string, fallback?: string) => string,
): { category: string; icon: string } {
  const { category: rawCategory, icon } = getFarmerCategory(featureKey);
  if (!t) return { category: rawCategory, icon };

  const key = CATEGORY_KEY_MAP[rawCategory] || "feat.cat.general";
  const localizedCategory = t(key, rawCategory);
  return { category: localizedCategory, icon };
}

/**
 * Localized Natural Language SHAP Directional Explanation
 */
export function getLocalizedFarmerExplanation(
  featureKey: string,
  shapValue: number,
  formattedValue?: string | null,
  t?: (key: string, fallback?: string) => string,
): string {
  if (!t) {
    return getFarmerExplanation(featureKey, shapValue, formattedValue);
  }

  const normalized = featureKey.toLowerCase().trim();
  const trans = FEATURE_TRANSLATIONS[normalized];
  const valueSnippet = formattedValue ? ` (${formattedValue})` : "";
  const absImpact = Math.abs(shapValue).toFixed(2);
  const modAdj = t("explain.model_adjustment_inline", "Model adjustment:");

  if (shapValue > 0.05) {
    const defaultText =
      trans?.positiveContributionText || "Pushed the model forecast higher.";
    const base = t(`feat.${normalized}.pos`, defaultText);
    return `${base} (${modAdj} +${absImpact} L/day${valueSnippet})`;
  } else if (shapValue < -0.05) {
    const defaultText =
      trans?.negativeContributionText || "Pushed the model forecast lower.";
    const base = t(`feat.${normalized}.neg`, defaultText);
    return `${base} (${modAdj} -${absImpact} L/day${valueSnippet})`;
  }

  const neutral = t(
    "explain.neutral_impact",
    "Neutral impact on the model forecast relative to baseline",
  );
  return `${neutral}${valueSnippet}.`;
}

/**
 * Localize Dynamic Backend Summary Narrative
 */
export function getLocalizedSummaryNarrative(
  narrative: string | null | undefined,
  t: (key: string, fallback?: string) => string,
  cowName?: string,
): string {
  if (!narrative || !narrative.trim()) {
    return t(
      "explain.narrative_baseline",
      "Prediction matches expected production baseline.",
    );
  }

  // 1. Check for negative driver narrative:
  // "{feature}{val} is the strongest factor lowering the model's predicted yield, contributing approximately {shap} L/day relative to the model baseline."
  const negMatch = narrative.match(
    /^(.*?)( \([^)]+\))? is the strongest factor lowering the model's predicted yield, contributing approximately (-?[\d.]+) L\/day relative to the model baseline\./,
  );
  if (negMatch) {
    const rawFeat = negMatch[1].trim();
    const valSnippet = negMatch[2] || "";
    const shap = negMatch[3];
    // Find matching feature key if possible
    const localizedFeat = getLocalizedFeatureLabel(rawFeat, rawFeat, t);
    return t("explain.narrative_top_neg", "{feature}{val} is the strongest factor lowering the model's predicted yield, contributing approximately {shap} L/day relative to the model baseline.")
      .replace("{feature}", localizedFeat)
      .replace("{val}", valSnippet)
      .replace("{shap}", shap);
  }

  // 2. Check for positive driver narrative:
  // "{feature}{val} is the strongest factor supporting the model's predicted yield, contributing approximately +{shap} L/day relative to the model baseline."
  const posMatch = narrative.match(
    /^(.*?)( \([^)]+\))? is the strongest factor supporting the model's predicted yield, contributing approximately \+?(-?[\d.]+) L\/day relative to the model baseline\./,
  );
  if (posMatch) {
    const rawFeat = posMatch[1].trim();
    const valSnippet = posMatch[2] || "";
    const shap = posMatch[3];
    const localizedFeat = getLocalizedFeatureLabel(rawFeat, rawFeat, t);
    return t("explain.narrative_top_pos", "{feature}{val} is the strongest factor supporting the model's predicted yield, contributing approximately +{shap} L/day relative to the model baseline.")
      .replace("{feature}", localizedFeat)
      .replace("{val}", valSnippet)
      .replace("{shap}", shap);
  }

  // 3. Check for cow-specific baseline narrative
  const cowMatch = narrative.match(
    /^For cow '([^']+)', predicted yield matches normal baseline production expectations with no major model-estimated environmental or feed penalties\./,
  );
  if (cowMatch) {
    const name = cowMatch[1] || cowName || "";
    return t(
      "explain.narrative_baseline_subject",
      "For cow '{name}', predicted yield matches normal baseline production expectations with no major model-estimated environmental or feed penalties.",
    ).replace("{name}", name);
  }

  // 4. Check for generic cow baseline narrative
  if (
    narrative.includes("predicted yield matches normal baseline production expectations with no major")
  ) {
    return t(
      "explain.narrative_baseline_general",
      "For this cow, predicted yield matches normal baseline production expectations with no major model-estimated environmental or feed penalties.",
    );
  }

  if (
    narrative === "Prediction matches expected production baseline." ||
    narrative.includes("matches expected production baseline")
  ) {
    return t(
      "explain.narrative_baseline",
      "Prediction matches expected production baseline.",
    );
  }

  return narrative;
}

/**
 * Localize Dynamic Backend Actionable Advice
 */
export function getLocalizedActionableAdvice(
  advice: string | null | undefined,
  t: (key: string, fallback?: string) => string,
): string {
  if (!advice || !advice.trim()) {
    return t(
      "explain.advice_baseline",
      "Production is currently within the model's expected range. Continue monitoring feed, health, and environmental conditions.",
    );
  }

  if (
    advice.includes("Production is currently within the model's expected range")
  ) {
    return t(
      "explain.advice_baseline",
      "Production is currently within the model's expected range. Continue monitoring feed, health, and environmental conditions.",
    );
  }

  if (advice.includes("Review cooling conditions during the hottest part of the day")) {
    return t(
      "explain.advice_cooling",
      "Review cooling conditions during the hottest part of the day and ensure adequate access to fresh water and shade.",
    );
  }

  if (advice.includes("Review the current feed intake and ration consistency")) {
    return t(
      "explain.advice_feed",
      "Review the current feed intake and ration consistency with the farm's feeding plan.",
    );
  }

  if (advice.includes("Monitor body condition and review whether the current nutrition plan")) {
    return t(
      "explain.advice_body_condition",
      "Monitor body condition and review whether the current nutrition plan is appropriate for the lactation stage.",
    );
  }

  if (advice.includes("Check the cow for signs of discomfort or health stress")) {
    return t(
      "explain.advice_health",
      "Check the cow for signs of discomfort or health stress and consider a closer herd health assessment.",
    );
  }

  if (advice.includes("Continue monitoring herd conditions. No specific management action")) {
    return t(
      "explain.advice_monitor",
      "Continue monitoring herd conditions. No specific management action was identified from the available model information.",
    );
  }

  return advice;
}

/**
 * Localize Constraint in Global SHAP
 */
export function getLocalizedConstraint(
  constraint: string | null | undefined,
  t: (key: string, fallback?: string) => string,
): string | null {
  if (!constraint) return null;
  const key = CONSTRAINT_KEY_MAP[constraint];
  if (key) {
    return t(key, constraint);
  }
  return constraint;
}
