from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4
from typing import Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.repositories.health_alert_repository import HealthAlertRepository
from app.models import HealthAlert, MilkPrediction, DailyObservation, Cow, Farm, WeatherLog
from app.schemas.feature import FeatureVector


class HealthAlertService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = HealthAlertRepository(db)

    def _validate_cow_ownership(self, cow_id: str, user_id: str):
        cow = self.db.get(Cow, cow_id)
        if cow is None:
            raise ValueError("Cow not found")
        if cow.owner_id != user_id:
            raise PermissionError("User does not own this cow")
        return cow

    def evaluate_and_create(
        self,
        user_id: str,
        cow_id: Optional[str] = None,
        observation_id: Optional[str] = None,
        prediction_id: Optional[str] = None,
        weather_log_id: Optional[str] = None,
        feature_vector: Optional[FeatureVector] = None,
        persist: bool = True,
    ) -> HealthAlert:
        # infer cow when possible
        if cow_id is None:
            if observation_id is not None:
                obs = self.db.get(DailyObservation, observation_id)
                if obs is None:
                    raise ValueError("Observation not found")
                cow_id = obs.cow_id
            elif prediction_id is not None:
                pred = self.db.get(MilkPrediction, prediction_id)
                if pred is None:
                    raise ValueError("Prediction not found")
                cow_id = pred.cow_id

        if cow_id is None:
            raise ValueError("cow_id is required when no observation_id or prediction_id is provided")

        # ownership
        cow = self._validate_cow_ownership(cow_id, user_id)
        farm = self.db.get(Farm, cow.farm_id)

        # collect inputs
        obs = None
        if observation_id:
            obs = self.db.get(DailyObservation, observation_id)
            if obs is None:
                raise ValueError("Observation not found")
            if obs.owner_id != user_id:
                raise PermissionError("User does not own this observation")

        pred = None
        if prediction_id:
            pred = self.db.get(MilkPrediction, prediction_id)
            if pred is None:
                raise ValueError("Prediction not found")
            if pred.owner_id != user_id:
                raise PermissionError("User does not own this prediction")

        weather = None
        if weather_log_id:
            weather = self.db.get(WeatherLog, weather_log_id)
            if weather is None:
                raise ValueError("WeatherLog not found")
            if weather.owner_id != user_id:
                raise PermissionError("User does not own this weather record")

        # compute component scores
        from app.core.project_paths import ensure_project_root_on_path
        ensure_project_root_on_path()
        from config import THI_COMFORT, THI_MODERATE, THI_SEVERE

        # Heat stress score
        thi = None
        if feature_vector is not None and getattr(feature_vector, 'thi', None) is not None:
            thi = float(feature_vector.thi)
        elif weather is not None and getattr(weather, 'thi', None) is not None:
            thi = float(weather.thi)
        elif obs is not None and getattr(obs, 'weather_log', None) is not None and getattr(obs.weather_log, 'thi', None) is not None:
            thi = float(obs.weather_log.thi)

        heat_score = 0.0
        if thi is not None:
            if thi < THI_COMFORT:
                heat_score = 0.0
            else:
                denom = max(1.0, THI_SEVERE - THI_COMFORT)
                heat_score = min(1.0, (thi - THI_COMFORT) / denom)

        # Milk drop score
        milk_score = 0.0
        if pred is not None and obs is not None and obs.milk_produced_liters is not None:
            expected = float(pred.predicted_milk_yield)
            observed = float(obs.milk_produced_liters)
            if expected > 0:
                milk_score = max(0.0, (expected - observed) / expected)
        elif pred is not None:
            # no observation: if predicted yield is low relative to typical heuristic, flag mild
            if pred.predicted_milk_yield < 5.0:
                milk_score = 0.5

        # Abnormal conditions
        abnormal_score = 0.0
        if obs is not None and getattr(obs, 'symptoms', None):
            if isinstance(obs.symptoms, dict) and len(obs.symptoms) > 0:
                abnormal_score = 1.0
        if weather is not None and getattr(weather, 'rainfall', 0) is not None:
            try:
                if float(weather.rainfall) > 50.0:
                    abnormal_score = max(abnormal_score, 0.6)
            except Exception:
                pass

        # combine
        weights = {'heat': 0.5, 'milk': 0.3, 'abnormal': 0.2}
        confidence = (heat_score * weights['heat'] + milk_score * weights['milk'] + abnormal_score * weights['abnormal'])
        # normalize
        confidence = max(0.0, min(1.0, confidence))

        # map to levels
        if confidence >= 0.75 or heat_score >= 0.9 or abnormal_score >= 0.9:
            level = 'Critical'
        elif confidence >= 0.4:
            level = 'Warning'
        else:
            level = 'Healthy'

        # if THI is in mild range or higher, promote to Warning at least
        from app.core.project_paths import ensure_project_root_on_path
        ensure_project_root_on_path()
        from config import THI_MILD
        if thi is not None and thi >= THI_MILD and level == 'Healthy':
            level = 'Warning'

        # description
        desc = f"heat_score={heat_score:.2f}; milk_score={milk_score:.2f}; abnormal_score={abnormal_score:.2f}"

        ha = HealthAlert(
            cow_id=cow_id,
            observation_id=observation_id,
            prediction_id=prediction_id,
            farm_id=getattr(farm, 'id', None),
            alert_level=level,
            alert_type='composite',
            description=desc,
            confidence=confidence,
            resolved=False,
            owner_id=user_id,
        )

        if persist:
            saved = self.repo.save(ha)
            return saved

        if getattr(ha, 'id', None) is None:
            ha.id = str(uuid4())
        if getattr(ha, 'created_at', None) is None:
            ha.created_at = datetime.now(timezone.utc)
        if getattr(ha, 'resolved', None) is None:
            ha.resolved = False
        return ha

    def list_health_alerts(
        self,
        user_id: str,
        alert_level: Optional[str] = None,
        resolved: Optional[bool] = None,
        cow_id: Optional[str] = None,
        prediction_id: Optional[str] = None,
        search: Optional[str] = None,
    ) -> list[HealthAlert]:
        query = self.db.query(HealthAlert)
        query = query.filter(HealthAlert.owner_id == user_id)

        if alert_level is not None:
            query = query.filter(HealthAlert.alert_level == alert_level)
        if resolved is not None:
            query = query.filter(HealthAlert.resolved.is_(resolved))
        if cow_id is not None:
            query = query.filter(HealthAlert.cow_id == cow_id)
        if prediction_id is not None:
            query = query.filter(HealthAlert.prediction_id == prediction_id)
        if search is not None and search.strip():
            term = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    HealthAlert.alert_type.ilike(term),
                    HealthAlert.description.ilike(term),
                    HealthAlert.alert_level.ilike(term),
                )
            )

        return query.order_by(HealthAlert.created_at.desc()).all()
