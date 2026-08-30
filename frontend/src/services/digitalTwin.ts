import api from "./api";

export type VitalSign = {
  name: string;
  value: string;
  unit?: string | null;
  status: "normal" | "warning" | "critical" | "info" | string;
  description?: string | null;
};

export type ProductionMetric = {
  current_yield_l?: number | null;
  predicted_yield_l?: number | null;
  efficiency_pct?: number | null;
  trend_7d_l_day?: number | null;
  baseline_status: "On Track" | "Above Baseline" | "Below Baseline" | string;
};

export type TopDriver = {
  factor: string;
  impact: string;
  type: "positive" | "negative" | "neutral" | string;
  explanation: string;
};

export type CowDigitalTwin = {
  cow_id: string;
  cow_name: string;
  breed?: string | null;
  age_display?: string | null;
  lactation_stage?: string | null;
  weight_kg?: number | null;
  vitality_score: number;
  health_status: "Healthy" | "Warning" | "Critical" | string;
  heat_stress_level: "Comfort" | "Mild" | "Moderate" | "High" | string;
  status_summary: string;
  vital_signs: VitalSign[];
  production: ProductionMetric;
  top_drivers: TopDriver[];
  active_alerts_count: number;
  active_anomalies_count: number;
  recent_anomalies: string[];
  recommended_actions: string[];
  last_updated: string;
};

export type HerdVitalitySummary = {
  total_cows: number;
  average_vitality_score: number;
  total_daily_yield_l: number;
  total_predicted_yield_l: number;
  health_distribution: Record<string, number>;
  heat_stress_distribution: Record<string, number>;
  attention_cow_count: number;
};

export type HerdDigitalTwin = {
  herd_summary: HerdVitalitySummary;
  cow_states: CowDigitalTwin[];
};

export async function fetchHerdDigitalTwin(farmId?: string): Promise<HerdDigitalTwin> {
  const params: Record<string, string> = {};
  if (farmId) params.farm_id = farmId;
  const res = await api.get<HerdDigitalTwin>("/api/v1/digital-twin/herd", { params });
  return res.data;
}

export async function fetchCowDigitalTwin(cowId: string): Promise<CowDigitalTwin> {
  const res = await api.get<CowDigitalTwin>(`/api/v1/digital-twin/cow/${cowId}`);
  return res.data;
}
