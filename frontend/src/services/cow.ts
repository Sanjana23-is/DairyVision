import api from './api';

export type Cow = {
  id: string;
  name: string;
  farm_id?: string;
  tag?: string;
  tag_id?: string;
  breed?: string;
  breed_id?: string;
  birth_date?: string | null;
  age_months?: number | null;
  weight_kg?: number | null;
  status?: 'active' | 'dry' | 'sick' | 'deceased' | 'sold' | string;
  [key: string]: any;
};

function normalizeCowPayload(payload: Partial<Cow>) {
  const normalized: Record<string, unknown> = { ...payload };
  if (payload.breed !== undefined) {
    if (payload.breed) {
      normalized.breed_id = payload.breed;
    }
    delete normalized.breed;
  }
  if (payload.tag !== undefined) {
    if (payload.tag) {
      normalized.tag_id = payload.tag;
    }
    delete normalized.tag;
  }
  if (payload.birth_date === "") {
    normalized.birth_date = null;
  }
  if ((payload.age_months as any) === "" || payload.age_months === undefined) {
    if ((payload.age_months as any) === "") {
      normalized.age_months = null;
    }
  }
  if ((payload.weight_kg as any) === "") {
    normalized.weight_kg = null;
  }
  return normalized;
}

function mapCowFromApi(cow: Cow) {
  return {
    ...cow,
    tag: cow.tag ?? cow.tag_id,
    breed: cow.breed ?? cow.breed_id,
  };
}

export async function fetchCows(farmId: string) {
  const res = await api.get<Cow[]>('/api/v1/cows', { params: { farm_id: farmId } });
  const cows = res.data || [];
  return cows.map(mapCowFromApi);
}

export async function fetchCow(cowId: string) {
  const res = await api.get<Cow>(`/api/v1/cows/${cowId}`);
  return mapCowFromApi(res.data);
}

export async function createCow(farmId: string, payload: Partial<Cow>) {
  const res = await api.post<Cow>('/api/v1/cows', {
    ...normalizeCowPayload(payload),
    farm_id: farmId,
  });
  return mapCowFromApi(res.data);
}

export async function updateCow(cowId: string, payload: Partial<Cow>) {
  const res = await api.patch<Cow>(`/api/v1/cows/${cowId}`, normalizeCowPayload(payload));
  return mapCowFromApi(res.data);
}

export async function deleteCow(cowId: string) {
  const res = await api.delete(`/api/v1/cows/${cowId}`);
  return res.data;
}
