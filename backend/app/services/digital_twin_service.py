from __future__ import annotations

import logging
from datetime import datetime, date, timedelta, timezone
from typing import Optional, Any
from uuid import uuid4

from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models import Cow, DailyObservation, MilkPrediction, WeatherLog, Farm, HealthAlert, AnomalyRecord, Recommendation, DigitalTwinState
from app.schemas.digital_twin import (
    CowDigitalTwinResponse,
    HerdDigitalTwinResponse,
    HerdVitalitySummary,
    VitalSign,
    ProductionMetric,
    TopDriver,
)
from app.services.health_alert_service import HealthAlertService

logger = logging.getLogger(__name__)


class DigitalTwinService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.health_service = HealthAlertService(db)

    def _format_age(self, birth_date: Optional[date]) -> Optional[str]:
        if not birth_date:
            return None
        today = date.today()
        total_months = (today.year - birth_date.year) * 12 + (today.month - birth_date.month)
        if total_months < 12:
            return f"{total_months} mos"
        years = total_months // 12
        months = total_months % 12
        if months == 0:
            return f"{years} yrs"
        return f"{years} yrs {months} mos"

    def get_cow_digital_twin(self, user_id: str, cow_id: str) -> CowDigitalTwinResponse:
        cow = self.db.get(Cow, cow_id)
        if cow is None:
            raise ValueError("Cow not found")
        if cow.owner_id != user_id and getattr(cow, "created_by", None) != user_id:
            raise PermissionError("User does not own this cow")

        cow_name = cow.name or cow.tag_id or "Unknown cow"

        # 1. Fetch recent observations (last 7 observations for this cow)
        recent_obs = (
            self.db.query(DailyObservation)
            .filter(DailyObservation.cow_id == cow_id)
            .order_by(DailyObservation.observation_date.desc())
            .limit(7)
            .all()
        )
        latest_obs = recent_obs[0] if recent_obs else None

        # 2. Fetch latest prediction for this cow
        latest_pred = (
            self.db.query(MilkPrediction)
            .filter(MilkPrediction.cow_id == cow_id)
            .order_by(MilkPrediction.prediction_timestamp.desc())
            .first()
        )

        # 3. Fetch weather log
        latest_weather = None
        if latest_obs and getattr(latest_obs, "weather_log", None):
            latest_weather = latest_obs.weather_log
        elif latest_obs and getattr(latest_obs, "weather_log_id", None):
            latest_weather = self.db.get(WeatherLog, latest_obs.weather_log_id)
        else:
            latest_weather = (
                self.db.query(WeatherLog)
                .filter(WeatherLog.owner_id == user_id)
                .order_by(WeatherLog.recorded_at.desc())
                .first()
            )


        # 4. Fetch Health Alerts for this cow
        active_alerts = (
            self.db.query(HealthAlert)
            .filter(
                HealthAlert.cow_id == cow_id,
                HealthAlert.resolved.is_(False),
            )
            .all()
        )

        # 5. Fetch Anomalies for this cow
        recent_anomalies_records = (
            self.db.query(AnomalyRecord)
            .filter(AnomalyRecord.cow_id == cow_id)
            .order_by(AnomalyRecord.detected_at.desc())
            .limit(5)
            .all()
        )

        # 6. Fetch Recommendations for this cow
        active_recs = (
            self.db.query(Recommendation)
            .filter(
                Recommendation.cow_id == cow_id,
                Recommendation.completed.is_(False),
            )
            .order_by(Recommendation.created_at.desc())
            .limit(3)
            .all()
        )



        # -----------------------------------------------------------------
        # Health & Stress Status
        # -----------------------------------------------------------------
        worst_alert_level = "Healthy"
        if any(a.alert_level == "Critical" for a in active_alerts):
            worst_alert_level = "Critical"
        elif any(a.alert_level == "Warning" for a in active_alerts):
            worst_alert_level = "Warning"

        thi_val = float(latest_weather.thi) if latest_weather and latest_weather.thi else None
        if thi_val is not None:
            if thi_val >= 78.0:
                heat_stress_level = "High"
            elif thi_val >= 75.0:
                heat_stress_level = "Moderate"
            elif thi_val >= 72.0:
                heat_stress_level = "Mild"
            else:
                heat_stress_level = "Comfort"
        else:
            heat_stress_level = "Comfort"

        # -----------------------------------------------------------------
        # Vital Signs Construction
        # -----------------------------------------------------------------
        vital_signs: list[VitalSign] = []

        if latest_obs and latest_obs.body_temperature_c is not None:
            temp = float(latest_obs.body_temperature_c)
            status = "critical" if temp > 39.8 else ("warning" if temp > 39.5 else "normal")
            vital_signs.append(
                VitalSign(
                    name="Body Temperature",
                    value=f"{temp:.1f}",
                    unit="°C",
                    status=status,
                    description="Elevated temp indicates potential fever or heat stress" if temp > 39.5 else "Normal range (38.0–39.2 °C)",
                )
            )

        if latest_obs and latest_obs.feed_quantity_kg is not None:
            feed = float(latest_obs.feed_quantity_kg)
            vital_signs.append(
                VitalSign(
                    name="Feed Intake",
                    value=f"{feed:.1f}",
                    unit="kg/day",
                    status="normal" if feed >= 18.0 else "warning",
                    description="Dry matter feed consumption",
                )
            )


        if latest_obs and latest_obs.body_condition_score is not None:
            bcs = float(latest_obs.body_condition_score)
            status = "warning" if (bcs < 2.75 or bcs > 3.75) else "normal"
            vital_signs.append(
                VitalSign(
                    name="Body Condition Score",
                    value=f"{bcs:.2f}",
                    unit="/ 5.0",
                    status=status,
                    description="Ideal lactation BCS is 3.0–3.5",
                )
            )

        if thi_val is not None:
            status = "critical" if heat_stress_level == "High" else ("warning" if heat_stress_level in ("Moderate", "Mild") else "normal")
            vital_signs.append(
                VitalSign(
                    name="Heat Stress Index (THI)",
                    value=f"{thi_val:.1f}",
                    unit="THI",
                    status=status,
                    description=f"{heat_stress_level} thermal stress zone",
                )
            )

        # -----------------------------------------------------------------
        # Production Metrics Construction
        # -----------------------------------------------------------------
        curr_yield = float(latest_obs.milk_produced_liters) if latest_obs and latest_obs.milk_produced_liters is not None else None
        pred_yield = float(latest_pred.predicted_milk_yield) if latest_pred and latest_pred.predicted_milk_yield is not None else None

        efficiency = None
        baseline_status = "On Track"
        if curr_yield is not None and pred_yield is not None and pred_yield > 0:
            efficiency = round((curr_yield / pred_yield) * 100.0, 1)
            if efficiency >= 105.0:
                baseline_status = "Above Baseline"
            elif efficiency < 92.0:
                baseline_status = "Below Baseline"
            else:
                baseline_status = "On Track"

        trend_7d = None
        if len(recent_obs) >= 2 and recent_obs[0].milk_produced_liters is not None and recent_obs[-1].milk_produced_liters is not None:
            trend_7d = round(float(recent_obs[0].milk_produced_liters) - float(recent_obs[-1].milk_produced_liters), 1)

        production = ProductionMetric(
            current_yield_l=curr_yield,
            predicted_yield_l=pred_yield,
            efficiency_pct=efficiency,
            trend_7d_l_day=trend_7d,
            baseline_status=baseline_status,
        )

        # -----------------------------------------------------------------
        # Digital Twin Vitality Index (0 - 100%)
        # -----------------------------------------------------------------
        vitality = 100.0
        if worst_alert_level == "Critical":
            vitality -= 30.0
        elif worst_alert_level == "Warning":
            vitality -= 15.0

        if heat_stress_level == "High":
            vitality -= 20.0
        elif heat_stress_level == "Moderate":
            vitality -= 10.0
        elif heat_stress_level == "Mild":
            vitality -= 5.0

        if efficiency is not None:
            if efficiency < 80.0:
                vitality -= 20.0
            elif efficiency < 92.0:
                vitality -= 10.0

        if latest_obs and latest_obs.body_temperature_c and float(latest_obs.body_temperature_c) > 39.8:
            vitality -= 15.0

        vitality -= len(recent_anomalies_records) * 4.0
        vitality = max(15.0, min(100.0, round(vitality, 1)))

        # -----------------------------------------------------------------
        # Top Drivers (Farmer-Friendly Explanation)
        # -----------------------------------------------------------------
        top_drivers: list[TopDriver] = []

        if heat_stress_level in ("High", "Moderate"):
            top_drivers.append(
                TopDriver(
                    factor="Heat Stress (THI)",
                    impact="-2.2 L/day",
                    type="negative",
                    explanation=f"Elevated THI ({thi_val:.1f} if thi_val else 'high') reduces appetite and causes thermal discomfort.",
                )
            )
        elif heat_stress_level == "Comfort":
            top_drivers.append(
                TopDriver(
                    factor="Ambient Thermal Comfort",
                    impact="+1.5 L/day",
                    type="positive",
                    explanation="Favorable ambient temperatures support optimal feed intake and rumination.",
                )
            )

        if latest_obs and latest_obs.body_temperature_c and float(latest_obs.body_temperature_c) > 39.5:
            top_drivers.append(
                TopDriver(
                    factor="Body Temperature Elevation",
                    impact="-3.0 L/day",
                    type="negative",
                    explanation=f"Recorded temperature ({latest_obs.body_temperature_c:.1f} °C) diverts energy to immune response.",
                )
            )

        if latest_obs and latest_obs.feed_quantity_kg and float(latest_obs.feed_quantity_kg) >= 20.0:

            top_drivers.append(
                TopDriver(
                    factor="High Feed Intake",
                    impact="+1.8 L/day",
                    type="positive",
                    explanation="Robust dry matter intake directly powers milk synthesis.",
                )
            )

        if not top_drivers:
            top_drivers.append(
                TopDriver(
                    factor="Balanced Lactation State",
                    impact="Stable",
                    type="neutral",
                    explanation=f"{cow_name} is operating in a stable lactation state.",
                )
            )

        # -----------------------------------------------------------------
        # Status Summary & Recommendations Text
        # -----------------------------------------------------------------
        summary_parts = []
        summary_parts.append(f"{cow_name} is currently operating at a Digital Twin Vitality Index of {vitality:.0f}%.")
        if worst_alert_level != "Healthy":
            summary_parts.append(f"Active health status is {worst_alert_level}.")
        if heat_stress_level != "Comfort":
            summary_parts.append(f"Environment indicates {heat_stress_level} heat stress.")
        if baseline_status != "On Track" and curr_yield is not None:
            summary_parts.append(f"Milk yield is currently {baseline_status.lower()}.")

        status_summary = " ".join(summary_parts)

        anomalies_list = [a.title for a in recent_anomalies_records if getattr(a, 'title', None)]
        recs_list = [r.title for r in active_recs if getattr(r, 'title', None)]
        if not recs_list and active_alerts:
            enriched_alert = self.health_service.enrich_health_alert_response(active_alerts[0])
            if enriched_alert.recommended_actions:
                recs_list = enriched_alert.recommended_actions

        obs_date = latest_obs.created_at if latest_obs else datetime.now(timezone.utc)

        lact_stage = getattr(cow, "lactation_stage", None)
        if not lact_stage and getattr(cow, "lactation_number", None) is not None:
            lact_stage = f"Lactation {cow.lactation_number}"

        breed_str = None
        if cow.breed:
            breed_str = cow.breed.name if hasattr(cow.breed, "name") else (cow.breed if isinstance(cow.breed, str) else None)

        response = CowDigitalTwinResponse(

            cow_id=cow.id,
            cow_name=cow_name,
            breed=breed_str,
            age_display=self._format_age(cow.birth_date),
            lactation_stage=lact_stage,
            weight_kg=float(cow.weight_kg) if cow.weight_kg else None,
            vitality_score=vitality,
            health_status=worst_alert_level,
            heat_stress_level=heat_stress_level,
            status_summary=status_summary,
            vital_signs=vital_signs,
            production=production,
            top_drivers=top_drivers,
            active_alerts_count=len(active_alerts),
            active_anomalies_count=len(recent_anomalies_records),
            recent_anomalies=anomalies_list,
            recommended_actions=recs_list,
            last_updated=obs_date,
        )
        return response

    def refresh_cow_digital_twin_state(self, user_id: str, cow_id: str) -> CowDigitalTwinResponse:

        response = self.get_cow_digital_twin(user_id, cow_id)
        cow = self.db.get(Cow, cow_id)
        if cow:
            twin_record = (
                self.db.query(DigitalTwinState)
                .filter(DigitalTwinState.cow_id == cow_id, DigitalTwinState.owner_id == user_id)
                .first()
            )
            now = datetime.now(timezone.utc)
            if twin_record is None:
                twin_record = DigitalTwinState(
                    id=str(uuid4()),
                    cow_id=cow.id,
                    farm_id=cow.farm_id,
                    owner_id=user_id,
                    vitality_score=response.vitality_score,
                    health_status=response.health_status,
                    heat_stress_level=response.heat_stress_level,
                    status_summary=response.status_summary,
                    state_data=response.model_dump(mode="json"),
                    created_at=now,
                    updated_at=now,
                )
                self.db.add(twin_record)
            else:
                twin_record.vitality_score = response.vitality_score
                twin_record.health_status = response.health_status
                twin_record.heat_stress_level = response.heat_stress_level
                twin_record.status_summary = response.status_summary
                twin_record.state_data = response.model_dump(mode="json")
                twin_record.updated_at = now
            
            try:
                self.db.commit()
            except Exception as e:
                self.db.rollback()
                logger.warning(f"Could not persist DigitalTwinState for cow {cow_id}: {e}")

        return response




    def get_herd_digital_twin(self, user_id: str, farm_id: Optional[str] = None) -> HerdDigitalTwinResponse:
        query = self.db.query(Cow).filter(
            (Cow.owner_id == user_id) | (Cow.created_by == user_id)
        )
        if farm_id and str(farm_id).strip() and str(farm_id) != "undefined" and str(farm_id) != "null":
            query = query.filter(Cow.farm_id == str(farm_id))
        cows = query.all()

        cow_states: list[CowDigitalTwinResponse] = []
        for c in cows:
            try:
                state = self.get_cow_digital_twin(user_id, c.id)
                cow_states.append(state)
            except Exception as e:
                logger.error(f"Failed to compute Digital Twin state for cow {c.id} ({c.name or c.tag_id}): {e}", exc_info=True)



        total_cows = len(cow_states)
        if total_cows == 0:
            return HerdDigitalTwinResponse(
                herd_summary=HerdVitalitySummary(
                    total_cows=0,
                    average_vitality_score=0.0,
                    total_daily_yield_l=0.0,
                    total_predicted_yield_l=0.0,
                    health_distribution={"Healthy": 0, "Warning": 0, "Critical": 0},
                    heat_stress_distribution={"Comfort": 0, "Mild": 0, "Moderate": 0, "High": 0},
                    attention_cow_count=0,
                ),
                cow_states=[],
            )

        avg_vitality = round(sum(cs.vitality_score for cs in cow_states) / total_cows, 1)
        tot_yield = round(sum(cs.production.current_yield_l or 0.0 for cs in cow_states), 1)
        tot_pred = round(sum(cs.production.predicted_yield_l or 0.0 for cs in cow_states), 1)

        health_dist = {"Healthy": 0, "Warning": 0, "Critical": 0}
        heat_dist = {"Comfort": 0, "Mild": 0, "Moderate": 0, "High": 0}
        attention_count = 0

        for cs in cow_states:
            health_dist[cs.health_status] = health_dist.get(cs.health_status, 0) + 1
            heat_dist[cs.heat_stress_level] = heat_dist.get(cs.heat_stress_level, 0) + 1
            if cs.health_status in ("Warning", "Critical") or cs.heat_stress_level == "High":
                attention_count += 1

        return HerdDigitalTwinResponse(
            herd_summary=HerdVitalitySummary(
                total_cows=total_cows,
                average_vitality_score=avg_vitality,
                total_daily_yield_l=tot_yield,
                total_predicted_yield_l=tot_pred,
                health_distribution=health_dist,
                heat_stress_distribution=heat_dist,
                attention_cow_count=attention_count,
            ),
            cow_states=cow_states,
        )
