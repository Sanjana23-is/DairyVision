import api from './api';

export type Farm = {
  id: string;
  name: string;
  description?: string;
  location_city?: string;
  location_country?: string;
  timezone?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export async function fetchFarms() {
  const res = await api.get<Farm[]>('/api/v1/farms');
  return res.data;
}

export type CreateFarmPayload = {
  name: string;
  description?: string;
  location_city?: string;
  location_country?: string;
  timezone?: string;
};

export async function createFarm(payload: CreateFarmPayload) {
  const res = await api.post<Farm>("/api/v1/farms", {
    ...payload,
    timezone: "Asia/Kolkata",
  });
  return res.data;
}

export async function updateFarm(id: string, payload: Partial<CreateFarmPayload>) {
  const res = await api.patch<Farm>(`/api/v1/farms/${id}`, {
    ...payload,
    timezone: "Asia/Kolkata",
  });
  return res.data;
}

export async function deleteFarm(id: string) {
  const res = await api.delete(`/api/v1/farms/${id}`);
  return res.data;
}
