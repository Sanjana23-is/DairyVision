import api from './api';

export type HealthAlert = {
  id: string;
  cow_id: string;
  observation_id?: string | null;
  prediction_id?: string | null;
  farm_id?: string | null;
  alert_level: string;
  alert_type: string;
  description?: string | null;
  confidence: number;
  resolved: boolean;
  owner_id: string;
  created_at: string;
  cow?: { id: string; name?: string };
};

export type HealthAlertFilter = {
  alert_level?: string;
  resolved?: boolean;
  cow_id?: string;
  prediction_id?: string;
  search?: string;
};

export async function fetchHealthAlerts(filters: HealthAlertFilter = {}) {
  const params: Record<string, string | boolean> = {};

  if (filters.alert_level) {
    params.alert_level = filters.alert_level;
  }
  if (filters.resolved !== undefined) {
    params.resolved = filters.resolved;
  }
  if (filters.cow_id) {
    params.cow_id = filters.cow_id;
  }
  if (filters.prediction_id) {
    params.prediction_id = filters.prediction_id;
  }
  if (filters.search) {
    params.search = filters.search;
  }

  const res = await api.get<HealthAlert[]>('/api/v1/health-alerts', {
    params,
  });
  return res.data || [];
}

export async function resolveHealthAlert(id: string) {
  const res = await api.patch<HealthAlert>(`/api/v1/health-alerts/${id}`, {
    resolved: true,
  });
  return res.data;
}

export type HealthSummaryCounts = {
  healthy: number;
  warning: number;
  critical: number;
  needs_attention: number;
  no_recent_data: number;
  total_cows: number;
};


export type RiskBreakdownItem = {
  risk_type: string;
  count: number;
};

export type AttentionCow = {
  cow_id: string;
  cow_name: string;
  alert_level: string;
  risk_type: string;
  last_observed_date?: string | null;
};


export type HealthSummary = {
  summary: HealthSummaryCounts;
  risk_breakdown: RiskBreakdownItem[];
  attention_cows: AttentionCow[];
};

export async function fetchHealthSummary(farmId?: string) {
  const params: Record<string, string> = {};
  if (farmId) params.farm_id = farmId;
  const res = await api.get<HealthSummary>("/api/v1/health-alerts/summary", {
    params,
  });
  return res.data;
}

