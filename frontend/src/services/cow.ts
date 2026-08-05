import api from './api';

export type Cow = {
  id: string;
  name: string;
  tag?: string;
  breed?: string;
  status?: 'active' | 'inactive' | string;
  [key: string]: any;
};

export async function fetchCows(farmId: string) {
  const res = await api.get<Cow[]>('/api/v1/cows');
  const cows = res.data || [];
  return cows.filter((cow) => cow.farm_id === farmId);
}

export async function fetchCow(cowId: string) {
  const res = await api.get<Cow>(`/api/v1/cows/${cowId}`);
  return res.data;
}

export async function createCow(farmId: string, payload: Partial<Cow>) {
  const res = await api.post<Cow>('/api/v1/cows', { ...payload, farm_id: farmId });
  return res.data;
}

export async function updateCow(cowId: string, payload: Partial<Cow>) {
  const res = await api.patch<Cow>(`/api/v1/cows/${cowId}`, payload);
  return res.data;
}

export async function deleteCow(cowId: string) {
  const res = await api.delete(`/api/v1/cows/${cowId}`);
  return res.data;
}
