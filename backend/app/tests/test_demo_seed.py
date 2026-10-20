import pytest
from datetime import date
from uuid import uuid4

from app.models.user import User
from app.models.farm import Farm
from app.models.cow import Cow
from app.models.daily_observation import DailyObservation
from app.models.farm_member import FarmMember
from app.models.weather_log import WeatherLog
from app.models.farm_settings import FarmSettings
from app.seeds.demo_seed import (
    seed_demo_data,
    DEMO_USER_EMAIL,
    DEMO_FARM_NAME,
)


def test_demo_seed_preserves_existing_user_farm_and_records(db_session):
    """
    Ensure seed_demo_data preserves existing non-demo farms, cows, and observations,
    never assuming the first farm is the demo farm or reassigning ownership.
    """
    # 1. Create pre-existing farm and cow owned by another farmer
    other_user = User(
        id=str(uuid4()),
        email="real.farmer@independent-dairy.com",
        full_name="Real Farmer",
        is_active=True,
    )
    db_session.add(other_user)
    db_session.flush()

    existing_farm = Farm(
        id=str(uuid4()),
        name="Independent Heritage Dairy",
        location_city="Bengaluru",
        created_by=str(other_user.id),
    )
    db_session.add(existing_farm)
    db_session.flush()

    existing_membership = FarmMember(
        id=str(uuid4()),
        farm_id=existing_farm.id,
        user_id=str(other_user.id),
        role="owner",
    )
    db_session.add(existing_membership)
    db_session.flush()

    existing_cow = Cow(
        id=str(uuid4()),
        farm_id=existing_farm.id,
        tag_id="HERITAGE-001",
        name="Daisy",
        owner_id=str(other_user.id),
        status="active",
    )
    db_session.add(existing_cow)
    db_session.flush()

    existing_obs = DailyObservation(
        id=str(uuid4()),
        cow_id=existing_cow.id,
        observation_date=date.today(),
        milk_produced_liters=24.5,
        observed_by=str(other_user.id),
        owner_id=str(other_user.id),
    )
    db_session.add(existing_obs)
    db_session.commit()

    # 2. Run demo seed with in-memory test session
    result = seed_demo_data(session=db_session)

    assert result["cows"] >= 5
    assert result["observations"] > 0

    # 3. Assert existing non-demo records were NOT mutated or reassigned
    refreshed_farm = db_session.query(Farm).filter(Farm.id == existing_farm.id).first()
    assert refreshed_farm is not None
    assert refreshed_farm.name == "Independent Heritage Dairy"
    assert refreshed_farm.created_by == str(other_user.id)

    refreshed_membership = db_session.query(FarmMember).filter(FarmMember.id == existing_membership.id).first()
    assert refreshed_membership is not None
    assert refreshed_membership.farm_id == existing_farm.id
    assert refreshed_membership.user_id == str(other_user.id)
    assert refreshed_membership.role == "owner"

    refreshed_cow = db_session.query(Cow).filter(Cow.id == existing_cow.id).first()
    assert refreshed_cow is not None
    assert refreshed_cow.name == "Daisy"
    assert refreshed_cow.owner_id == str(other_user.id)
    assert refreshed_cow.farm_id == existing_farm.id

    refreshed_obs = db_session.query(DailyObservation).filter(DailyObservation.id == existing_obs.id).first()
    assert refreshed_obs is not None
    assert refreshed_obs.observed_by == str(other_user.id)
    assert refreshed_obs.owner_id == str(other_user.id)
    assert refreshed_obs.cow_id == existing_cow.id

    # 4. Assert demo records were created under demo user and demo farm
    demo_user = db_session.query(User).filter(User.email == DEMO_USER_EMAIL).first()
    assert demo_user is not None

    demo_farm = db_session.query(Farm).filter(
        Farm.name == DEMO_FARM_NAME,
        Farm.created_by == str(demo_user.id),
    ).first()
    assert demo_farm is not None
    assert demo_farm.id != existing_farm.id

    demo_cows = db_session.query(Cow).filter(Cow.farm_id == demo_farm.id).all()
    assert len(demo_cows) >= 5
    for cow in demo_cows:
        assert cow.owner_id == str(demo_user.id)


def test_demo_seed_farm_conflict_fails_and_preserves_records_with_and_without_force(db_session):
    """
    If a farm named 'Luna Smart Dairy Farm' exists but belongs to a non-demo user,
    seed_demo_data must raise ValueError and NEVER transfer ownership,
    both in normal execution (force=False) and when force=True is passed.
    """
    other_user = User(
        id=str(uuid4()),
        email="someone_else@farm.org",
        full_name="Someone Else",
        is_active=True,
    )
    db_session.add(other_user)
    db_session.flush()

    conflicting_farm = Farm(
        id=str(uuid4()),
        name=DEMO_FARM_NAME,
        location_city="Bengaluru",
        created_by=str(other_user.id),
    )
    db_session.add(conflicting_farm)

    existing_membership = FarmMember(
        id=str(uuid4()),
        farm_id=conflicting_farm.id,
        user_id=str(other_user.id),
        role="owner",
    )
    db_session.add(existing_membership)
    db_session.commit()

    # 1. Normal execution (force=False) must fail safely without modifying records
    with pytest.raises(ValueError, match="Conflict: Farm 'Luna Smart Dairy Farm' exists"):
        seed_demo_data(session=db_session, force=False)

    refreshed_farm = db_session.query(Farm).filter(Farm.id == conflicting_farm.id).first()
    assert refreshed_farm.created_by == str(other_user.id)

    # 2. Execution with force=True must ALSO fail safely and NEVER transfer ownership
    with pytest.raises(ValueError, match="Conflict: Farm 'Luna Smart Dairy Farm' exists"):
        seed_demo_data(session=db_session, force=True)

    refreshed_farm_after_force = db_session.query(Farm).filter(Farm.id == conflicting_farm.id).first()
    assert refreshed_farm_after_force.created_by == str(other_user.id)

    refreshed_membership = db_session.query(FarmMember).filter(FarmMember.id == existing_membership.id).first()
    assert refreshed_membership.user_id == str(other_user.id)
    assert refreshed_membership.role == "owner"


def test_demo_seed_cow_conflict_fails_and_preserves_records_with_and_without_force(db_session):
    """
    If a cow with a demo tag exists but belongs to another owner,
    seed_demo_data must raise PermissionError and NEVER transfer ownership,
    both in normal execution (force=False) and when force=True is passed.
    """
    other_user = User(
        id=str(uuid4()),
        email="third.party@farm.org",
        full_name="Third Party",
        is_active=True,
    )
    db_session.add(other_user)
    db_session.flush()

    other_farm = Farm(
        id=str(uuid4()),
        name="Other Farm",
        created_by=str(other_user.id),
    )
    db_session.add(other_farm)
    db_session.flush()

    # Pre-create cow with demo tag KA-01-G-101 under other_user
    conflicting_cow = Cow(
        id=str(uuid4()),
        farm_id=other_farm.id,
        tag_id="KA-01-G-101",
        name="Independent Ganga",
        owner_id=str(other_user.id),
    )
    db_session.add(conflicting_cow)
    db_session.commit()

    # 1. Normal execution (force=False) must fail safely
    with pytest.raises(PermissionError, match="Conflict: Cow with tag 'KA-01-G-101' already exists"):
        seed_demo_data(session=db_session, force=False)

    refreshed_cow = db_session.query(Cow).filter(Cow.id == conflicting_cow.id).first()
    assert refreshed_cow.owner_id == str(other_user.id)
    assert refreshed_cow.name == "Independent Ganga"
    assert refreshed_cow.farm_id == other_farm.id

    # 2. Execution with force=True must ALSO fail safely and NEVER transfer ownership
    with pytest.raises(PermissionError, match="Conflict: Cow with tag 'KA-01-G-101' already exists"):
        seed_demo_data(session=db_session, force=True)

    refreshed_cow_after_force = db_session.query(Cow).filter(Cow.id == conflicting_cow.id).first()
    assert refreshed_cow_after_force.owner_id == str(other_user.id)
    assert refreshed_cow_after_force.name == "Independent Ganga"
    assert refreshed_cow_after_force.farm_id == other_farm.id


def test_demo_seed_idempotency_and_safe_demo_creation(db_session):
    """
    Verify that demo seed creates demo data cleanly and can run idempotently
    multiple times (both force=False and force=True) without errors or corrupting demo data.
    """
    # First run
    result1 = seed_demo_data(session=db_session, force=False)
    assert result1["cows"] >= 5
    assert result1["observations"] > 0

    demo_user = db_session.query(User).filter(User.email == DEMO_USER_EMAIL).first()
    assert demo_user is not None
    demo_farm = db_session.query(Farm).filter(
        Farm.name == DEMO_FARM_NAME,
        Farm.created_by == str(demo_user.id),
    ).first()
    assert demo_farm is not None

    # Second run with force=False (idempotent reuse of demo farm and cows)
    result2 = seed_demo_data(session=db_session, force=False)
    assert result2["cows"] == 0  # no new cows needed, existing demo cows were preserved and reused

    # Third run with force=True (still idempotent and safe)
    result3 = seed_demo_data(session=db_session, force=True)
    assert result3["cows"] == 0

    # Ensure demo farm and cow counts remain exact
    total_demo_cows = db_session.query(Cow).filter(Cow.farm_id == demo_farm.id).count()
    assert total_demo_cows == 5


def test_demo_seed_late_conflict_leaves_database_records_unchanged(db_session):
    """
    Prove that an ownership conflict discovered late in the process (e.g., on cow 5 KA-01-G-105)
    rolls back all changes and leaves all database records completely unchanged,
    for both force=False and force=True.
    """
    other_user = User(
        id=str(uuid4()),
        email="late.conflict.farmer@external.org",
        full_name="External Farmer",
        is_active=True,
    )
    db_session.add(other_user)
    db_session.flush()

    other_farm = Farm(
        id=str(uuid4()),
        name="External Pastures",
        created_by=str(other_user.id),
    )
    db_session.add(other_farm)
    db_session.flush()

    other_membership = FarmMember(
        id=str(uuid4()),
        farm_id=other_farm.id,
        user_id=str(other_user.id),
        role="owner",
    )
    db_session.add(other_membership)
    db_session.flush()

    # Pre-create the 5th demo cow (KA-01-G-105) under other_user
    conflicting_cow_5 = Cow(
        id=str(uuid4()),
        farm_id=other_farm.id,
        tag_id="KA-01-G-105",
        name="External Surabhi",
        owner_id=str(other_user.id),
    )
    db_session.add(conflicting_cow_5)
    db_session.commit()

    # Record baseline state counts before seed attempt
    baseline_user_count = db_session.query(User).count()
    baseline_farm_count = db_session.query(Farm).count()
    baseline_cow_count = db_session.query(Cow).count()
    baseline_obs_count = db_session.query(DailyObservation).count()
    baseline_weather_count = db_session.query(WeatherLog).count()
    baseline_member_count = db_session.query(FarmMember).count()
    baseline_settings_count = db_session.query(FarmSettings).count()

    # 1. Run with force=False: Must fail with PermissionError and leave DB state unchanged
    with pytest.raises(PermissionError, match="Conflict: Cow with tag 'KA-01-G-105' already exists"):
        seed_demo_data(session=db_session, force=False)

    assert db_session.query(User).count() == baseline_user_count
    assert db_session.query(Farm).count() == baseline_farm_count
    assert db_session.query(Cow).count() == baseline_cow_count
    assert db_session.query(DailyObservation).count() == baseline_obs_count
    assert db_session.query(WeatherLog).count() == baseline_weather_count
    assert db_session.query(FarmMember).count() == baseline_member_count
    assert db_session.query(FarmSettings).count() == baseline_settings_count

    # Assert no demo records leaked into DB
    assert db_session.query(Farm).filter(Farm.name == DEMO_FARM_NAME).first() is None
    refreshed_cow = db_session.query(Cow).filter(Cow.id == conflicting_cow_5.id).first()
    assert refreshed_cow.owner_id == str(other_user.id)
    assert refreshed_cow.farm_id == other_farm.id
    assert refreshed_cow.name == "External Surabhi"

    # 2. Run with force=True: Must ALSO fail with PermissionError and leave DB state unchanged
    with pytest.raises(PermissionError, match="Conflict: Cow with tag 'KA-01-G-105' already exists"):
        seed_demo_data(session=db_session, force=True)

    assert db_session.query(User).count() == baseline_user_count
    assert db_session.query(Farm).count() == baseline_farm_count
    assert db_session.query(Cow).count() == baseline_cow_count
    assert db_session.query(DailyObservation).count() == baseline_obs_count
    assert db_session.query(WeatherLog).count() == baseline_weather_count
    assert db_session.query(FarmMember).count() == baseline_member_count
    assert db_session.query(FarmSettings).count() == baseline_settings_count

    assert db_session.query(Farm).filter(Farm.name == DEMO_FARM_NAME).first() is None
    refreshed_cow = db_session.query(Cow).filter(Cow.id == conflicting_cow_5.id).first()
    assert refreshed_cow.owner_id == str(other_user.id)
    assert refreshed_cow.farm_id == other_farm.id
    assert refreshed_cow.name == "External Surabhi"
