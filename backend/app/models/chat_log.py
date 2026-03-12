from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.db import Base
from datetime import datetime, timezone

class ChatLog(Base):
    __tablename__ = "chat_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
