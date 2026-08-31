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

export async function createPredictionForObservation(observationId: string) {
  const res = await api.post<MilkPrediction>('/api/v1/predictions/milk-yield', {
    observation_id: observationId,
  });
  return res.data;
}

export async function deletePrediction(id: string) {
  await api.delete(`/api/v1/milk-predictions/${id}`);
}
