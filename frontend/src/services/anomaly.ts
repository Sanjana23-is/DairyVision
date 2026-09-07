import api from './api';

export type AnomalyRecord = {
  id: string;
  cow_id: string;
  observation_id?: string | null;
  farm_id: string;
  owner_id: string;
  anomaly_score: number;
  severity: 'Normal' | 'Warning' | 'Critical' | string;
  anomaly_type: string;
  issue_tags?: string[] | null;
  description?: string | null;
  details?: Record<string, any> | null;
  detected_at: string;
  resolved: boolean;
};

export type AnomalySummaryCounts = {
  total_scanned: number;
  normal: number;
  warning: number;
  critical: number;
  unresolved_anomalies: number;
};

export type TopAnomalousCow = {
  cow_id: string;
  cow_name: string;
  anomaly_score: number;
  severity: string;
  issue_tags: string[];
  last_observed_date?: string | null;
};

export type AnomalySummary = {
  summary: AnomalySummaryCounts;
  top_anomalous_cows: TopAnomalousCow[];
  recent_anomalies: AnomalyRecord[];
};

export type AnomalyFilter = {
  severity?: string;
  resolved?: boolean;
  cow_id?: string;
  search?: string;
};

export async function fetchAnomalySummary(farmId?: string) {
  const params: Record<string, string> = {};
  if (farmId) params.farm_id = farmId;
  const res = await api.get<AnomalySummary>('/api/v1/anomalies/summary', { params });
  return res.data;
}

export async function triggerAnomalyScan(farmId?: string) {
  const params: Record<string, string> = {};
  if (farmId) params.farm_id = farmId;
  const res = await api.post<{ message: string; scanned_observations: number }>('/api/v1/anomalies/scan', null, { params });
  return res.data;
}

export async function fetchAnomalies(filters: AnomalyFilter = {}) {
  const params: Record<string, string | boolean> = {};
  if (filters.severity && filters.severity !== 'All') {
    params.severity = filters.severity;
  }
  if (filters.resolved !== undefined) {
    params.resolved = filters.resolved;
  }
  if (filters.cow_id) {
    params.cow_id = filters.cow_id;
  }
  if (filters.search) {
    params.search = filters.search;
  }

  const res = await api.get<AnomalyRecord[]>('/api/v1/anomalies', { params });
  return res.data || [];
}

export async function resolveAnomaly(anomalyId: string) {
  const res = await api.patch<AnomalyRecord>(`/api/v1/anomalies/${anomalyId}`, {
    resolved: true,
  });
  return res.data;
}
