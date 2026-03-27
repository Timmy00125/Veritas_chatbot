from pydantic import BaseModel, ConfigDict
from typing import Optional


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    conversation_id: Optional[int] = None


class ChatResponse(BaseModel):
    answer: str
    conversation_id: int

    model_config = ConfigDict(from_attributes=True)
