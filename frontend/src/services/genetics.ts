import api from "./api";

export type Sire = {
  id: string;
  sire_code: string;
  name: string;
  breed_name?: string | null;
  peak_yield_kg?: number | null;
  days_to_peak?: number | null;
  lactation_length_days?: number | null;
  total_milk_yield_kg?: number | null;
  genetic_merit_score: number;
  rank: number;
};

export type SireRankingResponse = {
  sires: Sire[];
  total_sires_evaluated: number;
  top_sire_code?: string | null;
  top_sire_name?: string | null;
  average_sire_total_yield_kg: number;
};

export type CowGeneticProfile = {
  cow_id: string;
  cow_name: string;
  tag_id: string;
  breed_name?: string | null;
  sire_id?: string | null;
  sire_code?: string | null;
  sire_name?: string | null;
  dam_name?: string | null;
  pedigree_status: "Verified Sire Pedigree" | "Estimated from Breed Baseline";
  pedigree_confidence: "High" | "Medium" | "Low";
  estimated_genetic_potential_l: number;
  actual_avg_daily_yield_l?: number | null;
  genetic_merit_rating: number;
  breeding_insights: string[];
};

export type HerdGeneticsSummary = {
  total_cows: number;
  cows_with_pedigree_count: number;
  average_herd_genetic_score: number;
  top_genetic_sire_lines: { sire_name: string; offspring_count: number }[];
  herd_genetic_distribution: Record<string, number>;
  cow_profiles: CowGeneticProfile[];
};

export async function fetchSireRankings(): Promise<SireRankingResponse> {
  const res = await api.get<SireRankingResponse>("/api/v1/genetics/sires");
  return res.data;
}

export async function fetchCowGeneticProfile(cowId: string): Promise<CowGeneticProfile> {
  const res = await api.get<CowGeneticProfile>(`/api/v1/genetics/cow/${cowId}`);
  return res.data;
}

export async function fetchHerdGeneticsSummary(farmId?: string): Promise<HerdGeneticsSummary> {
  const params: Record<string, string> = {};
  if (farmId) params.farm_id = farmId;
  const res = await api.get<HerdGeneticsSummary>("/api/v1/genetics/herd", { params });
  return res.data;
}
