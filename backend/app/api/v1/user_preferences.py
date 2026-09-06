from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user, get_db
from app.models.user_preference import UserPreference
from app.schemas.auth import MeResponse, UserPreferenceSchema

router = APIRouter(prefix="/user-preferences", tags=["user-preferences"])
logger = logging.getLogger(__name__)

VALID_LANGUAGES = {"en", "hi", "mr", "gu", "pa", "bn"}
VALID_CURRENCIES = {"INR", "USD", "EUR", "GBP", "AUD"}
VALID_BREED_DISPLAY = {"canonical", "alias", "auto"}


@router.get("", response_model=UserPreferenceSchema)
def get_user_preferences(
    current_user: Annotated[MeResponse, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> UserPreferenceSchema:
    """Get current user's preferences."""
    pref = db.scalar(select(UserPreference).where(UserPreference.user_id == current_user.user.id))
    if pref is None:
        # Return defaults if no preference record exists yet
        return UserPreferenceSchema(
            preferred_language="en",
            preferred_currency="INR",
            breed_display_preference="canonical",
            show_local_names=True,
        )
    return UserPreferenceSchema.model_validate(pref)


@router.put("", response_model=UserPreferenceSchema)
def update_user_preferences(
    payload: UserPreferenceSchema,
    current_user: Annotated[MeResponse, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> UserPreferenceSchema:
    """Update current user's preferences. Only provided fields are updated."""
    pref = db.scalar(select(UserPreference).where(UserPreference.user_id == current_user.user.id))

    if pref is None:
        pref = UserPreference(
            user_id=current_user.user.id,
            preferred_language="en",
            preferred_currency="INR",
            breed_display_preference="canonical",
            show_local_names=True,
        )
        db.add(pref)

    if payload.preferred_language is not None:
        lang = payload.preferred_language.strip().lower()
        if lang and lang in VALID_LANGUAGES:
            pref.preferred_language = lang

    if payload.preferred_currency is not None:
        currency = payload.preferred_currency.strip().upper()
        if currency and currency in VALID_CURRENCIES:
            pref.preferred_currency = currency

    if payload.breed_display_preference is not None:
        disp = payload.breed_display_preference.strip().lower()
        if disp in VALID_BREED_DISPLAY:
            pref.breed_display_preference = disp

    if payload.show_local_names is not None:
        pref.show_local_names = payload.show_local_names

    try:
        db.commit()
        db.refresh(pref)
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to update user preferences")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save preferences. Please try again.",
        ) from exc

    return UserPreferenceSchema.model_validate(pref)
