from datetime import date
from uuid import uuid4

import pytest
from sqlalchemy.orm import Session

from app.models import Cow, SireMaster, User, Farm, DailyObservation
from app.services.genetics_service import GeneticsService


def test_sire_rankings(db_session: Session):
    service = GeneticsService(db_session)
    res = service.get_sire_rankings()

    assert res.total_sires_evaluated == 10
    assert len(res.sires) == 10
    assert res.top_sire_code == "SIRE009"  # Apex Sovereign (12,730 kg)
    assert res.top_sire_name == "Apex Sovereign"
    assert res.sires[0].rank == 1
    assert res.sires[0].total_milk_yield_kg == 12730.0
    assert res.sires[-1].rank == 10


def test_cow_genetic_profile_with_verified_sire(db_session: Session):
    service = GeneticsService(db_session)
    user_id = str(uuid4())
    user = User(id=user_id, email=f"gen_{user_id}@example.com", full_name="Genetics Tester")
    farm = Farm(id=str(uuid4()), name="Genetics Farm", created_by=user_id)

    top_sire = db_session.query(SireMaster).filter(SireMaster.sire_code == "SIRE004").first()
    assert top_sire is not None

    cow = Cow(
        id=str(uuid4()),
        farm_id=farm.id,
        tag_id="GEN-01",
        name="Queen Bella",
        sire_id=top_sire.id,
        dam_name="Bella Senior",
        owner_id=user_id,
        created_by=user_id,
    )
    db_session.add_all([user, farm, cow])
    db_session.commit()

    profile = service.get_cow_genetic_profile(user_id, cow.id)

    assert profile.cow_id == cow.id
    assert profile.cow_name == "Queen Bella"
    assert profile.sire_code == "SIRE004"
    assert profile.sire_name == "Titan Royal"
    assert profile.dam_name == "Bella Senior"
    assert profile.pedigree_status == "Verified Sire Pedigree"
    assert profile.pedigree_confidence == "High"
    assert profile.genetic_merit_rating == 97.5
    assert profile.estimated_genetic_potential_l > 40.0
    assert len(profile.breeding_insights) >= 2


def test_cow_genetic_profile_without_sire_safeguard(db_session: Session):
    service = GeneticsService(db_session)
    user_id = str(uuid4())
    user = User(id=user_id, email=f"gen_base_{user_id}@example.com", full_name="Baseline Tester")
    farm = Farm(id=str(uuid4()), name="Baseline Farm", created_by=user_id)

    cow = Cow(
        id=str(uuid4()),
        farm_id=farm.id,
        tag_id="GEN-02",
        name="Unknown Daisy",
        sire_id=None,
        owner_id=user_id,
        created_by=user_id,
    )
    db_session.add_all([user, farm, cow])
    db_session.commit()

    profile = service.get_cow_genetic_profile(user_id, cow.id)

    assert profile.cow_id == cow.id
    assert profile.sire_name is None
    assert profile.pedigree_status == "Estimated from Breed Baseline"
    assert profile.pedigree_confidence == "Medium"
    assert profile.genetic_merit_rating == 75.0
    assert "Sire pedigree is not recorded" in profile.breeding_insights[0]


def test_herd_genetics_summary(db_session: Session):
    service = GeneticsService(db_session)
    user_id = str(uuid4())
    user = User(id=user_id, email=f"gen_herd_{user_id}@example.com", full_name="Herd Genetics Tester")
    farm = Farm(id=str(uuid4()), name="Herd Genetics Farm", created_by=user_id)

    sire = db_session.query(SireMaster).first()

    cow1 = Cow(id=str(uuid4()), farm_id=farm.id, tag_id="HGEN-01", name="Cow One", sire_id=sire.id, owner_id=user_id)
    cow2 = Cow(id=str(uuid4()), farm_id=farm.id, tag_id="HGEN-02", name="Cow Two", sire_id=None, owner_id=user_id)

    db_session.add_all([user, farm, cow1, cow2])
    db_session.commit()

    summary = service.get_herd_genetics_summary(user_id, farm.id)

    assert summary.total_cows == 2
    assert summary.cows_with_pedigree_count == 1
    assert summary.average_herd_genetic_score > 0
    assert len(summary.top_genetic_sire_lines) >= 1
    assert summary.top_genetic_sire_lines[0]["sire_name"] == sire.name
