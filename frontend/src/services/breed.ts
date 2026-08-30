import api from './api';

export type Breed = {
  id: string;
  canonical_name: string;
  breed_category?: string;
  species?: string;
  origin_region?: string;
  description?: string;
  is_active?: boolean;
  is_featured?: boolean;
};

export async function fetchBreeds() {
  const res = await api.get<Breed[]>('/api/v1/breeds');
  return res.data || [];
}
