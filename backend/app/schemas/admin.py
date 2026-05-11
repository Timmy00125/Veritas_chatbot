from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime


class TopicCount(BaseModel):
    topic: str
    count: int


class DayCount(BaseModel):
    date: str
    count: int


class StatsResponse(BaseModel):
    total_questions: int
    top_topics: list[TopicCount]
    total_conversations: int
    total_documents: int
    active_documents: int
    failed_documents: int
    questions_per_day: list[DayCount]
    avg_messages_per_conversation: float


class AdminConversationItem(BaseModel):
    id: int
    session_id: str
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int
    last_question: str | None = None

    model_config = ConfigDict(from_attributes=True)


class SettingResponse(BaseModel):
    id: int
    system_prompt: str
    strictness: float

    model_config = ConfigDict(from_attributes=True)


class SettingUpdate(BaseModel):
    system_prompt: str = Field(..., min_length=1, max_length=2000)
    strictness: float = Field(..., ge=0.0, le=1.0)
