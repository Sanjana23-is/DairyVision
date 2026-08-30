"""Custom exception types for the API layer."""


class ObservationError(Exception):
    pass


class ObservationNotFound(ObservationError):
    pass


class ObservationForbidden(ObservationError):
    pass


class ObservationValidationError(ObservationError):
    pass


class WeatherError(Exception):
    pass


class WeatherNotFound(WeatherError):
    pass


class WeatherForbidden(WeatherError):
    pass


class WeatherValidationError(WeatherError):
    pass


class PredictionError(Exception):
    pass


class PredictionNotFound(PredictionError):
    pass


class PredictionValidationError(PredictionError):
    pass


class ExplainabilityError(Exception):
    pass


class ExplainabilityNotFound(ExplainabilityError):
    pass


class ExplainabilityValidationError(ExplainabilityError):
    pass
