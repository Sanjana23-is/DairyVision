from typing import Annotated

from fastapi import APIRouter, Depends

from app.dependencies.auth import get_current_user
from app.schemas.auth import MeResponse

router = APIRouter()


@router.get("/health")
def health_check(_current_user: Annotated[MeResponse, Depends(get_current_user)]) -> dict[str, str]:
    return {"status": "ok"}
