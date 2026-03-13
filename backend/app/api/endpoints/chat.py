from fastapi import APIRouter, HTTPException, Depends
from typing import List
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.models.document import Document
from app.models.chat_log import ChatLog
from app.models.setting import Setting
from app.schemas.chat import ChatRequest, ChatResponse
from app.core.config import settings
from app.services.gemini_documents import (
    build_active_document_parts,
    is_dns_resolution_error,
    refresh_document_statuses,
)
from google import genai
from google.genai import types

router = APIRouter()

try:
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
except Exception:
    client = None

DEFAULT_SYSTEM_PROMPT = "You are a helpful school assistant answering student inquiries. Answer only based on the provided documents."
DEFAULT_STRICTNESS = 0.2


def _get_settings(db: Session):
    """Return the active settings row or fall back to defaults."""
    setting = db.query(Setting).first()
    if setting:
        return setting.system_prompt, setting.strictness
    return DEFAULT_SYSTEM_PROMPT, DEFAULT_STRICTNESS


@router.post("/query", response_model=ChatResponse)
async def chat_query(request: ChatRequest, db: Session = Depends(get_db)):
    system_prompt, strictness = _get_settings(db)
    documents = db.query(Document).all()

    refresh_document_statuses(db, documents, client)
    active_document_parts = build_active_document_parts(documents)

    if not client:
        # Fallback for testing or missing API key
        answer = "This is a grounded answer from the mock."
    else:
        try:
            contents = [*active_document_parts, request.message]

            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=strictness,
                ),
            )
            answer = response.text
        except Exception as e:
            if is_dns_resolution_error(e):
                raise HTTPException(
                    status_code=503,
                    detail=(
                        "Gemini API hostname could not be resolved from the backend "
                        "container. Verify Docker DNS and outbound internet access."
                    ),
                ) from e
            raise HTTPException(status_code=500, detail=str(e))

    # Log the interaction
    log_entry = ChatLog(question=request.message, answer=answer)
    db.add(log_entry)
    db.commit()

    return ChatResponse(answer=answer)
