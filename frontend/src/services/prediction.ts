import api from './api';

export type MilkPrediction = {
  id: string;
  cow_id: string;
  observation_id?: string | null;
  predicted_milk_yield: number;
  model_version: string;
  confidence_score?: number;
  prediction_timestamp: string;
  owner_id?: string;
  health_status?: string | number;
  recommendation_summary?: string;
  recommendations?: string[];
  cow?: { id: string; name?: string };
};

export async function fetchPredictions() {
  const res = await api.get<MilkPrediction[]>('/api/v1/milk-predictions');
  return res.data || [];
}

export async function fetchPrediction(id: string) {
  const res = await api.get<MilkPrediction>(`/api/v1/milk-predictions/${id}`);
  return res.data;
}

export async function createPredictionForObservation(
  observationId: string,
  metadata?: { farm_id?: string; cow_id?: string },
) {
  const payload = {
    observation_id: observationId,
    ...metadata,
  };
  const res = await api.post<MilkPrediction>('/api/v1/predictions/milk-yield', payload);
  return res.data;
}

export async function deletePrediction(id: string) {
  await api.delete(`/api/v1/milk-predictions/${id}`);
}
