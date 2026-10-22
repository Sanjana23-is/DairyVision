import api from './api';

export type Recommendation = {
  id: string;
  cow_id?: string | null;
  alert_id?: string | null;
  prediction_id?: string | null;
  observation_id?: string | null;
  anomaly_id?: string | null;
  farm_id?: string | null;

  title: string;
  description?: string | null;
  why_reason?: string | null;
  category: string;

  priority: string;
  recommendation_type: string;
  completed: boolean;
  owner_id: string;
  created_at: string;
  cow?: { id: string; name?: string };
};

export type GroupedCowRecommendation = {
  cow_id: string | null;
  cow_name: string;
  farm_id?: string | null;
  highest_priority: "Critical" | "High" | "Medium" | "Low";
  categories: string[];
  action_count: number;
  pending_count: number;
  completed_count: number;
  is_all_completed: boolean;
  latest_created_at: string;
  recommendations: Recommendation[];
  primary_action_title: string;
};

export type RecommendationFilter = {
  farm_id?: string;
  category?: string;
  priority?: string;
  completed?: boolean;
  search?: string;
};

const PRIORITY_ORDER: Record<string, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

/**
 * Maps actual backend recommendation category to a meaningful UI label.
 * Returns null for unnecessary "General Farm Management" / "General" badges so they can be omitted.
 * Falls back to "Other" if no suitable category exists.
 */
export function mapCategoryToLabel(rawCategory?: string | null): string | null {
  if (!rawCategory) return null;
  const normalized = rawCategory.trim().toLowerCase();

  if (
    normalized === "feeding strategy" ||
    normalized === "nutrition" ||
    normalized === "feed" ||
    normalized === "feeding"
  ) {
    return "Nutrition";
  }
  if (
    normalized === "heat stress management" ||
    normalized === "heat stress" ||
    normalized === "heat"
  ) {
    return "Heat Stress";
  }
  if (
    normalized === "veterinary attention" ||
    normalized === "veterinary care" ||
    normalized === "veterinary" ||
    normalized === "vet"
  ) {
    return "Veterinary Care";
  }
  if (
    normalized === "observation frequency" ||
    normalized === "health monitoring" ||
    normalized === "health"
  ) {
    return "Health Monitoring";
  }
  if (
    normalized === "water management" ||
    normalized === "hydration" ||
    normalized === "water"
  ) {
    return "Hydration";
  }
  if (
    normalized === "general farm management" ||
    normalized === "general management" ||
    normalized === "general farm" ||
    normalized === "general"
  ) {
    // General category adds no clinical/management value when other categories exist
    return null;
  }

  // If no suitable category exists, use "Other" as a fallback
  return "Other";
}

export function getCategoryTranslationKey(cat: string): string {
  switch (cat) {
    case "Nutrition":
      return "rec.cat.nutrition";
    case "Heat Stress":
      return "rec.cat.heat_stress";
    case "Veterinary Care":
      return "rec.cat.veterinary";
    case "Health Monitoring":
      return "rec.cat.health";
    case "Hydration":
      return "rec.cat.hydration";
    default:
      return "rec.cat.other";
  }
}

export function getCategoryIcon(cat?: string | null): string {
  if (!cat) return "💡";
  if (cat === "Nutrition" || cat.includes("Feed")) return "🌾";
  if (cat === "Heat Stress" || cat.includes("Heat")) return "🌡️";
  if (cat === "Veterinary Care" || cat.includes("Veterinary")) return "🩺";
  if (cat === "Health Monitoring" || cat.includes("Observation") || cat.includes("Health")) return "👁️";
  if (cat === "Hydration" || cat.includes("Water")) return "💧";
  return "💡";
}

export function translateRecommendationTitle(
  title?: string | null,
  t?: (key: string, fallback?: string) => string
): string {
  if (!title) return "";
  if (!t) return title;

  const normalized = title.trim().toLowerCase();

  if (normalized.includes("adjust high-energy ration for milk recovery")) {
    return t("rec.title.adjust_ration", title);
  }
  if (normalized.includes("monitor heat stress and hydration")) {
    return t("rec.title.monitor_heat_stress", title);
  }
  if (normalized.includes("isolate cow and arrange immediate veterinary check")) {
    return t("rec.title.isolate_cow_vet", title);
  }
  if (normalized.includes("schedule veterinary attention")) {
    return t("rec.title.schedule_vet", title);
  }
  if (normalized.includes("activate emergency heat stress cooling and shade")) {
    return t("rec.title.activate_cooling_shade", title);
  }
  if (normalized.includes("increase water and cooling support")) {
    return t("rec.title.increase_water_cooling", title);
  }
  if (normalized.includes("adjust feeding and nutrition")) {
    return t("rec.title.adjust_feeding_nutrition", title);
  }
  if (normalized.includes("inspect feed bunk palatability and freshness")) {
    return t("rec.title.inspect_feed_bunk", title);
  }
  if (normalized.includes("prioritize heat stress mitigation")) {
    return t("rec.title.prioritize_heat_mitigation", title);
  }
  if (normalized.includes("continue monitoring farm conditions")) {
    return t("rec.title.continue_monitoring", title);
  }

  return title;
}

export function translateRecommendationDescription(
  desc?: string | null,
  t?: (key: string, fallback?: string) => string
): string {
  if (!desc) {
    return t ? t("rec.desc.standard_protocols", "Follow standard herd health protocols.") : "Follow standard herd health protocols.";
  }
  if (!t) return desc;

  const normalized = desc.trim().toLowerCase();

  if (normalized.includes("inspect tmr quality")) {
    return t("rec.desc.adjust_ration", desc);
  }
  if (normalized.includes("track water consumption")) {
    return t("rec.desc.monitor_heat_stress", desc);
  }
  if (normalized.includes("for diagnosis and treatment")) {
    return t("rec.desc.isolate_cow_vet_treatment", desc);
  }
  if (normalized.includes("isolate from herd to prevent contagion")) {
    return t("rec.desc.isolate_cow_vet", desc);
  }
  if (normalized.includes("arrange a veterinary check-up")) {
    return t("rec.desc.schedule_vet", desc);
  }
  if (normalized.includes("provide continuous shade")) {
    return t("rec.desc.activate_cooling_shade", desc);
  }
  if (normalized.includes("ensure fresh water is available")) {
    return t("rec.desc.increase_water_cooling", desc);
  }
  if (normalized.includes("evaluate feed intake and consider a slightly richer diet")) {
    return t("rec.desc.adjust_feeding_nutrition", desc);
  }
  if (normalized.includes("check for feed spoilage")) {
    return t("rec.desc.inspect_feed_bunk", desc);
  }
  if (normalized.includes("focus on cooling, ventilation")) {
    return t("rec.desc.prioritize_heat_mitigation", desc);
  }
  if (normalized.includes("no urgent recommendations identified")) {
    return t("rec.desc.continue_monitoring", desc);
  }
  if (normalized.includes("follow standard herd health protocols")) {
    return t("rec.desc.standard_protocols", desc);
  }

  return desc;
}

export function translateRecommendationWhyReason(
  why?: string | null,
  cowName: string = "the cow",
  t?: (key: string, fallback?: string) => string
): string {
  if (!why || !why.trim()) {
    return "";
  }
  if (!t) return why;

  const normalized = why.trim().toLowerCase();

  // 1. All normal bounds
  if (normalized.includes("all recorded health, temperature, weather, and milk yield measurements are within expected normal bounds")) {
    return t("rec.why.all_normal", why);
  }

  // 2. Feed intake unusual
  if (normalized.includes("unusually different from its normal pattern")) {
    return t("rec.why.unusual_feed", why);
  }

  // 3. AI explainability
  if (normalized.includes("ai explainability analysis identified temperature and humidity")) {
    return t("rec.why.ai_explainability", why);
  }

  // 4. Weather warm conditions approaching heat stress thresholds (THI {thi})
  const warmMatch = why.match(/approaching heat stress thresholds \(THI ([^)]+)\)/i);
  if (warmMatch) {
    return t("rec.why.warm_thi", why).replace("{thi}", warmMatch[1]);
  }

  // 5. Moderate heat stress (THI {thi})
  const modMatch = why.match(/moderate heat stress \(THI ([^)]+)\)/i);
  if (modMatch) {
    return t("rec.why.moderate_thi", why).replace("{thi}", modMatch[1]);
  }

  // 6. Extreme/high heat stress ({thi})
  const extremeMatch = why.match(/high heat stress \(([^)]+)\)/i);
  if (extremeMatch) {
    return t("rec.why.high_thi", why).replace("{thi}", extremeMatch[1]);
  }

  // 7. Fever + milk drop
  const feverDropMatch = why.match(/elevated body temperature \(([^)]+)\) and its milk production dropped ([^ ]+) below/i);
  if (feverDropMatch) {
    return t("rec.why.fever_and_drop", why)
      .replace("{temp}", feverDropMatch[1])
      .replace("{drop}", feverDropMatch[2]);
  }

  // 8. Fever alone
  const feverMatch = why.match(/above the normal range \(([^)]+)\)/i);
  if (feverMatch) {
    return t("rec.why.fever_alone", why).replace("{temp}", feverMatch[1]);
  }

  // 9. Milk drop significant
  const dropSigMatch = why.match(/dropped significantly \(([^)]+) lower than expected baseline\)/i);
  if (dropSigMatch) {
    return t("rec.why.milk_drop_significant", why).replace("{drop}", dropSigMatch[1]);
  }

  // 10. Milk drop moderate
  const dropModMatch = why.match(/recent production baseline \(([^)]+) drop\)/i);
  if (dropModMatch) {
    return t("rec.why.milk_drop_moderate", why).replace("{drop}", dropModMatch[1]);
  }

  // 11. Abnormal health condition
  const condMatch = why.match(/abnormal health condition \(([^)]+)\)/i);
  if (condMatch) {
    return t("rec.why.abnormal_health", why).replace("{condition}", condMatch[1]);
  }

  // Fallbacks if constructed dynamically
  if (normalized.includes("veterinary") || normalized.includes("infection")) {
    return t("rec.why.fallback_vet", why).replace("{cow}", cowName);
  }
  if (normalized.includes("heat")) {
    return t("rec.why.fallback_heat", why);
  }
  if (normalized.includes("feed") || normalized.includes("ration")) {
    return t("rec.why.fallback_feed", why).replace("{cow}", cowName);
  }

  return why;
}

export function groupRecommendationsByCow(
  recommendations: Recommendation[],
  cowNameById: Record<string, string> = {}
): GroupedCowRecommendation[] {
  const groupsMap = new Map<string, GroupedCowRecommendation>();

  for (const rec of recommendations) {
    const key = rec.cow_id || "general";
    let group = groupsMap.get(key);

    const displayName =
      rec.cow?.name ||
      (rec.cow_id && cowNameById[rec.cow_id]) ||
      (rec.cow_id ? `Cow ${rec.cow_id.slice(0, 8)}` : "Herd / General Farm");

    if (!group) {
      group = {
        cow_id: rec.cow_id || null,
        cow_name: displayName,
        farm_id: rec.farm_id || null,
        highest_priority: "Low",
        categories: [],
        action_count: 0,
        pending_count: 0,
        completed_count: 0,
        is_all_completed: true,
        latest_created_at: rec.created_at,
        recommendations: [],
        primary_action_title: rec.title || "Advisory Action",
      };
      groupsMap.set(key, group);
    }

    group.recommendations.push(rec);
    group.action_count++;
    if (rec.completed) {
      group.completed_count++;
    } else {
      group.pending_count++;
      group.is_all_completed = false;
    }

    const currentHighestWeight = PRIORITY_ORDER[group.highest_priority] || 1;
    const recWeight = PRIORITY_ORDER[rec.priority] || 2;
    if (recWeight > currentHighestWeight) {
      group.highest_priority = (rec.priority as any) || "Medium";
    }

    if (new Date(rec.created_at).getTime() > new Date(group.latest_created_at).getTime()) {
      group.latest_created_at = rec.created_at;
    }
  }

  // Determine relevant categories and sort recommendations within each cow group
  for (const group of groupsMap.values()) {
    const mappedLabels: string[] = [];
    let hadOmittedGeneral = false;

    for (const rec of group.recommendations) {
      const label = mapCategoryToLabel(rec.category);
      if (label) {
        if (!mappedLabels.includes(label)) {
          mappedLabels.push(label);
        }
      } else {
        hadOmittedGeneral = true;
      }
    }

    // If no suitable category exists at all (e.g. only General Farm Management), fallback to "Other"
    if (mappedLabels.length === 0 && hadOmittedGeneral) {
      mappedLabels.push("Other");
    }

    group.categories = mappedLabels;

    group.recommendations.sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      const weightA = PRIORITY_ORDER[a.priority] || 2;
      const weightB = PRIORITY_ORDER[b.priority] || 2;
      if (weightB !== weightA) return weightB - weightA;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    if (group.recommendations.length > 0) {
      group.primary_action_title = group.recommendations[0].title;
    }
  }

  // Sort groups: cows with pending actions first, then highest priority, then newest
  return Array.from(groupsMap.values()).sort((a, b) => {
    if (a.is_all_completed !== b.is_all_completed) {
      return a.is_all_completed ? 1 : -1;
    }
    const weightA = PRIORITY_ORDER[a.highest_priority] || 1;
    const weightB = PRIORITY_ORDER[b.highest_priority] || 1;
    if (weightB !== weightA) return weightB - weightA;
    return new Date(b.latest_created_at).getTime() - new Date(a.latest_created_at).getTime();
  });
}

export async function fetchRecommendations(filters: RecommendationFilter = {}) {
  const params: Record<string, string | boolean> = {};

  if (filters.farm_id) {
    params.farm_id = filters.farm_id;
  }
  if (filters.category) {
    params.category = filters.category;
  }
  if (filters.priority) {
    params.priority = filters.priority;
  }
  if (filters.completed !== undefined) {
    params.completed = filters.completed;
  }
  if (filters.search) {
    params.search = filters.search;
  }

  const res = await api.get<Recommendation[]>('/api/v1/recommendations', {
    params,
  });
  return res.data || [];
}

export async function completeRecommendation(id: string) {
  const res = await api.patch<Recommendation>(`/api/v1/recommendations/${id}`, {
    completed: true,
  });
  return res.data;
}

export async function batchCompleteRecommendations(params: {
  recommendation_ids?: string[];
  cow_id?: string;
  farm_id?: string;
}) {
  const res = await api.post<{ success: boolean; updated_count: number }>(
    '/api/v1/recommendations/batch-complete',
    params
  );
  return res.data;
}

export async function deleteRecommendation(id: string) {
  await api.delete(`/api/v1/recommendations/${id}`);
}
