from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import get_current_user_id
from app.schemas.genetics import (
    SireRankingResponse,
    CowGeneticProfileResponse,
    HerdGeneticsSummaryResponse,
)
from app.services.genetics_service import GeneticsService

router = APIRouter()


def get_genetics_service(db: Session = Depends(get_db)) -> GeneticsService:
    return GeneticsService(db)


@router.get("/genetics/sires", response_model=SireRankingResponse)
def get_sire_rankings(
    service: GeneticsService = Depends(get_genetics_service),
) -> SireRankingResponse:
    """Return canonical sire rankings and performance benchmarks."""
    return service.get_sire_rankings()


@router.get("/genetics/cow/{cow_id}", response_model=CowGeneticProfileResponse)
def get_cow_genetic_profile(
    cow_id: str,
    user_id: str = Depends(get_current_user_id),
    service: GeneticsService = Depends(get_genetics_service),
) -> CowGeneticProfileResponse:
    """Return genetic profile, pedigree status, and breeding insights for a cow."""
    try:
        return service.get_cow_genetic_profile(user_id=user_id, cow_id=cow_id)
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))


@router.get("/genetics/herd", response_model=HerdGeneticsSummaryResponse)
def get_herd_genetics_summary(
    farm_id: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user_id),
    service: GeneticsService = Depends(get_genetics_service),
) -> HerdGeneticsSummaryResponse:
    """Return herd genetics overview, pedigree statistics, and top sire lines."""
    return service.get_herd_genetics_summary(user_id=user_id, farm_id=farm_id)
