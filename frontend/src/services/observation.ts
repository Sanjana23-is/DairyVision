import api from "./api";
import { Cow } from "./cow";

export type Observation = {
  id: string;
  cow_id: string;
  observation_date: string;
  milk_produced_liters?: number;
  feed_quantity_kg?: number;
  symptoms?: {
    condition?: string;
    signs?: string[];
    [key: string]: any;
  };
  notes?: string;
  observed_by?: string | null;
  owner_id: string;
  created_at: string;
  cow?: Cow;
};

export async function fetchObservations() {
  const res = await api.get<Observation[]>("/api/v1/daily-observations");
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

export async function updateObservation(id: string, payload: Partial<Observation>) {
  const res = await api.patch<Observation>(`/api/v1/daily-observations/${id}`, payload);
  return res.data;
}

export async function deleteObservation(id: string) {
  await api.delete(`/api/v1/daily-observations/${id}`);
}
