from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.models.chat_log import ChatLog
from app.models.setting import Setting
from app.schemas.admin import StatsResponse, SettingResponse, SettingUpdate

router = APIRouter()


def get_or_create_settings(db: Session) -> Setting:
    """Return the single settings row, creating one with defaults if it doesn't exist."""
    setting = db.query(Setting).first()
    if not setting:
        setting = Setting()
        db.add(setting)
        db.commit()
        db.refresh(setting)
    return setting


@router.get("/stats", response_model=StatsResponse)
def get_stats(db: Session = Depends(get_db)):
    """Return usage statistics: total number of questions asked."""
    total_questions = db.query(ChatLog).count()
    return StatsResponse(total_questions=total_questions)


@router.get("/settings", response_model=SettingResponse)
def get_settings(db: Session = Depends(get_db)):
    """Return the current chatbot settings."""
    return get_or_create_settings(db)


@router.put("/settings", response_model=SettingResponse)
def update_settings(payload: SettingUpdate, db: Session = Depends(get_db)):
    """Update the chatbot settings (system prompt and strictness/temperature)."""
    setting = get_or_create_settings(db)
    setting.system_prompt = payload.system_prompt
    setting.strictness = payload.strictness
    db.commit()
    db.refresh(setting)
    return setting
