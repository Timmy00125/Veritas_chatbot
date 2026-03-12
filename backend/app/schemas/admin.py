from pydantic import BaseModel, ConfigDict, Field


class StatsResponse(BaseModel):
    total_questions: int


class SettingResponse(BaseModel):
    id: int
    system_prompt: str
    strictness: float

    model_config = ConfigDict(from_attributes=True)


class SettingUpdate(BaseModel):
    system_prompt: str = Field(..., min_length=1, max_length=2000)
    strictness: float = Field(..., ge=0.0, le=1.0)
