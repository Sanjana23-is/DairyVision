from uuid import uuid4

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models import Farm, User, WeatherLog
from app.schemas.weather import WeatherCreate
from app.services.weather_service import WeatherService


def _create_user_and_farm(session: Session) -> tuple[str, str]:
    user_id = str(uuid4())
    user = User(id=user_id, email=f"user+{user_id}@example.com", full_name="Weather User")
    session.add(user)
    session.flush()

    farm = Farm(id=str(uuid4()), name="Weather Farm", timezone="UTC", created_by=user.id, latitude=12.34, longitude=56.78)
    session.add(farm)
    session.commit()
    return user.id, farm.id


def test_create_weather_log_with_snapshot_if_missing_values(db_session: Session) -> None:
    user_id, farm_id = _create_user_and_farm(db_session)
    service = WeatherService(db_session)

    recorded_at = datetime.now(timezone.utc)
    payload = WeatherCreate(farm_id=farm_id, recorded_at=recorded_at)

    weather_log = service.create_weather_log(user_id, payload)

    assert weather_log.farm_id == farm_id
    assert weather_log.temperature is not None
    assert weather_log.humidity is not None
    assert weather_log.thi is not None
    assert weather_log.owner_id == user_id


def test_get_or_create_nearest_snapshot_reuses_existing_entry(db_session: Session) -> None:
    user_id, farm_id = _create_user_and_farm(db_session)
    service = WeatherService(db_session)

    recorded_at = datetime.now(timezone.utc)
    weather_log = WeatherLog(
        id=str(uuid4()),
        farm_id=farm_id,
        temperature=20.0,
        humidity=50.0,
        rainfall=0.0,
        wind_speed=5.0,
        pressure=1013.0,
        cloud_cover=20.0,
        thi=65.5,
        recorded_at=recorded_at,
        owner_id=user_id,
    )
    db_session.add(weather_log)
    db_session.commit()

    snapshot = service.get_or_create_nearest_snapshot(user_id, farm_id, recorded_at + timedelta(minutes=10))

    assert snapshot.id == weather_log.id
    assert snapshot.farm_id == farm_id


def test_create_weather_log_rejects_other_user_farm(db_session: Session) -> None:
    user_id, farm_id = _create_user_and_farm(db_session)
    other_user_id = str(uuid4())
    other_user = User(id=other_user_id, email=f"other+{other_user_id}@example.com", full_name="Other User")
    db_session.add(other_user)
    db_session.commit()

    service = WeatherService(db_session)
    payload = WeatherCreate(farm_id=farm_id, recorded_at=datetime.now(timezone.utc))

    try:
        service.create_weather_log(other_user_id, payload)
        assert False, "Expected PermissionError for unauthorized farm"
    except PermissionError:
        pass


def test_weather_response_includes_thi(db_session: Session) -> None:
    # Create a WeatherLog and ensure WeatherResponse includes the persisted `thi` value
    from app.schemas.weather import WeatherResponse

    user_id, farm_id = _create_user_and_farm(db_session)
    weather_log = WeatherLog(
        id=str(uuid4()),
        farm_id=farm_id,
        temperature=22.0,
        humidity=55.0,
        rainfall=0.0,
        wind_speed=3.0,
        pressure=1012.0,
        cloud_cover=10.0,
        thi=66.42,
        recorded_at=datetime.now(timezone.utc),
        owner_id=user_id,
    )
    db_session.add(weather_log)
    db_session.commit()

    resp = WeatherResponse.model_validate(weather_log)
    assert resp.thi == 66.42


def test_auto_geocodes_farm_without_coordinates_and_persists_lat_lon(db_session: Session) -> None:
    from unittest.mock import MagicMock
    from app.services.weather_provider import WeatherProvider, WeatherSnapshot

    user_id = str(uuid4())
    user = User(id=user_id, email=f"user+{user_id}@example.com", full_name="Geocode User")
    db_session.add(user)
    db_session.flush()

    farm = Farm(
        id=str(uuid4()),
        name="Geocode Farm",
        location_city="Pune",
        location_country="India",
        timezone="UTC",
        created_by=user.id,
        latitude=None,
        longitude=None,
    )
    db_session.add(farm)
    db_session.commit()

    mock_provider = MagicMock(spec=WeatherProvider)
    mock_provider.geocode_location.return_value = (18.5204, 73.8567)
    mock_provider.fetch_snapshot.return_value = WeatherSnapshot(
        temperature=28.0,
        humidity=65.0,
        rainfall=0.0,
        wind_speed=4.0,
        pressure=1010.0,
        cloud_cover=20.0,
    )

    service = WeatherService(db_session, provider=mock_provider)
    target_time = datetime.now(timezone.utc)
    weather_log = service.get_or_create_nearest_snapshot(user_id, farm.id, target_time)

    mock_provider.geocode_location.assert_called_once_with("Pune", "India")
    mock_provider.fetch_snapshot.assert_called_once()

    # Verify coordinates were persisted back to the farm in DB
    reloaded_farm = db_session.get(Farm, farm.id)
    assert float(reloaded_farm.latitude) == 18.5204
    assert float(reloaded_farm.longitude) == 73.8567
    assert weather_log.id is not None




def test_geocoding_failure_raises_weather_not_found_without_fake_coords(db_session: Session) -> None:
    from unittest.mock import MagicMock
    from app.exceptions import WeatherNotFound
    from app.services.weather_provider import WeatherProvider

    user_id = str(uuid4())
    user = User(id=user_id, email=f"user+{user_id}@example.com", full_name="Failed Geocode User")
    db_session.add(user)
    db_session.flush()

    farm = Farm(
        id=str(uuid4()),
        name="Unknown Farm",
        location_city="UnknownCity12345",
        location_country="UnknownCountry",
        timezone="UTC",
        created_by=user.id,
        latitude=None,
        longitude=None,
    )
    db_session.add(farm)
    db_session.commit()

    mock_provider = MagicMock(spec=WeatherProvider)
    mock_provider.geocode_location.return_value = None

    service = WeatherService(db_session, provider=mock_provider)
    target_time = datetime.now(timezone.utc)

    try:
        service.get_or_create_nearest_snapshot(user_id, farm.id, target_time)
        assert False, "Expected WeatherNotFound"
    except WeatherNotFound:
        pass

    # Verify coordinates remain None (no fake coordinates created)
    reloaded_farm = db_session.get(Farm, farm.id)
    assert reloaded_farm.latitude is None
    assert reloaded_farm.longitude is None


def test_historical_vs_forecast_weather_api_selection() -> None:
    from unittest.mock import MagicMock
    import httpx
    from app.services.weather_provider import OpenMeteoWeatherProvider

    mock_client = MagicMock(spec=httpx.Client)
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "hourly": {
            "time": ["2024-01-01T12:00"],
            "temperature_2m": [20.0],
            "relativehumidity_2m": [50.0],
            "rain": [0.0],
            "windspeed_10m": [5.0],
            "surface_pressure": [1013.0],
            "cloudcover": [10.0],
        }
    }
    mock_client.get.return_value = mock_response

    provider = OpenMeteoWeatherProvider(client=mock_client)
    farm = Farm(id="f1", name="Test", latitude=12.34, longitude=56.78)

    # 1. Historical date (e.g. 30 days ago)
    historical_date = datetime.now(timezone.utc) - timedelta(days=30)
    provider.fetch_snapshot(farm, historical_date)
    args, _ = mock_client.get.call_args
    assert args[0] == OpenMeteoWeatherProvider.ARCHIVE_API_URL

    # 2. Recent/today date
    recent_date = datetime.now(timezone.utc)
    provider.fetch_snapshot(farm, recent_date)
    args, _ = mock_client.get.call_args
    assert args[0] == OpenMeteoWeatherProvider.FORECAST_API_URL
