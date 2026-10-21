from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.services.location_service import LocationService

router = APIRouter(prefix="/locations", tags=["locations"])


class LocationSearchResult(BaseModel):
    name: str
    taluk: Optional[str] = ""
    district: Optional[str] = ""
    state: Optional[str] = ""
    country: str = "India"
    latitude: float
    longitude: float
    display_name: str


class ReverseGeocodeRequest(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)


class ReverseGeocodeResult(BaseModel):
    latitude: float
    longitude: float
    village: Optional[str] = ""
    taluk: Optional[str] = ""
    district: Optional[str] = ""
    state: Optional[str] = ""
    country: str = "India"
    display_name: str


def get_location_service() -> LocationService:
    return LocationService()


@router.get("/states", response_model=List[str])
def list_states() -> List[str]:
    """Return list of all official Indian states and union territories."""
    return get_location_service().list_states()


@router.get("/districts", response_model=List[str])
def list_districts(state: str = Query(..., description="Indian state name")) -> List[str]:
    """Return official districts filtered by the selected Indian state."""
    districts = get_location_service().list_districts(state)
    return districts


@router.get("/search", response_model=List[LocationSearchResult])
def search_locations(
    q: str = Query(..., min_length=2, description="Place, village, taluk, or city name"),
    state: Optional[str] = Query(None, description="Optional state filter"),
    district: Optional[str] = Query(None, description="Optional district filter"),
    limit: int = Query(10, ge=1, le=25),
) -> List[LocationSearchResult]:
    """Search Indian locations and resolve them into coordinates and administrative hierarchy."""
    service = get_location_service()
    return service.search_locations(query=q, state=state, district=district, limit=limit)


@router.post("/reverse-geocode", response_model=ReverseGeocodeResult)
def reverse_geocode(payload: ReverseGeocodeRequest) -> ReverseGeocodeResult:
    """Resolve browser device GPS coordinates into state, district, taluk, and village."""
    service = get_location_service()
    try:
        return service.reverse_geocode(payload.latitude, payload.longitude)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
