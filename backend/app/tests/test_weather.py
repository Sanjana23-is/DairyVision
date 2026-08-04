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
