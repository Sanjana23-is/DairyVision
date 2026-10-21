from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
import httpx

from app.services.indian_locations import get_all_states, get_districts_for_state

logger = logging.getLogger(__name__)


class LocationService:
    OPEN_METEO_GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
    NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"

    def __init__(self, client: Optional[httpx.Client] = None) -> None:
        self.client = client or httpx.Client(timeout=8.0)

    def list_states(self) -> List[str]:
        return get_all_states()

    def list_districts(self, state: str) -> List[str]:
        return get_districts_for_state(state)

    def search_locations(
        self,
        query: str,
        state: Optional[str] = None,
        district: Optional[str] = None,
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        """Search Indian administrative locations (villages, taluks, towns, cities) using Open-Meteo Geocoding.

        Filters and ranks matches within the selected state and district when provided.
        """
        clean_q = query.strip()
        if not clean_q:
            return []

        search_term = clean_q
        params: Dict[str, Any] = {
            "name": search_term,
            "count": min(limit * 2, 20),
            "format": "json",
            "country_code": "IN",
        }

        results: List[Dict[str, Any]] = []
        try:
            resp = self.client.get(self.OPEN_METEO_GEOCODE_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
            raw_results = data.get("results", [])
        except Exception as exc:
            logger.warning("Open-Meteo location search failed for '%s': %s", clean_q, exc)
            raw_results = []

        # If Open-Meteo returns no results and district/state provided, try combining
        if not raw_results and (district or state):
            combined_query = f"{clean_q}, {district or state}, India"
            try:
                resp = self.client.get(
                    "https://nominatim.openstreetmap.org/search",
                    params={"q": combined_query, "format": "json", "countrycodes": "in", "limit": limit},
                    headers={"User-Agent": "DairyVisionAI/1.0"},
                )
                if resp.status_code == 200:
                    for item in resp.json():
                        lat = float(item["lat"])
                        lon = float(item["lon"])
                        disp = item.get("display_name", "")
                        parts = [p.strip() for p in disp.split(",")]
                        name = parts[0] if parts else clean_q
                        results.append({
                            "name": name,
                            "taluk": district or "",
                            "district": district or "",
                            "state": state or "",
                            "country": "India",
                            "latitude": lat,
                            "longitude": lon,
                            "display_name": disp,
                        })
                    return results[:limit]
            except Exception as e:
                logger.warning("Nominatim fallback search failed: %s", e)

        for item in raw_results:
            item_country = str(item.get("country", "")).lower()
            item_code = str(item.get("country_code", "")).lower()
            if item_country != "india" and item_code != "in":
                continue

            item_state = item.get("admin1") or ""
            item_district = item.get("admin2") or ""
            item_taluk = item.get("admin3") or ""
            name = item.get("name") or clean_q

            # Filter by state if provided
            if state and item_state:
                if state.lower() not in item_state.lower() and item_state.lower() not in state.lower():
                    continue

            # Filter by district if provided
            if district and item_district:
                if district.lower() not in item_district.lower() and item_district.lower() not in district.lower():
                    # Check if taluk matches district
                    if district.lower() not in item_taluk.lower():
                        continue

            lat = float(item["latitude"])
            lon = float(item["longitude"])

            # Build readable address
            parts = [name]
            if item_taluk and item_taluk != name:
                parts.append(item_taluk)
            if item_district and item_district != item_taluk:
                parts.append(item_district)
            if item_state:
                parts.append(item_state)
            parts.append("India")

            display_name = ", ".join(parts)

            results.append({
                "name": name,
                "taluk": item_taluk,
                "district": item_district,
                "state": item_state,
                "country": "India",
                "latitude": lat,
                "longitude": lon,
                "display_name": display_name,
            })

        return results[:limit]

    def reverse_geocode(self, latitude: float, longitude: float) -> Dict[str, Any]:
        """Convert GPS coordinates into state, district, taluk, village/city, and readable address."""
        if not (-90 <= latitude <= 90) or not (-180 <= longitude <= 180):
            raise ValueError("Coordinates out of range")

        try:
            resp = self.client.get(
                self.NOMINATIM_REVERSE_URL,
                params={"lat": latitude, "lon": longitude, "format": "json"},
                headers={"User-Agent": "DairyVisionAI/1.0"},
            )
            resp.raise_for_status()
            data = resp.json()
            address = data.get("address", {})

            village = (
                address.get("village")
                or address.get("town")
                or address.get("suburb")
                or address.get("city")
                or address.get("hamlet")
                or address.get("neighbourhood")
                or ""
            )
            taluk = (
                address.get("county")
                or address.get("subdistrict")
                or address.get("tehsil")
                or address.get("taluk")
                or ""
            )
            district = (
                address.get("state_district")
                or address.get("district")
                or ""
            )
            state = address.get("state") or ""
            country = address.get("country") or "India"

            parts = [p for p in [village, taluk, district, state, country] if p]
            display_name = data.get("display_name") or ", ".join(parts)

            return {
                "latitude": latitude,
                "longitude": longitude,
                "village": village,
                "taluk": taluk,
                "district": district,
                "state": state,
                "country": country,
                "display_name": display_name,
            }
        except Exception as exc:
            logger.warning("Reverse geocoding failed for (%f, %f): %s", latitude, longitude, exc)
            return {
                "latitude": latitude,
                "longitude": longitude,
                "village": "",
                "taluk": "",
                "district": "",
                "state": "",
                "country": "India",
                "display_name": f"{latitude:.6f}, {longitude:.6f}",
            }
