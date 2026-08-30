from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.v1.auth import router as auth_router
from .api.v1.health import router as health_router
from .api.v1.observations import router as observations_router
from .api.v1.weather import router as weather_router
from .api.v1.feature_engineering import router as feature_engineering_router
from .api.v1.predictions import router as predictions_router
from .api.v1.explainability import router as explainability_router
from .api.v1.health_alerts import router as health_alerts_router
from .api.v1.recommendations import router as recommendations_router
from .api.v1.what_if import router as what_if_router
from .api.v1.dashboard import router as dashboard_router
from .api.v1.dairy import router as dairy_router
from .core.config import get_settings
from .core.logging import configure_logging

configure_logging()
settings = get_settings()

app = FastAPI(title=settings.app_name, debug=settings.app_debug)

# CORS - allow configured frontend origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(health_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(observations_router, prefix="/api/v1")
app.include_router(weather_router, prefix="/api/v1")
app.include_router(feature_engineering_router, prefix="/api/v1")
app.include_router(predictions_router, prefix="/api/v1")
app.include_router(explainability_router, prefix="/api/v1")
app.include_router(health_alerts_router, prefix="/api/v1")
app.include_router(recommendations_router, prefix="/api/v1")
app.include_router(what_if_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")
app.include_router(dairy_router, prefix="/api/v1")


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "DairyVision AI backend is running"}
