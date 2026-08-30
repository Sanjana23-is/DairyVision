import api from "./api";

export type SimulationInput = {
  temperature_c?: number | null;
  humidity_pct?: number | null;
  feed_quantity_kg?: number | null;
  cooling_intervention_thi_reduction?: number | null;
  body_condition_score?: number | null;
};

export type CowSimulationComparison = {
  cow_id: string;
  cow_name: string;
  tag_id: string;
  baseline_yield_l: number;
  simulated_yield_l: number;
  delta_yield_l: number;
  percent_change: number;
  baseline_health_status: string;
  simulated_health_status: string;
  baseline_thi: number;
  simulated_thi: number;
};

export type RecommendationItem = {
  title: string;
  description?: string | null;
  category: string;
  priority: string;
  recommendation_type: string;
};

export type HerdWhatIfResponse = {
  farm_id?: string | null;
  total_cows_simulated: number;
  baseline_total_yield_l: number;
  simulated_total_yield_l: number;
  total_delta_l: number;
  total_percent_change: number;
  cow_comparisons: CowSimulationComparison[];
  herd_recommendations: RecommendationItem[];
  extrapolation_warning: boolean;
};

export type CowWhatIfResponse = {
  cow_id: string;
  cow_name: string;
  tag_id: string;
  breed_name?: string | null;
  baseline_milk_yield_l: number;
  predicted_milk_yield_l: number;
  simulated_milk_yield_l: number;
  delta_milk_yield_l: number;
  percent_change: number;
  baseline_thi: number;
  simulated_thi: number;
  baseline_health_status: string;
  simulated_health_status: string;
  baseline_vitality_score: number;
  simulated_vitality_score: number;
  explanation_summary: string;
  extrapolation_warning: boolean;
  recommendations: RecommendationItem[];
};

export async function runHerdSimulation(
  scenario: SimulationInput,
  farmId?: string
): Promise<HerdWhatIfResponse> {
  const res = await api.post<HerdWhatIfResponse>("/api/v1/what-if/herd", {
    farm_id: farmId || null,
    scenario,
  });
  return res.data;
}

export async function runCowSimulation(
  cowId: string,
  scenario: SimulationInput
): Promise<CowWhatIfResponse> {
  const res = await api.post<CowWhatIfResponse>(`/api/v1/what-if/cow/${cowId}`, {
    scenario,
  });
  return res.data;
}
