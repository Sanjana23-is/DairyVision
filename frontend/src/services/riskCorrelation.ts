import { HealthAlert, HealthSummary } from "./healthAlert";
import { AnomalyRecord, AnomalySummary } from "./anomaly";
import { Cow } from "./cow";

export type RiskSource = "Health Alert" | "AI Anomaly" | "Environmental";
export type SeverityLevel = "Critical" | "Warning" | "Normal";

export type SummaryFilterType = "high_attention" | "monitor" | "healthy" | "flagged_7d" | "all_attention";

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

export interface UnifiedRiskCase {
  cow_id: string;
  cow_name: string;
  tag_id: string;
  breed?: string | null;
  highest_severity: SeverityLevel;
  primary_concern: string;
  reasons: string[];
  sources: RiskSource[];
  signals: CowSignalRecord[];
  health_alerts: HealthAlert[];
  anomalies: AnomalyRecord[];
  last_detected_date: string;
  is_resolved: boolean;
  score: number;
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
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i.test(val.trim()) ||
    (/^[0-9a-fA-F-]{20,}$/i.test(val.trim()));
}

/**
 * Maps risk names or alerts to cleaner farmer-friendly labels
 */
export function formatRiskDisplayName(alert: HealthAlert): string {
  if (alert.risk_display_name && alert.risk_display_name !== "composite") {
    return alert.risk_display_name;
  }
  const desc = (alert.description || "").toLowerCase();
  const atype = (alert.alert_type || "").toLowerCase();

  if (atype.includes("heat") || desc.includes("heat")) return "Heat Stress Risk";
  if (atype.includes("temp") || atype.includes("fever") || desc.includes("fever") || desc.includes("temperature"))
    return "Elevated Body Temperature";
  if (atype.includes("milk") || desc.includes("milk")) return "Milk Production Drop";
  if (atype.includes("feed") || desc.includes("feed")) return "Reduced Feed Intake";
  if (atype.includes("mastitis") || desc.includes("mastitis")) return "Mastitis Risk";
  return "Health Concern";
}

/**
 * Normalizes severity strings from either engine
 */
export function normalizeSeverity(severity?: string): SeverityLevel {
  if (!severity) return "Normal";
  const s = severity.toLowerCase();
  if (s.includes("crit") || s.includes("high")) return "Critical";
  if (s.includes("warn") || s.includes("mod")) return "Warning";
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
 * Formats a clean primary concern summary from combined reasons (e.g. "Milk drop + elevated temperature")
 */
function buildPrimaryConcern(reasons: string[], highestSeverity: SeverityLevel): string {
  if (!reasons.length || highestSeverity === "Normal") {
    return "Healthy Baseline";
  }

  // Extract concise keywords
  const keywords: string[] = [];
  for (const r of reasons) {
    const lr = r.toLowerCase();
    if ((lr.includes("milk") || lr.includes("yield")) && !keywords.includes("Milk Production")) {
      keywords.push("Milk Production Drop");
    }
    if ((lr.includes("temp") || lr.includes("fever") || lr.includes("temperature")) && !keywords.includes("Elevated Temperature")) {
      keywords.push("Elevated Temperature");
    }
    if (lr.includes("feed") && !keywords.includes("Feed Intake")) {
      keywords.push("Reduced Feed Intake");
    }
    if (lr.includes("heat") && !keywords.includes("Heat Stress")) {
      keywords.push("Heat Stress");
    }
    if (lr.includes("mastitis") && !keywords.includes("Mastitis")) {
      keywords.push("Mastitis Risk");
    }
  }

  if (keywords.length > 0) {
    return keywords.slice(0, 3).join(" + ");
  }

  // Fallback to first reason trimmed
  return reasons[0].replace(/^Behavioral outlier:\s*/i, "").slice(0, 45);
}

/**
 * Correlates health alerts and anomaly detections strictly by cow_id into 1 case per cow.
 * Covers all cows in the herd so interactive filter cards (Healthy, Monitor, High Attention, 7-Day) work seamlessly.
 */
export function correlateHerdRiskCases(
  healthAlerts: HealthAlert[],
  anomalies: AnomalyRecord[],
  cows: Cow[]
): UnifiedRiskCase[] {
  const cowMap: Record<string, Cow> = {};
  for (const c of cows) {
    cowMap[c.id] = c;
  }

  const casesByCow: Record<string, {
    health_alerts: HealthAlert[];
    anomalies: AnomalyRecord[];
  }> = {};

  // Initialize entry for all known cows
  for (const cow of cows) {
    casesByCow[cow.id] = { health_alerts: [], anomalies: [] };
  }

  // Group alerts by cow_id
  for (const alert of healthAlerts) {
    if (!casesByCow[alert.cow_id]) {
      casesByCow[alert.cow_id] = { health_alerts: [], anomalies: [] };
    }
    casesByCow[alert.cow_id].health_alerts.push(alert);
  }

  // Group anomalies by cow_id
  for (const anomaly of anomalies) {
    if (!casesByCow[anomaly.cow_id]) {
      casesByCow[anomaly.cow_id] = { health_alerts: [], anomalies: [] };
    }
    casesByCow[anomaly.cow_id].anomalies.push(anomaly);
  }

  const result: UnifiedRiskCase[] = [];

  for (const [cowId, group] of Object.entries(casesByCow)) {
    const { name, tag_id, breed } = resolveCowDisplayName(cowId, cowMap, group.health_alerts[0]?.cow_name);
    const sourcesSet = new Set<RiskSource>();
    const reasonsSet = new Set<string>();
    const signals: CowSignalRecord[] = [];

    let hasUnresolvedSignal = false;
    let highestSeverity: SeverityLevel = "Normal";
    let latestDate = "";
    let highestScore = 0;

    // 1. Process health alerts for this cow
    for (const h of group.health_alerts) {
      if (!h.resolved) hasUnresolvedSignal = true;

      const sev = normalizeSeverity(h.alert_level);
      if (sev === "Critical") highestSeverity = "Critical";
      else if (sev === "Warning" && highestSeverity !== "Critical") highestSeverity = "Warning";

      const hDate = h.observation_date || h.created_at || "";
      if (hDate > latestDate) latestDate = hDate;

      const riskName = formatRiskDisplayName(h);
      const isEnv = riskName.toLowerCase().includes("heat") || (h.alert_type || "").toLowerCase().includes("heat");
      const srcLabel: RiskSource = isEnv ? "Environmental" : "Health Alert";
      sourcesSet.add(srcLabel);

      const why = h.why_explanation || h.description || `${riskName} flagged`;
      const cleanWhy = why.replace(/Cow\s+[a-f0-9-]{8,}/gi, name);
      if (!cleanWhy.toLowerCase().includes("normal pattern")) {
        reasonsSet.add(cleanWhy);
      }

      signals.push({
        id: `alert-${h.id}`,
        date: hDate,
        concern: riskName,
        severity: sev,
        source: srcLabel,
        status: h.resolved ? "resolved" : "active",
        raw_description: h.description || undefined,
        metrics: h.evidence || undefined,
        alert_id: h.id,
      });
    }

    // 2. Process anomalies for this cow
    for (const a of group.anomalies) {
      if (!a.resolved) hasUnresolvedSignal = true;

      const sev = normalizeSeverity(a.severity);
      if (sev === "Critical") highestSeverity = "Critical";
      else if (sev === "Warning" && highestSeverity !== "Critical") highestSeverity = "Warning";

      const aDate = a.detected_at || "";
      if (aDate > latestDate) latestDate = aDate;

      if (a.anomaly_score > highestScore) {
        highestScore = a.anomaly_score;
      }

      const isEnv = (a.anomaly_type || "").toLowerCase().includes("heat") || (a.issue_tags || []).some(t => t.toLowerCase().includes("heat"));
      const srcLabel: RiskSource = isEnv ? "Environmental" : "AI Anomaly";
      sourcesSet.add(srcLabel);

      if (a.issue_tags && a.issue_tags.length > 0) {
        for (const tag of a.issue_tags) {
          if (!tag.toLowerCase().includes("normal pattern")) {
            reasonsSet.add(tag);
          }
        }
      } else if (a.description && !a.description.toLowerCase().includes("normal pattern")) {
        reasonsSet.add(a.description);
      }

      signals.push({
        id: `anomaly-${a.id}`,
        date: aDate,
        concern: a.issue_tags && a.issue_tags.length > 0 ? a.issue_tags.filter(t => !t.toLowerCase().includes("normal")).join(", ") || "Outlier Pattern" : a.anomaly_type || "Outlier Pattern",
        severity: sev,
        source: srcLabel,
        status: a.resolved ? "resolved" : "active",
        raw_description: a.description || undefined,
        metrics: a.details || undefined,
        score: a.anomaly_score,
        anomaly_id: a.id,
      });
    }

    // Sort signals descending by date
    signals.sort((s1, s2) => new Date(s2.date).getTime() - new Date(s1.date).getTime());

    let reasons = Array.from(reasonsSet);
    
    // Filter out "Normal Pattern" when non-normal reasons exist
    if (reasons.length > 1) {
      reasons = reasons.filter(r => !r.toLowerCase().includes("normal pattern"));
    }

    if (reasons.length === 0) {
      if (highestSeverity === "Critical") {
        reasons.push("Critical health risk requiring immediate physical inspection");
      } else if (highestSeverity === "Warning") {
        reasons.push("Moderate behavioral variance under active surveillance");
      } else {
        reasons.push("All milk yield, feed intake, and biometrics within expected baseline");
      }
    }

    const primaryConcern = buildPrimaryConcern(reasons, highestSeverity);

    result.push({
      cow_id: cowId,
      cow_name: name,
      tag_id: tag_id,
      breed: breed,
      highest_severity: highestSeverity,
      primary_concern: primaryConcern,
      reasons: reasons.slice(0, 3), // Max 3 clean reasons for visual clarity
      sources: Array.from(sourcesSet),
      signals: signals,
      health_alerts: group.health_alerts,
      anomalies: group.anomalies,
      last_detected_date: latestDate || new Date().toISOString(),
      is_resolved: !hasUnresolvedSignal,
      score: highestScore,
    });
  }

  // Sort order: Unresolved Critical -> Unresolved Warning -> Resolved Critical -> Resolved Warning -> Normal/Healthy
  return result.sort((a, b) => {
    if (a.is_resolved !== b.is_resolved) return a.is_resolved ? 1 : -1;
    const severityWeight: Record<SeverityLevel, number> = {
      Critical: 3,
      Warning: 2,
      Normal: 1,
    };
    const diff = severityWeight[b.highest_severity] - severityWeight[a.highest_severity];
    if (diff !== 0) return diff;
    return new Date(b.last_detected_date).getTime() - new Date(a.last_detected_date).getTime();
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
  const totalCows = cows.length || healthSummary?.summary.total_cows || anomalySummary?.summary.total_scanned || correlatedCases.length || 0;

  // Active cases per unique cow
  const activeCases = correlatedCases.filter((c) => !c.is_resolved);
  const highAttention = activeCases.filter((c) => c.highest_severity === "Critical").length;
  const monitor = activeCases.filter((c) => c.highest_severity === "Warning").length;

  // Healthy cows = total cows minus unique cows with active high attention or monitor
  const healthy = Math.max(0, totalCows - (highAttention + monitor));

  // 7-day cases count (cows with activity in last 7 days)
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const casesThisWeek = correlatedCases.filter((c) => {
    if (c.signals.length === 0 && c.highest_severity === "Normal") return false;
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
      return cases.filter((c) => c.highest_severity === "Critical" && !c.is_resolved);
    case "monitor":
      return cases.filter((c) => c.highest_severity === "Warning" && !c.is_resolved);
    case "healthy":
      return cases.filter((c) => c.highest_severity === "Normal" || c.is_resolved);
    case "flagged_7d":
      return cases.filter((c) => {
        if (c.signals.length === 0 && c.highest_severity === "Normal") return false;
        const dt = new Date(c.last_detected_date).getTime();
        return dt >= oneWeekAgo;
      });
    case "all_attention":
    default:
      // Show all active attention cows (High Attention + Monitor)
      const attentionOnly = cases.filter((c) => !c.is_resolved && c.highest_severity !== "Normal");
      return attentionOnly.length > 0 ? attentionOnly : cases;
  }
}

/**
 * Generates and downloads a CSV export of cow-level risk cases
 */
export function exportRiskReportCSV(cases: UnifiedRiskCase[], farmName: string = "Farm"): void {
  if (!cases.length) return;

  const headers = ["Last Signal Date", "Cow Name", "Tag ID", "Breed", "Primary Concern", "Severity", "Detected By", "Status", "Reasons"];
  const rows = cases.map((c) => [
    `"${new Date(c.last_detected_date).toLocaleDateString()}"`,
    `"${c.cow_name.replace(/"/g, '""')}"`,
    `"${c.tag_id.replace(/"/g, '""')}"`,
    `"${(c.breed || "—").replace(/"/g, '""')}"`,
    `"${c.primary_concern.replace(/"/g, '""')}"`,
    `"${c.highest_severity}"`,
    `"${c.sources.join(" + ")}"`,
    `"${c.is_resolved ? "Resolved" : "Active"}"`,
    `"${c.reasons.join("; ").replace(/"/g, '""')}"`,
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `cow_risk_summary_${farmName.toLowerCase().replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

