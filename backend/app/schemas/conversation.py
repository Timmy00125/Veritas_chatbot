from pydantic import BaseModel
from datetime import datetime


class MessageItem(BaseModel):
    role: str
    content: str
    created_at: datetime


class ConversationListItem(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int

    model_config = {"from_attributes": True}


class ConversationDetail(BaseModel):
    id: int
    title: str
    created_at: datetime
    messages: list[MessageItem]

    model_config = {"from_attributes": True}
