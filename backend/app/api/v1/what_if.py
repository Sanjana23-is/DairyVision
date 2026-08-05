from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import get_current_user_id
from app.schemas.what_if import WhatIfRequest, WhatIfResponse
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
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
