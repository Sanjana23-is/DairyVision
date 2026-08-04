from __future__ import annotations

from datetime import datetime, timezone
from statistics import mean
from typing import Optional

from sqlalchemy.orm import Session

from app.repositories.feature_repository import FeatureRepository
from app.schemas.feature import FeatureVector


def _temp_category(temp: Optional[float]) -> Optional[str]:
    if temp is None:
        return None
    if temp < 5:
        return "very_cold"
    if temp < 15:
        return "cold"
    if temp < 25:
        return "mild"
    if temp < 32:
        return "warm"
    return "hot"


def _humidity_category(h: Optional[float]) -> Optional[str]:
    if h is None:
        return None
    if h < 30:
        return "low"
    if h < 60:
        return "moderate"
    return "high"


def _lactation_stage_from_dim(dim: Optional[int]) -> Optional[str]:
    if dim is None:
        return None
    if dim <= 60:
        return "early"
    if dim <= 200:
        return "mid"
    return "late"


class FeatureEngineeringService:
    def __init__(self, db: Session, defaults: dict | None = None) -> None:
        self.db = db
        self.repo = FeatureRepository(db)
        self.defaults = defaults or {}

    def build_features_for_observation(self, user_id: str, observation_id: str) -> FeatureVector:
        obs = self.repo.get_observation(observation_id)
        if obs is None:
            raise ValueError("Observation not found")

        # ownership checks
        if obs.owner_id != user_id:
            raise PermissionError("User does not own this observation")

        cow = self.repo.get_cow(obs.cow_id)
        if cow is None:
            raise ValueError("Cow not found")
        if cow.owner_id != user_id:
            raise PermissionError("User does not own the cow")

        farm = self.repo.get_farm(cow.farm_id)
        if farm is None:
            raise ValueError("Farm not found")
        if farm.created_by != user_id and getattr(farm, "owner_id", None) not in (None, user_id):
            raise PermissionError("User does not own the farm")

        weather = None
        if obs.weather_log_id:
            weather = self.repo.get_weather_log(obs.weather_log_id)

        # compute milk history
        recorded_dt = datetime.combine(obs.observation_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        recent = self.repo.recent_observations(cow.id, recorded_dt, days=7)
        milk_values = [float(o.milk_produced_liters) for o in recent if o.milk_produced_liters is not None and o.id != obs.id]

        rolling_7d = mean(milk_values) if milk_values else None
        previous = milk_values[0] if milk_values else None
        milk_trend = None
        if previous is not None and len(milk_values) >= 2:
            milk_trend = previous - (mean(milk_values[1:]) if len(milk_values[1:]) else previous)

        # derived animal features
        age = None
        if cow.birth_date is not None:
            age_days = (obs.observation_date - cow.birth_date).days
            # training dataset uses age in months
            age = int(age_days / 30)

        # days in milk and lactation stage not available without calving/lactation dates
        days_in_milk = None
        lactation_stage = None

        # body condition and health
        bcs_cat = self.defaults.get("bcs_category")
        # health_status: encode based on symptoms or cow status (0 healthy, 1 diseased)
        health_status = 0
        try:
            if getattr(obs, "symptoms", None):
                if isinstance(obs.symptoms, dict) and len(obs.symptoms) > 0:
                    health_status = 1
            if getattr(cow, "status", "active") != "active":
                health_status = 1
        except Exception:
            health_status = 0

        # weather-derived
        thi = None
        temp = None
        hum = None
        if weather is not None:
            thi = float(weather.thi) if weather.thi is not None else None
            temp = float(weather.temperature) if weather.temperature is not None else None
            hum = float(weather.humidity) if weather.humidity is not None else None

        temp_cat = _temp_category(temp)
        hum_cat = _humidity_category(hum)

        observation_age_hours = None
        try:
            observation_age_hours = (datetime.now(timezone.utc) - obs.created_at).total_seconds() / 3600.0
        except Exception:
            observation_age_hours = None

        # engineered numeric features matching training dataset
        weight = float(cow.weight_kg) if cow.weight_kg is not None else None
        feed = float(obs.feed_quantity_kg) if getattr(obs, "feed_quantity_kg", None) is not None else None

        feed_weight_ratio = None
        feed_per_weight = None
        temp_humidity = None
        thi_squared = None
        feed_thi_interaction = None
        age_weight_ratio = None

        if feed is not None and weight is not None and weight != 0:
            feed_weight_ratio = feed / weight
            feed_per_weight = feed_weight_ratio
            age_weight_ratio = (age / weight) if age is not None else None

        if temp is not None and hum is not None:
            temp_humidity = temp * hum

        if thi is not None:
            thi_squared = thi * thi
            if feed is not None:
                feed_thi_interaction = feed * thi

        features = FeatureVector(
            age=age,
            weight=weight,
            health_status=int(health_status),
            feed=feed,
            temperature=temp,
            humidity=hum,
            thi=thi,
            feed_weight_ratio=feed_weight_ratio,
            feed_per_weight=feed_per_weight,
            temp_humidity=temp_humidity,
            thi_squared=thi_squared,
            feed_thi_interaction=feed_thi_interaction,
            age_weight_ratio=age_weight_ratio,
        )

        return features
