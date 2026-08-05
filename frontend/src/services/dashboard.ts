import api from './api';

export type DashboardSummary = {
  totalCows?: number;
  total_cows?: number;
  todaysPrediction?: number;
  todays_prediction?: number;
  activeAlerts?: number;
  active_alerts?: number;
  currentWeather?: { temp: number; hum?: number; thi?: number };
  current_weather?: { temp: number; hum?: number; thi?: number };
  recentPredictions?: Array<{ id: string; cow: string; predicted: number }>;
  recent_predictions?: Array<{ id: string; cow: string; predicted: number }>;
  recentAlerts?: Array<{ id: string; cow: string; level: string; message: string }>;
  recent_alerts?: Array<{ id: string; cow: string; level: string; message: string }>;
  recommendations?: Array<{ id: string; title: string; priority?: string }>;
};

export async function fetchDashboardSummary(farmId: string) {
  const res = await api.get<DashboardSummary>(`/api/v1/dashboard/farms/${farmId}/summary`);
  return res.data;
}
