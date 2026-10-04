import api from './api';

export type ExplainabilityFeature = {
  feature: string;
  display_name: string;
  value?: number | null;
  value_formatted?: string | null;
  shap_value: number;
  rank: number;
  impact_direction: 'Positive' | 'Negative' | 'Neutral' | string;
  impact_description: string;
};

export type ExplainabilityResponse = {
  id: string;
  prediction_id?: string | null;
  anomaly_id?: string | null;
  observation_id?: string | null;
  cow_id?: string | null;
  cow_name?: string | null;
  farm_id?: string | null;
  observation_date?: string | null;
  predicted_yield?: number | null;
  anomaly_severity?: string | null;
  computed_at: string;
  model_version?: string | null;
  summary_narrative?: string | null;
  actionable_advice?: string | null;
  features: ExplainabilityFeature[];
  top_positive: ExplainabilityFeature[];
  top_negative: ExplainabilityFeature[];
};

export type ExplainableItem = {
  type: 'prediction' | 'anomaly' | string;
  id: string;
  cow_id: string;
  cow_name: string;
  date: string;
  label: string;
  prediction_id?: string | null;
  anomaly_id?: string | null;
};

export async function fetchExplainabilityByPrediction(predictionId: string) {
  const res = await api.post<ExplainabilityResponse>('/api/v1/explainability', { prediction_id: predictionId });
  return res.data;
}

export async function fetchExplainabilityByAnomaly(anomalyId: string) {
  const res = await api.post<ExplainabilityResponse>('/api/v1/explainability', { anomaly_id: anomalyId });
  return res.data;
}

export async function fetchExplainabilityHistory(farmId?: string) {
  const params: Record<string, string> = {};
  if (farmId) params.farm_id = farmId;
  const res = await api.get<{ items: ExplainableItem[] }>('/api/v1/explainability/history', { params });
  return res.data.items || [];
}

export type ModelBenchmark = {
  model: string;
  r2_mean: number;
  r2_std: number;
  mae_mean: number;
  mae_std: number;
  rmse_mean: number;
  rmse_std: number;
};

export type GlobalFeatureImportance = {
  feature: string;
  display_name: string;
  mean_abs_shap: number;
  monotone_constraint?: string | null;
  description: string;
};

export type ModelInsightsResponse = {
  model_name: string;
  version: string;
  algorithm: string;
  monotone_guaranteed: boolean;
  violations_count: number;
  summary: string;
  benchmarks: ModelBenchmark[];
  features: GlobalFeatureImportance[];
};

export async function fetchModelInsights(): Promise<ModelInsightsResponse> {
  const res = await api.get<ModelInsightsResponse>('/api/v1/explainability/model-insights');
  return res.data;
}

