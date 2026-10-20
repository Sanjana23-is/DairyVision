import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from .api.v1.auth import router as auth_router
from .api.v1.health import router as health_router
from .api.v1.observations import router as observations_router
from .api.v1.weather import router as weather_router
from .api.v1.feature_engineering import router as feature_engineering_router
from .api.v1.predictions import router as predictions_router
from .api.v1.explainability import router as explainability_router
from .api.v1.health_alerts import router as health_alerts_router
from .api.v1.anomaly_detection import router as anomaly_detection_router
from .api.v1.recommendations import router as recommendations_router
from .api.v1.digital_twin import router as digital_twin_router
from .api.v1.what_if import router as what_if_router
from .api.v1.dashboard import router as dashboard_router
from .api.v1.dairy import router as dairy_router
from .core.config import get_settings
from .core.logging import configure_logging
from .database.init_db import ensure_database_schema
from .exceptions import AuthError, AuthUnauthorized, AuthServiceUnavailable, AuthRateLimitExceeded

logger = logging.getLogger(__name__)
configure_logging()
settings = get_settings()


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            return await call_next(request)
        except Exception as exc:
            logger.exception("Unhandled server exception [%s %s]: %s", request.method, request.url.path, exc)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={"detail": "Internal server error"},
            )


def _sanitize_auth_unauthorized_message(exc: Exception) -> str:
    raw = str(exc).strip()
    lowered = raw.lower()
    if any(marker in lowered for marker in ("traceback", "file ", "line ", "psycopg", "postgres", "sqlalchemy", "select ", "http://", "https://", "eyjh")):
        return "The provided authentication token is invalid or expired."
    if "deactivated" in lowered:
        return "This account has been deactivated."
    if "incorrect" in lowered or "invalid login credentials" in lowered or "invalid credentials" in lowered:
        return "The supplied email address or password is incorrect."
    if "invalid or expired" in lowered or "expired" in lowered or "jwt" in lowered:
        return "The provided authentication token is invalid or expired."
    if "missing" in lowered or "no authentication token" in lowered:
        return "Missing authorization header"
    if "user not found" in lowered:
        return "User not found"
    if len(raw) <= 120 and not any(marker in lowered for marker in ("error:", "exception", "traceback")):
        return raw
    return "The provided authentication token is invalid or expired."


def _sanitize_auth_error_message(exc: Exception) -> str:
    raw = str(exc).strip()
    lowered = raw.lower()
    if any(marker in lowered for marker in ("traceback", "file ", "line ", "psycopg", "postgres", "sqlalchemy", "select ", "http://", "https://", "eyjh")):
        return "The request could not be processed due to invalid authentication data."
    if "at least 8" in lowered or "password must be" in lowered:
        return "Password must be at least 8 characters long."
    if "invalid email" in lowered or ("email address" in lowered and "invalid" in lowered):
        return "The supplied email address is invalid."
    if "already" in lowered and "registered" in lowered or "already exists" in lowered:
        return "An account already exists for this email address."
    if "password" in lowered and ("requirement" in lowered or "meet" in lowered):
        return "The supplied password does not meet the current authentication requirements."
    if len(raw) <= 120 and not any(marker in lowered for marker in ("error:", "exception", "traceback")):
        return raw
    return "The request could not be processed due to invalid authentication data."


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_database_schema()
    yield


app = FastAPI(title=settings.app_name, debug=settings.app_debug, lifespan=lifespan)

# Inner middleware: catch unhandled errors so they return proper JSON
app.add_middleware(ErrorHandlingMiddleware)

# Outermost middleware: CORS wraps all responses, including error responses
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(AuthUnauthorized)
async def auth_unauthorized_handler(request: Request, exc: AuthUnauthorized):
    logger.warning("AuthUnauthorized [%s %s]: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content={"detail": _sanitize_auth_unauthorized_message(exc)},
    )


@app.exception_handler(AuthRateLimitExceeded)
async def auth_rate_limit_handler(request: Request, exc: AuthRateLimitExceeded):
    logger.warning("AuthRateLimitExceeded [%s %s]: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={"detail": "Email rate limit exceeded. Please wait a few minutes before trying again."},
    )


@app.exception_handler(AuthServiceUnavailable)
async def auth_service_unavailable_handler(request: Request, exc: AuthServiceUnavailable):
    logger.warning("AuthServiceUnavailable [%s %s]: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"detail": "Authentication service is temporarily unavailable. Please try again later."},
    )


@app.exception_handler(AuthError)
async def auth_error_handler(request: Request, exc: AuthError):
    logger.warning("AuthError [%s %s]: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": _sanitize_auth_error_message(exc)},
    )
app.include_router(health_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(observations_router, prefix="/api/v1")
app.include_router(weather_router, prefix="/api/v1")
app.include_router(feature_engineering_router, prefix="/api/v1")
app.include_router(predictions_router, prefix="/api/v1")
app.include_router(explainability_router, prefix="/api/v1")
app.include_router(health_alerts_router, prefix="/api/v1")
app.include_router(anomaly_detection_router, prefix="/api/v1")
app.include_router(recommendations_router, prefix="/api/v1")
app.include_router(digital_twin_router, prefix="/api/v1")
app.include_router(what_if_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")
app.include_router(dairy_router, prefix="/api/v1")


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "DairyVision AI backend is running"}
