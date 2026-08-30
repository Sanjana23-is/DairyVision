"""ORM models package for the DairyVision backend."""

from .activity_log import ActivityLog
from .breed_alias import BreedAlias
from .breed_master import BreedMaster
from .cow import Cow
from .daily_observation import DailyObservation
from .farm import Farm
from .farm_member import FarmMember
from .farm_settings import FarmSettings
from .health_alert import HealthAlert
from .milk_prediction import MilkPrediction
from .anomaly_record import AnomalyRecord
from .explainability_result import ExplainabilityResult
from .recommendation import Recommendation
from .digital_twin import DigitalTwinState
from .user import User
from .user_preference import UserPreference
from .weather_log import WeatherLog

__all__ = [
    "ActivityLog",
    "AnomalyRecord",
    "BreedAlias",
    "BreedMaster",
    "Cow",
    "DailyObservation",
    "DigitalTwinState",
    "Farm",
    "FarmMember",
    "FarmSettings",
    "HealthAlert",
    "MilkPrediction",
    "ExplainabilityResult",
    "Recommendation",
    "User",
    "UserPreference",
    "WeatherLog",
]


