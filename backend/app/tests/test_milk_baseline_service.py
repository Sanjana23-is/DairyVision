from datetime import date, timedelta
from uuid import uuid4
import pytest
from sqlalchemy.orm import Session

from app.models import User, Farm, Cow, DailyObservation
from app.services.milk_baseline_service import MilkBaselineService, BaselineStatus


def _setup_cow(session: Session) -> tuple[User, Farm, Cow]:
    user_id = str(uuid4())
    user = User(id=user_id, email=f"user_{user_id}@example.com", full_name="Baseline Tester")
    session.add(user)
    session.flush()

    farm = Farm(id=str(uuid4()), name="Baseline Farm", created_by=user.id, latitude=12.97, longitude=77.59)
    session.add(farm)
    session.flush()

    cow = Cow(id=str(uuid4()), farm_id=farm.id, tag_id="COW-BASE-1", owner_id=user.id, created_by=user.id, age_months=48, weight_kg=480.0)
    session.add(cow)
    session.commit()
    return user, farm, cow


def test_zero_historical_observations_insufficient_history(db_session: Session):
    user, farm, cow = _setup_cow(db_session)
    svc = MilkBaselineService(db_session)

    today = date(2026, 10, 10)
    result = svc.compute_cow_baseline(cow.id, today)

    assert result.baseline_status == BaselineStatus.INSUFFICIENT_HISTORY
    assert result.expected_baseline is None
    assert result.observations_used == 0
    assert result.previous_day_yield is None
    assert "No prior milk production records found" in result.explanation


def test_one_observation_provisional_baseline(db_session: Session):
    user, farm, cow = _setup_cow(db_session)
    today = date(2026, 10, 10)

    obs = DailyObservation(
        id=str(uuid4()),
        cow_id=cow.id,
        owner_id=user.id,
        observation_date=today - timedelta(days=1),
        milk_produced_liters=18.5,
    )
    db_session.add(obs)
    db_session.commit()

    svc = MilkBaselineService(db_session)
    result = svc.compute_cow_baseline(cow.id, today)

    assert result.baseline_status == BaselineStatus.PROVISIONAL_BASELINE
    assert result.expected_baseline == 18.50
    assert result.observations_used == 1
    assert result.previous_day_yield == 18.50
    assert "Provisional baseline" in result.explanation


def test_two_observations_provisional_baseline(db_session: Session):
    user, farm, cow = _setup_cow(db_session)
    today = date(2026, 10, 10)

    for i, yield_val in enumerate([18.0, 19.0], start=1):
        obs = DailyObservation(
            id=str(uuid4()),
            cow_id=cow.id,
            owner_id=user.id,
            observation_date=today - timedelta(days=i),
            milk_produced_liters=yield_val,
        )
        db_session.add(obs)
    db_session.commit()

    svc = MilkBaselineService(db_session)
    result = svc.compute_cow_baseline(cow.id, today)

    assert result.baseline_status == BaselineStatus.PROVISIONAL_BASELINE
    assert result.expected_baseline == 18.50  # median(18, 19) = 18.5
    assert result.observations_used == 2
    assert result.previous_day_yield == 18.0  # yesterday's yield (days=1)


def test_three_observations_established_boundary(db_session: Session):
    user, farm, cow = _setup_cow(db_session)
    today = date(2026, 10, 10)

    for i, yield_val in enumerate([18.0, 18.4, 18.2], start=1):
        obs = DailyObservation(
            id=str(uuid4()),
            cow_id=cow.id,
            owner_id=user.id,
            observation_date=today - timedelta(days=i),
            milk_produced_liters=yield_val,
        )
        db_session.add(obs)
    db_session.commit()

    svc = MilkBaselineService(db_session, min_observations=3)
    result = svc.compute_cow_baseline(cow.id, today)

    assert result.baseline_status == BaselineStatus.ESTABLISHED_BASELINE
    assert result.expected_baseline == 18.20  # median([18.0, 18.4, 18.2]) = 18.2
    assert result.observations_used == 3
    assert result.historical_variability is not None
    assert result.historical_variability >= 0.50  # variability floor


def test_rolling_seven_day_median_robustness_to_outliers(db_session: Session):
    user, farm, cow = _setup_cow(db_session)
    today = date(2026, 10, 10)

    # 6 typical days around 18 L and 1 extreme reporting error / outlier day (45.0 L)
    yields = [18.0, 18.2, 17.8, 45.0, 18.1, 17.9, 18.3]
    for i, yield_val in enumerate(yields, start=1):
        obs = DailyObservation(
            id=str(uuid4()),
            cow_id=cow.id,
            owner_id=user.id,
            observation_date=today - timedelta(days=i),
            milk_produced_liters=yield_val,
        )
        db_session.add(obs)
    db_session.commit()

    svc = MilkBaselineService(db_session)
    result = svc.compute_cow_baseline(cow.id, today)

    assert result.baseline_status == BaselineStatus.ESTABLISHED_BASELINE
    assert result.observations_used == 7
    # Mean is (18.0+18.2+17.8+45.0+18.1+17.9+18.3)/7 = 21.9 L (distorted!)
    # Median is sorted: [17.8, 17.9, 18.0, 18.1, 18.2, 18.3, 45.0] -> 18.10 L
    assert result.expected_baseline == 18.10
    assert result.previous_day_yield == 18.0


def test_zero_variability_floor_prevention_of_div_zero(db_session: Session):
    user, farm, cow = _setup_cow(db_session)
    today = date(2026, 10, 10)

    # All identical yields
    for i in range(1, 6):
        obs = DailyObservation(
            id=str(uuid4()),
            cow_id=cow.id,
            owner_id=user.id,
            observation_date=today - timedelta(days=i),
            milk_produced_liters=20.0,
        )
        db_session.add(obs)
    db_session.commit()

    svc = MilkBaselineService(db_session)
    result = svc.compute_cow_baseline(cow.id, today)

    assert result.expected_baseline == 20.00
    # Raw MAD is 0.0, but historical_variability must be clamped to the minimum floor
    assert result.historical_variability == svc.MIN_VARIABILITY_FLOOR_LITERS


def test_duplicate_observations_same_date_de_duplicated(db_session: Session):
    user, farm, cow = _setup_cow(db_session)
    today = date(2026, 10, 10)

    # 2 observations on day -1 (e.g. 17.0 and 19.0)
    for y in [17.0, 19.0]:
        obs = DailyObservation(
            id=str(uuid4()),
            cow_id=cow.id,
            owner_id=user.id,
            observation_date=today - timedelta(days=1),
            milk_produced_liters=y,
        )
        db_session.add(obs)
    # 2 other days
    for d, y in [(2, 18.0), (3, 18.5)]:
        obs = DailyObservation(
            id=str(uuid4()),
            cow_id=cow.id,
            owner_id=user.id,
            observation_date=today - timedelta(days=d),
            milk_produced_liters=y,
        )
        db_session.add(obs)
    db_session.commit()

    svc = MilkBaselineService(db_session)
    result = svc.compute_cow_baseline(cow.id, today)

    # Exact de-duplication must keep 3 unique dates, not 4 records
    assert result.observations_used == 3
    assert any("Duplicate observation detected" in w for w in result.data_quality_warnings)


def test_target_date_and_future_leakage_strictly_prevented(db_session: Session):
    user, farm, cow = _setup_cow(db_session)
    today = date(2026, 10, 10)

    # 3 past days (10.0, 10.0, 10.0)
    for i in range(1, 4):
        db_session.add(
            DailyObservation(
                id=str(uuid4()),
                cow_id=cow.id,
                owner_id=user.id,
                observation_date=today - timedelta(days=i),
                milk_produced_liters=10.0,
            )
        )
    # Today's observation (25.0) - must NEVER leak into baseline for today!
    db_session.add(
        DailyObservation(
            id=str(uuid4()),
            cow_id=cow.id,
            owner_id=user.id,
            observation_date=today,
            milk_produced_liters=25.0,
        )
    )
    # Future observation (30.0) - must NEVER leak!
    db_session.add(
        DailyObservation(
            id=str(uuid4()),
            cow_id=cow.id,
            owner_id=user.id,
            observation_date=today + timedelta(days=1),
            milk_produced_liters=30.0,
        )
    )
    db_session.commit()

    svc = MilkBaselineService(db_session)
    result = svc.compute_cow_baseline(cow.id, today)

    assert result.expected_baseline == 10.00
    assert result.observations_used == 3
    # Check that neither 25.0 nor 30.0 appears in history
    history_yields = [h["milk_yield"] for h in result.observations_history]
    assert 25.0 not in history_yields
    assert 30.0 not in history_yields


def test_multi_cow_data_isolation(db_session: Session):
    user, farm, cow1 = _setup_cow(db_session)
    cow2 = Cow(
        id=str(uuid4()),
        farm_id=farm.id,
        tag_id="COW-BASE-2",
        owner_id=user.id,
        created_by=user.id,
        age_months=60,
        weight_kg=520.0,
    )
    db_session.add(cow2)
    db_session.commit()

    today = date(2026, 10, 10)

    # Cow 1 has 3 observations around 12 L
    for i in range(1, 4):
        db_session.add(
            DailyObservation(
                id=str(uuid4()),
                cow_id=cow1.id,
                owner_id=user.id,
                observation_date=today - timedelta(days=i),
                milk_produced_liters=12.0,
            )
        )

    # Cow 2 has 3 observations around 25 L
    for i in range(1, 4):
        db_session.add(
            DailyObservation(
                id=str(uuid4()),
                cow_id=cow2.id,
                owner_id=user.id,
                observation_date=today - timedelta(days=i),
                milk_produced_liters=25.0,
            )
        )
    db_session.commit()

    svc = MilkBaselineService(db_session)
    res1 = svc.compute_cow_baseline(cow1.id, today)
    res2 = svc.compute_cow_baseline(cow2.id, today)

    assert res1.expected_baseline == 12.00
    assert res2.expected_baseline == 25.00
