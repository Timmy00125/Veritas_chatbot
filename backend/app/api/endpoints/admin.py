from fastapi import APIRouter, Depends
from collections import Counter
import re
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.models.chat_log import ChatLog
from app.models.setting import Setting
from app.schemas.admin import (
    StatsResponse,
    SettingResponse,
    SettingUpdate,
    TopicCount,
)

router = APIRouter()

STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "how",
    "i",
    "in",
    "is",
    "it",
    "me",
    "my",
    "of",
    "on",
    "or",
    "our",
    "that",
    "the",
    "this",
    "to",
    "we",
    "what",
    "when",
    "where",
    "which",
    "who",
    "why",
    "with",
    "you",
    "your",
}


def extract_top_topics(messages: list[str], limit: int = 5) -> list[TopicCount]:
    """Extract simple keyword-based topics from chat questions."""
    terms: list[str] = []
    for message in messages:
        words = re.findall(r"[a-zA-Z]{3,}", message.lower())
        terms.extend(word for word in words if word not in STOPWORDS)

    if not terms:
        return []

    top = Counter(terms).most_common(limit)
    return [TopicCount(topic=topic, count=count) for topic, count in top]


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
    """Return usage statistics: total questions and most common topics."""
    logs = db.query(ChatLog.question).all()
    questions = [row[0] for row in logs]
    total_questions = len(questions)
    top_topics = extract_top_topics(questions)
    return StatsResponse(total_questions=total_questions, top_topics=top_topics)


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
