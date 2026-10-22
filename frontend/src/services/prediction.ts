import api from './api';

export type MilkPrediction = {
  id: string;
  cow_id: string;
  observation_id?: string | null;
  predicted_milk_yield: number;
  model_version: string;
  confidence_score?: number | null;
  confidence_lower?: number | null;
  confidence_upper?: number | null;
  confidence_data_status?: "historical" | "limited_data" | string;
  prediction_timestamp: string;
  owner_id?: string;

  // Enriched Baseline & Anomaly Detection fields
  expected_baseline?: number | null;
  actual_yield?: number | null;
  residual_liters?: number | null;
  drop_liters?: number | null;
  drop_percentage?: number | null;
  baseline_status?: "established_baseline" | "provisional_baseline" | "insufficient_history" | string | null;
  baseline_method?: string | null;
  observations_used?: number | null;
  baseline_window_days?: number | null;
  historical_variability?: number | null;
  anomaly_status?: "normal" | "monitor" | "unusual_drop" | "persistent_drop" | "provisional_baseline" | "insufficient_history" | "data_quality_issue" | "missing_observation" | string | null;
  alert_explanation?: string | null;
  recommended_action?: string | null;
  data_quality_warnings?: string[] | null;
};

export type CowBaselineSummary = {
  cow_id: string;
  target_date: string;
  expected_baseline: number | null;
  baseline_status: "established_baseline" | "provisional_baseline" | "insufficient_history" | string;
  observations_used: number;
  baseline_window_days: number;
  method: string;
  historical_variability: number | null;
  previous_day_yield: number | null;
  observations_history?: Array<{
    date: string;
    milk_yield: number;
  }>;
  data_quality_warnings?: string[];
  explanation?: string;

  // Anomaly evaluation fields
  anomaly_status?: "normal" | "monitor" | "unusual_drop" | "persistent_drop" | "provisional_baseline" | "insufficient_history" | "data_quality_issue" | "missing_observation" | string | null;
  actual_yield?: number | null;
  residual_liters?: number | null;
  drop_liters?: number | null;
  drop_percentage?: number | null;
  z_score?: number | null;
  is_persistent?: boolean;
  alert_explanation?: string | null;
  recommended_action?: string | null;
  observation_id?: string | null;
  has_today_observation?: boolean;
};

export async function fetchPredictions(farmId?: string) {
  const res = await api.get<MilkPrediction[]>('/api/v1/milk-predictions', {
    params: farmId ? { farm_id: farmId } : undefined,
  });
  return res.data || [];
}

export async function fetchPrediction(id: string) {
  const res = await api.get<MilkPrediction>(`/api/v1/milk-predictions/${id}`);
  return res.data;
}

export async function fetchCowBaseline(cowId: string, targetDate?: string): Promise<CowBaselineSummary> {
  const res = await api.get<CowBaselineSummary>(`/api/v1/cows/${cowId}/baseline`, {
    params: targetDate ? { target_date: targetDate } : undefined,
  });
  return res.data;
}

export async function createPredictionForObservation(observationId: string) {
  const res = await api.post<MilkPrediction>('/api/v1/predictions/milk-yield', {
    observation_id: observationId,
  });
  return res.data;
}

export async function deletePrediction(id: string) {
  await api.delete(`/api/v1/milk-predictions/${id}`);
}
