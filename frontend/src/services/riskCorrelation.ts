import { HealthAlert, HealthSummary } from "./healthAlert";
import { AnomalyRecord, AnomalySummary } from "./anomaly";
import { Cow } from "./cow";
import { Observation } from "./observation";

export type RiskSource = "Health Alert" | "AI Anomaly" | "Environmental" | "Observation";
export type SeverityLevel = "Critical" | "Warning" | "Normal";

export type AttentionPriority = "urgent" | "needs_attention" | "monitor" | "routine";
export type CaseStatus = "open" | "under_review" | "resolved";

export type RecordedHealthStatus =
  | "no_recorded_concern"
  | "concern_reported"
  | "vet_recommended"
  | "assessment_unavailable";

export type MilkProductionStatus =
  | "within_usual_range"
  | "below_usual_range"
  | "above_usual_range"
  | "insufficient_history"
  | "today_unrecorded";

export type AIMonitoringStatus =
  | "no_unusual_pattern"
  | "unusual_pattern"
  | "insufficient_data";

export type SummaryFilterType =
  | "high_attention"
  | "monitor"
  | "healthy"
  | "flagged_7d"
  | "all_attention";

export type EventTimeFilter = "3d" | "7d" | "30d" | "all";

export interface CowSignalRecord {
  id: string;
  date: string;
  concern: string;
  severity: SeverityLevel;
  source: RiskSource;
  status: "active" | "resolved";
  raw_description?: string;
  metrics?: Record<string, any>;
  score?: number;
  alert_id?: string;
  anomaly_id?: string;
}

export interface CowEventRecord {
  id: string;
  date: string;
  event_title: string;
  observed_summary: string;
  actual_value?: string;
  usual_value?: string;
  significance: string;
  priority: AttentionPriority;
  status: CaseStatus;
  source: RiskSource;
  occurrence_count: number;
  latest_update: string;
  recommended_step: string;
  raw_details?: Record<string, any>;
}

export interface UnifiedRiskCase {
  cow_id: string;
  cow_name: string;
  tag_id: string;
  breed?: string | null;

  // 1. Overall attention priority & case status
  priority: AttentionPriority; // "urgent" | "needs_attention" | "monitor" | "routine"
  case_status: CaseStatus;     // "open" | "under_review" | "resolved"
  highest_severity: SeverityLevel; // Backwards compatible: Critical | Warning | Normal

  // 2. The 3 distinct core evidence dimensions:
  recorded_health_status: RecordedHealthStatus;
  recorded_health_label: string;

  milk_production_status: MilkProductionStatus;
  milk_production_label: string;
  milk_recorded_liters: number | null;
  milk_baseline_liters: number | null;
  milk_deviation_liters: number | null;
  milk_deviation_pct: number | null;

  ai_monitoring_status: AIMonitoringStatus;
  ai_monitoring_label: string;

  // 3. Farmer-facing narrative & evidence
  primary_concern: string;
  primary_evidence_summary: string;
  reasons: string[];
  sources: RiskSource[];

  // 4. Activity events & audit signals
  events: CowEventRecord[];
  signals: CowSignalRecord[]; // Backwards compatible full signal list
  health_alerts: HealthAlert[];
  anomalies: AnomalyRecord[];
  observations: Observation[];

  last_detected_date: string;
  last_observation_date: string;
  is_resolved: boolean;
  score: number;

  // 5. Tailored recommendations
  recommendations: string[];

  // 6. Explicit counts distinguishing log concepts
  recent_observations_count: number;
  distinct_events_count: number;
  active_cases_count: number;
  technical_scans_count: number;
}

export interface HerdRiskKPIs {
  healthy: number;
  monitor: number;
  high_attention: number;
  cases_this_week: number;
  total_cows: number;
}

/**
 * Checks if a string is a raw UUID to prevent showing raw hashes in UI
 */
export function isRawUUID(val?: string | null): boolean {
  if (!val) return false;
  return (
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i.test(
      val.trim()
    ) || /^[0-9a-fA-F-]{20,}$/i.test(val.trim())
  );
}

/**
 * Normalizes severity strings
 */
export function normalizeSeverity(severity?: string): SeverityLevel {
  if (!severity) return "Normal";
  const s = severity.toLowerCase();
  if (s.includes("crit") || s.includes("high") || s.includes("urgent")) return "Critical";
  if (s.includes("warn") || s.includes("mod") || s.includes("attention")) return "Warning";
  return "Normal";
}

/**
 * Helper to get clean display name for a cow
 */
export function resolveCowDisplayName(
  cowId: string,
  cowMap: Record<string, Cow>,
  fallbackName?: string | null
): { name: string; tag_id: string; breed?: string | null } {
  const cow = cowMap[cowId];
  if (cow) {
    const rawBreed = cow.breed;
    const cleanBreed = rawBreed && !isRawUUID(rawBreed) ? rawBreed : null;
    return {
      name: cow.name || cow.tag_id || `Cow ${cowId.slice(0, 6)}`,
      tag_id: cow.tag_id || cowId.slice(0, 8),
      breed: cleanBreed,
    };
  }
  if (fallbackName && !fallbackName.startsWith("Cow ") && !isRawUUID(fallbackName)) {
    return {
      name: fallbackName,
      tag_id: cowId.slice(0, 8),
    };
  }
  return {
    name: `Cow ${cowId.slice(0, 8)}`,
    tag_id: cowId.slice(0, 8),
  };
}

/**
 * Maps risk names or alerts to cleaner farmer-friendly labels
 */
export function formatRiskDisplayName(
  alert: HealthAlert,
  t?: (key: string, fallback?: string, params?: Record<string, string | number>) => string
): string {
  const tr = (k: string, fb: string) => (t ? t(k, fb) : fb);
  const desc = (alert.description || "").toLowerCase();
  const atype = (alert.alert_type || "").toLowerCase();

  if (atype.includes("heat") || desc.includes("heat")) return tr("risk.name_heat_stress", "Heat Stress");
  if (atype.includes("temp") || atype.includes("fever") || desc.includes("fever") || desc.includes("temperature"))
    return tr("risk.name_elevated_temp", "Elevated Body Temperature");
  if (atype.includes("milk") || desc.includes("milk")) return tr("risk.name_milk_drop", "Milk Production Drop");
  if (atype.includes("feed") || desc.includes("feed")) return tr("risk.name_reduced_feed", "Reduced Feed Intake");
  if (atype.includes("mastitis") || desc.includes("mastitis")) return tr("risk.name_mastitis", "Mastitis Risk");
  if (alert.risk_display_name && alert.risk_display_name !== "composite") {
    return alert.risk_display_name;
  }
  return tr("risk.name_health_concern", "Health Concern");
}

/**
 * Maps anomaly issue tags or ML anomaly descriptions to farmer-friendly localized labels
 */
export function formatAnomalyTag(
  tag: string,
  t?: (key: string, fallback?: string, params?: Record<string, string | number>) => string
): string {
  const tr = (k: string, fb: string) => (t ? t(k, fb) : fb);
  const lower = (tag || "").toLowerCase();
  if (lower.includes("heat")) return tr("risk.name_heat_stress", "Heat Stress");
  if (lower.includes("temp") || lower.includes("fever") || lower.includes("spike"))
    return tr("risk.name_elevated_temp", "Elevated Body Temperature");
  if (lower.includes("milk") || lower.includes("drop")) return tr("risk.name_milk_drop", "Milk Production Drop");
  if (lower.includes("feed")) return tr("risk.name_reduced_feed", "Reduced Feed Intake");
  if (lower.includes("mastitis")) return tr("risk.name_mastitis", "Mastitis Risk");
  if (lower.includes("isolation") || lower.includes("outlier") || lower.includes("anomaly"))
    return tr("risk.behavioral_variance", "Behavioral Pattern Variance");
  return tr("risk.behavioral_variance", tag || "Behavioral Pattern Variance");
}

/**
 * Calculates rolling median milk baseline from up to 7 prior observations (strictly date < targetDate)
 */
export function calculateHistoricalBaseline(priorObs: Observation[]): {
  baseline: number | null;
  status: "established" | "provisional" | "insufficient";
  count: number;
} {
  const validYields = priorObs
    .filter((o) => o.milk_produced_liters != null && Number(o.milk_produced_liters) > 0)
    .map((o) => Number(o.milk_produced_liters))
    .slice(0, 7);

  if (validYields.length < 3) {
    return { baseline: null, status: "insufficient", count: validYields.length };
  }

  validYields.sort((a, b) => a - b);
  const mid = Math.floor(validYields.length / 2);
  const median =
    validYields.length % 2 !== 0
      ? validYields[mid]
      : (validYields[mid - 1] + validYields[mid]) / 2;

  return {
    baseline: Number(median.toFixed(2)),
    status: validYields.length >= 5 ? "established" : "provisional",
    count: validYields.length,
  };
}

/**
 * Correlates health alerts, anomalies, and observations strictly per cow
 * Produces exactly 1 unified case per cow with the 5 distinct core dimensions.
 */
export function correlateHerdRiskCases(
  healthAlerts: HealthAlert[] = [],
  anomalies: AnomalyRecord[] = [],
  cows: Cow[] = [],
  observations: Observation[] = [],
  t?: (key: string, fallback?: string, params?: Record<string, string | number>) => string
): UnifiedRiskCase[] {
  const tr = (key: string, fallback: string, params?: Record<string, string | number>): string => {
    if (t) return t(key, fallback, params);
    if (!params) return fallback;
    return Object.entries(params).reduce(
      (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, "g"), String(v)),
      fallback
    );
  };

  const cowMap: Record<string, Cow> = {};
  for (const c of cows) {
    cowMap[c.id] = c;
  }

  // 1. Group records per cow
  const alertsByCow: Record<string, HealthAlert[]> = {};
  const anomsByCow: Record<string, AnomalyRecord[]> = {};
  const obsByCow: Record<string, Observation[]> = {};

  for (const cow of cows) {
    alertsByCow[cow.id] = [];
    anomsByCow[cow.id] = [];
    obsByCow[cow.id] = [];
  }

  for (const h of healthAlerts) {
    if (!alertsByCow[h.cow_id]) alertsByCow[h.cow_id] = [];
    alertsByCow[h.cow_id].push(h);
  }

  for (const a of anomalies) {
    if (!anomsByCow[a.cow_id]) anomsByCow[a.cow_id] = [];
    anomsByCow[a.cow_id].push(a);
  }

  for (const o of observations) {
    if (!obsByCow[o.cow_id]) obsByCow[o.cow_id] = [];
    obsByCow[o.cow_id].push(o);
  }

  const result: UnifiedRiskCase[] = [];
  const sevenDaysAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;

  for (const [cowId, cowAlerts] of Object.entries(alertsByCow)) {
    const cowAnoms = anomsByCow[cowId] || [];
    const cowObs = obsByCow[cowId] || [];

    // Sort observations descending by date
    cowObs.sort((a, b) => new Date(b.observation_date).getTime() - new Date(a.observation_date).getTime());

    const { name, tag_id, breed } = resolveCowDisplayName(
      cowId,
      cowMap,
      cowAlerts[0]?.cow_name
    );

    const latestObs = cowObs[0] || null;
    const lastObsDate = latestObs?.observation_date || "";

    // 2. DIMENSION A: Recorded Health Status
    let recordedHealthStatus: RecordedHealthStatus = "assessment_unavailable";
    let recordedHealthLabel = tr("risk.health_unavailable", "Health assessment unavailable");
    if (latestObs) {
      const cond = (latestObs.health_condition || "").toLowerCase();
      const temp = latestObs.body_temperature_c ? Number(latestObs.body_temperature_c) : null;
      const symptoms = latestObs.symptoms;

      const activeSymptoms = symptoms
        ? Object.entries(symptoms)
            .filter(([k, v]) => {
              if (v === false || v == null) return false;
              const valStr = String(v).toLowerCase();
              if (valStr === "healthy" || valStr === "normal" || valStr === "none" || valStr === "false") return false;
              if (k.toLowerCase() === "condition" && (valStr === "healthy" || valStr === "normal")) return false;
              return true;
            })
            .map(([k, v]) => (typeof v === "string" && v !== "true" && v !== "1" ? v : k))
        : [];

      if (temp && temp > 39.8) {
        recordedHealthStatus = "vet_recommended";
        recordedHealthLabel = tr("risk.health_elevated_temp", "Elevated body temperature ({temp} °C) — veterinary check recommended", { temp: temp.toFixed(1) });
      } else if ((cond && cond !== "normal" && cond !== "healthy") || activeSymptoms.length > 0) {
        recordedHealthStatus = "concern_reported";
        const symStr = activeSymptoms.length > 0
          ? activeSymptoms.map((s) => tr(`health_cond.${s.toLowerCase()}`, s)).join(", ")
          : tr(`health_cond.${cond.toLowerCase()}`, cond);
        recordedHealthLabel = tr("risk.health_concern_recorded", "Health concern recorded: {concern}", { concern: symStr });
      } else {
        recordedHealthStatus = "no_recorded_concern";
        recordedHealthLabel = tr("risk.health_no_concern", "No recorded health concern in latest daily log");
      }
    }

    // 3. DIMENSION B: Milk Production Status & Historical Baseline
    let milkStatus: MilkProductionStatus = "today_unrecorded";
    let milkLabel = tr("risk.milk_unrecorded", "Today's production not recorded");
    let milkRecorded: number | null = null;
    let milkBaseline: number | null = null;
    let milkDeviationLiters: number | null = null;
    let milkDeviationPct: number | null = null;

    if (latestObs && latestObs.milk_produced_liters != null) {
      milkRecorded = Number(Number(latestObs.milk_produced_liters).toFixed(2));
      const priorObservations = cowObs.filter((o) => o.observation_date < latestObs.observation_date);
      const baselineResult = calculateHistoricalBaseline(priorObservations);

      if (baselineResult.status === "insufficient") {
        milkStatus = "insufficient_history";
        milkLabel = tr("risk.milk_insufficient", "Not enough history to calculate this cow's usual milk yield");
      } else if (baselineResult.baseline != null) {
        milkBaseline = baselineResult.baseline;
        milkDeviationLiters = Number((milkRecorded - milkBaseline).toFixed(2));
        milkDeviationPct = Number(((milkDeviationLiters / milkBaseline) * 100).toFixed(1));

        if (milkDeviationPct <= -20.0 && milkDeviationLiters <= -1.5) {
          milkStatus = "below_usual_range";
          milkLabel = tr("risk.milk_below_usual", "Yield ({actual} L) is {pct}% below recent usual ({baseline} L)", { actual: milkRecorded, pct: Math.abs(milkDeviationPct), baseline: milkBaseline });
        } else if (milkDeviationPct >= 25.0) {
          milkStatus = "above_usual_range";
          milkLabel = tr("risk.milk_above_usual", "Yield ({actual} L) is {pct}% above recent usual ({baseline} L)", { actual: milkRecorded, pct: milkDeviationPct, baseline: milkBaseline });
        } else {
          milkStatus = "within_usual_range";
          milkLabel = tr("risk.milk_within_usual", "Yield ({actual} L) is within normal range of recent usual ({baseline} L)", { actual: milkRecorded, baseline: milkBaseline });
        }
      }
    }

    // 4. DIMENSION C: AI Monitoring Status (Last 7 Days)
    const recentAnoms = cowAnoms.filter((a) => {
      const dt = new Date(a.detected_at).getTime();
      return dt >= sevenDaysAgoMs && !a.resolved;
    });

    let aiStatus: AIMonitoringStatus = "no_unusual_pattern";
    let aiLabel = tr("risk.ai_normal", "No unusual pattern detected");
    if (cowObs.length === 0 && cowAnoms.length === 0) {
      aiStatus = "insufficient_data";
      aiLabel = tr("risk.ai_insufficient", "Insufficient data for reliable AI assessment");
    } else if (recentAnoms.some((a) => a.severity === "Critical" || a.severity === "Warning" || (a.issue_tags || []).some((t) => !t.toLowerCase().includes("normal")))) {
      aiStatus = "unusual_pattern";
      aiLabel = tr("risk.ai_unusual", "Unusual pattern detected; review recommended");
    }

    // 5. Raw Signals Audit Collection
    const sourcesSet = new Set<RiskSource>();
    const signals: CowSignalRecord[] = [];
    let hasUnresolvedRecentSignal = false;
    let latestSignalDate = lastObsDate || new Date().toISOString();
    let highestScore = 0;

    for (const h of cowAlerts) {
      const hDate = h.observation_date || h.created_at || "";
      if (hDate > latestSignalDate) latestSignalDate = hDate;

      const isRecent = new Date(h.created_at || hDate).getTime() >= sevenDaysAgoMs;
      if (!h.resolved && isRecent && h.alert_level !== "Healthy") {
        hasUnresolvedRecentSignal = true;
      }

      const sev = normalizeSeverity(h.alert_level);
      const isEnv = (h.alert_type || "").toLowerCase().includes("heat") || (h.description || "").toLowerCase().includes("heat");
      const src: RiskSource = isEnv ? "Environmental" : "Health Alert";
      sourcesSet.add(src);

      signals.push({
        id: `alert-${h.id}`,
        date: hDate,
        concern: formatRiskDisplayName(h, t),
        severity: sev,
        source: src,
        status: h.resolved ? "resolved" : "active",
        raw_description: h.description || undefined,
        metrics: h.evidence || undefined,
        score: h.confidence || undefined,
        alert_id: h.id,
      });
    }

    for (const a of cowAnoms) {
      const aDate = a.detected_at || "";
      if (aDate > latestSignalDate) latestSignalDate = aDate;

      const isRecent = new Date(aDate).getTime() >= sevenDaysAgoMs;
      if (!a.resolved && isRecent && a.severity !== "Normal") {
        hasUnresolvedRecentSignal = true;
      }

      if (a.anomaly_score > highestScore) highestScore = a.anomaly_score;

      const sev = normalizeSeverity(a.severity);
      const isEnv = (a.anomaly_type || "").toLowerCase().includes("heat") || (a.issue_tags || []).some((t) => t.toLowerCase().includes("heat"));
      const src: RiskSource = isEnv ? "Environmental" : "AI Anomaly";
      sourcesSet.add(src);

      const concern =
        a.issue_tags && a.issue_tags.length > 0
          ? a.issue_tags.filter((tag) => !tag.toLowerCase().includes("normal")).join(", ") || tr("risk.behavioral_variance", "Behavioral Variance")
          : tr("risk.behavioral_variance", "Behavioral Variance");

      signals.push({
        id: `anomaly-${a.id}`,
        date: aDate,
        concern: formatAnomalyTag(concern, t),
        severity: sev,
        source: src,
        status: a.resolved ? "resolved" : "active",
        raw_description: a.description || undefined,
        metrics: a.details || undefined,
        score: a.anomaly_score,
        anomaly_id: a.id,
      });
    }

    // Sort signals descending by date
    signals.sort((s1, s2) => new Date(s2.date).getTime() - new Date(s1.date).getTime());

    // 6. DIMENSION D: Overall Attention Priority
    let priority: AttentionPriority = "routine";
    const recentAlerts = cowAlerts.filter((h) => new Date(h.created_at || "").getTime() >= sevenDaysAgoMs && !h.resolved);

    // Documented Priority Rules:
    const isAcuteFever = latestObs?.body_temperature_c != null && Number(latestObs.body_temperature_c) > 39.8;
    const isAcuteMastitis = (latestObs?.health_condition || "").toLowerCase().includes("mastitis");
    const isAcuteDrop = milkStatus === "below_usual_range" && milkDeviationPct != null && milkDeviationPct <= -40.0;
    const hasCriticalRecentAlert = recentAlerts.some((h) => normalizeSeverity(h.alert_level) === "Critical");

    if (hasCriticalRecentAlert || isAcuteFever || isAcuteMastitis || isAcuteDrop) {
      priority = "urgent";
    } else if (
      recordedHealthStatus === "concern_reported" ||
      milkStatus === "below_usual_range" ||
      recentAlerts.some((h) => normalizeSeverity(h.alert_level) === "Warning")
    ) {
      priority = "needs_attention";
    } else if (
      aiStatus === "unusual_pattern" ||
      (latestObs?.body_temperature_c != null && Number(latestObs.body_temperature_c) > 39.3)
    ) {
      priority = "monitor";
    } else {
      priority = "routine";
    }

    // 7. DIMENSION E: Case Status
    let caseStatus: CaseStatus = "resolved";
    if (priority !== "routine" && hasUnresolvedRecentSignal) {
      caseStatus = "open";
    } else if (priority !== "routine" && !hasUnresolvedRecentSignal) {
      caseStatus = "under_review";
    } else {
      caseStatus = "resolved";
    }

    // Highest severity mapping for backwards compatibility
    const highestSeverity: SeverityLevel =
      priority === "urgent" ? "Critical" : priority === "needs_attention" || priority === "monitor" ? "Warning" : "Normal";

    // 8. Farmer-Facing Narrative: "Why is this cow flagged?"
    let primaryEvidenceSummary = tr("risk.summary_healthy_baseline", "All milk yield, feed intake, and biometrics within expected baseline.");
    const reasons: string[] = [];

    if (priority === "urgent") {
      if (isAcuteFever) reasons.push(tr("risk.reason_fever", "Severe elevated body temperature ({temp} °C) requires urgent inspection.", { temp: Number(latestObs?.body_temperature_c).toFixed(1) }));
      if (isAcuteDrop) reasons.push(tr("risk.reason_acute_drop", "Acute milk drop of {pct}% compared to recent baseline.", { pct: Math.abs(milkDeviationPct || 0) }));
      if (isAcuteMastitis) reasons.push(tr("risk.reason_mastitis", "Mastitis symptoms recorded in latest daily observation."));
      primaryEvidenceSummary = reasons.join(" ") || tr("risk.reason_urgent_fallback", "Clinical risk requiring urgent veterinary assessment.");
    } else if (priority === "needs_attention") {
      if (milkStatus === "below_usual_range") reasons.push(milkLabel);
      if (recordedHealthStatus === "concern_reported") reasons.push(recordedHealthLabel);
      for (const h of recentAlerts) {
        if (h.description && !h.description.toLowerCase().includes("healthy state")) {
          reasons.push(h.description.replace(/Cow\s+[a-f0-9-]{8,}/gi, name));
        }
      }
      primaryEvidenceSummary = reasons.slice(0, 2).join(". ") || tr("risk.reason_needs_attention_fallback", "Evidence warrants a timely review.");
    } else if (priority === "monitor") {
      if (aiStatus === "unusual_pattern") reasons.push(tr("risk.reason_monitor_pattern", "Monitoring system detected an unusual pattern that should be reviewed."));
      if (milkStatus === "below_usual_range") reasons.push(milkLabel);
      primaryEvidenceSummary = reasons[0] || tr("risk.reason_monitor_fallback", "Mild biometric or environmental variance observed.");
    } else {
      reasons.push(tr("risk.reason_normal", "Operating within normal expected baselines and healthy biometrics."));
      primaryEvidenceSummary = tr("risk.reason_normal_summary", "No current actionable concern was identified from the available records.");
    }

    const primaryConcern =
      priority === "urgent"
        ? tr("risk.concern_urgent", "Urgent Health Concern")
        : priority === "needs_attention"
        ? milkStatus === "below_usual_range"
          ? tr("risk.concern_milk_drop", "Milk Production Drop")
          : tr("risk.concern_health_review", "Health Observation Review")
        : priority === "monitor"
        ? tr("risk.concern_surveillance", "Surveillance Monitoring")
        : tr("risk.concern_healthy", "Healthy Baseline");

    // 9. Tailored Farmer Recommendations
    const recommendations: string[] = [];
    if (priority === "urgent") {
      recommendations.push(tr("risk.rec_vet", "Contact a qualified veterinarian immediately for diagnosis and treatment."));
      recommendations.push(tr("risk.rec_isolate", "Isolate cow in a clean, shaded, well-ventilated recovery stall."));
      recommendations.push(tr("risk.rec_hydration", "Check hydration and provide continuous cool, clean drinking water."));
    } else if (priority === "needs_attention") {
      if (milkStatus === "below_usual_range") {
        recommendations.push(tr("risk.rec_feed", "Inspect feed bunk dry matter intake and ration quality."));
        recommendations.push(tr("risk.rec_verify_milk", "Verify daily milking records to rule out recording errors."));
      }
      recommendations.push(tr("risk.rec_observe_milking", "Observe cow during next milking cycle for visible symptoms or lethargy."));
      recommendations.push(tr("risk.rec_review_temp", "Review temperature and rumination patterns over the last 3 days."));
    } else if (priority === "monitor") {
      recommendations.push(tr("risk.rec_monitor_appetite", "Monitor cow's appetite, rumination, and walking activity over the next 24 hours."));
      recommendations.push(tr("risk.rec_bedding", "Ensure comfortable bedding and unobstructed water access."));
    } else {
      recommendations.push(tr("risk.rec_routine", "Continue routine daily milking and standard herd biometric logging."));
    }

    // 10. Grouped Event Activity (Solving the 62-Log Problem)
    const events: CowEventRecord[] = [];

    // Group observations into clean grouped events
    if (cowObs.length > 0) {
      let normalRunCount = 0;
      let normalStartDate = "";
      let normalEndDate = "";

      for (const obs of cowObs) {
        const hasAlert = cowAlerts.find((h) => h.observation_id === obs.id && h.alert_level !== "Healthy");
        const hasAnom = cowAnoms.find((a) => a.observation_id === obs.id && a.severity !== "Normal");

        if (!hasAlert && !hasAnom && (obs.health_condition === "normal" || !obs.health_condition)) {
          normalRunCount++;
          if (!normalEndDate) normalEndDate = obs.observation_date;
          normalStartDate = obs.observation_date;
        } else {
          // Flush normal run before adding distinct event
          if (normalRunCount > 0) {
            events.push({
              id: `group-normal-${normalStartDate}-${normalEndDate}`,
              date: normalEndDate,
              event_title: tr("risk.event_normal_title", "Routine Baseline Monitoring ({count} days)", { count: normalRunCount }),
              observed_summary: tr("risk.event_normal_summary", "Milk yield, feed, and biometrics within expected parameters across {count} consecutive days.", { count: normalRunCount }),
              actual_value: tr("risk.event_actual_normal", "Normal"),
              usual_value: tr("risk.event_usual_baseline", "Standard Baseline"),
              significance: tr("risk.event_normal_significance", "Standard herd monitoring without clinical deviation."),
              priority: "routine",
              status: "resolved",
              source: "Observation",
              occurrence_count: normalRunCount,
              latest_update: normalEndDate,
              recommended_step: tr("risk.event_normal_step", "Maintain routine daily log."),
            });
            normalRunCount = 0;
            normalStartDate = "";
            normalEndDate = "";
          }

          // Create distinct event for the flagged observation
          const eventTitle = hasAlert
            ? formatRiskDisplayName(hasAlert, t)
            : hasAnom
            ? (hasAnom.issue_tags?.[0] ? formatAnomalyTag(hasAnom.issue_tags[0], t) : tr("risk.pattern_variance", "Pattern Variance"))
            : tr("risk.recorded_observation", "Recorded Observation");
          const eventPriority: AttentionPriority =
            hasAlert?.alert_level === "Critical" || hasAnom?.severity === "Critical"
              ? "urgent"
              : hasAlert?.alert_level === "Warning" || hasAnom?.severity === "Warning"
              ? "needs_attention"
              : "monitor";

          let obsSummary = "";
          if (hasAlert) {
            const atype = (hasAlert.alert_type || "").toLowerCase();
            const adesc = (hasAlert.description || "").toLowerCase();
            if (atype.includes("heat") || adesc.includes("heat")) {
              obsSummary = tr("risk.event_heat_stress_desc", "High heat index causing potential thermal discomfort.");
            } else if (atype.includes("temp") || adesc.includes("temperature") || adesc.includes("fever")) {
              obsSummary = tr("risk.reason_fever", "Severe elevated body temperature ({temp} °C) requires urgent inspection.", { temp: Number(obs.body_temperature_c || 39.9).toFixed(1) });
            } else if (atype.includes("milk") || adesc.includes("milk")) {
              obsSummary = tr("risk.reason_acute_drop", "Acute milk drop of {pct}% compared to recent baseline.", { pct: Math.abs(milkDeviationPct || 0) });
            } else if (atype.includes("mastitis") || adesc.includes("mastitis")) {
              obsSummary = tr("risk.reason_mastitis", "Mastitis symptoms recorded in latest daily observation.");
            }
          } else if (hasAnom) {
            obsSummary = tr("risk.reason_monitor_pattern", "Monitoring system detected an unusual pattern that should be reviewed.");
          }

          if (!obsSummary) {
            obsSummary = tr("risk.event_observed_yield_temp", "Recorded yield: {yield} L, temp: {temp} °C", {
              yield: obs.milk_produced_liters ?? "—",
              temp: obs.body_temperature_c ? `${obs.body_temperature_c}` : tr("risk.normal", "normal"),
            });
          }

          events.push({
            id: `event-${obs.id}`,
            date: obs.observation_date,
            event_title: eventTitle,
            observed_summary: obsSummary,
            actual_value: obs.milk_produced_liters != null ? `${obs.milk_produced_liters} L` : undefined,
            usual_value: milkBaseline != null ? `${milkBaseline} L` : undefined,
            significance: eventPriority === "urgent" ? tr("risk.event_urgent_significance", "Acute health or yield drop requiring immediate attention.") : tr("risk.event_variance_significance", "Notable variance from standard baseline."),
            priority: eventPriority,
            status: (hasAlert?.resolved ?? true) && (hasAnom?.resolved ?? true) ? "resolved" : "open",
            source: hasAlert ? "Health Alert" : hasAnom ? "AI Anomaly" : "Observation",
            occurrence_count: 1,
            latest_update: obs.observation_date,
            recommended_step: recommendations[0] || tr("risk.review_observation_details", "Review observation details."),
            raw_details: {
              milk_produced_liters: obs.milk_produced_liters,
              body_temperature_c: obs.body_temperature_c,
              health_condition: obs.health_condition,
              feed_quantity_kg: obs.feed_quantity_kg,
            },
          });
        }
      }

      // Flush any trailing normal run
      if (normalRunCount > 0) {
        events.push({
          id: `group-normal-${normalStartDate}-${normalEndDate}`,
          date: normalEndDate,
          event_title: tr("risk.event_normal_title", "Routine Baseline Monitoring ({count} days)", { count: normalRunCount }),
          observed_summary: tr("risk.event_normal_summary", "Milk yield, feed, and biometrics within expected parameters across {count} consecutive days.", { count: normalRunCount }),
          actual_value: tr("risk.event_actual_normal", "Normal"),
          usual_value: tr("risk.event_usual_baseline", "Standard Baseline"),
          significance: tr("risk.event_normal_significance", "Standard herd monitoring without clinical deviation."),
          priority: "routine",
          status: "resolved",
          source: "Observation",
          occurrence_count: normalRunCount,
          latest_update: normalEndDate,
          recommended_step: tr("risk.event_normal_step", "Maintain routine daily log."),
        });
      }
    }

    // Fallback if no observations were passed
    if (events.length === 0 && signals.length > 0) {
      events.push({
        id: `event-sig-${cowId}`,
        date: latestSignalDate,
        event_title: primaryConcern,
        observed_summary: primaryEvidenceSummary,
        significance: tr("risk.event_fallback_significance", "Correlated risk signals recorded across diagnostic engines."),
        priority: priority,
        status: caseStatus,
        source: sourcesSet.has("Health Alert") ? "Health Alert" : "AI Anomaly",
        occurrence_count: signals.length,
        latest_update: latestSignalDate,
        recommended_step: recommendations[0] || tr("risk.review_animal_profile", "Review animal profile."),
      });
    }

    // 11. Clean Counts
    const recentObs = cowObs.filter((o) => new Date(o.observation_date).getTime() >= sevenDaysAgoMs);
    const recentObsCount = recentObs.length || Math.min(cowObs.length, 7);
    const distinctEventsCount = events.length;
    const activeCasesCount = caseStatus === "open" ? 1 : 0;
    const technicalScansCount = signals.length;

    result.push({
      cow_id: cowId,
      cow_name: name,
      tag_id: tag_id,
      breed: breed,
      priority,
      case_status: caseStatus,
      highest_severity: highestSeverity,

      recorded_health_status: recordedHealthStatus,
      recorded_health_label: recordedHealthLabel,

      milk_production_status: milkStatus,
      milk_production_label: milkLabel,
      milk_recorded_liters: milkRecorded,
      milk_baseline_liters: milkBaseline,
      milk_deviation_liters: milkDeviationLiters,
      milk_deviation_pct: milkDeviationPct,

      ai_monitoring_status: aiStatus,
      ai_monitoring_label: aiLabel,

      primary_concern: primaryConcern,
      primary_evidence_summary: primaryEvidenceSummary,
      reasons: reasons.slice(0, 3),
      sources: Array.from(sourcesSet),

      events,
      signals,
      health_alerts: cowAlerts,
      anomalies: cowAnoms,
      observations: cowObs,

      last_detected_date: latestSignalDate,
      last_observation_date: lastObsDate,
      is_resolved: caseStatus === "resolved",
      score: highestScore,

      recommendations,

      recent_observations_count: recentObsCount,
      distinct_events_count: distinctEventsCount,
      active_cases_count: activeCasesCount,
      technical_scans_count: technicalScansCount,
    });
  }

  // Sort order: Open Urgent -> Open Needs Attention -> Open Monitor -> Under Review -> Routine/Resolved
  const priorityWeight: Record<AttentionPriority, number> = {
    urgent: 4,
    needs_attention: 3,
    monitor: 2,
    routine: 1,
  };

  return result.sort((a, b) => {
    if (a.case_status !== b.case_status) {
      if (a.case_status === "open" && b.case_status !== "open") return -1;
      if (b.case_status === "open" && a.case_status !== "open") return 1;
    }
    const diff = priorityWeight[b.priority] - priorityWeight[a.priority];
    if (diff !== 0) return diff;
    return new Date(b.last_detected_date).getTime() - new Date(a.last_detected_date).getTime();
  });
}

/**
 * Filters grouped events by time range
 */
export function filterEventsByTimeRange(
  events: CowEventRecord[],
  range: EventTimeFilter
): CowEventRecord[] {
  if (range === "all") return events;
  if (!events || events.length === 0) return [];

  const timestamps = events
    .map((ev) => new Date(ev.date).getTime())
    .filter((t) => !isNaN(t));

  const maxEventTime = timestamps.length > 0 ? Math.max(...timestamps) : Date.now();
  const now = Date.now();
  // If latest event is within 60 days of current clock, use max(now, maxEventTime); otherwise anchor to maxEventTime
  const isRecent = Math.abs(now - maxEventTime) < 60 * 24 * 60 * 60 * 1000;
  const anchor = isRecent ? Math.max(now, maxEventTime) : maxEventTime;

  const days = range === "3d" ? 3 : range === "7d" ? 7 : 30;
  const cutoff = anchor - days * 24 * 60 * 60 * 1000;

  return events.filter((ev) => {
    const dt = new Date(ev.date).getTime();
    return isNaN(dt) || dt >= cutoff;
  });
}

/**
 * Calculates COW-LEVEL KPIs (1 cow = 1 count)
 */
export function calculateHerdRiskKPIs(
  healthSummary?: HealthSummary | null,
  anomalySummary?: AnomalySummary | null,
  correlatedCases: UnifiedRiskCase[] = [],
  cows: Cow[] = []
): HerdRiskKPIs {
  const totalCows =
    cows.length ||
    healthSummary?.summary.total_cows ||
    anomalySummary?.summary.total_scanned ||
    correlatedCases.length ||
    0;

  const activeCases = correlatedCases.filter((c) => c.case_status !== "resolved");
  const highAttention = activeCases.filter((c) => c.priority === "urgent" || c.priority === "needs_attention").length;
  const monitor = activeCases.filter((c) => c.priority === "monitor").length;
  const healthy = Math.max(0, totalCows - (highAttention + monitor));

  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const casesThisWeek = correlatedCases.filter((c) => {
    if (c.priority === "routine" && c.case_status === "resolved") return false;
    const dt = new Date(c.last_detected_date).getTime();
    return dt >= oneWeekAgo;
  }).length;

  return {
    healthy,
    monitor,
    high_attention: highAttention,
    cases_this_week: casesThisWeek,
    total_cows: totalCows,
  };
}

/**
 * Filters the correlated cow cases based on the selected interactive summary card
 */
export function filterCasesBySummaryType(
  cases: UnifiedRiskCase[],
  filterType: SummaryFilterType
): UnifiedRiskCase[] {
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  switch (filterType) {
    case "high_attention":
      return cases.filter((c) => (c.priority === "urgent" || c.priority === "needs_attention") && c.case_status !== "resolved");
    case "monitor":
      return cases.filter((c) => c.priority === "monitor" && c.case_status !== "resolved");
    case "healthy":
      return cases.filter((c) => c.priority === "routine" || c.case_status === "resolved");
    case "flagged_7d":
      return cases.filter((c) => {
        if (c.priority === "routine" && c.case_status === "resolved") return false;
        const dt = new Date(c.last_detected_date).getTime();
        return dt >= oneWeekAgo;
      });
    case "all_attention":
    default: {
      const attentionOnly = cases.filter((c) => c.case_status !== "resolved" && c.priority !== "routine");
      return attentionOnly.length > 0 ? attentionOnly : cases;
    }
  }
}

/**
 * Generates and downloads a CSV export of cow-level risk cases with all 5 core dimensions
 */
export function exportRiskReportCSV(
  cases: UnifiedRiskCase[],
  farmName: string = "Farm",
  t?: (key: string, fallback?: string, params?: Record<string, string | number>) => string
): void {
  if (!cases.length) return;

  const tr = (k: string, fb: string) => (t ? t(k, fb) : fb);

  const headers = [
    tr("risk.csv_last_obs", "Last Observation Date"),
    tr("risk.csv_cow_name", "Cow Name"),
    tr("risk.csv_tag_id", "Tag ID"),
    tr("risk.csv_breed", "Breed"),
    tr("risk.csv_priority", "Attention Priority"),
    tr("risk.csv_status", "Case Status"),
    tr("risk.csv_health_status", "Recorded Health Status"),
    tr("risk.csv_milk_status", "Milk Production Status"),
    tr("risk.csv_recorded_milk", "Recorded Milk (L)"),
    tr("risk.csv_usual_baseline", "Usual Baseline (L)"),
    tr("risk.csv_milk_dev_l", "Milk Deviation (L)"),
    tr("risk.csv_milk_dev_pct", "Milk Deviation (%)"),
    tr("risk.csv_ai_status", "AI Monitoring Status"),
    tr("risk.csv_evidence_summary", "Primary Evidence Summary"),
    tr("risk.csv_recommended_action", "Recommended Action"),
  ];

  const rows = cases.map((c) => [
    `"${c.last_observation_date || c.last_detected_date}"`,
    `"${c.cow_name.replace(/"/g, '""')}"`,
    `"${c.tag_id.replace(/"/g, '""')}"`,
    `"${(c.breed || "—").replace(/"/g, '""')}"`,
    `"${c.priority.toUpperCase()}"`,
    `"${c.case_status.toUpperCase()}"`,
    `"${c.recorded_health_label.replace(/"/g, '""')}"`,
    `"${c.milk_production_label.replace(/"/g, '""')}"`,
    `"${c.milk_recorded_liters != null ? c.milk_recorded_liters : "—"}"`,
    `"${c.milk_baseline_liters != null ? c.milk_baseline_liters : "—"}"`,
    `"${c.milk_deviation_liters != null ? c.milk_deviation_liters : "—"}"`,
    `"${c.milk_deviation_pct != null ? `${c.milk_deviation_pct}%` : "—"}"`,
    `"${c.ai_monitoring_label.replace(/"/g, '""')}"`,
    `"${c.primary_evidence_summary.replace(/"/g, '""')}"`,
    `"${(c.recommendations[0] || tr("risk.rec_routine", "Routine monitoring")).replace(/"/g, '""')}"`,
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `herd_health_risk_report_${farmName.toLowerCase().replace(/\s+/g, "_")}_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
