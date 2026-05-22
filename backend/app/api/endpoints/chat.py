from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.db import get_db
from app.models.document import Document
from app.models.chat_log import ChatLog
from app.models.setting import Setting
from app.models.conversation import Conversation
from app.schemas.chat import ChatRequest, ChatResponse
from app.schemas.conversation import ConversationListItem, ConversationDetail, MessageItem
from app.core.config import settings
from app.services.gemini_documents import (
    build_active_document_parts,
    extract_file_ids_from_permission_error,
    is_dns_resolution_error,
    is_file_permission_error,
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
    setting = setting = db.query(Setting).first()
    if setting:
        return setting.system_prompt, setting.strictness
    return DEFAULT_SYSTEM_PROMPT, DEFAULT_STRICTNESS


def _mark_documents_failed_by_file_ids(
    db: Session,
    documents: list[Document],
    denied_file_ids: set[str],
) -> bool:
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


def _mark_document_failed(db: Session, document: Document) -> None:
    document.status = "FAILED"
    document.gemini_file_uri = None
    db.commit()


def _get_active_documents(documents: list[Document]) -> list[Document]:
    return [
        document
        for document in documents
        if document.status == "ACTIVE" and bool(document.gemini_file_uri)
    ]


def _generate_with_documents(
    request_message: str,
    system_prompt: str,
    strictness: float,
    grounding_documents: list[Document],
) -> str:
    document_parts = build_active_document_parts(grounding_documents)
    contents = [*document_parts, request_message]

    response = client.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=strictness,
        ),
    )
    return response.text


def _get_or_create_conversation(
    db: Session,
    session_id: str,
    conversation_id: Optional[int],
    first_message: str
) -> tuple[Conversation, bool]:
    is_new = False
    if conversation_id:
        conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
        if conversation:
            conversation.updated_at = func.now()
            db.commit()
            return conversation, is_new
    if session_id:
        conversation = Conversation(
            session_id=session_id,
            title=first_message[:100] if len(first_message) > 100 else first_message
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
        is_new = True
        return conversation, is_new
    return None, is_new


@router.post("/query", response_model=ChatResponse)
async def chat_query(request: ChatRequest, db: Session = Depends(get_db)):
    system_prompt, strictness = _get_settings(db)
    documents = db.query(Document).all()

    active_documents = _get_active_documents(documents)

    if not client:
        answer = "This is a grounded answer from the mock."
    else:
        try:
            answer = _generate_with_documents(
                request_message=request.message,
                system_prompt=system_prompt,
                strictness=strictness,
                grounding_documents=active_documents,
            )
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
                        answer = _generate_with_documents(
                            request_message=request.message,
                            system_prompt=system_prompt,
                            strictness=strictness,
                            grounding_documents=_get_active_documents(documents),
                        )
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
                    active_docs = _get_active_documents(documents)
                    for suspected_document in active_docs:
                        try:
                            candidate_documents = [
                                document
                                for document in active_docs
                                if document.id != suspected_document.id
                            ]
                            answer = _generate_with_documents(
                                request_message=request.message,
                                system_prompt=system_prompt,
                                strictness=strictness,
                                grounding_documents=candidate_documents,
                            )
                            _mark_document_failed(db, suspected_document)
                            break
                        except Exception:
                            continue
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

    conversation = None
    if request.session_id or request.conversation_id:
        conversation, _ = _get_or_create_conversation(
            db,
            request.session_id,
            request.conversation_id,
            request.message
        )

    log_entry = ChatLog(
        question=request.message,
        answer=answer,
        conversation_id=conversation.id if conversation else None
    )
    db.add(log_entry)
    db.commit()

    if conversation:
        conversation.updated_at = func.now()
        db.commit()

    return ChatResponse(
        answer=answer,
        conversation_id=conversation.id if conversation else 0
    )


@router.get("/conversations", response_model=list[ConversationListItem])
def list_conversations(
    session_id: str = Query(..., description="Browser session ID"),
    db: Session = Depends(get_db)
):
    conversations = (
        db.query(
            Conversation,
            func.count(ChatLog.id).label("message_count")
        )
        .outerjoin(ChatLog, Conversation.id == ChatLog.conversation_id)
        .filter(Conversation.session_id == session_id)
        .group_by(Conversation.id)
        .order_by(Conversation.updated_at.desc())
        .all()
    )

    return [
        ConversationListItem(
            id=conv.Conversation.id,
            title=conv.Conversation.title,
            created_at=conv.Conversation.created_at,
            updated_at=conv.Conversation.updated_at,
            message_count=conv.message_count
        )
        for conv in conversations
    ]


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
def get_conversation(conversation_id: int, db: Session = Depends(get_db)):
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    chat_logs = db.query(ChatLog).filter(ChatLog.conversation_id == conversation_id).order_by(ChatLog.created_at).all()

    messages = []
    for log in chat_logs:
        messages.append(MessageItem(role="user", content=log.question, created_at=log.created_at))
        messages.append(MessageItem(role="assistant", content=log.answer, created_at=log.created_at))

    return ConversationDetail(
        id=conversation.id,
        title=conversation.title,
        created_at=conversation.created_at,
        messages=messages
    )


@router.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: int, db: Session = Depends(get_db)):
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    db.query(ChatLog).filter(ChatLog.conversation_id == conversation_id).delete()
    db.delete(conversation)
    db.commit()

    return {"message": "Conversation deleted"}
