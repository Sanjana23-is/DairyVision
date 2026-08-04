"""Custom exception types for the API layer."""


class ObservationError(Exception):
    pass


class ObservationNotFound(ObservationError):
    pass


class ObservationForbidden(ObservationError):
    pass


class ObservationValidationError(ObservationError):
    pass


class ObservationError(Exception):
    pass


class ObservationNotFound(ObservationError):
    pass


class ObservationForbidden(ObservationError):
    pass


class ObservationValidationError(ObservationError):
    pass
