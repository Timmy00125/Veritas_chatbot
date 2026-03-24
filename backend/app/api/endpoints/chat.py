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
    extract_file_ids_from_permission_error,
    is_dns_resolution_error,
    is_file_permission_error,
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


def _mark_documents_failed_by_file_ids(
    db: Session,
    documents: list[Document],
    denied_file_ids: set[str],
) -> bool:
    """Mark inaccessible Gemini files as FAILED so they are excluded from grounding."""
    if not denied_file_ids:
        return False

    normalized_denied_ids = {file_id.split("/")[-1] for file_id in denied_file_ids}
    has_changes = False

    for document in documents:
        document_file_id = document.gemini_file_id.split("/")[-1]
        if document_file_id not in normalized_denied_ids:
            continue
        if document.status == "FAILED" and document.gemini_file_uri is None:
            continue

        document.status = "FAILED"
        document.gemini_file_uri = None
        has_changes = True

    if has_changes:
        db.commit()

    return has_changes


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

            if is_file_permission_error(e):
                denied_file_ids = extract_file_ids_from_permission_error(e)
                changed_documents = _mark_documents_failed_by_file_ids(
                    db,
                    documents,
                    denied_file_ids,
                )

                if changed_documents:
                    try:
                        retry_parts = build_active_document_parts(documents)
                        retry_contents = [*retry_parts, request.message]

                        retry_response = client.models.generate_content(
                            model="gemini-2.5-flash",
                            contents=retry_contents,
                            config=types.GenerateContentConfig(
                                system_instruction=system_prompt,
                                temperature=strictness,
                            ),
                        )
                        answer = retry_response.text
                    except Exception as retry_error:
                        if is_dns_resolution_error(retry_error):
                            raise HTTPException(
                                status_code=503,
                                detail=(
                                    "Gemini API hostname could not be resolved from the backend "
                                    "container. Verify Docker DNS and outbound internet access."
                                ),
                            ) from retry_error
                        raise HTTPException(status_code=500, detail=str(retry_error))
                else:
                    raise HTTPException(
                        status_code=503,
                        detail=(
                            "One or more document references are inaccessible in Gemini. "
                            "Re-upload the affected documents and retry."
                        ),
                    ) from e
            else:
                raise HTTPException(status_code=500, detail=str(e))

    # Log the interaction
    log_entry = ChatLog(question=request.message, answer=answer)
    db.add(log_entry)
    db.commit()

    return ChatResponse(answer=answer)
