from fastapi import FastAPI

from .api.v1.health import router as health_router
from .core.config import get_settings
from .core.logging import configure_logging

configure_logging()
settings = get_settings()

app = FastAPI(title=settings.app_name, debug=settings.app_debug)
app.include_router(health_router, prefix="/api/v1")


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "DairyVision AI backend is running"}
