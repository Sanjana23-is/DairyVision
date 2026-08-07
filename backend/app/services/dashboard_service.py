from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from typing import List

from sqlalchemy import case, func
from sqlalchemy.orm import Session, aliased, joinedload

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

    def ensure_farm_accessible(self, user_id: str, farm_id: str) -> None:
        """Validate farm existence/ownership once, up front.

        Used by callers (e.g. the trends endpoint) that need to run several
        trend/distribution queries against the same farm, so that ownership
        is checked exactly once instead of being re-checked by every
        individual query method.
        """
        self._get_farm(user_id, farm_id)

    @staticmethod
    def _today() -> date:
        """Single source of truth for "today" across all dashboard queries.

        Always uses UTC so that summary figures (e.g. "today's" prediction
        average) and trend windows (e.g. the last N days) bucket data using
        the same day boundary, regardless of the server's local timezone.
        """
        return datetime.now(timezone.utc).date()

    def get_dashboard_summary(self, user_id: str, farm_id: str) -> dict:
        farm = self._get_farm(user_id, farm_id)
        today = self._today()

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

        total_farms = scope_query(self.db.query(Farm), Farm, user_id).count() or 0

        total_cow_count = (
            self.db.query(func.count())
            .select_from(Cow)
            .filter(Cow.farm_id == farm_id)
            .scalar()
            or 0
        )

        total_daily_observations = (
            self.db.query(func.count())
            .select_from(DailyObservation)
            .join(Cow)
            .filter(Cow.farm_id == farm_id)
            .scalar()
            or 0
        )

        total_milk = (
            self.db.query(func.coalesce(func.sum(DailyObservation.milk_produced_liters), 0.0))
            .join(Cow)
            .filter(Cow.farm_id == farm_id)
            .scalar()
            or 0.0
        )

        total_milk_produced = float(total_milk)
        average_milk_per_cow = float(total_milk_produced / total_cow_count) if total_cow_count else 0.0

        active_recommendations = (
            self.db.query(func.count())
            .select_from(Recommendation)
            .filter(Recommendation.farm_id == farm_id, Recommendation.completed.is_(False))
            .scalar()
            or 0
        )

        prediction_accuracy = None
        Observation = aliased(DailyObservation)
        accuracy_row = (
            self.db.query(
                func.avg(
                    1
                    - func.abs(
                        MilkPrediction.predicted_milk_yield - Observation.milk_produced_liters
                    )
                    / (Observation.milk_produced_liters + 0.0)
                ).label("accuracy")
            )
            .select_from(MilkPrediction)
            .join(Cow, Cow.id == MilkPrediction.cow_id)
            .join(Observation, Observation.id == MilkPrediction.observation_id)
            .filter(
                Cow.farm_id == farm_id,
                Observation.milk_produced_liters.isnot(None),
                Observation.milk_produced_liters > 0,
            )
            .scalar()
        )
        if accuracy_row is not None:
            accuracy_pct = float(accuracy_row) * 100.0
            prediction_accuracy = max(0.0, min(100.0, accuracy_pct))

        return {
            "farm": farm,
            "total_farms": int(total_farms),
            "total_cow_count": int(total_cow_count),
            "active_cow_count": int(active_cow_count),
            "total_daily_observations": int(total_daily_observations),
            "total_milk_produced": total_milk_produced,
            "average_milk_per_cow": average_milk_per_cow,
            "active_recommendations": int(active_recommendations),
            "prediction_accuracy": prediction_accuracy,
            "herd_summary": herd_summary,
            "todays_milk_predictions": today_predictions,
            "average_predicted_milk_yield": float(avg_yield or 0.0),
            "todays_weather": todays_weather,
            "active_health_alerts": active_alerts,
            "recent_recommendations": recent_recommendations,
            "recent_observations": recent_observations,
        }

    def get_milk_yield_trends(self, user_id: str, farm_id: str, days: int = 14) -> list[dict]:
        # NOTE: does not re-validate farm access; caller must invoke
        # ensure_farm_accessible()/_get_farm() beforehand (see get_dashboard_trends).
        today = self._today()
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
        # NOTE: does not re-validate farm access; caller must invoke
        # ensure_farm_accessible()/_get_farm() beforehand (see get_dashboard_trends).
        today = self._today()
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

    def get_observation_trends(self, user_id: str, farm_id: str, days: int = 14) -> list[dict]:
        # NOTE: does not re-validate farm access; caller must invoke
        # ensure_farm_accessible()/_get_farm() beforehand (see get_dashboard_trends).
        today = self._today()
        window_start = today - timedelta(days=days - 1)

        rows = (
            self.db.query(
                func.date(DailyObservation.observation_date).label("date"),
                func.count().label("observation_count"),
                func.coalesce(func.sum(DailyObservation.milk_produced_liters), 0.0).label("total_milk_produced"),
            )
            .join(Cow)
            .filter(
                Cow.farm_id == farm_id,
                DailyObservation.observation_date >= window_start,
            )
            .group_by(func.date(DailyObservation.observation_date))
            .order_by(func.date(DailyObservation.observation_date))
            .all()
        )

        return [
            {
                "date": row.date,
                "observation_count": int(row.observation_count),
                "total_milk_produced": float(row.total_milk_produced or 0.0),
            }
            for row in rows
        ]

    def get_recommendation_category_distribution(self, user_id: str, farm_id: str) -> list[dict]:
        # NOTE: does not re-validate farm access; caller must invoke
        # ensure_farm_accessible()/_get_farm() beforehand (see get_dashboard_trends).
        rows = (
            self.db.query(
                Recommendation.category.label("category"),
                func.count().label("count"),
            )
            .filter(Recommendation.farm_id == farm_id)
            .group_by(Recommendation.category)
            .order_by(func.count().desc())
            .all()
        )

        return [{"category": row.category, "count": int(row.count)} for row in rows]

    def get_health_alert_distribution(self, user_id: str, farm_id: str) -> list[dict]:
        # NOTE: does not re-validate farm access; caller must invoke
        # ensure_farm_accessible()/_get_farm() beforehand (see get_dashboard_trends).
        rows = (
            self.db.query(
                HealthAlert.alert_level.label("category"),
                func.count().label("count"),
            )
            .filter(HealthAlert.farm_id == farm_id)
            .group_by(HealthAlert.alert_level)
            .order_by(func.count().desc())
            .all()
        )

        return [{"category": row.category, "count": int(row.count)} for row in rows]

    def get_cow_health_status_distribution(self, user_id: str, farm_id: str) -> list[dict]:
        # NOTE: does not re-validate farm access; caller must invoke
        # ensure_farm_accessible()/_get_farm() beforehand (see get_dashboard_trends).
        rows = (
            self.db.query(
                Cow.status.label("category"),
                func.count().label("count"),
            )
            .filter(Cow.farm_id == farm_id)
            .group_by(Cow.status)
            .order_by(func.count().desc())
            .all()
        )

        return [{"category": row.category, "count": int(row.count)} for row in rows]

    def get_weather_trends(self, user_id: str, farm_id: str, days: int = 7) -> list[dict]:
        # NOTE: does not re-validate farm access; caller must invoke
        # ensure_farm_accessible()/_get_farm() beforehand (see get_dashboard_trends).
        today = self._today()
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
