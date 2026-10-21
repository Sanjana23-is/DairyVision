/**
 * featureTranslator.ts
 * ====================
 * Farmer-friendly translation layer for DairyVision AI model features and SHAP attributions.
 *
 * Translates engineering/statistical feature names into intuitive dairy domain concepts
 * with scientifically sound, non-causal explanations of model contributions.
 */

export interface FeatureTranslation {
  farmerLabel: string;
  category:
    | "Heat & Environment"
    | "Nutrition & Feeding"
    | "Cow Biometrics"
    | "Production History";
  categoryIcon: string;
  shortDescription: string;
  positiveContributionText: string;
  negativeContributionText: string;
}

export const FEATURE_TRANSLATIONS: Record<string, FeatureTranslation> = {
  feed_thi_interaction: {
    farmerLabel: "Heat-Induced Feed Inefficiency",
    category: "Heat & Environment",
    categoryIcon: "🌡️",
    shortDescription:
      "Combined interaction between ambient heat stress and daily feed intake.",
    positiveContributionText:
      "Feed intake remained effective relative to thermal conditions, supporting predicted yield.",
    negativeContributionText:
      "Elevated heat stress combined with feed level reduced the model's yield forecast relative to baseline.",
  },
  thi_squared: {
    farmerLabel: "Severe Heat Load Acceleration",
    category: "Heat & Environment",
    categoryIcon: "🔥",
    shortDescription:
      "Non-linear compound heat stress index under extreme temperatures and humidity.",
    positiveContributionText:
      "Low ambient heat load supported normal production capacity.",
    negativeContributionText:
      "Severe heat stress conditions substantially lowered the model's predicted yield.",
  },
  thi: {
    farmerLabel: "Heat Stress Index (THI)",
    category: "Heat & Environment",
    categoryIcon: "☀️",
    shortDescription:
      "Temperature-Humidity Index indicating cow comfort and heat strain.",
    positiveContributionText:
      "Comfortable barn climate conditions supported optimal production.",
    negativeContributionText:
      "Elevated THI contributed to a lower predicted yield relative to baseline.",
  },
  temperature: {
    farmerLabel: "Ambient Barn Temperature",
    category: "Heat & Environment",
    categoryIcon: "🌡️",
    shortDescription: "Recorded ambient air temperature in the barn.",
    positiveContributionText:
      "Moderate ambient temperature supported standard production.",
    negativeContributionText:
      "Unfavorable ambient temperature pulled the model forecast downward.",
  },
  humidity: {
    farmerLabel: "Relative Humidity",
    category: "Heat & Environment",
    categoryIcon: "💧",
    shortDescription:
      "Moisture level in the barn air impacting evaporative cooling.",
    positiveContributionText:
      "Favorable humidity level supported normal cooling.",
    negativeContributionText:
      "High humidity contributed to reduced predicted production.",
  },
  temp_humidity: {
    farmerLabel: "Temperature & Humidity Compound",
    category: "Heat & Environment",
    categoryIcon: "🌤️",
    shortDescription: "Joint atmospheric moisture and temperature factor.",
    positiveContributionText:
      "Atmospheric conditions favored comfortable barn environment.",
    negativeContributionText:
      "Compound weather factors reduced the model yield projection.",
  },
  feed: {
    farmerLabel: "Daily Feed Intake",
    category: "Nutrition & Feeding",
    categoryIcon: "🌾",
    shortDescription: "Total ration quantity consumed by the cow per day.",
    positiveContributionText:
      "Strong daily feed intake was the primary positive factor lifting predicted yield.",
    negativeContributionText:
      "Lower recorded feed intake reduced the model's predicted yield.",
  },
  feed_weight_ratio: {
    farmerLabel: "Feed per Bodyweight Ratio",
    category: "Nutrition & Feeding",
    categoryIcon: "⚖️",
    shortDescription:
      "Proportion of feed consumed relative to the cow's total body mass.",
    positiveContributionText:
      "High feed intake relative to body size supported strong predicted output.",
    negativeContributionText:
      "Feed intake was low relative to body weight, lowering the forecast.",
  },
  feed_per_weight: {
    farmerLabel: "Intake per kg Bodyweight",
    category: "Nutrition & Feeding",
    categoryIcon: "⚖️",
    shortDescription: "Specific feed efficiency metric relative to cow mass.",
    positiveContributionText:
      "Efficient nutritional intake supported higher predicted yield.",
    negativeContributionText:
      "Sub-optimal intake ratio pulled predicted yield below baseline.",
  },
  weight: {
    farmerLabel: "Cow Bodyweight",
    category: "Cow Biometrics",
    categoryIcon: "🐄",
    shortDescription: "Physical body mass indicating metabolic capacity.",
    positiveContributionText:
      "Healthy cow body mass provided strong capacity supporting the yield forecast.",
    negativeContributionText:
      "Lower cow bodyweight was associated with a modest reduction in forecasted yield.",
  },
  age: {
    farmerLabel: "Cow Age & Maturity",
    category: "Cow Biometrics",
    categoryIcon: "📅",
    shortDescription:
      "Age of the animal indicating maturity level and lactation capacity.",
    positiveContributionText:
      "Optimal maturity stage contributed positively to predicted yield.",
    negativeContributionText:
      "Age profile adjusted the model's expectation downward relative to prime maturity.",
  },
  age_weight_ratio: {
    farmerLabel: "Maturity-to-Weight Balance",
    category: "Cow Biometrics",
    categoryIcon: "🧬",
    shortDescription: "Growth balance between age and physical frame.",
    positiveContributionText:
      "Well-balanced growth profile supported the model forecast.",
    negativeContributionText:
      "Age-to-weight alignment resulted in a slight downward baseline adjustment.",
  },
  health_status: {
    farmerLabel: "Clinical Health Status",
    category: "Cow Biometrics",
    categoryIcon: "🩺",
    shortDescription: "Veterinary diagnostic health indicator.",
    positiveContributionText:
      "Healthy clinical status supported standard or elevated yield expectations.",
    negativeContributionText:
      "Health flags contributed to a lower predicted milk yield.",
  },
  milk_lag_1d: {
    farmerLabel: "Previous Day Milk Yield",
    category: "Production History",
    categoryIcon: "🥛",
    shortDescription:
      "Yesterday's recorded yield serving as the primary short-term baseline.",
    positiveContributionText:
      "High previous day production strongly anchored a higher yield forecast.",
    negativeContributionText:
      "Lower previous day production lowered the short-term model forecast.",
  },
  rolling_avg_7d: {
    farmerLabel: "7-Day Production Baseline",
    category: "Production History",
    categoryIcon: "📊",
    shortDescription:
      "Weekly rolling production average reflecting persistent yield trend.",
    positiveContributionText:
      "Strong 7-day historical average provided high baseline support.",
    negativeContributionText:
      "Declining 7-day production trend pulled down today's prediction.",
  },
  days_in_milk: {
    farmerLabel: "Lactation Stage (Days in Milk)",
    category: "Production History",
    categoryIcon: "⏳",
    shortDescription:
      "Days elapsed since calving along the standard lactation curve.",
    positiveContributionText:
      "Lactation curve position supported peak or steady yield.",
    negativeContributionText:
      "Late lactation stage contributed to lower expected daily volume.",
  },
};

/**
 * Get the farmer-friendly display name for an engineering feature key.
 */
export function getFarmerFeatureLabel(
  featureKey: string,
  fallbackDisplayName?: string,
): string {
  const normalized = featureKey.toLowerCase().trim();
  if (FEATURE_TRANSLATIONS[normalized]) {
    return FEATURE_TRANSLATIONS[normalized].farmerLabel;
  }
  return (
    fallbackDisplayName ||
    featureKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/**
 * Get category and icon for a feature.
 */
export function getFarmerCategory(featureKey: string): {
  category: string;
  icon: string;
} {
  const normalized = featureKey.toLowerCase().trim();
  if (FEATURE_TRANSLATIONS[normalized]) {
    return {
      category: FEATURE_TRANSLATIONS[normalized].category,
      icon: FEATURE_TRANSLATIONS[normalized].categoryIcon,
    };
  }
  return { category: "General Biometrics", icon: "📋" };
}

/**
 * Get a natural-language explanation of a feature's directional SHAP contribution.
 * Non-causal: describes how the model adjusted its prediction relative to baseline.
 */
export function getFarmerExplanation(
  featureKey: string,
  shapValue: number,
  formattedValue?: string | null,
): string {
  const normalized = featureKey.toLowerCase().trim();
  const trans = FEATURE_TRANSLATIONS[normalized];
  const valueSnippet = formattedValue ? ` (${formattedValue})` : "";
  const absImpact = Math.abs(shapValue).toFixed(2);

  if (shapValue > 0.05) {
    const base =
      trans?.positiveContributionText || `Pushed the model forecast higher.`;
    return `${base} (Model adjustment: +${absImpact} L/day${valueSnippet})`;
  } else if (shapValue < -0.05) {
    const base =
      trans?.negativeContributionText || `Pushed the model forecast lower.`;
    return `${base} (Model adjustment: -${absImpact} L/day${valueSnippet})`;
  }
  return `Neutral impact on the model forecast relative to baseline${valueSnippet}.`;
}
