from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import List, Optional
from uuid import uuid4

import numpy as np
from sqlalchemy import or_
from sqlalchemy.orm import Session
from sklearn.ensemble import IsolationForest

from app.models import AnomalyRecord, Cow, DailyObservation, Farm, MilkPrediction, WeatherLog

logger = logging.getLogger(__name__)


class AnomalyDetectionService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def detect_for_observation(
        self,
        user_id: str,
        observation_id: str,
        persist: bool = True,
    ) -> Optional[AnomalyRecord]:
        obs = self.db.get(DailyObservation, observation_id)
        if obs is None:
            raise ValueError("Observation not found")
        if obs.owner_id != user_id:
            raise PermissionError("User does not own this observation")

        cow = self.db.get(Cow, obs.cow_id)
        if cow is None:
            raise ValueError("Cow not found")

        farm = self.db.get(Farm, cow.farm_id)
        if farm is None:
            raise ValueError("Farm not found")

        # Gather context features
        weather = obs.weather_log_id and self.db.get(WeatherLog, obs.weather_log_id)
        prediction = (
            self.db.query(MilkPrediction)
            .filter(MilkPrediction.observation_id == observation_id)
            .first()
        )

        # Build feature values
        milk = float(obs.milk_produced_liters) if obs.milk_produced_liters is not None else None
        feed = float(obs.feed_quantity_kg) if obs.feed_quantity_kg is not None else None
        thi = float(weather.thi) if weather and weather.thi is not None else None
        weight = float(cow.weight_kg) if cow.weight_kg is not None else None
        age = float(cow.age_months / 12.0) if cow.age_months is not None else None
        temp = float(obs.body_temperature_c) if obs.body_temperature_c is not None else None
        cond = obs.health_condition or "normal"

        # Calculate deviation score & tags
        tags: List[str] = []
        score_components: List[float] = []

        # 1. Milk yield anomaly vs prediction or typical threshold
        milk_drop_ratio = 0.0
        if milk is not None and prediction is not None and float(prediction.predicted_milk_yield) > 0:
            exp = float(prediction.predicted_milk_yield)
            if milk < exp:
                milk_drop_ratio = (exp - milk) / exp
                if milk_drop_ratio >= 0.30:
                    tags.append("Abnormal Milk Drop")
                    score_components.append(min(1.0, milk_drop_ratio))

        if milk is not None and milk <= 5.0 and "Abnormal Milk Drop" not in tags:
            tags.append("Abnormal Milk Drop")
            score_components.append(0.6)

        # 2. Feed intake anomaly
        if feed is not None:
            if feed <= 5.0 or feed >= 35.0:
                tags.append("Unusual Feed Intake")
                score_components.append(0.65)

        # 3. Extreme Heat stress
        if thi is not None and thi >= 78.0:
            tags.append("Extreme Heat Stress")
            score_components.append(min(1.0, (thi - 70.0) / 15.0))

        # 4. Temperature / fever spike
        if temp is not None and (temp > 39.5 or temp < 37.5):
            tags.append("High Temperature Spike")
            score_components.append(0.85)

        # 5. Health condition
        if cond != "normal" and "High Temperature Spike" not in tags:
            tags.append(f"Condition Anomaly ({cond.capitalize()})")
            score_components.append(0.7)

        # ML Isolation Forest scoring over farm historical baseline
        ml_score = 0.0
        try:
            obs_history = (
                self.db.query(DailyObservation)
                .filter(DailyObservation.farm_id == farm.id)
                .limit(200)
                .all()
            )
            data_rows = []
            for o in obs_history:
                if o.milk_produced_liters is not None and o.feed_quantity_kg is not None:
                    o_thi = float(o.weather_log.thi) if getattr(o, "weather_log", None) and o.weather_log.thi else 70.0
                    data_rows.append([float(o.milk_produced_liters), float(o.feed_quantity_kg), o_thi])

            if len(data_rows) >= 5 and milk is not None and feed is not None:
                cur_thi = thi if thi is not None else 70.0
                X = np.array(data_rows)
                clf = IsolationForest(contamination=0.1, random_state=42)
                clf.fit(X)
                raw_score = -clf.decision_function(np.array([[milk, feed, cur_thi]]))[0]
                ml_score = max(0.0, min(1.0, (raw_score + 0.2) / 0.4))
                if clf.predict(np.array([[milk, feed, cur_thi]]))[0] == -1 and not tags:
                    tags.append("Isolation Forest Outlier")
        except Exception as exc:
            logger.debug("ML Anomaly isolation forest skipped: %s", str(exc))

        if ml_score > 0:
            score_components.append(ml_score)

        # Combined normalized score
        if score_components:
            anomaly_score = max(score_components)
        else:
            anomaly_score = 0.05

        anomaly_score = round(max(0.0, min(1.0, anomaly_score)), 2)

        # Assign severity
        if anomaly_score >= 0.75 or "High Temperature Spike" in tags or milk_drop_ratio >= 0.40:
            severity = "Critical"
        elif anomaly_score >= 0.35 or len(tags) > 0:
            severity = "Warning"
        else:
            severity = "Normal"

        if not tags:
            tags = ["Normal Pattern"]

        issue_desc = ", ".join(tags)
        desc = f"Anomaly score {anomaly_score:.2f} ({severity}): {issue_desc}"

        details_json = {
            "milk_produced_liters": milk,
            "expected_milk_yield": float(prediction.predicted_milk_yield) if prediction else None,
            "feed_quantity_kg": feed,
            "thi": thi,
            "body_temperature_c": temp,
            "health_condition": cond,
            "anomaly_score": anomaly_score,
        }

        # Prevent duplicate records for the same observation
        if persist:
            existing = (
                self.db.query(AnomalyRecord)
                .filter(AnomalyRecord.observation_id == observation_id)
                .first()
            )
            if existing:
                existing.anomaly_score = anomaly_score
                existing.severity = severity
                existing.anomaly_type = "composite"
                existing.issue_tags = tags
                existing.description = desc
                existing.details = details_json
                existing.detected_at = datetime.now(timezone.utc)
                self.db.commit()
                self.db.refresh(existing)
                return existing

            record = AnomalyRecord(
                id=str(uuid4()),
                cow_id=cow.id,
                observation_id=observation_id,
                farm_id=farm.id,
                owner_id=user_id,
                anomaly_score=anomaly_score,
                severity=severity,
                anomaly_type="composite",
                issue_tags=tags,
                description=desc,
                details=details_json,
                detected_at=datetime.now(timezone.utc),
                resolved=False,
            )
            self.db.add(record)
            self.db.commit()
            self.db.refresh(record)
            return record

        return AnomalyRecord(
            id=str(uuid4()),
            cow_id=cow.id,
            observation_id=observation_id,
            farm_id=farm.id,
            owner_id=user_id,
            anomaly_score=anomaly_score,
            severity=severity,
            anomaly_type="composite",
            issue_tags=tags,
            description=desc,
            details=details_json,
            detected_at=datetime.now(timezone.utc),
            resolved=False,
        )

    def run_herd_anomaly_scan(self, user_id: str, farm_id: Optional[str] = None) -> int:
        obs_query = self.db.query(DailyObservation).join(Cow, DailyObservation.cow_id == Cow.id).filter(DailyObservation.owner_id == user_id)
        if farm_id:
            obs_query = obs_query.filter(Cow.farm_id == farm_id)

        latest_obs = obs_query.order_by(DailyObservation.observation_date.desc()).limit(100).all()
        count = 0
        for obs in latest_obs:
            try:
                self.detect_for_observation(user_id, obs.id, persist=True)
                count += 1
            except Exception as exc:
                logger.warning("Failed to run anomaly detection for observation %s: %s", obs.id, str(exc))
        return count


    def get_anomaly_summary(self, user_id: str, farm_id: Optional[str] = None) -> dict:
        cows_query = self.db.query(Cow).filter(Cow.owner_id == user_id)
        if farm_id:
            cows_query = cows_query.filter(Cow.farm_id == farm_id)
        cows = cows_query.all()
        cow_dict = {c.id: c for c in cows}
        total_scanned = len(cows)

        anom_query = self.db.query(AnomalyRecord).filter(AnomalyRecord.owner_id == user_id)
        if farm_id:
            anom_query = anom_query.filter(AnomalyRecord.farm_id == farm_id)
        records = anom_query.order_by(AnomalyRecord.detected_at.desc()).all()

        # Latest anomaly per cow
        cow_latest_anom: dict[str, AnomalyRecord] = {}
        for r in records:
            if r.cow_id not in cow_latest_anom:
                cow_latest_anom[r.cow_id] = r

        normal_cnt = 0
        warning_cnt = 0
        critical_cnt = 0
        unresolved_cnt = 0

        for c_id in cow_dict:
            rec = cow_latest_anom.get(c_id)
            if rec is None or rec.severity == "Normal":
                normal_cnt += 1
            elif rec.severity == "Warning":
                warning_cnt += 1
                if not rec.resolved:
                    unresolved_cnt += 1
            elif rec.severity == "Critical":
                critical_cnt += 1
                if not rec.resolved:
                    unresolved_cnt += 1

        # Top anomalous cows
        top_cows = []
        sorted_records = sorted(
            [r for r in cow_latest_anom.values() if r.severity in ("Warning", "Critical")],
            key=lambda x: x.anomaly_score,
            reverse=True,
        )

        for rec in sorted_records[:10]:
            cow = cow_dict.get(rec.cow_id) or self.db.get(Cow, rec.cow_id)
            latest_obs = (
                self.db.query(DailyObservation)
                .filter(DailyObservation.cow_id == rec.cow_id)
                .order_by(DailyObservation.observation_date.desc())
                .first()
            )
            last_date_str = (
                latest_obs.observation_date.strftime("%Y-%m-%d")
                if latest_obs and latest_obs.observation_date
                else None
            )

            tags = rec.issue_tags if isinstance(rec.issue_tags, list) else ["Anomaly Detected"]
            top_cows.append(
                {
                    "cow_id": rec.cow_id,
                    "cow_name": (cow.name or cow.tag_id) if cow else rec.cow_id,
                    "anomaly_score": rec.anomaly_score,
                    "severity": rec.severity,
                    "issue_tags": tags,
                    "last_observed_date": last_date_str,
                }
            )

        return {
            "summary": {
                "total_scanned": total_scanned,
                "normal": normal_cnt,
                "warning": warning_cnt,
                "critical": critical_cnt,
                "unresolved_anomalies": unresolved_cnt,
            },
            "top_anomalous_cows": top_cows,
            "recent_anomalies": records[:50],
        }

    def list_anomalies(
        self,
        user_id: str,
        severity: Optional[str] = None,
        resolved: Optional[bool] = None,
        cow_id: Optional[str] = None,
        search: Optional[str] = None,
    ) -> list[AnomalyRecord]:
        query = self.db.query(AnomalyRecord).filter(AnomalyRecord.owner_id == user_id)
        if severity is not None:
            query = query.filter(AnomalyRecord.severity == severity)
        if resolved is not None:
            query = query.filter(AnomalyRecord.resolved.is_(resolved))
        if cow_id is not None:
            query = query.filter(AnomalyRecord.cow_id == cow_id)
        if search is not None and search.strip():
            term = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    AnomalyRecord.description.ilike(term),
                    AnomalyRecord.severity.ilike(term),
                    AnomalyRecord.anomaly_type.ilike(term),
                )
            )
        return query.order_by(AnomalyRecord.detected_at.desc()).all()
