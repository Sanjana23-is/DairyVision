import api from './api';

export type ExplainabilityFeature = {
  feature: string;
  value?: any;
  shap_value?: number;
  rank?: number;
};

export type ExplainabilityResponse = {
  id: string;
  prediction_id?: string;
  observation_id?: string;
  cow_id?: string;
  farm_id?: string;
  computed_at?: string;
  model_version?: string;
  features: ExplainabilityFeature[];
  top_positive: ExplainabilityFeature[];
  top_negative: ExplainabilityFeature[];
};

export async function fetchExplainabilityByPrediction(predictionId: string) {
  const res = await api.post<ExplainabilityResponse>('/api/v1/explainability', { prediction_id: predictionId });
  return res.data;
}
