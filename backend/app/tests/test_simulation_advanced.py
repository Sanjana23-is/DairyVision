from datetime import date, datetime, timezone
from uuid import uuid4

import pytest
from sqlalchemy.orm import Session

from app.models import Cow, DailyObservation, User, Farm, HealthAlert, WeatherLog
from app.schemas.what_if import HerdWhatIfRequest, CowWhatIfRequest, SimulationInput
from app.services.what_if_service import WhatIfService


def test_herd_what_if_simulation(db_session: Session, tmp_path):
    user_id = str(uuid4())
    user = User(id=user_id, email=f"sim_{user_id}@example.com", full_name="Sim Tester")
    farm = Farm(id=str(uuid4()), name="Sim Farm", latitude=12.9716, longitude=77.5946, created_by=user_id)

    cow1 = Cow(
        id=str(uuid4()),
        farm_id=farm.id,
        tag_id="SIM-01",
        name="Sim Cow 1",
        birth_date=date(2020, 1, 1),
        weight_kg=550.0,
        owner_id=user_id,
        created_by=user_id,
    )
    cow2 = Cow(
        id=str(uuid4()),
        farm_id=farm.id,
        tag_id="SIM-02",
        name="Sim Cow 2",
        birth_date=date(2021, 1, 1),
        weight_kg=580.0,
        owner_id=user_id,
        created_by=user_id,
    )

    db_session.add_all([user, farm, cow1, cow2])
    db_session.commit()

    weather = WeatherLog(
        id=str(uuid4()),
        farm_id=farm.id,
        owner_id=user_id,
        temperature=28.0,
        humidity=65.0,
        thi=72.0,
        recorded_at=datetime.now(timezone.utc),
    )
    db_session.add(weather)
    db_session.commit()

    obs1 = DailyObservation(
        id=str(uuid4()),
        cow_id=cow1.id,
        owner_id=user_id,
        observation_date=date.today(),
        milk_produced_liters=25.0,
        feed_quantity_kg=22.0,
        body_temperature_c=38.5,
        weather_log_id=weather.id,
    )
    obs2 = DailyObservation(
        id=str(uuid4()),
        cow_id=cow2.id,
        owner_id=user_id,
        observation_date=date.today(),
        milk_produced_liters=30.0,
        feed_quantity_kg=24.0,
        body_temperature_c=38.6,
        weather_log_id=weather.id,
    )
    db_session.add_all([obs1, obs2])
    db_session.commit()

    obs_count_before = db_session.query(DailyObservation).count()
    alerts_count_before = db_session.query(HealthAlert).count()

    service = WhatIfService(db_session)
    request = HerdWhatIfRequest(
        farm_id=farm.id,
        scenario=SimulationInput(
            temperature_c=32.0,
            humidity_pct=75.0,
            cooling_intervention_thi_reduction=3.0,
        ),
    )

    res = service.run_herd_what_if(user_id, request)

    assert res.total_cows_simulated == 2
    assert len(res.cow_comparisons) == 2
    assert res.baseline_total_yield_l > 0
    assert res.simulated_total_yield_l > 0

    obs_count_after = db_session.query(DailyObservation).count()
    alerts_count_after = db_session.query(HealthAlert).count()
    assert obs_count_after == obs_count_before
    assert alerts_count_after == alerts_count_before


def test_cow_what_if_simulation(db_session: Session):
    user_id = str(uuid4())
    user = User(id=user_id, email=f"cow_sim_{user_id}@example.com", full_name="Cow Sim Tester")
    farm = Farm(id=str(uuid4()), name="Momo Farm", latitude=12.9716, longitude=77.5946, created_by=user_id)
    cow = Cow(
        id=str(uuid4()),
        farm_id=farm.id,
        tag_id="MOMO-01",
        name="Momo",
        birth_date=date(2020, 1, 1),
        weight_kg=550.0,
        owner_id=user_id,
        created_by=user_id,
    )
    db_session.add_all([user, farm, cow])
    db_session.commit()

    weather = WeatherLog(
        id=str(uuid4()),
        farm_id=farm.id,
        owner_id=user_id,
        temperature=28.0,
        humidity=65.0,
        thi=72.0,
        recorded_at=datetime.now(timezone.utc),
    )
    db_session.add(weather)
    db_session.commit()

    obs = DailyObservation(
        id=str(uuid4()),
        cow_id=cow.id,
        owner_id=user_id,
        observation_date=date.today(),
        milk_produced_liters=25.0,
        feed_quantity_kg=22.0,
        body_temperature_c=38.5,
        weather_log_id=weather.id,
    )
    db_session.add(obs)
    db_session.commit()

    service = WhatIfService(db_session)
    request = CowWhatIfRequest(
        scenario=SimulationInput(
            temperature_c=34.0,
            humidity_pct=75.0,
            cooling_intervention_thi_reduction=4.0,
        )
    )

    res = service.run_cow_what_if(user_id, cow.id, request)

    assert res.cow_id == cow.id
    assert res.cow_name == "Momo"
    assert res.tag_id == "MOMO-01"
    assert res.baseline_milk_yield_l > 0
    assert res.simulated_milk_yield_l > 0
    assert "Momo" in res.explanation_summary
    assert res.baseline_vitality_score > 0
    assert res.simulated_vitality_score > 0


def test_extrapolation_warning(db_session: Session):
    user_id = str(uuid4())
    user = User(id=user_id, email=f"extrap_{user_id}@example.com", full_name="Extrapolation Tester")
    farm = Farm(id=str(uuid4()), name="Extrap Farm", latitude=12.9716, longitude=77.5946, created_by=user_id)
    cow = Cow(
        id=str(uuid4()),
        farm_id=farm.id,
        tag_id="EX-01",
        name="Hot Cow",
        birth_date=date(2020, 1, 1),
        weight_kg=550.0,
        owner_id=user_id,
        created_by=user_id,
    )
    db_session.add_all([user, farm, cow])
    db_session.commit()

    weather = WeatherLog(
        id=str(uuid4()),
        farm_id=farm.id,
        owner_id=user_id,
        temperature=28.0,
        humidity=65.0,
        thi=72.0,
        recorded_at=datetime.now(timezone.utc),
    )
    db_session.add(weather)
    db_session.commit()

    obs = DailyObservation(
        id=str(uuid4()),
        cow_id=cow.id,
        owner_id=user_id,
        observation_date=date.today(),
        milk_produced_liters=25.0,
        body_temperature_c=38.5,
        weather_log_id=weather.id,
    )
    db_session.add(obs)
    db_session.commit()

    service = WhatIfService(db_session)
    request = HerdWhatIfRequest(
        farm_id=farm.id,
        scenario=SimulationInput(
            temperature_c=45.0,
        ),
    )

    res = service.run_herd_what_if(user_id, request)
    assert res.extrapolation_warning is True
