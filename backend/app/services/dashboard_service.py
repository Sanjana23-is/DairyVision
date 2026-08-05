from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import List

from sqlalchemy import case, func
from sqlalchemy.orm import Session, joinedload

from app.models import (
    Cow,
    DailyObservation,
    Farm,
    HealthAlert,
    MilkPrediction,
    Recommendation,
    WeatherLog,
)
from app.repositories.ownership import ensure_record_accessible, scope_query


class DashboardService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def _get_farm(self, user_id: str, farm_id: str) -> Farm:
        farm = self.db.query(Farm).filter(Farm.id == farm_id).first()
        if farm is None:
            raise ValueError("Farm not found")
        ensure_record_accessible(farm, user_id)
        return farm

    def get_dashboard_summary(self, user_id: str, farm_id: str) -> dict:
        farm = self._get_farm(user_id, farm_id)
        today = date.today()

        active_cow_count = (
            self.db.query(func.count())
            .select_from(Cow)
            .filter(Cow.farm_id == farm_id, Cow.status == "active")
            .scalar()
            or 0
        )

        herd_counts = (
            self.db.query(Cow.status, func.count())
            .filter(Cow.farm_id == farm_id)
            .group_by(Cow.status)
            .all()
        )
        herd_summary = [
            {"status": status, "count": count} for status, count in herd_counts
        ]

        today_predictions = (
            self.db.query(MilkPrediction)
            .join(Cow)
            .filter(
                Cow.farm_id == farm_id,
                func.date(MilkPrediction.prediction_timestamp) == today,
            )
            .order_by(MilkPrediction.prediction_timestamp.desc())
            .all()
        )

        avg_yield = (
            self.db.query(func.avg(MilkPrediction.predicted_milk_yield))
            .join(Cow)
            .filter(
                Cow.farm_id == farm_id,
                func.date(MilkPrediction.prediction_timestamp) == today,
            )
            .scalar()
        )

        todays_weather = (
            self.db.query(WeatherLog)
            .filter(
                WeatherLog.farm_id == farm_id,
                func.date(WeatherLog.recorded_at) == today,
            )
            .order_by(WeatherLog.recorded_at.desc())
            .first()
        )

        active_alerts = (
            self.db.query(HealthAlert)
            .filter(HealthAlert.farm_id == farm_id, HealthAlert.resolved.is_(False))
            .order_by(HealthAlert.created_at.desc())
            .limit(10)
            .all()
        )

        recent_recommendations = (
            self.db.query(Recommendation)
            .filter(Recommendation.farm_id == farm_id)
            .order_by(Recommendation.created_at.desc())
            .limit(10)
            .all()
        )

        recent_observations = (
            self.db.query(DailyObservation)
            .options(joinedload(DailyObservation.cow))
            .join(Cow)
            .filter(Cow.farm_id == farm_id)
            .order_by(DailyObservation.observation_date.desc(), DailyObservation.created_at.desc())
            .limit(10)
            .all()
        )

        return {
            "farm": farm,
            "herd_summary": herd_summary,
            "active_cow_count": int(active_cow_count),
            "todays_milk_predictions": today_predictions,
            "average_predicted_milk_yield": float(avg_yield or 0.0),
            "todays_weather": todays_weather,
            "active_health_alerts": active_alerts,
            "recent_recommendations": recent_recommendations,
            "recent_observations": recent_observations,
        }

    def get_milk_yield_trends(self, user_id: str, farm_id: str, days: int = 14) -> list[dict]:
        self._get_farm(user_id, farm_id)
        today = date.today()
        window_start = today - timedelta(days=days - 1)

        rows = (
            self.db.query(
                func.date(MilkPrediction.prediction_timestamp).label("date"),
                func.avg(MilkPrediction.predicted_milk_yield).label("average_predicted_milk_yield"),
                func.count().label("prediction_count"),
            )
            .join(Cow)
            .filter(
                Cow.farm_id == farm_id,
                func.date(MilkPrediction.prediction_timestamp) >= window_start,
            )
            .group_by(func.date(MilkPrediction.prediction_timestamp))
            .order_by(func.date(MilkPrediction.prediction_timestamp))
            .all()
        )

        return [
            {
                "date": row.date,
                "average_predicted_milk_yield": float(row.average_predicted_milk_yield or 0.0),
                "prediction_count": int(row.prediction_count),
            }
            for row in rows
        ]

    def get_health_alert_trends(self, user_id: str, farm_id: str, days: int = 14) -> list[dict]:
        self._get_farm(user_id, farm_id)
        today = date.today()
        window_start = today - timedelta(days=days - 1)

        rows = (
            self.db.query(
                func.date(HealthAlert.created_at).label("date"),
                func.count().label("total_alerts"),
                func.sum(case((HealthAlert.alert_level == "Critical", 1), else_=0)).label("critical_count"),
                func.sum(case((HealthAlert.alert_level == "Warning", 1), else_=0)).label("warning_count"),
                func.sum(case((HealthAlert.alert_level == "Healthy", 1), else_=0)).label("healthy_count"),
            )
            .filter(
                HealthAlert.farm_id == farm_id,
                func.date(HealthAlert.created_at) >= window_start,
            )
            .group_by(func.date(HealthAlert.created_at))
            .order_by(func.date(HealthAlert.created_at))
            .all()
        )

        return [
            {
                "date": row.date,
                "total_alerts": int(row.total_alerts),
                "critical_count": int(row.critical_count),
                "warning_count": int(row.warning_count),
                "healthy_count": int(row.healthy_count),
            }
            for row in rows
        ]

    def get_weather_trends(self, user_id: str, farm_id: str, days: int = 7) -> list[dict]:
        self._get_farm(user_id, farm_id)
        today = date.today()
        window_start = today - timedelta(days=days - 1)

        rows = (
            self.db.query(
                func.date(WeatherLog.recorded_at).label("date"),
                func.avg(WeatherLog.temperature).label("average_temperature"),
                func.avg(WeatherLog.humidity).label("average_humidity"),
                func.avg(WeatherLog.thi).label("average_thi"),
            )
            .filter(
                WeatherLog.farm_id == farm_id,
                func.date(WeatherLog.recorded_at) >= window_start,
            )
            .group_by(func.date(WeatherLog.recorded_at))
            .order_by(func.date(WeatherLog.recorded_at))
            .all()
        )

        return [
            {
                "date": row.date,
                "average_temperature": float(row.average_temperature or 0.0),
                "average_humidity": float(row.average_humidity or 0.0),
                "average_thi": float(row.average_thi or 0.0),
            }
            for row in rows
        ]

    def get_observation_history(self, user_id: str, farm_id: str, limit: int = 20) -> list[dict]:
        self._get_farm(user_id, farm_id)

        observations = (
            self.db.query(DailyObservation)
            .options(joinedload(DailyObservation.cow))
            .join(Cow)
            .filter(Cow.farm_id == farm_id)
            .order_by(DailyObservation.observation_date.desc(), DailyObservation.created_at.desc())
            .limit(limit)
            .all()
        )

        return [
            {
                "id": observation.id,
                "cow_id": observation.cow_id,
                "cow_name": observation.cow.name if observation.cow is not None else None,
                "observation_date": observation.observation_date,
                "milk_produced_liters": float(observation.milk_produced_liters) if observation.milk_produced_liters is not None else None,
                "feed_quantity_kg": float(observation.feed_quantity_kg) if observation.feed_quantity_kg is not None else None,
                "symptoms": observation.symptoms,
                "notes": observation.notes,
                "created_at": observation.created_at,
            }
            for observation in observations
        ]
