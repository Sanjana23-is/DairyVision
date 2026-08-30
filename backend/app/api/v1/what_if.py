from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import get_current_user_id
from app.exceptions import PredictionValidationError
from app.schemas.what_if import (
    WhatIfRequest,
    WhatIfResponse,
    HerdWhatIfRequest,
    HerdWhatIfResponse,
    CowWhatIfRequest,
    CowWhatIfResponse,
    SimulationInput,
)
from app.services.what_if_service import WhatIfService

router = APIRouter(prefix="/what-if", tags=["what-if"])


def get_what_if_service(db: Session = Depends(get_db)) -> WhatIfService:
    return WhatIfService(db)


@router.post("", response_model=WhatIfResponse)
def run_what_if(
    payload: WhatIfRequest,
    user_id: str = Depends(get_current_user_id),
    service: WhatIfService = Depends(get_what_if_service),
) -> WhatIfResponse:
    try:
        return service.run_what_if(user_id, payload)
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    except (ValueError, PredictionValidationError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/herd", response_model=HerdWhatIfResponse)
def run_herd_what_if(
    payload: HerdWhatIfRequest,
    user_id: str = Depends(get_current_user_id),
    service: WhatIfService = Depends(get_what_if_service),
) -> HerdWhatIfResponse:
    try:
        return service.run_herd_what_if(user_id, payload)
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    except (ValueError, PredictionValidationError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/cow/{cow_id}", response_model=CowWhatIfResponse)
def run_cow_what_if(
    cow_id: str,
    payload: CowWhatIfRequest,
    user_id: str = Depends(get_current_user_id),
    service: WhatIfService = Depends(get_what_if_service),
) -> CowWhatIfResponse:
    try:
        return service.run_cow_what_if(user_id=user_id, cow_id=cow_id, request=payload)
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    except (ValueError, PredictionValidationError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))



