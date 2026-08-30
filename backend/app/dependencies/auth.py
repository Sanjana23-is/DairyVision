from __future__ import annotations

from typing import Annotated, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.auth import MeResponse
from app.services.auth_service import AuthService


class CurrentUserContext:
    def __init__(self, user: MeResponse) -> None:
        self.user = user

security = HTTPBearer(auto_error=False)


def get_optional_auth_service(db: Annotated[Session, Depends(get_db)]) -> AuthService:
    return AuthService(db=db)


def get_bearer_token(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security)] = None,
) -> str:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing authorization header")
    return credentials.credentials


def get_current_user(
    token: Annotated[str, Depends(get_bearer_token)] = None,
    db: Annotated[Session, Depends(get_db)] = None,
) -> MeResponse:
    auth_service = AuthService(db=db)
    try:
        return auth_service.me(token)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


def get_current_user_id(current_user: Annotated[MeResponse, Depends(get_current_user)]) -> str:
    return current_user.user.id
