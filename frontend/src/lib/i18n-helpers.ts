/**
 * Localization helper utilities for dynamic enum mappings, breed display names,
 * health conditions, severity levels, and unit formatting.
 *
 * NOTE: Backend canonical identifiers remain unchanged in API requests and state;
 * these helpers only translate their display strings in the UI.
 */

type TranslateFn = (key: string, fallback?: string) => string;

/**
 * Returns localized breed name for UI display while preserving standard canonical string for API.
 */
export function getBreedLabel(breed: string | null | undefined, t: TranslateFn): string {
  if (!breed) return t("common.unknown", "Unknown");
  const keyMap: Record<string, string> = {
    "holstein friesian": "breeds.holstein_friesian",
    "holstein": "breeds.holstein_friesian",
    "jersey": "breeds.jersey",
    "gir": "breeds.gir",
    "sahiwal": "breeds.sahiwal",
    "red sindhi": "breeds.red_sindhi",
    "murrah": "breeds.murrah",
    "kankrej": "breeds.kankrej",
    "tharparkar": "breeds.tharparkar",
    "crossbreed": "breeds.crossbreed",
    "cross breed": "breeds.crossbreed",
    "other": "breeds.other",
  };

  const normalized = breed.trim().toLowerCase();
  const key = keyMap[normalized];
  if (key) {
    return t(key, breed);
  }
  return breed;
}

/**
 * Returns localized cow status (Active, Dry, Sick, Sold, Deceased, Pregnant, Lactating, Quarantine).
 */
export function getStatusLabel(status: string | null | undefined, t: TranslateFn): string {
  if (!status) return t("common.unknown", "Unknown");
  const normalized = status.trim().toLowerCase();
  const key = `status.${normalized}`;
  return t(key, status.charAt(0).toUpperCase() + status.slice(1));
}

/**
 * Returns localized severity/alert level (Healthy, Monitor, Warning, Critical, Low, Medium, High).
 */
export function getSeverityLabel(severity: string | null | undefined, t: TranslateFn): string {
  if (!severity) return t("common.unknown", "Unknown");
  const normalized = severity.trim().toLowerCase();
  const key = `severity.${normalized}`;
  return t(key, severity.charAt(0).toUpperCase() + severity.slice(1));
}

/**
 * Returns localized health condition (Healthy, Minor Issue, Critical, Mastitis, Lameness, Fever, Digestive, Off Feed).
 */
export function getConditionLabel(condition: string | null | undefined, t: TranslateFn): string {
  if (!condition) return t("common.normal", "Normal");
  const normalized = condition.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const key = `health.${normalized}`;
  return t(key, condition.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
}

/**
 * Returns localized recommendation action status (Pending, Applied, Dismissed).
 */
export function getRecommendationStatusLabel(status: string | null | undefined, t: TranslateFn): string {
  if (!status) return t("common.pending", "Pending");
  const normalized = status.trim().toLowerCase();
  const key = `recommendations.status_${normalized}`;
  return t(key, status.charAt(0).toUpperCase() + status.slice(1));
}

/**
 * Returns localized recommendation category (Nutrition, Health, Management, Environment).
 */
export function getRecommendationCategoryLabel(category: string | null | undefined, t: TranslateFn): string {
  if (!category) return t("common.general", "General");
  const normalized = category.trim().toLowerCase();
  const key = `recommendations.category_${normalized}`;
  return t(key, category.charAt(0).toUpperCase() + category.slice(1));
}

/**
 * Returns localized anomaly type (Drop, Spike, Flatline, Missing, Environmental).
 */
export function getAnomalyTypeLabel(type: string | null | undefined, t: TranslateFn): string {
  if (!type) return t("common.unknown", "Unknown");
  const normalized = type.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const key = `anomaly.type_${normalized}`;
  return t(key, type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
}
