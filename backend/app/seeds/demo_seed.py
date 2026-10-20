"""
demo_seed.py
============
Deterministic seed script for hackathon demonstration.
Populates:
  - Farm 'Luna' coordinates (Bengaluru: 12.9716° N, 77.5946° E) and FarmSettings
  - FarmMember mapping user to farm as owner
  - 5 realistic cattle profiles (Gir, Sahiwal, Hallikar, Jersey)
  - 7 days of historical observations and ambient weather logs
  - True XGBoost model predictions, confidence intervals, and SHAP explainability
  - Isolation Forest & clinical anomaly records
  - Multi-tier health alerts and actionable recommendations
  - Digital Twin state synchronization
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.breed_master import BreedMaster
from app.models.cow import Cow
from app.models.daily_observation import DailyObservation
from app.models.farm import Farm
from app.models.farm_member import FarmMember
from app.models.farm_settings import FarmSettings
from app.models.health_alert import HealthAlert
from app.models.milk_prediction import MilkPrediction
from app.models.recommendation import Recommendation
from app.models.user import User
from app.models.weather_log import WeatherLog
from app.schemas.feature import FeatureVector
from app.services.anomaly_detection_service import AnomalyDetectionService
from app.services.digital_twin_service import DigitalTwinService
from app.services.explainability_service import ExplainabilityService
from app.services.feature_engineering_service import FeatureEngineeringService
from app.services.health_alert_service import HealthAlertService
from app.services.prediction_service import PredictionService
from app.services.recommendation_service import RecommendationService
from app.services.weather_service import WeatherService

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("demo_seed")


DEMO_COWS = [
    {
        "tag_id": "KA-01-G-101",
        "name": "Ganga",
        "breed_name": "Gir",
        "age_months": 42,
        "weight_kg": 445.0,
        "lactation_number": 2,
        "base_yield": 24.5,
        "base_feed": 18.0,
        "base_temp": 38.6,
        "persona": "High Producer — Steady high daily yield with optimal feed-to-milk conversion.",
    },
    {
        "tag_id": "KA-01-S-102",
        "name": "Kamadhenu",
        "breed_name": "Sahiwal",
        "age_months": 48,
        "weight_kg": 465.0,
        "lactation_number": 3,
        "base_yield": 21.0,
        "base_feed": 16.5,
        "base_temp": 39.2,
        "persona": "Thermal Sensitive — Elevated body temperature on warm afternoons; ideal for What-If cooling simulations.",
    },
    {
        "tag_id": "KA-01-H-103",
        "name": "Nandi",
        "breed_name": "Hallikar",
        "age_months": 36,
        "weight_kg": 385.0,
        "lactation_number": 1,
        "base_yield": 15.0,
        "base_feed": 13.5,
        "base_temp": 38.5,
        "persona": "Indigenous Resilient — Hardy native Karnataka dual-purpose breed with consistent heat tolerance.",
    },
    {
        "tag_id": "KA-01-J-104",
        "name": "Lakshmi",
        "breed_name": "Jersey",
        "age_months": 54,
        "weight_kg": 425.0,
        "lactation_number": 3,
        "base_yield": 19.5,
        "base_feed": 12.0,  # Feed drop causing anomaly
        "base_temp": 39.8,  # Mild fever
        "persona": "Clinical Anomaly — Recent feed intake drop and fever spike flagged by Isolation Forest.",
    },
    {
        "tag_id": "KA-01-G-105",
        "name": "Surabhi",
        "breed_name": "Gir",
        "age_months": 30,
        "weight_kg": 415.0,
        "lactation_number": 1,
        "base_yield": 22.0,
        "base_feed": 17.0,
        "base_temp": 38.7,
        "persona": "First Lactation — Young vigorous cow progressing along expected lactation curve.",
    },
]


DEMO_USER_EMAIL = "demo.farmer@dairyvision.ai"
DEMO_FARM_NAME = "Luna Smart Dairy Farm"


def seed_demo_data(
    session: Optional[Session] = None,
    force: bool = False,
) -> dict[str, int]:
    """
    Deterministically seeds hackathon demonstration records for DairyVision AI.

    Safety Guarantees:
      - Never reassigns ownership of existing non-demo farms, cows, observations, or alerts.
      - Never changes created_by, transfers ownership, or overwrites another user's records,
        even if force=True is supplied.
      - Never selects an arbitrary first farm via db.query(Farm).first().
      - Specifically seeks or creates a dedicated farm named 'Luna Smart Dairy Farm' owned by demo.farmer@dairyvision.ai.
      - Fails safely (raises ValueError or PermissionError) on any ownership conflict, leaving existing records untouched.
    """
    own_session = session is None
    db = session or SessionLocal()
    try:
        # 0. Pre-flight ownership conflict verification before performing ANY mutations
        existing_farm_other_owner = db.query(Farm).filter(Farm.name == DEMO_FARM_NAME).first()
        demo_user = db.query(User).filter(User.email == DEMO_USER_EMAIL).first()
        demo_user_id = str(demo_user.id) if demo_user else None

        if existing_farm_other_owner:
            if demo_user_id is None or existing_farm_other_owner.created_by != demo_user_id:
                raise ValueError(
                    f"Conflict: Farm '{DEMO_FARM_NAME}' exists but is owned by user ID '{existing_farm_other_owner.created_by}', "
                    f"not demo user. Refusing to transfer ownership or mutate another user's records."
                )

        demo_tags = [c["tag_id"] for c in DEMO_COWS]
        conflicting_cow = (
            db.query(Cow)
            .filter(
                Cow.tag_id.in_(demo_tags),
                Cow.owner_id != demo_user_id if demo_user_id else True,
            )
            .first()
        )
        if conflicting_cow:
            raise PermissionError(
                f"Conflict: Cow with tag '{conflicting_cow.tag_id}' already exists (owned by user '{conflicting_cow.owner_id}'). "
                f"Refusing to transfer ownership or mutate another user's records."
            )

        # 1. Identify or create primary demo user
        user = db.query(User).filter(User.email == DEMO_USER_EMAIL).first()
        if not user:
            user = User(
                id=str(uuid4()),
                email=DEMO_USER_EMAIL,
                full_name="Dairy Farm Operations Director",
                is_active=True,
            )
            db.add(user)
            db.flush()
        user_id = str(user.id)
        logger.info("Using demo user: %s (id=%s)", user.email, user_id)

        # 2. Identify or configure primary demo farm specifically by name and owner
        farm = db.query(Farm).filter(
            Farm.name == DEMO_FARM_NAME,
            Farm.created_by == user_id,
        ).first()

        if not farm:
            farm = Farm(
                id=str(uuid4()),
                name=DEMO_FARM_NAME,
                location_city="Bengaluru",
                location_country="India",
                latitude=12.9716,
                longitude=77.5946,
                timezone="Asia/Kolkata",
                created_by=user_id,
            )
            db.add(farm)
            db.flush()

        farm.name = DEMO_FARM_NAME
        farm.location_city = "Bengaluru"
        farm.location_country = "India"
        farm.latitude = 12.9716
        farm.longitude = 77.5946
        farm.timezone = "Asia/Kolkata"
        farm_id = str(farm.id)
        logger.info("Configured demo farm: %s (id=%s) at (%s, %s)", farm.name, farm_id, farm.latitude, farm.longitude)

        # Ensure FarmMember ownership mapping for demo user
        member = db.query(FarmMember).filter(FarmMember.farm_id == farm_id, FarmMember.user_id == user_id).first()
        if not member:
            member = FarmMember(
                id=str(uuid4()),
                farm_id=farm_id,
                user_id=user_id,
                role="owner",
            )
            db.add(member)
            db.flush()
        else:
            member.role = "owner"

        # Ensure FarmSettings for demo farm
        settings = db.query(FarmSettings).filter(FarmSettings.farm_id == farm_id).first()
        if not settings:
            settings = FarmSettings(
                id=str(uuid4()),
                farm_id=farm_id,
                default_language="en",
                default_currency="INR",
                milk_price_per_liter=40.0,
                feed_cost_per_kg=22.0,
                timezone="Asia/Kolkata",
                use_local_breed_names=True,
            )
            db.add(settings)
            db.flush()

        # 3. Cache breed records
        breeds = {b.canonical_name: b.id for b in db.query(BreedMaster).all()}

        # 4. Initialize services
        weather_service = WeatherService(db)
        prediction_service = PredictionService(db)
        explainability_service = ExplainabilityService(db)
        anomaly_service = AnomalyDetectionService(db)
        health_alert_service = HealthAlertService(db)
        recommendation_service = RecommendationService(db)
        digital_twin_service = DigitalTwinService(db)
        fe_service = FeatureEngineeringService(db)

        # 5. Create weather history for past 7 days
        today = date.today()
        weather_logs_by_day = {}
        for day_offset in range(7, -1, -1):
            obs_date = today - timedelta(days=day_offset)
            target_dt = datetime.combine(obs_date, datetime.min.time(), tzinfo=timezone.utc) + timedelta(hours=14)

            # Seasonal Bengaluru weather profile: 27°C - 31°C, 58% - 68% RH
            temp = 28.5 + (1.2 if day_offset % 2 == 0 else -0.8)
            hum = 62.0 + (3.0 if day_offset % 2 == 0 else -4.0)
            nrc_thi = WeatherService.calculate_thi(temp, hum)

            w_log = (
                db.query(WeatherLog)
                .filter(WeatherLog.farm_id == farm_id, WeatherLog.recorded_at == target_dt)
                .first()
            )
            if not w_log:
                w_log = WeatherLog(
                    id=str(uuid4()),
                    farm_id=farm_id,
                    owner_id=user_id,
                    temperature=round(temp, 1),
                    humidity=round(hum, 1),
                    rainfall=0.0,
                    wind_speed=3.2,
                    pressure=1012.0,
                    cloud_cover=25.0,
                    thi=nrc_thi,
                    recorded_at=target_dt,
                )
                db.add(w_log)
                db.flush()
            weather_logs_by_day[obs_date] = w_log

        # 6. Seed Cows and Observations
        cows_seeded = 0
        obs_seeded = 0
        predictions_seeded = 0
        anomalies_seeded = 0
        alerts_seeded = 0
        recs_seeded = 0

        for cow_data in DEMO_COWS:
            tag = cow_data["tag_id"]
            cow = db.query(Cow).filter(Cow.farm_id == farm_id, Cow.tag_id == tag).first()
            if not cow:
                existing_cow_anywhere = db.query(Cow).filter(Cow.tag_id == tag).first()
                if existing_cow_anywhere and existing_cow_anywhere.owner_id != user_id:
                    raise PermissionError(
                        f"Conflict: Cow with tag '{tag}' already exists (owned by user '{existing_cow_anywhere.owner_id}'). "
                        f"Refusing to transfer ownership or mutate another user's records."
                    )
                breed_id = breeds.get(cow_data["breed_name"])
                cow = Cow(
                    id=str(uuid4()),
                    farm_id=farm_id,
                    tag_id=tag,
                    name=cow_data["name"],
                    breed_id=breed_id,
                    age_months=cow_data["age_months"],
                    weight_kg=cow_data["weight_kg"],
                    lactation_number=cow_data["lactation_number"],
                    status="active",
                    owner_id=user_id,
                    created_by=user_id,
                    notes=cow_data["persona"],
                )
                db.add(cow)
                db.flush()
                cows_seeded += 1
            else:
                if cow.owner_id != user_id:
                    raise PermissionError(
                        f"Conflict: Cow with tag '{tag}' exists on farm '{farm_id}' but is owned by user '{cow.owner_id}', "
                        f"not demo user '{user_id}'. Refusing to transfer ownership or mutate another user's records."
                    )

            # Seed 7 days of daily observations
            for day_offset in range(6, -1, -1):
                obs_date = today - timedelta(days=day_offset)
                existing_obs = (
                    db.query(DailyObservation)
                    .filter(DailyObservation.cow_id == cow.id, DailyObservation.observation_date == obs_date)
                    .first()
                )
                if existing_obs:
                    obs = existing_obs
                else:
                    w_log = weather_logs_by_day[obs_date]
                    is_anomaly_day = (cow_data["name"] == "Lakshmi" and day_offset <= 1)

                    milk_yield = (
                        cow_data["base_yield"] * 0.65 if is_anomaly_day else cow_data["base_yield"] + ((day_offset % 3 - 1) * 0.4)
                    )
                    feed_qty = (
                        cow_data["base_feed"] * 0.60 if is_anomaly_day else cow_data["base_feed"] + ((day_offset % 2) * 0.5)
                    )
                    body_temp = (
                        cow_data["base_temp"] + (0.8 if is_anomaly_day else 0.0)
                    )
                    condition = "fever" if is_anomaly_day else "normal"
                    symptoms = {"condition": "unwell", "fever": True} if is_anomaly_day else {"condition": "healthy"}

                    obs = DailyObservation(
                        id=str(uuid4()),
                        cow_id=cow.id,
                        observation_date=obs_date,
                        milk_produced_liters=round(milk_yield, 2),
                        feed_quantity_kg=round(feed_qty, 2),
                        body_temperature_c=round(body_temp, 2),
                        body_condition_score=3.25,
                        health_condition=condition,
                        symptoms=symptoms,
                        weather_log_id=w_log.id,
                        observed_by=user_id,
                        owner_id=user_id,
                        notes=f"Daily routine recording for {cow.name}",
                    )
                    db.add(obs)
                    db.flush()
                    obs_seeded += 1

                # Generate real ML Prediction for the latest 2 days
                if day_offset <= 1:
                    try:
                        pred_rec = db.query(MilkPrediction).filter(MilkPrediction.observation_id == obs.id).first()
                        if not pred_rec:
                            pred_rec = prediction_service.predict_for_observation(user_id, obs.id)
                            predictions_seeded += 1

                        # Generate real SHAP Explainability
                        try:
                            explainability_service.explain(
                                user_id=user_id,
                                prediction_id=pred_rec.id,
                                persist=True,
                            )
                        except Exception as e:
                            logger.warning("SHAP explanation skipped for %s: %s", cow.name, e)

                        # Generate Anomaly Detection record
                        anomaly = anomaly_service.detect_for_observation(
                            user_id=user_id,
                            observation_id=obs.id,
                            persist=True,
                        )
                        if anomaly:
                            anomalies_seeded += 1

                        # Generate Health Alert
                        alert = health_alert_service.evaluate_and_create(user_id=user_id, observation_id=obs.id)
                        if alert:
                            alerts_seeded += 1

                        # Generate Recommendations
                        new_recs = recommendation_service.generate_recommendations(
                            user_id=user_id,
                            observation_id=obs.id,
                        )
                        if new_recs:
                            recs_seeded += len(new_recs)

                    except Exception as exc:
                        logger.warning("Pipeline processing error for cow %s: %s", cow.name, exc)

            # Sync Cow Digital Twin State
            try:
                digital_twin_service.get_cow_digital_twin(user_id, cow.id)
            except Exception as e:
                logger.warning("Digital twin sync note for %s: %s", cow.name, e)

        db.commit()

        logger.info(
            "Demo seeding complete! Cows: %d, Observations: %d, Predictions: %d, Anomalies: %d, Alerts: %d, Recs: %d",
            cows_seeded, obs_seeded, predictions_seeded, anomalies_seeded, alerts_seeded, recs_seeded,
        )

        return {
            "cows": cows_seeded,
            "observations": obs_seeded,
            "predictions": predictions_seeded,
            "anomalies": anomalies_seeded,
            "alerts": alerts_seeded,
            "recommendations": recs_seeded,
        }
    except Exception:
        db.rollback()
        raise
    finally:
        if own_session:
            db.close()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(
        description="Seed deterministic demo data for DairyVision AI safely."
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-run demo seeding for existing demo-owned records. Note: Never transfers ownership or modifies non-demo tenant records.",
    )
    args = parser.parse_args()
    seed_demo_data(force=args.force)
