from sqlalchemy import Column, Integer, String, Float
from sqlalchemy.orm import Mapped, mapped_column
from app.core.db import Base

class Setting(Base):
    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    system_prompt: Mapped[str] = mapped_column(String(2000), nullable=False, default="You are a helpful school assistant answering student inquiries. Answer only based on the provided documents.")
    strictness: Mapped[float] = mapped_column(Float, nullable=False, default=0.2)
