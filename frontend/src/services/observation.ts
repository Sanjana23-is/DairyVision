import api from "./api";

export type Observation = {
  id: string;
  farm_id: string;
  cow_id: string;
  observation_date: string;
  milk_produced_liters?: number;
  feed_quantity_kg?: number;
  symptoms?: {
    condition?: string;
    signs?: string[];
    [key: string]: any;
  };
  health_condition?: string;
  body_temperature_c?: number;
  body_condition_score?: number;
  health_notes?: string;
  notes?: string;
  observed_by?: string | null;
  owner_id: string;
  created_at: string;
  updated_at?: string;
};

export type BulkObservationItem = {
  tag_id: string;
  observation_date?: string;
  milk_produced_liters?: number | null;
  feed_quantity_kg?: number | null;
  health_condition?: string | null;
  body_temperature_c?: number | null;
  body_condition_score?: number | null;
  notes?: string | null;
};

export type BulkRowError = {
  row: number;
  tag_id?: string | null;
  reason: string;
};

export type BulkObservationResponse = {
  total_rows: number;
  imported_count: number;
  failed_count: number;
  duplicate_count: number;
  errors: BulkRowError[];
};

export async function fetchObservations(farmId?: string) {
  const res = await api.get<Observation[]>("/api/v1/daily-observations", {
    params: farmId ? { farm_id: farmId } : undefined,
  });
  return res.data || [];
}

export async function fetchObservation(id: string) {
  const res = await api.get<Observation>(`/api/v1/daily-observations/${id}`);
  return res.data;
}

export async function createObservation(payload: Partial<Observation>) {
  const res = await api.post<Observation>("/api/v1/daily-observations", payload);
  return res.data;
}

export async function uploadBulkObservations(farmId: string, items: BulkObservationItem[]): Promise<BulkObservationResponse> {
  const res = await api.post<BulkObservationResponse>("/api/v1/observations/bulk", {
    farm_id: farmId,
    items,
  });
  return res.data;
}

export async function updateObservation(id: string, payload: Partial<Observation>) {
  const res = await api.patch<Observation>(`/api/v1/daily-observations/${id}`, payload);
  return res.data;
}

export async function deleteObservation(id: string) {
  await api.delete(`/api/v1/daily-observations/${id}`);
}
