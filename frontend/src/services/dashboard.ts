import api from './api';

export type DashboardSummary = {
  farm?: any;
  total_farms?: number;
  total_cow_count?: number;
  active_cow_count?: number;
  total_daily_observations?: number;
  total_milk_produced?: number;
  average_milk_per_cow?: number;
  active_recommendations?: number;
  prediction_accuracy?: number;
  herd_summary?: Array<{ status: string; count: number }>;
  todays_milk_predictions?: Array<{
    id: string;
    cow_id: string;
    predicted_milk_yield: number;
    confidence_score?: number;
    prediction_timestamp: string;
  }>;
  average_predicted_milk_yield?: number;
  todays_weather?: { temperature?: number; humidity?: number; thi?: number } | null;
  active_health_alerts?: Array<{
    id: string;
    cow_id: string;
    alert_level: string;
    alert_type: string;
    description?: string;
    confidence: number;
    created_at: string;
  }>;
  recent_recommendations?: Array<{
    id: string;
    title: string;
    category: string;
    priority: string;
    recommendation_type: string;
    created_at: string;
  }>;
  recent_observations?: Array<{
    id: string;
    cow_id: string;
    cow_name?: string;
    observation_date: string;
    milk_produced_liters?: number;
    feed_quantity_kg?: number;
    symptoms?: any;
    notes?: string;
    created_at: string;
  }>;
};

export type DashboardTrends = {
  milk_yield_trends: Array<{
    date: string;
    average_predicted_milk_yield: number;
    prediction_count: number;
  }>;
  health_alert_trends: Array<{
    date: string;
    total_alerts: number;
    critical_count: number;
    warning_count: number;
    healthy_count: number;
  }>;
  weather_trends: Array<{
    date: string;
    average_temperature: number;
    average_humidity: number;
    average_thi: number;
  }>;
  observation_trends: Array<{
    date: string;
    observation_count: number;
    total_milk_produced: number;
  }>;
  recommendation_category_distribution: Array<{ category: string; count: number }>;
  health_alert_distribution: Array<{ category: string; count: number }>;
  cow_health_status_distribution: Array<{ category: string; count: number }>;
};

export async function fetchDashboardSummary(farmId: string) {
  const res = await api.get<DashboardSummary>(`/api/v1/dashboard/farms/${farmId}/summary`);
  return res.data;
}

export async function fetchDashboardTrends(farmId: string) {
  const res = await api.get<DashboardTrends>(`/api/v1/dashboard/farms/${farmId}/trends`);
  return res.data;
}
