from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone, date
from uuid import uuid4
from typing import Any, Optional

from sqlalchemy import or_, func
from sqlalchemy.orm import Session

from app.repositories.health_alert_repository import HealthAlertRepository
from app.models import HealthAlert, MilkPrediction, DailyObservation, Cow, Farm, WeatherLog
from app.schemas.feature import FeatureVector
from app.schemas.health_alert import HealthAlertResponse

logger = logging.getLogger(__name__)


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

    def enrich_health_alert_response(self, alert: HealthAlert) -> HealthAlertResponse:
        cow = self.db.get(Cow, alert.cow_id)
        cow_name = (cow.name or cow.tag_id) if (cow and (cow.name or cow.tag_id)) else "Unknown cow"


        obs = self.db.get(DailyObservation, alert.observation_id) if alert.observation_id else None
        pred = self.db.get(MilkPrediction, alert.prediction_id) if alert.prediction_id else None
        weather = None
        if obs and getattr(obs, "weather_log", None):
            weather = obs.weather_log
        elif obs and getattr(obs, "weather_log_id", None):
            weather = self.db.get(WeatherLog, obs.weather_log_id)

        desc_lower = (alert.description or "").lower()
        atype_lower = (alert.alert_type or "").lower()

        # Derive Farmer-Facing Risk Display Name (never expose raw 'composite')
        if "heat" in atype_lower or "heat" in desc_lower:
            risk_display_name = "Heat Stress"
        elif "temp" in atype_lower or "fever" in atype_lower or "fever" in desc_lower or "temperature" in desc_lower or (obs and obs.body_temperature_c and obs.body_temperature_c > 39.5):
            risk_display_name = "High Temperature"
        elif "milk" in atype_lower or "milk" in desc_lower or (pred and obs and obs.milk_produced_liters is not None):
            risk_display_name = "Milk Production Drop"
        else:
            risk_display_name = "Health Condition"

        # Observation Date
        obs_date_str = obs.observation_date.strftime("%d %b %Y") if obs and obs.observation_date else alert.created_at.strftime("%d %b %Y")

        # Farmer-Facing Why Explanation (Never expose raw debug strings like heat_score=0.47)
        if alert.description and "heat_score=" not in alert.description and "milk_score=" not in alert.description:
            why_explanation = alert.description
        else:
            parts = []
            if risk_display_name == "Heat Stress":
                thi_val = f" (THI {weather.thi:.1f})" if weather and weather.thi else ""
                parts.append(f"{cow_name} has experienced elevated heat-stress conditions during recent monitoring{thi_val}.")
                parts.append("High heat stress reduces feed intake, lowers milk production, and increases animal stress.")
            elif risk_display_name == "High Temperature":
                temp_val = f" ({obs.body_temperature_c:.1f} °C)" if obs and obs.body_temperature_c else " above normal range"
                parts.append(f"{cow_name} recorded an elevated body temperature{temp_val}.")
                parts.append("Elevated body temperature can be a sign of fever or acute infection and should be checked by a veterinarian.")
            elif risk_display_name == "Milk Production Drop":
                yield_val = f" ({obs.milk_produced_liters:.1f} L/day)" if obs and obs.milk_produced_liters is not None else ""
                parts.append(f"{cow_name}'s milk yield{yield_val} dropped compared with expected production baseline.")
                parts.append("Yield drops can be caused by health conditions, nutritional deficiencies, or heat stress.")
            else:
                cond_val = f" ({obs.health_condition.capitalize()})" if obs and obs.health_condition and obs.health_condition != "normal" else ""
                parts.append(f"{cow_name} was recorded with an abnormal health condition{cond_val} during recent observation.")
                parts.append("Abnormal health conditions can affect animal welfare and milk yield.")

            why_explanation = " ".join(parts)

        # Structured Evidence Dictionary (Only include existing measurements!)
        evidence: dict[str, Any] = {}

        if weather and getattr(weather, "thi", None) is not None:
            thi_num = float(weather.thi)
            thi_label = "High Heat Stress" if thi_num >= 78.0 else ("Moderate Heat Stress" if thi_num >= 75.0 else "Mild Stress")
            evidence["Heat Stress Index (THI)"] = f"{thi_num:.1f} ({thi_label})"

        if obs and getattr(obs, "body_temperature_c", None) is not None:
            evidence["Body Temperature"] = f"{float(obs.body_temperature_c):.1f} °C"

        if obs and getattr(obs, "milk_produced_liters", None) is not None:
            evidence["Milk Yield"] = f"{float(obs.milk_produced_liters):.1f} L/day"

        if pred and pred.predicted_milk_yield and obs and obs.milk_produced_liters is not None:
            expected = float(pred.predicted_milk_yield)
            observed = float(obs.milk_produced_liters)
            if expected > 0:
                drop_pct = int(((expected - observed) / expected) * 100)
                if drop_pct > 0:
                    evidence["Production vs Expected"] = f"{drop_pct}% below expected ({expected:.1f} L/day baseline)"

        if obs and getattr(obs, "health_condition", None) and obs.health_condition != "normal":
            evidence["Health Condition"] = obs.health_condition.capitalize()

        if obs and getattr(obs, "symptoms", None) and isinstance(obs.symptoms, dict) and len(obs.symptoms) > 0:
            evidence["Recorded Symptoms"] = ", ".join(obs.symptoms.keys()).capitalize()

        if obs and getattr(obs, "observation_date", None):
            evidence["Observation Date"] = obs.observation_date.strftime("%d %b %Y")

        # Recommended Actions
        if risk_display_name == "Heat Stress":
            recommended_actions = [
                "Ensure continuous access to cool, fresh drinking water",
                "Provide shade, fans, or misting cooling support",
                "Monitor cow closely during peak afternoon heat",
            ]
        elif risk_display_name == "High Temperature":
            recommended_actions = [
                "Isolate cow from herd to prevent potential contagion",
                "Contact a veterinarian immediately for diagnosis and treatment",
                "Provide comfortable bedding and fresh water",
            ]
        elif risk_display_name == "Milk Production Drop":
            recommended_actions = [
                "Inspect TMR quality and feed bunk access",
                "Increase dietary energy density to support recovery",
                "Check for underlying health or thermal stress",
            ]
        else:
            recommended_actions = [
                "Arrange a veterinary check-up promptly",
                "Monitor feed intake and vital signs closely",
                "Keep detailed daily observation records",
            ]

        return HealthAlertResponse(
            id=alert.id,
            cow_id=alert.cow_id,
            observation_id=alert.observation_id,
            prediction_id=alert.prediction_id,
            farm_id=alert.farm_id,
            alert_level=alert.alert_level,
            alert_type=alert.alert_type,
            description=why_explanation,  # Provide plain English description
            confidence=float(alert.confidence or 0.0),
            resolved=alert.resolved,
            owner_id=alert.owner_id,
            created_at=alert.created_at,
            risk_display_name=risk_display_name,
            why_explanation=why_explanation,
            evidence=evidence,
            cow_name=cow_name,
            observation_date=obs_date_str,
            recommended_actions=recommended_actions,
        )

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
        # Infer cow when possible
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

        cow = self._validate_cow_ownership(cow_id, user_id)
        farm = self.db.get(Farm, cow.farm_id)
        cow_name = cow.name or cow.tag_id or "Unknown cow"


        # Fetch recent observations (rolling window of up to 5 observations in last 14 days)
        cutoff_date = date.today() - timedelta(days=14)
        recent_obs = (
            self.db.query(DailyObservation)
            .filter(
                DailyObservation.cow_id == cow_id,
                DailyObservation.owner_id == user_id,
                DailyObservation.observation_date >= cutoff_date,
            )
            .order_by(DailyObservation.observation_date.desc())
            .limit(5)
            .all()
        )

        current_obs = self.db.get(DailyObservation, observation_id) if observation_id else (recent_obs[0] if recent_obs else None)

        # Collect linked records
        pred = None
        if prediction_id:
            pred = self.db.get(MilkPrediction, prediction_id)
        elif observation_id:
            pred = self.db.query(MilkPrediction).filter(MilkPrediction.observation_id == observation_id).first()
            if pred:
                prediction_id = pred.id

        weather = self.db.get(WeatherLog, weather_log_id) if weather_log_id else None

        # -------------------------------------------------------------
        # Evaluate Health Signals across Rolling Window
        # -------------------------------------------------------------
        from app.core.project_paths import ensure_project_root_on_path
        ensure_project_root_on_path()
        from config import THI_COMFORT, THI_MILD, THI_SEVERE

        obs_window = recent_obs if recent_obs else ([current_obs] if current_obs else [])
        obs_count = len(obs_window)

        fever_readings = []
        heat_readings = []
        milk_drop_readings = []
        condition_readings = []

        latest_temp = getattr(current_obs, "body_temperature_c", None) if current_obs else None
        latest_health_cond = getattr(current_obs, "health_condition", None) if current_obs else None
        latest_symptoms = getattr(current_obs, "symptoms", None) if current_obs else None

        for o in obs_window:
            if o.body_temperature_c and o.body_temperature_c > 39.5:
                fever_readings.append(o)

            if (o.health_condition and o.health_condition != "normal") or (isinstance(o.symptoms, dict) and len(o.symptoms) > 0):
                condition_readings.append(o)

            o_thi = None
            if o.weather_log and o.weather_log.thi:
                o_thi = float(o.weather_log.thi)
            if o_thi and o_thi >= 75.0:
                heat_readings.append(o)

            if pred and o.milk_produced_liters is not None and pred.predicted_milk_yield > 0:
                drop = (pred.predicted_milk_yield - o.milk_produced_liters) / pred.predicted_milk_yield
                if drop > 0.15:
                    milk_drop_readings.append(drop)

        current_thi = None
        if feature_vector and getattr(feature_vector, 'thi', None) is not None:
            current_thi = float(feature_vector.thi)
        elif weather and getattr(weather, 'thi', None) is not None:
            current_thi = float(weather.thi)
        elif current_obs and current_obs.weather_log and current_obs.weather_log.thi:
            current_thi = float(current_obs.weather_log.thi)

        if current_thi and current_thi >= 75.0 and current_obs not in heat_readings:
            heat_readings.append(current_obs)

        # Determine Primary Risk Type
        primary_risk = "composite"
        if len(fever_readings) > 0 or (latest_temp and latest_temp > 39.5):
            primary_risk = "high_temperature"
        elif len(heat_readings) > 0 or (current_thi and current_thi >= 75.0):
            primary_risk = "heat_stress"
        elif len(milk_drop_readings) > 0:
            primary_risk = "milk_drop"
        elif len(condition_readings) > 0:
            primary_risk = "health_condition"

        # Calculate Severity & Confidence
        confidence = 0.0
        level = "Healthy"

        is_acute_fever = latest_temp is not None and latest_temp > 39.8
        is_acute_heat = current_thi is not None and current_thi >= 80.0
        is_acute_condition = latest_health_cond in ("mastitis", "fever")

        if is_acute_fever or is_acute_heat or is_acute_condition or len(fever_readings) >= 2 or len(heat_readings) >= 2:
            level = "Critical"
            confidence = 0.88 + (0.05 if len(obs_window) > 1 else 0.0)
        elif len(fever_readings) == 1 or len(heat_readings) == 1 or len(milk_drop_readings) >= 1 or len(condition_readings) >= 1 or (current_thi and current_thi >= 70.0):
            level = "Warning"
            confidence = 0.55
        else:
            level = "Healthy"
            confidence = 0.10

        confidence = max(0.0, min(1.0, confidence))

        # Synthesize Multi-Observation Farmer-Friendly Evidence Summary
        summary_parts = []
        if len(heat_readings) > 1:
            summary_parts.append(f"{cow_name} has experienced high heat-stress conditions across {len(heat_readings)} recent observations.")
        elif len(heat_readings) == 1:
            thi_val = f" (THI {current_thi:.1f})" if current_thi else ""
            summary_parts.append(f"Recent weather monitoring indicates heat-stress conditions{thi_val} for {cow_name}.")

        if len(fever_readings) > 1:
            summary_parts.append(f"{cow_name} has experienced elevated body temperature across {len(fever_readings)} recent observations.")
        elif len(fever_readings) == 1 or (latest_temp and latest_temp > 39.5):
            temp_val = f" ({latest_temp:.1f} °C)" if latest_temp else ""
            summary_parts.append(f"{cow_name} recorded body temperature above normal range{temp_val}.")


        if len(milk_drop_readings) > 0:
            avg_drop_pct = int((sum(milk_drop_readings) / len(milk_drop_readings)) * 100)
            summary_parts.append(f"Milk production has declined ~{avg_drop_pct}% compared with expected baseline.")

        if len(condition_readings) > 0 and not any("temperature" in p for p in summary_parts):
            cond_name = latest_health_cond if latest_health_cond and latest_health_cond != "normal" else "abnormal symptoms"
            summary_parts.append(f"Recorded with {cond_name} during recent observation.")

        if not summary_parts:
            summary_desc = f"Health monitoring indicates {cow_name} is in a Healthy state."
        else:
            summary_desc = " ".join(summary_parts)

        # Update-or-Insert Active Alert Deduplication
        active_alerts_for_cow = (
            self.db.query(HealthAlert)
            .filter(
                HealthAlert.cow_id == cow_id,
                HealthAlert.owner_id == user_id,
                HealthAlert.resolved.is_(False),
                or_(
                    HealthAlert.alert_type == primary_risk,
                    HealthAlert.alert_type == "composite"
                )
            )
            .order_by(HealthAlert.created_at.desc())
            .all()
        )

        if active_alerts_for_cow:
            existing_active = active_alerts_for_cow[0]
            for extra in active_alerts_for_cow[1:]:
                extra.resolved = True

            if level == "Healthy":
                existing_active.resolved = True
                existing_active.alert_level = "Healthy"
                existing_active.confidence = confidence
                existing_active.description = summary_desc
                if persist:
                    self.db.commit()
                    self.db.refresh(existing_active)
                return existing_active
            else:
                existing_active.alert_level = level
                existing_active.alert_type = primary_risk
                existing_active.confidence = confidence
                existing_active.description = summary_desc
                existing_active.observation_id = observation_id or current_obs.id if current_obs else existing_active.observation_id
                if prediction_id:
                    existing_active.prediction_id = prediction_id
                if farm:
                    existing_active.farm_id = farm.id

                if persist:
                    self.db.commit()
                    self.db.refresh(existing_active)
                return existing_active

        if level == "Healthy":
            ha = HealthAlert(
                id=str(uuid4()),
                cow_id=cow_id,
                observation_id=observation_id,
                prediction_id=prediction_id,
                farm_id=getattr(farm, 'id', None),
                alert_level="Healthy",
                alert_type="composite",
                description=summary_desc,
                confidence=confidence,
                resolved=True,
                owner_id=user_id,
                created_at=datetime.now(timezone.utc),
            )
            return ha

        ha = HealthAlert(
            cow_id=cow_id,
            observation_id=observation_id,
            prediction_id=prediction_id,
            farm_id=getattr(farm, 'id', None),
            alert_level=level,
            alert_type=primary_risk,
            description=summary_desc,
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
        return ha

    def list_health_alerts(
        self,
        user_id: str,
        alert_level: Optional[str] = None,
        resolved: Optional[bool] = None,
        cow_id: Optional[str] = None,
        prediction_id: Optional[str] = None,
        search: Optional[str] = None,
    ) -> list[HealthAlertResponse]:
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

        raw_alerts = query.order_by(HealthAlert.created_at.desc()).all()

        # Deduplicate active alerts so only ONE active record per (cow_id, alert_type) is exposed
        final_alerts: list[HealthAlert] = []
        if resolved is False or resolved is None:
            seen_active_keys: set[tuple[str, str]] = set()
            for alert in raw_alerts:
                if not alert.resolved:
                    key = (alert.cow_id, alert.alert_type or "composite")
                    if key in seen_active_keys:
                        continue
                    seen_active_keys.add(key)
                final_alerts.append(alert)
        else:
            final_alerts = raw_alerts

        # Return enriched farmer-facing responses
        return [self.enrich_health_alert_response(alert) for alert in final_alerts]

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

        heat_cows: set[str] = set()
        milk_cows: set[str] = set()
        fever_cows: set[str] = set()
        condition_cows: set[str] = set()

        for alert in active_alerts:
            c_id = alert.cow_id
            atype = (alert.alert_type or "").lower()
            desc = (alert.description or "").lower()

            if "heat" in atype or "heat" in desc:
                heat_cows.add(c_id)
            elif "milk" in atype or "milk" in desc:
                milk_cows.add(c_id)
            elif "fever" in atype or "temperature" in atype or "temperature" in desc or "fever" in desc:
                fever_cows.add(c_id)
            else:
                condition_cows.add(c_id)

        risk_breakdown = [
            {"risk_type": "Heat Stress", "count": len(heat_cows)},
            {"risk_type": "Milk Drop", "count": len(milk_cows)},
            {"risk_type": "High Temperature", "count": len(fever_cows)},
            {"risk_type": "Health Condition", "count": len(condition_cows)},
        ]

        attention_cows = []
        for c_id in (critical_cows | warning_cows):
            cow = cow_dict.get(c_id) or self.db.get(Cow, c_id)
            c_alerts = cow_alerts.get(c_id, [])
            worst_level = "Critical" if c_id in critical_cows else "Warning"

            first_alert = c_alerts[0] if c_alerts else None
            risk_desc = "Health Condition"
            if first_alert:
                d = ((first_alert.alert_type or "") + " " + (first_alert.description or "")).lower()
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
