import { CowDigitalTwin } from "@/services/digitalTwin";
import { translateRecommendationTitle } from "@/services/recommendation";
import { SupportedLanguage } from "@/i18n/translations";

export function getLocalizedHealthStatus(
  status: string | null | undefined,
  t: (key: string, fallback?: string) => string
): string {
  if (!status) return "";
  const lower = status.trim().toLowerCase();
  if (lower === "healthy") return t("twin.status_healthy", "Healthy");
  if (lower === "warning") return t("twin.status_warning", "Warning");
  if (lower === "critical") return t("twin.status_critical", "Critical");
  if (lower.includes("attention")) return t("twin.status_attention", "Attention Needed");
  return status;
}

export function getLocalizedHeatStress(
  level: string | null | undefined,
  t: (key: string, fallback?: string) => string
): string {
  if (!level) return "";
  const lower = level.trim().toLowerCase();
  if (lower === "comfort") return t("twin.thi_comfort", "Comfort");
  if (lower === "mild") return t("twin.thi_mild", "Mild Stress");
  if (lower === "moderate") return t("twin.thi_moderate", "Moderate Stress");
  if (lower === "high") return t("twin.thi_high", "High Stress");
  if (lower === "critical") return t("twin.thi_critical", "Critical Stress");
  return level;
}

export function getLocalizedLactationStage(
  stage: string | null | undefined,
  t: (key: string, fallback?: string) => string
): string {
  if (!stage || stage.trim() === "" || stage.toLowerCase() === "active lactation") {
    return t("twin.lactation_active", "Active Lactation");
  }
  const lower = stage.trim().toLowerCase();
  if (lower.includes("early")) return t("twin.lactation_early", "Early Lactation");
  if (lower.includes("mid")) return t("twin.lactation_mid", "Mid Lactation");
  if (lower.includes("late")) return t("twin.lactation_late", "Late Lactation");
  if (lower.includes("dry")) return t("twin.lactation_dry", "Dry / Non-lactating");
  if (lower.includes("pregnant")) return t("twin.lactation_pregnant", "Pregnant");
  const numMatch = stage.match(/lactation\s*(\d+)/i);
  if (numMatch) {
    return t("twin.lactation_num", "Lactation {num}").replace("{num}", numMatch[1]);
  }
  return stage;
}

export function getLocalizedBreed(
  breed: string | null | undefined,
  t: (key: string, fallback?: string) => string
): string {
  if (!breed) return "";
  const lower = breed.trim().toLowerCase();
  if (lower === "gir") return t("twin.breed_gir", "Gir");
  if (lower === "sahiwal") return t("twin.breed_sahiwal", "Sahiwal");
  if (lower === "murrah") return t("twin.breed_murrah", "Murrah");
  if (lower === "jersey") return t("twin.breed_jersey", "Jersey");
  if (lower.includes("holstein") || lower === "hf") return t("twin.breed_hf", "Holstein Friesian");
  if (lower.includes("cross")) return t("twin.breed_crossbred", "Crossbred");
  return breed;
}

export function getLocalizedAge(
  ageDisplay: string | null | undefined,
  t: (key: string, fallback?: string) => string
): string {
  if (!ageDisplay) return "";
  const matchYearsMonths = ageDisplay.match(/^(\d+)\s*yrs(?:\s*(\d+)\s*mos)?$/i);
  if (matchYearsMonths) {
    const years = matchYearsMonths[1];
    const months = matchYearsMonths[2];
    const yrsStr = `${years} ${t("twin.age_yrs", "yrs")}`;
    if (months) {
      return `${yrsStr} ${months} ${t("twin.age_mos", "mos")}`;
    }
    return yrsStr;
  }
  const matchMonthsOnly = ageDisplay.match(/^(\d+)\s*mos$/i);
  if (matchMonthsOnly) {
    return `${matchMonthsOnly[1]} ${t("twin.age_mos", "mos")}`;
  }
  return ageDisplay;
}

export function getLocalizedVitalSignName(
  name: string,
  t: (key: string, fallback?: string) => string
): string {
  const lower = name.trim().toLowerCase();
  if (lower.includes("body temperature")) return t("twin.vs_body_temp", "Body Temperature");
  if (lower.includes("feed intake")) return t("twin.vs_feed_intake", "Feed Intake");
  if (lower.includes("body condition")) return t("twin.vs_bcs", "Body Condition Score");
  if (lower.includes("thi") || lower.includes("heat stress index")) return t("twin.vs_thi", "Heat Stress Index (THI)");
  if (lower.includes("rumination")) return t("twin.vs_rumination", "Rumination Time");
  if (lower.includes("activity")) return t("twin.vs_activity", "Activity Level");
  if (lower.includes("heart rate")) return t("twin.vs_heart_rate", "Heart Rate");
  return name;
}

export function getLocalizedVitalSignDescription(
  desc: string | null | undefined,
  _vsName: string,
  t: (key: string, fallback?: string) => string
): string {
  if (!desc) return "";
  const lower = desc.trim().toLowerCase();
  if (lower.includes("elevated temp indicates potential fever")) {
    return t("twin.vs_desc_temp_high", "Elevated temp indicates potential fever or heat stress");
  }
  if (lower.includes("normal range")) {
    return t("twin.vs_desc_temp_normal", "Normal range (38.0–39.2 °C)");
  }
  if (lower.includes("dry matter feed consumption")) {
    return t("twin.vs_desc_feed", "Dry matter feed consumption");
  }
  if (lower.includes("ideal lactation bcs")) {
    return t("twin.vs_desc_bcs", "Ideal lactation BCS is 3.0–3.5");
  }
  if (lower.includes("thermal stress zone")) {
    const parts = desc.split(" ");
    const level = parts[0] || "";
    const localizedLevel = getLocalizedHeatStress(level, t);
    return t("twin.vs_desc_thi_zone", "{level} thermal stress zone").replace("{level}", localizedLevel);
  }
  return desc;
}

export function getLocalizedBaselineStatus(
  status: string | null | undefined,
  t: (key: string, fallback?: string) => string
): string {
  if (!status) return "";
  const lower = status.trim().toLowerCase();
  if (lower.includes("on track")) return t("twin.baseline_on_track", "On Track");
  if (lower.includes("above")) return t("twin.baseline_above", "Above Baseline");
  if (lower.includes("below")) return t("twin.baseline_below", "Below Baseline");
  return status;
}

export function getLocalizedDriverFactor(
  factor: string,
  t: (key: string, fallback?: string) => string
): string {
  const lower = factor.trim().toLowerCase();
  if (lower.includes("heat stress")) return t("twin.driver_heat_stress", "Heat Stress (THI)");
  if (lower.includes("thermal comfort")) return t("twin.driver_thermal_comfort", "Ambient Thermal Comfort");
  if (lower.includes("temperature elevation")) return t("twin.driver_temp_elevation", "Body Temperature Elevation");
  if (lower.includes("feed intake")) return t("twin.driver_high_feed", "High Feed Intake");
  if (lower.includes("balanced lactation")) return t("twin.driver_balanced_lactation", "Balanced Lactation State");
  return factor;
}

export function getLocalizedDriverExplanation(
  explanation: string,
  _factor: string,
  cowName: string,
  t: (key: string, fallback?: string) => string
): string {
  const lower = explanation.trim().toLowerCase();
  if (lower.includes("favorable ambient temperatures support optimal feed intake")) {
    return t("twin.driver_desc_thermal_comfort", "Favorable ambient temperatures support optimal feed intake and rumination.");
  }
  if (lower.includes("robust dry matter intake directly powers milk synthesis")) {
    return t("twin.driver_desc_high_feed", "Robust dry matter intake directly powers milk synthesis.");
  }
  if (lower.includes("reduces appetite and causes thermal discomfort")) {
    return t("twin.driver_desc_heat_stress", "Elevated THI reduces appetite and causes thermal discomfort.");
  }
  if (lower.includes("diverts energy to immune response")) {
    return t("twin.driver_desc_temp_elevation", "Recorded elevated temperature diverts energy to immune response.");
  }
  if (lower.includes("operating in a stable lactation state")) {
    return t("twin.driver_desc_balanced_lactation", "{name} is operating in a stable lactation state.").replace("{name}", cowName);
  }
  return explanation;
}

export function getLocalizedStatusSummary(
  cowTwin: CowDigitalTwin,
  t: (key: string, fallback?: string) => string
): string {
  const parts: string[] = [];
  parts.push(
    t("twin.summary_vitality", "{name} is currently operating at a Digital Twin Vitality Index of {vitality}%.")
      .replace("{name}", cowTwin.cow_name)
      .replace("{vitality}", cowTwin.vitality_score.toFixed(0))
  );

  if (cowTwin.health_status && cowTwin.health_status !== "Healthy") {
    parts.push(
      t("twin.summary_health", "Active health status is {status}.")
        .replace("{status}", getLocalizedHealthStatus(cowTwin.health_status, t))
    );
  }

  if (cowTwin.heat_stress_level && cowTwin.heat_stress_level !== "Comfort") {
    parts.push(
      t("twin.summary_heat", "Environment indicates {stress} heat stress.")
        .replace("{stress}", getLocalizedHeatStress(cowTwin.heat_stress_level, t))
    );
  }

  const baseline = cowTwin.production?.baseline_status?.toLowerCase();
  if (baseline) {
    if (baseline.includes("below")) {
      parts.push(t("twin.summary_milk_below", "Milk yield is currently below baseline."));
    } else if (baseline.includes("above")) {
      parts.push(t("twin.summary_milk_above", "Milk yield is currently above baseline."));
    }
  }

  return parts.join(" ");
}

export function getLocalizedAction(
  action: string,
  t: (key: string, fallback?: string) => string
): string {
  if (!action) return "";
  const lower = action.trim().toLowerCase();
  if (lower.includes("cool, fresh drinking water")) {
    return t("twin.action_water_access", "Ensure continuous access to cool, fresh drinking water");
  }
  if (lower.includes("shade, fans, or misting")) {
    return t("twin.action_cooling_shade", "Provide shade, fans, or misting cooling support");
  }
  if (lower.includes("peak afternoon heat")) {
    return t("twin.action_monitor_heat", "Monitor cow closely during peak afternoon heat");
  }
  if (lower.includes("isolate cow from herd")) {
    return t("twin.action_isolate", "Isolate cow from herd to prevent potential contagion");
  }
  if (lower.includes("contact a veterinarian immediately")) {
    return t("twin.action_contact_vet", "Contact a veterinarian immediately for diagnosis and treatment");
  }
  if (lower.includes("comfortable bedding and fresh water")) {
    return t("twin.action_comfortable_bedding", "Provide comfortable bedding and fresh water");
  }
  if (lower.includes("inspect tmr quality")) {
    return t("twin.action_inspect_tmr", "Inspect TMR quality and feed bunk access");
  }
  if (lower.includes("increase dietary energy density")) {
    return t("twin.action_increase_energy", "Increase dietary energy density to support recovery");
  }
  if (lower.includes("underlying health or thermal stress")) {
    return t("twin.action_check_thermal", "Check for underlying health or thermal stress");
  }
  if (lower.includes("arrange a veterinary check-up")) {
    return t("twin.action_prompt_vet", "Arrange a veterinary check-up promptly");
  }
  if (lower.includes("monitor feed intake and vital signs")) {
    return t("twin.action_monitor_vital_signs", "Monitor feed intake and vital signs closely");
  }
  if (lower.includes("detailed daily observation records")) {
    return t("twin.action_daily_records", "Keep detailed daily observation records");
  }

  const recTitle = translateRecommendationTitle(action, t);
  if (recTitle && recTitle !== action) {
    return recTitle;
  }

  return action;
}

export function formatDigitalTwinDate(iso: string, language: SupportedLanguage): string {
  try {
    const localeMap: Record<SupportedLanguage, string> = {
      en: "en-GB",
      hi: "hi-IN",
      mr: "mr-IN",
      pa: "pa-IN",
      gu: "gu-IN",
      kn: "kn-IN",
    };
    return new Date(iso).toLocaleDateString(localeMap[language] || "en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
