from uuid import uuid4

from datetime import datetime, timedelta, timezone, date

from sqlalchemy.orm import Session

from app.models import User, Farm, Cow, DailyObservation, WeatherLog
from app.services.feature_engineering_service import FeatureEngineeringService


def _create_user_farm_cow(session: Session):
    user_id = str(uuid4())
    user = User(id=user_id, email=f'user+{user_id}@example.com', full_name='FE Test')
    session.add(user)
    session.flush()
    farm = Farm(id=str(uuid4()), name='FE Farm', timezone='UTC', created_by=user.id, latitude=10.0, longitude=20.0)
    session.add(farm)
    session.flush()
    cow = Cow(id=str(uuid4()), farm_id=farm.id, tag_id='TAG1', owner_id=user.id, created_by=user.id, age_months=54, weight_kg=550.0)
    session.add(cow)
    session.commit()
    return user, farm, cow


def test_complete_feature_generation(db_session: Session) -> None:
    user, farm, cow = _create_user_farm_cow(db_session)
    # create prior observations
    for i in range(1, 5):
        obs = DailyObservation(
            id=str(uuid4()),
            cow_id=cow.id,
            observation_date=(date.today() - timedelta(days=i)),
            milk_produced_liters=10.0 + i,
            owner_id=user.id,
        )
        db_session.add(obs)

    # create weather and current observation
    weather = WeatherLog(id=str(uuid4()), farm_id=farm.id, owner_id=user.id, temperature=22.0, humidity=55.0, thi=66.4, recorded_at=datetime.now(timezone.utc))
    db_session.add(weather)
    db_session.flush()

    cur_obs = DailyObservation(
        id=str(uuid4()),
        cow_id=cow.id,
        observation_date=date.today(),
        milk_produced_liters=12.0,
        owner_id=user.id,
        weather_log_id=weather.id,
        feed_quantity_kg=20.0,
    )
    db_session.add(cur_obs)
    db_session.commit()

    svc = FeatureEngineeringService(db_session)
    fv = svc.build_features_for_observation(user.id, cur_obs.id)

    # 54 months / 12.0 = 4.5 years
    assert fv.age == 4.5
    assert fv.weight == 550.0
    assert fv.thi == 66.4
    assert fv.temperature == 22.0
    assert fv.feed_weight_ratio == 20.0 / 550.0
    assert fv.age_weight_ratio == 4.5 / 550.0



def test_missing_weather_handling(db_session: Session) -> None:
    user, farm, cow = _create_user_farm_cow(db_session)
    obs = DailyObservation(id=str(uuid4()), cow_id=cow.id, observation_date=date.today(), owner_id=user.id)
    db_session.add(obs)
    db_session.commit()

    svc = FeatureEngineeringService(db_session)
    fv = svc.build_features_for_observation(user.id, obs.id)
    assert fv.thi is None
    assert fv.temperature is None
    assert fv.feed is None


def test_missing_history(db_session: Session) -> None:
    user, farm, cow = _create_user_farm_cow(db_session)
    obs = DailyObservation(id=str(uuid4()), cow_id=cow.id, observation_date=date.today(), owner_id=user.id)
    db_session.add(obs)
    db_session.commit()

    svc = FeatureEngineeringService(db_session)
    fv = svc.build_features_for_observation(user.id, obs.id)
    assert fv.feed is None
    assert fv.age is None or isinstance(fv.age, (int, float))


def test_invalid_ownership(db_session: Session) -> None:
    user, farm, cow = _create_user_farm_cow(db_session)
    other_user_id = str(uuid4())
    obs = DailyObservation(id=str(uuid4()), cow_id=cow.id, observation_date=date.today(), owner_id=user.id)
    db_session.add(obs)
    db_session.commit()

    svc = FeatureEngineeringService(db_session)
    try:
        svc.build_features_for_observation(other_user_id, obs.id)
        assert False, "Expected PermissionError"
    except PermissionError:
        pass
