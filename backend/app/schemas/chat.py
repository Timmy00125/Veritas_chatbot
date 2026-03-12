from pydantic import BaseModel, ConfigDict

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    answer: str
    
    model_config = ConfigDict(from_attributes=True)
