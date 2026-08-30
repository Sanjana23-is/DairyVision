from __future__ import annotations

import logging
from typing import Optional, Any
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models import Cow, SireMaster, DailyObservation, BreedMaster, Farm
from app.schemas.genetics import (
    SireResponse,
    SireRankingResponse,
    CowGeneticProfileResponse,
    HerdGeneticsSummaryResponse,
)
from app.seeds.sire_seed import seed_sires

logger = logging.getLogger(__name__)


class GeneticsService:
    """Service providing sire ranking, cow genetic profiles, and herd breeding analytics."""

    def __init__(self, db: Session):
        self.db = db
        self._ensure_sires_seeded()

    def _ensure_sires_seeded(self) -> None:
        """Seed default sires if sire_master table is empty."""
        try:
            count = self.db.query(SireMaster).count()
            if count == 0:
                seed_sires(self.db)
        except Exception as exc:
            logger.warning(f"Could not verify or seed sires: {exc}")

    def get_sire_rankings(self) -> SireRankingResponse:
        """Rank all canonical sires by total milk yield and genetic merit score."""
        sires = (
            self.db.query(SireMaster)
            .order_by(SireMaster.total_milk_yield_kg.desc(), SireMaster.genetic_merit_score.desc())
            .all()
        )

        sire_responses: list[SireResponse] = []
        total_yield_sum = 0.0

        for rank, s in enumerate(sires, 1):
            breed_name = None
            if s.breed:
                breed_name = s.breed.canonical_name if hasattr(s.breed, "canonical_name") else str(s.breed)

            yield_kg = s.total_milk_yield_kg or 0.0
            total_yield_sum += yield_kg

            sire_responses.append(
                SireResponse(
                    id=s.id,
                    sire_code=s.sire_code,
                    name=s.name,
                    breed_name=breed_name,
                    peak_yield_kg=s.peak_yield_kg,
                    days_to_peak=s.days_to_peak,
                    lactation_length_days=s.lactation_length_days,
                    total_milk_yield_kg=s.total_milk_yield_kg,
                    genetic_merit_score=s.genetic_merit_score,
                    rank=rank,
                )
            )

        avg_yield = total_yield_sum / len(sires) if sires else 0.0
        top_sire = sire_responses[0] if sire_responses else None

        return SireRankingResponse(
            sires=sire_responses,
            total_sires_evaluated=len(sires),
            top_sire_code=top_sire.sire_code if top_sire else None,
            top_sire_name=top_sire.name if top_sire else None,
            average_sire_total_yield_kg=round(avg_yield, 1),
        )

    def get_cow_genetic_profile(self, user_id: str, cow_id: str) -> CowGeneticProfileResponse:
        """Generate genetic evaluation profile for an individual cow."""
        cow = self.db.get(Cow, cow_id)
        if not cow:
            raise ValueError(f"Cow {cow_id} not found.")

        if cow.owner_id != user_id:
            # Check if user is a member of the farm
            farm = self.db.get(Farm, cow.farm_id)
            if not farm or (farm.created_by != user_id and cow.created_by != user_id):
                raise PermissionError(f"User {user_id} not authorized for cow {cow_id}")

        cow_name = cow.name or f"Cow {cow.tag_id}"

        # Breed string resolution
        breed_str = "Unknown Breed"
        if cow.breed:
            if hasattr(cow.breed, "canonical_name"):
                breed_str = cow.breed.canonical_name
            elif hasattr(cow.breed, "name"):
                breed_str = cow.breed.name
            else:
                breed_str = str(cow.breed)

        # Actual average yield from observations
        obs_avg = (
            self.db.query(func.avg(DailyObservation.milk_produced_liters))
            .filter(DailyObservation.cow_id == cow.id)
            .scalar()
        )
        actual_avg = round(float(obs_avg), 1) if obs_avg is not None else None

        # Pedigree & Sire Evaluation
        sire = cow.sire
        breeding_insights: list[str] = []

        if sire:
            pedigree_status = "Verified Sire Pedigree"
            pedigree_confidence = "High"
            sire_daily_potential = (sire.total_milk_yield_kg or 11000.0) / 305.0
            estimated_potential = round(sire_daily_potential, 1)
            genetic_rating = round(sire.genetic_merit_score, 1)

            breeding_insights.append(
                f"Sired by {sire.name} ({sire.sire_code}) with a proven 305-day yield rating of {sire.total_milk_yield_kg:,.0f} kg."
            )
            if actual_avg and actual_avg >= estimated_potential:
                breeding_insights.append(
                    f"{cow_name} is performing at or above her sire's genetic potential ({actual_avg} L/day vs {estimated_potential} L baseline)."
                )
            elif actual_avg:
                breeding_insights.append(
                    f"{cow_name}'s actual yield ({actual_avg} L/day) has room to grow toward her sire potential ({estimated_potential} L/day) with optimized nutrition."
                )
            breeding_insights.append("High-confidence genetic profile suitable for selecting replacement heifers.")
        else:
            pedigree_status = "Estimated from Breed Baseline"
            pedigree_confidence = "Medium"
            estimated_potential = 24.5
            genetic_rating = 75.0

            breeding_insights.append(
                f"Sire pedigree is not recorded for {cow_name}. Potential is estimated based on {breed_str} breed averages."
            )
            breeding_insights.append(
                "Recording sire pedigree for future calves will enable high-accuracy Genetic Merit Rankings."
            )

        return CowGeneticProfileResponse(
            cow_id=cow.id,
            cow_name=cow_name,
            tag_id=cow.tag_id,
            breed_name=breed_str,
            sire_id=cow.sire_id,
            sire_code=sire.sire_code if sire else None,
            sire_name=sire.name if sire else None,
            dam_name=cow.dam_name,
            pedigree_status=pedigree_status,
            pedigree_confidence=pedigree_confidence,
            estimated_genetic_potential_l=estimated_potential,
            actual_avg_daily_yield_l=actual_avg,
            genetic_merit_rating=genetic_rating,
            breeding_insights=breeding_insights,
        )

    def get_herd_genetics_summary(self, user_id: str, farm_id: Optional[str] = None) -> HerdGeneticsSummaryResponse:
        """Compute herd-level genetics summary and top sire lines."""
        query = self.db.query(Cow).filter(Cow.owner_id == user_id, Cow.status == "active")
        if farm_id:
            query = query.filter(Cow.farm_id == farm_id)

        cows = query.all()

        profiles: list[CowGeneticProfileResponse] = []
        pedigree_count = 0
        total_score_sum = 0.0

        sire_line_counts: dict[str, int] = {}
        distribution = {
            "Top Tier (90+)": 0,
            "Above Average (80-89)": 0,
            "Average (70-79)": 0,
            "Baseline (<70)": 0,
        }

        for c in cows:
            try:
                prof = self.get_cow_genetic_profile(user_id, c.id)
                profiles.append(prof)

                if prof.sire_id:
                    pedigree_count += 1
                    sire_name = prof.sire_name or "Unknown Sire"
                    sire_line_counts[sire_name] = sire_line_counts.get(sire_name, 0) + 1

                total_score_sum += prof.genetic_merit_rating

                score = prof.genetic_merit_rating
                if score >= 90:
                    distribution["Top Tier (90+)"] += 1
                elif score >= 80:
                    distribution["Above Average (80-89)"] += 1
                elif score >= 70:
                    distribution["Average (70-79)"] += 1
                else:
                    distribution["Baseline (<70)"] += 1
            except Exception as e:
                logger.warning(f"Could not calculate genetic profile for cow {c.id}: {e}")

        avg_score = round(total_score_sum / len(cows), 1) if cows else 75.0

        top_sire_lines = [
            {"sire_name": name, "offspring_count": cnt}
            for name, cnt in sorted(sire_line_counts.items(), key=lambda x: x[1], reverse=True)
        ]

        return HerdGeneticsSummaryResponse(
            total_cows=len(cows),
            cows_with_pedigree_count=pedigree_count,
            average_herd_genetic_score=avg_score,
            top_genetic_sire_lines=top_sire_lines,
            herd_genetic_distribution=distribution,
            cow_profiles=profiles,
        )
