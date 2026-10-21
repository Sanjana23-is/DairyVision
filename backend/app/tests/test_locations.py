from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.models import User, Farm, Cow, DailyObservation
from app.services.indian_locations import get_all_states, get_districts_for_state
from app.services.location_service import LocationService


client = TestClient(app)


def test_indian_states_and_districts():
    states = get_all_states()
    assert len(states) >= 36
    assert "Karnataka" in states
    assert "Maharashtra" in states
    assert "Punjab" in states
    assert "Gujarat" in states

    ka_districts = get_districts_for_state("Karnataka")
    assert "Bengaluru Urban" in ka_districts
    assert "Mysuru" in ka_districts
    assert "Belagavi" in ka_districts

    mh_districts = get_districts_for_state("Maharashtra")
    assert "Pune" in mh_districts
    assert "Nashik" in mh_districts

    # Case-insensitive
    assert len(get_districts_for_state("karnataka")) == len(ka_districts)
    # Nonexistent
    assert get_districts_for_state("NonExistentState123") == []


def test_location_service_search_open_meteo():
    mock_client = MagicMock()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "results": [
            {
                "name": "Baramati",
                "latitude": 18.15174,
                "longitude": 74.57767,
                "country": "India",
                "country_code": "IN",
                "admin1": "Maharashtra",
                "admin2": "Pune",
                "admin3": "Baramati",
            }
        ]
    }
    mock_client.get.return_value = mock_resp

    service = LocationService(client=mock_client)
    results = service.search_locations(query="Baramati", state="Maharashtra", district="Pune")
    assert len(results) == 1
    assert results[0]["name"] == "Baramati"
    assert results[0]["state"] == "Maharashtra"
    assert results[0]["district"] == "Pune"
    assert results[0]["latitude"] == 18.15174
    assert results[0]["longitude"] == 74.57767


def test_location_service_reverse_geocode():
    mock_client = MagicMock()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "display_name": "Kengeri, Bangalore South, Bengaluru Urban, Karnataka, 560060, India",
        "address": {
            "suburb": "Kengeri",
            "county": "Bangalore South",
            "state_district": "Bengaluru Urban",
            "state": "Karnataka",
            "country": "India",
        },
    }
    mock_client.get.return_value = mock_resp

    service = LocationService(client=mock_client)
    res = service.reverse_geocode(12.91218, 77.4827)
    assert res["village"] == "Kengeri"
    assert res["taluk"] == "Bangalore South"
    assert res["district"] == "Bengaluru Urban"
    assert res["state"] == "Karnataka"
    assert res["country"] == "India"


def test_location_endpoints():
    # 1. States endpoint
    resp = client.get("/api/v1/locations/states")
    assert resp.status_code == 200
    states = resp.json()
    assert "Karnataka" in states
    assert "Gujarat" in states

    # 2. Districts endpoint
    resp = client.get("/api/v1/locations/districts", params={"state": "Karnataka"})
    assert resp.status_code == 200
    districts = resp.json()
    assert "Bengaluru Urban" in districts

    # 3. Invalid reverse geocode coordinates
    resp = client.post("/api/v1/locations/reverse-geocode", json={"latitude": 999.0, "longitude": 999.0})
    assert resp.status_code == 422


def test_location_service_open_meteo_timeout_and_error_fallback():
    import httpx
    # Test timeout error in Open-Meteo falls back to Nominatim without crashing
    mock_client = MagicMock()
    # First call (Open-Meteo) raises TimeoutException
    mock_client.get.side_effect = [
        httpx.TimeoutException("Connection timed out"),
        # Second call (Nominatim fallback)
        MagicMock(status_code=200, json=lambda: [
            {
                "name": "Khed",
                "lat": "18.8456",
                "lon": "73.8912",
                "display_name": "Khed, Pune, Maharashtra, India",
                "address": {
                    "town": "Khed",
                    "county": "Pune",
                    "state": "Maharashtra",
                    "country": "India"
                }
            }
        ])
    ]

    service = LocationService(client=mock_client)
    results = service.search_locations(query="Khed", state="Maharashtra")
    assert len(results) >= 1
    assert results[0]["name"] == "Khed"
    assert results[0]["latitude"] == 18.8456


def test_location_service_empty_query_and_missing_data():
    service = LocationService()
    # Empty or single character query returns empty list
    assert service.search_locations("") == []
    assert service.search_locations("a") == []
    assert service.search_locations("   ") == []


def test_location_service_ambiguous_matches():
    mock_client = MagicMock()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "results": [
            {
                "name": "Anand",
                "latitude": 22.5645,
                "longitude": 72.9289,
                "country": "India",
                "admin1": "Gujarat",
                "admin2": "Anand",
            },
            {
                "name": "Anand Nagar",
                "latitude": 19.1234,
                "longitude": 73.1234,
                "country": "India",
                "admin1": "Maharashtra",
                "admin2": "Thane",
            }
        ]
    }
    mock_client.get.return_value = mock_resp

    service = LocationService(client=mock_client)
    # Searching with state="Gujarat" filters out non-matching states
    results = service.search_locations(query="Anand", state="Gujarat")
    assert len(results) == 1
    assert results[0]["name"] == "Anand"
    assert results[0]["state"] == "Gujarat"


def test_weather_and_thi_integration_with_scientific_formula():
    from app.core.scientific import calculate_thi
    from app.services.weather_service import WeatherService

    # 1. Verify WeatherService uses the scientific utility
    temp = 32.0
    hum = 75.0
    scientific_thi = calculate_thi(temp, hum)
    service_thi = WeatherService.calculate_thi(temp, hum)
    assert scientific_thi == service_thi
    assert scientific_thi > 80.0  # Heat stress threshold

    # 2. None handling
    assert WeatherService.calculate_thi(None, 60.0) is None
    assert WeatherService.calculate_thi(25.0, None) is None

