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
