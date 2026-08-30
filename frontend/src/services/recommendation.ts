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

export type RecommendationFilter = {
  category?: string;
  priority?: string;
  completed?: boolean;
  search?: string;
};

export async function fetchRecommendations(filters: RecommendationFilter = {}) {
  const params: Record<string, string | boolean> = {};

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

export async function deleteRecommendation(id: string) {
  await api.delete(`/api/v1/recommendations/${id}`);
}
