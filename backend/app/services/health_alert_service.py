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
        elif observation_id:
            pred = self.db.query(MilkPrediction).filter(MilkPrediction.observation_id == observation_id).first()
            if pred:
                prediction_id = pred.id

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
        if obs is not None:
            if getattr(obs, 'symptoms', None) and isinstance(obs.symptoms, dict) and len(obs.symptoms) > 0:
                abnormal_score = 1.0
            if getattr(obs, 'health_condition', None) and obs.health_condition != 'normal':
                abnormal_score = 1.0
            if getattr(obs, 'body_temperature_c', None) and (float(obs.body_temperature_c) > 39.5 or float(obs.body_temperature_c) < 37.5):
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

        if persist and observation_id:
            existing_ha = self.db.query(HealthAlert).filter(HealthAlert.observation_id == observation_id).first()
            if existing_ha:
                existing_ha.alert_level = level
                existing_ha.confidence = confidence
                existing_ha.description = desc
                if prediction_id:
                    existing_ha.prediction_id = prediction_id
                if farm:
                    existing_ha.farm_id = farm.id
                self.db.commit()
                self.db.refresh(existing_ha)
                return existing_ha

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

    def get_health_summary(self, user_id: str, farm_id: Optional[str] = None) -> dict:
        cow_query = self.db.query(Cow).filter(Cow.owner_id == user_id)
        if farm_id:
            cow_query = cow_query.filter(Cow.farm_id == farm_id)
        cows = cow_query.all()
        total_cows = len(cows)
        cow_dict = {c.id: c for c in cows}

        alert_query = self.db.query(HealthAlert).filter(
            HealthAlert.owner_id == user_id,
            HealthAlert.resolved.is_(False),
            HealthAlert.alert_level != "Healthy",
        )
        if farm_id:
            alert_query = alert_query.filter(HealthAlert.farm_id == farm_id)
        active_alerts = alert_query.all()

        cow_alerts: dict[str, list[HealthAlert]] = {}
        for alert in active_alerts:
            if alert.cow_id not in cow_alerts:
                cow_alerts[alert.cow_id] = []
            cow_alerts[alert.cow_id].append(alert)

        critical_cows: set[str] = set()
        warning_cows: set[str] = set()

        for c_id, alerts in cow_alerts.items():
            if any(a.alert_level == "Critical" for a in alerts):
                critical_cows.add(c_id)
            elif any(a.alert_level == "Warning" for a in alerts):
                warning_cows.add(c_id)

        critical_count = len(critical_cows)
        warning_count = len(warning_cows)
        needs_attention_count = critical_count + warning_count

        from datetime import date, timedelta
        recent_threshold = date.today() - timedelta(days=14)

        healthy_count = 0
        no_recent_data_count = 0

        for c_id in cow_dict:
            if c_id in critical_cows or c_id in warning_cows:
                continue

            latest_obs = (
                self.db.query(DailyObservation)
                .filter(DailyObservation.cow_id == c_id)
                .order_by(DailyObservation.observation_date.desc())
                .first()
            )
            if latest_obs and latest_obs.observation_date and latest_obs.observation_date >= recent_threshold:
                healthy_count += 1
            else:
                no_recent_data_count += 1


        risk_counts = {
            "Heat Stress": 0,
            "Milk Drop": 0,
            "Health Condition": 0,
            "High Temperature": 0,
        }

        for alert in active_alerts:
            desc = (alert.description or "").lower()
            obs = alert.observation_id and self.db.get(DailyObservation, alert.observation_id)

            is_heat = "heat" in desc or (
                obs
                and getattr(obs, "weather_log", None)
                and getattr(obs.weather_log, "thi", 0)
                and float(obs.weather_log.thi) >= 70.0
            )
            is_milk = "milk" in desc or (
                alert.prediction_id is not None
                and obs
                and obs.milk_produced_liters is not None
            )
            is_fever = (
                obs
                and obs.body_temperature_c
                and (float(obs.body_temperature_c) > 39.5 or float(obs.body_temperature_c) < 37.5)
            ) or "fever" in desc or "temperature" in desc
            is_condition = (
                obs and obs.health_condition and obs.health_condition != "normal"
            ) or "abnormal" in desc or (obs and obs.symptoms)

            if is_heat:
                risk_counts["Heat Stress"] += 1
            if is_milk:
                risk_counts["Milk Drop"] += 1
            if is_fever:
                risk_counts["High Temperature"] += 1
            if is_condition and not is_fever:
                risk_counts["Health Condition"] += 1

            if not (is_heat or is_milk or is_fever or is_condition):
                risk_counts["Health Condition"] += 1

        risk_breakdown = [
            {"risk_type": k, "count": v} for k, v in risk_counts.items() if v > 0
        ]
        if not risk_breakdown:
            risk_breakdown = [{"risk_type": k, "count": 0} for k in risk_counts.keys()]

        attention_cows = []
        for c_id in (critical_cows | warning_cows):
            cow = cow_dict.get(c_id) or self.db.get(Cow, c_id)
            c_alerts = cow_alerts.get(c_id, [])
            worst_level = "Critical" if c_id in critical_cows else "Warning"

            first_alert = c_alerts[0] if c_alerts else None
            risk_desc = "Health Condition"
            if first_alert:
                d = (first_alert.description or "").lower()
                if "heat" in d:
                    risk_desc = "Heat Stress"
                elif "milk" in d:
                    risk_desc = "Milk Drop"
                elif "fever" in d or "temp" in d:
                    risk_desc = "High Temperature"

            latest_obs = (
                self.db.query(DailyObservation)
                .filter(DailyObservation.cow_id == c_id)
                .order_by(DailyObservation.observation_date.desc())
                .first()
            )
            last_date_str = (
                latest_obs.observation_date.strftime("%Y-%m-%d")
                if latest_obs and latest_obs.observation_date
                else None
            )

            attention_cows.append(
                {
                    "cow_id": c_id,
                    "cow_name": (cow.name or cow.tag_id) if cow else c_id,
                    "alert_level": worst_level,
                    "risk_type": risk_desc,
                    "last_observed_date": last_date_str,
                }
            )

        return {
            "summary": {
                "healthy": healthy_count,
                "warning": warning_count,
                "critical": critical_count,
                "needs_attention": needs_attention_count,
                "no_recent_data": no_recent_data_count,
                "total_cows": total_cows,
            },
            "risk_breakdown": risk_breakdown,
            "attention_cows": attention_cows,
        }


