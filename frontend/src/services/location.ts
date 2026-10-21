import api from "./api";

export interface LocationSearchResult {
  name: string;
  taluk?: string;
  district?: string;
  state?: string;
  country: string;
  latitude: number;
  longitude: number;
  display_name: string;
}

export interface ReverseGeocodeResult {
  latitude: number;
  longitude: number;
  village?: string;
  taluk?: string;
  district?: string;
  state?: string;
  country: string;
  display_name: string;
}

export async function fetchIndianStates(): Promise<string[]> {
  const res = await api.get<string[]>("/api/v1/locations/states");
  return res.data || [];
}

export async function fetchDistrictsForState(state: string): Promise<string[]> {
  if (!state) return [];
  const res = await api.get<string[]>("/api/v1/locations/districts", {
    params: { state },
  });
  return res.data || [];
}

export async function searchIndianLocations(
  query: string,
  state?: string,
  district?: string,
): Promise<LocationSearchResult[]> {
  if (!query || query.trim().length < 2) return [];
  const res = await api.get<LocationSearchResult[]>("/api/v1/locations/search", {
    params: {
      q: query.trim(),
      state: state || undefined,
      district: district || undefined,
    },
  });
  return res.data || [];
}

export async function reverseGeocodeCoordinates(
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodeResult> {
  const res = await api.post<ReverseGeocodeResult>(
    "/api/v1/locations/reverse-geocode",
    { latitude, longitude },
  );
  return res.data;
}
