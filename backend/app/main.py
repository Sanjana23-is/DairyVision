from fastapi import FastAPI

from .api.v1.auth import router as auth_router
from .api.v1.health import router as health_router
from .api.v1.observations import router as observations_router
from .api.v1.weather import router as weather_router
from .api.v1.feature_engineering import router as feature_engineering_router
from .core.config import get_settings
from .core.logging import configure_logging

configure_logging()
settings = get_settings()

app = FastAPI(title=settings.app_name, debug=settings.app_debug)
app.include_router(health_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(observations_router, prefix="/api/v1")
app.include_router(weather_router, prefix="/api/v1")
app.include_router(feature_engineering_router, prefix="/api/v1")


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "DairyVision AI backend is running"}
