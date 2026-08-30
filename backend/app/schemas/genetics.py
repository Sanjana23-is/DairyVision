from __future__ import annotations

from typing import Optional, Literal, Any
from pydantic import BaseModel, ConfigDict


class SireResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    sire_code: str
    name: str
    breed_name: Optional[str] = None
    peak_yield_kg: Optional[float] = None
    days_to_peak: Optional[int] = None
    lactation_length_days: Optional[int] = None
    total_milk_yield_kg: Optional[float] = None
    genetic_merit_score: float
    rank: int = 1


class SireRankingResponse(BaseModel):
    sires: list[SireResponse]
    total_sires_evaluated: int
    top_sire_code: Optional[str] = None
    top_sire_name: Optional[str] = None
    average_sire_total_yield_kg: float


class CowGeneticProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    cow_id: str
    cow_name: str
    tag_id: str
    breed_name: Optional[str] = None
    sire_id: Optional[str] = None
    sire_code: Optional[str] = None
    sire_name: Optional[str] = None
    dam_name: Optional[str] = None
    pedigree_status: Literal["Verified Sire Pedigree", "Estimated from Breed Baseline"]
    pedigree_confidence: Literal["High", "Medium", "Low"]
    estimated_genetic_potential_l: float
    actual_avg_daily_yield_l: Optional[float] = None
    genetic_merit_rating: float
    breeding_insights: list[str]


class HerdGeneticsSummaryResponse(BaseModel):
    total_cows: int
    cows_with_pedigree_count: int
    average_herd_genetic_score: float
    top_genetic_sire_lines: list[dict[str, Any]]
    herd_genetic_distribution: dict[str, int]
    cow_profiles: list[CowGeneticProfileResponse]
