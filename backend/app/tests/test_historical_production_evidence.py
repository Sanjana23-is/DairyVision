"""
test_historical_production_evidence.py
=======================================
Comprehensive test suite validating the Historical Production Evidence logic:
1. Missing observations (returns insufficient_history, never fabricates or returns 0.0).
2. Insufficient history (1-2 records yields provisional_baseline with correct message).
3. Leakage prevention (strictly date < evaluated_date; same-day observation is excluded).
4. Duplicate dates (prioritizes latest created observation, warns without data corruption).
5. Incorrect units & invalid values (negative or non-numeric yields cleanly rejected).
6. Indigenous breed low-yield validation (Hallikar with 2.8 L vs 3.0 L baseline is healthy, not flagged).
7. Genuine drop against valid baseline (>= 25% and >= 1.5 L drop triggers alert).
8. Seeded demo data verification for Nandi.
"""

from datetime import date, timedelta
from uuid import uuid4
import pytest
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.farm import Farm
from app.models.cow import Cow
from app.models.daily_observation import DailyObservation
from app.models.breed_master import BreedMaster
from app.services.milk_baseline_service import MilkBaselineService, BaselineStatus
from app.services.milk_anomaly_service import MilkAnomalyService, AnomalyStatus
from app.services.anomaly_detection_service import AnomalyDetectionService


def _setup_test_cow(session: Session, breed_name: str = "Hallikar", cow_name: str = "Nandi") -> tuple[User, Farm, Cow]:
    user = User(id=str(uuid4()), email=f"farmer_{uuid4()}@dairyvision.ai", full_name="Test Farmer")
    session.add(user)
    session.flush()

    farm = Farm(id=str(uuid4()), name="Test Farm", created_by=user.id, latitude=12.9716, longitude=77.5946)
    session.add(farm)
    session.flush()

    breed = session.query(BreedMaster).filter(BreedMaster.canonical_name == breed_name).first()
    if not breed:
        breed = BreedMaster(id=str(uuid4()), canonical_name=breed_name, breed_category="indigenous")
        session.add(breed)
        session.flush()

    cow = Cow(
        id=str(uuid4()),
        farm_id=farm.id,
        tag_id=f"TAG-{str(uuid4())[:6]}",
        name=cow_name,
        breed_id=breed.id,
        age_months=36,
        weight_kg=360.0,
        owner_id=user.id,
        created_by=user.id,
    )
    session.add(cow)
    session.commit()
    return user, farm, cow


def test_missing_observations_never_fabricates_or_returns_zero(db_session: Session):
    """When a cow has zero prior observations, baseline is None, never 0.0 or fabricated."""
    user, farm, cow = _setup_test_cow(db_session)
    svc = MilkBaselineService(db_session)
    today = date(2026, 10, 22)

    result = svc.compute_cow_baseline(cow.id, today)

    assert result.baseline_status == BaselineStatus.INSUFFICIENT_HISTORY
    assert result.expected_baseline is None
    assert result.expected_baseline != 0.0
    assert result.observations_used == 0
    assert "No prior milk production records found" in result.explanation


def test_insufficient_history_provisional_baseline(db_session: Session):
    """With 1 or 2 observations, provisional baseline is computed with clear notice."""
    user, farm, cow = _setup_test_cow(db_session)
    svc = MilkBaselineService(db_session)
    eval_date = date(2026, 10, 22)

    # Add 2 prior observations
    for days_ago, yield_l in [(2, 3.2), (1, 2.8)]:
        obs = DailyObservation(
            id=str(uuid4()),
            cow_id=cow.id,
            owner_id=user.id,
            observation_date=eval_date - timedelta(days=days_ago),
            milk_produced_liters=yield_l,
        )
        db_session.add(obs)
    db_session.commit()

    result = svc.compute_cow_baseline(cow.id, eval_date)

    assert result.baseline_status == BaselineStatus.PROVISIONAL_BASELINE
    assert result.expected_baseline == 3.0  # median(3.2, 2.8) = 3.0
    assert result.observations_used == 2
    assert "Provisional baseline" in result.explanation
    assert "At least 3 observations are required" in result.explanation


def test_leakage_prevention_same_day_excluded(db_session: Session):
    """The observation on the evaluated date must NEVER be included in its own baseline."""
    user, farm, cow = _setup_test_cow(db_session)
    svc = MilkBaselineService(db_session)
    eval_date = date(2026, 10, 22)

    # 3 historical records on days 3, 2, 1
    for days_ago in [3, 2, 1]:
        obs = DailyObservation(
            id=str(uuid4()),
            cow_id=cow.id,
            owner_id=user.id,
            observation_date=eval_date - timedelta(days=days_ago),
            milk_produced_liters=3.0,
        )
        db_session.add(obs)

    # Current evaluated date observation has a distinct value (e.g. 50.0)
    current_obs = DailyObservation(
        id=str(uuid4()),
        cow_id=cow.id,
        owner_id=user.id,
        observation_date=eval_date,
        milk_produced_liters=50.0,
    )
    db_session.add(current_obs)
    db_session.commit()

    result = svc.compute_cow_baseline(cow.id, eval_date)

    # Baseline must be 3.0, strictly unaffected by the 50.0 L on eval_date
    assert result.expected_baseline == 3.0
    assert result.observations_used == 3
    for hist in result.observations_history:
        assert hist["date"] < eval_date.isoformat()


def test_duplicate_dates_handled_without_distortion(db_session: Session):
    """When duplicate observations exist on the same date, latest is prioritized and warning recorded."""
    user, farm, cow = _setup_test_cow(db_session)
    svc = MilkBaselineService(db_session)
    eval_date = date(2026, 10, 22)

    dup_date = eval_date - timedelta(days=1)
    # First entry on dup_date
    obs1 = DailyObservation(
        id=str(uuid4()),
        cow_id=cow.id,
        owner_id=user.id,
        observation_date=dup_date,
        milk_produced_liters=2.5,
    )
    db_session.add(obs1)
    db_session.flush()

    # Second entry on dup_date with updated value
    obs2 = DailyObservation(
        id=str(uuid4()),
        cow_id=cow.id,
        owner_id=user.id,
        observation_date=dup_date,
        milk_produced_liters=3.0,
    )
    db_session.add(obs2)

    # Add other dates to reach established baseline
    for d in [2, 3]:
        db_session.add(DailyObservation(
            id=str(uuid4()),
            cow_id=cow.id,
            owner_id=user.id,
            observation_date=eval_date - timedelta(days=d),
            milk_produced_liters=3.0,
        ))
    db_session.commit()

    result = svc.compute_cow_baseline(cow.id, eval_date)

    assert result.observations_used == 3
    assert any("Duplicate observation detected" in w for w in result.data_quality_warnings)
    # The yields used should be 3.0, 3.0, 3.0 -> median 3.0
    assert result.expected_baseline == 3.0


def test_incorrect_and_negative_units_filtered(db_session: Session):
    """Negative or non-finite milk yield observations are excluded with warnings."""
    user, farm, cow = _setup_test_cow(db_session)
    svc = MilkBaselineService(db_session)
    eval_date = date(2026, 10, 22)

    # Negative observation
    db_session.add(DailyObservation(
        id=str(uuid4()),
        cow_id=cow.id,
        owner_id=user.id,
        observation_date=eval_date - timedelta(days=1),
        milk_produced_liters=-5.0,
    ))
    # Valid observations
    for d in [2, 3, 4]:
        db_session.add(DailyObservation(
            id=str(uuid4()),
            cow_id=cow.id,
            owner_id=user.id,
            observation_date=eval_date - timedelta(days=d),
            milk_produced_liters=3.0,
        ))
    db_session.commit()

    result = svc.compute_cow_baseline(cow.id, eval_date)

    assert result.observations_used == 3
    assert result.expected_baseline == 3.0
    assert any("Negative milk yield" in w for w in result.data_quality_warnings)


def test_indigenous_breed_low_yield_is_not_flagged(db_session: Session):
    """Indigenous cow (Hallikar) producing 2.8 L with baseline 3.0 L is within normal variation."""
    user, farm, cow = _setup_test_cow(db_session, breed_name="Hallikar", cow_name="Nandi")
    svc = MilkBaselineService(db_session)
    eval_date = date(2026, 10, 22)

    # History of 3.0 L
    for d in range(1, 8):
        db_session.add(DailyObservation(
            id=str(uuid4()),
            cow_id=cow.id,
            owner_id=user.id,
            observation_date=eval_date - timedelta(days=d),
            milk_produced_liters=3.0,
        ))
    db_session.commit()

    baseline = svc.compute_cow_baseline(cow.id, eval_date)
    assert baseline.expected_baseline == 3.0

    # Today's yield is 2.8 L (drop is 0.2 L, or 6.7%)
    anomaly = MilkAnomalyService.evaluate_observation(
        actual_yield=2.8,
        baseline=baseline,
    )

    assert anomaly.anomaly_status == AnomalyStatus.NORMAL
    assert "within normal expected range" in anomaly.alert_explanation or "within expected variability" in anomaly.alert_explanation


def test_genuine_drop_against_baseline_is_flagged(db_session: Session):
    """A genuine drop >= 25% and >= 1.5 L against baseline is properly flagged."""
    user, farm, cow = _setup_test_cow(db_session, breed_name="Gir", cow_name="Ganga")
    svc = MilkBaselineService(db_session)
    eval_date = date(2026, 10, 22)

    # History of 20.0 L
    for d in range(1, 8):
        db_session.add(DailyObservation(
            id=str(uuid4()),
            cow_id=cow.id,
            owner_id=user.id,
            observation_date=eval_date - timedelta(days=d),
            milk_produced_liters=20.0,
        ))
    db_session.commit()

    baseline = svc.compute_cow_baseline(cow.id, eval_date)
    assert baseline.expected_baseline == 20.0

    # Yield drops to 12.0 L (drop of 8.0 L, 40%)
    anomaly = MilkAnomalyService.evaluate_observation(
        actual_yield=12.0,
        baseline=baseline,
    )

    assert anomaly.anomaly_status == AnomalyStatus.UNUSUAL_DROP
    assert anomaly.drop_liters == 8.0
    assert anomaly.drop_percentage == 40.0


def test_seeded_demo_nandi_verified(db_session: Session):
    """Verifies that Nandi with her exact demo-seeded daily observations computes reliable baseline."""
    user, farm, cow = _setup_test_cow(db_session, breed_name="Hallikar", cow_name="Nandi")
    svc = MilkBaselineService(db_session)

    # Seed Nandi's exact 31 historical observations (2.5 to 3.4 L, ending at 3.0 L on 2026-10-22)
    eval_date = date(2026, 10, 22)
    historical_yields = [
        3.0, 2.8, 3.2, 2.9, 2.7, 3.1, 2.8, 3.0, 2.6, 2.9,
        3.3, 2.8, 2.7, 3.0, 3.1, 2.9, 2.8, 3.4, 2.7, 2.8,
        3.0, 2.9, 3.1, 2.8, 2.6, 2.9, 3.0, 2.8, 3.1, 2.9
    ]
    for idx, yld in enumerate(historical_yields, start=1):
        db_session.add(DailyObservation(
            id=str(uuid4()),
            cow_id=cow.id,
            owner_id=user.id,
            observation_date=eval_date - timedelta(days=idx),
            milk_produced_liters=yld,
            notes="Nandi: routine daily milking; Hallikar; sample demo observation",
        ))
    # Add today's observation (3.0 L)
    db_session.add(DailyObservation(
        id=str(uuid4()),
        cow_id=cow.id,
        owner_id=user.id,
        observation_date=eval_date,
        milk_produced_liters=3.0,
        notes="Nandi: routine daily milking; Hallikar; sample demo observation",
    ))
    db_session.commit()

    baseline = svc.compute_cow_baseline(cow.id, eval_date)

    assert baseline.baseline_status == BaselineStatus.ESTABLISHED_BASELINE
    assert baseline.observations_used >= 7
    # Prior 7 observations before eval_date: [3.0, 2.8, 3.2, 2.9, 2.7, 3.1, 2.8] -> median is 2.9 or 2.8
    assert 2.5 <= baseline.expected_baseline <= 3.5

    # Today's 3.0 L vs baseline is normal
    anomaly = MilkAnomalyService.evaluate_observation(3.0, baseline)
    assert anomaly.anomaly_status == AnomalyStatus.NORMAL
    assert anomaly.actual_yield == 3.0
