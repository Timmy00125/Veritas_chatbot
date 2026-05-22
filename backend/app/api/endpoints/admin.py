import csv
import io
from collections import Counter
from datetime import datetime, timedelta, timezone

import re
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.chat_log import ChatLog
from app.models.conversation import Conversation
from app.models.document import Document
from app.models.setting import Setting
from app.schemas.admin import (
    AdminConversationItem,
    DayCount,
    SettingResponse,
    SettingUpdate,
    StatsResponse,
    TopicCount,
)

router = APIRouter()

STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "how",
    "i",
    "in",
    "is",
    "it",
    "me",
    "my",
    "of",
    "on",
    "or",
    "our",
    "that",
    "the",
    "this",
    "to",
    "we",
    "what",
    "when",
    "where",
    "which",
    "who",
    "why",
    "with",
    "you",
    "your",
}


def extract_top_topics(messages: list[str], limit: int = 10) -> list[TopicCount]:
    """Extract simple keyword-based topics from chat questions."""
    terms: list[str] = []
    for message in messages:
        words = re.findall(r"[a-zA-Z]{3,}", message.lower())
        terms.extend(word for word in words if word not in STOPWORDS)

    if not terms:
        return []

    top = Counter(terms).most_common(limit)
    return [TopicCount(topic=topic, count=count) for topic, count in top]


def get_or_create_settings(db: Session) -> Setting:
    """Return the single settings row, creating one with defaults if it doesn't exist."""
    setting = db.query(Setting).first()
    if not setting:
        setting = Setting()
        db.add(setting)
        db.commit()
        db.refresh(setting)
    return setting


@router.get("/stats", response_model=StatsResponse)
def get_stats(db: Session = Depends(get_db)):
    """Return enhanced usage statistics."""
    logs = db.query(ChatLog.question).all()
    questions = [row[0] for row in logs]
    total_questions = len(questions)
    top_topics = extract_top_topics(questions)

    total_conversations = db.query(func.count(Conversation.id)).scalar() or 0
    total_documents = db.query(func.count(Document.id)).scalar() or 0
    active_documents = (
        db.query(func.count(Document.id)).filter(Document.status == "ACTIVE").scalar()
        or 0
    )
    failed_documents = (
        db.query(func.count(Document.id)).filter(Document.status == "FAILED").scalar()
        or 0
    )

    # Questions per day (last 30 days)
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    daily_counts = (
        db.query(
            func.date(ChatLog.created_at).label("day"),
            func.count(ChatLog.id).label("count"),
        )
        .filter(ChatLog.created_at >= thirty_days_ago)
        .group_by(func.date(ChatLog.created_at))
        .order_by(func.date(ChatLog.created_at))
        .all()
    )
    questions_per_day = [DayCount(date=str(row.day), count=row.count) for row in daily_counts]

    # Average messages per conversation (use subquery to avoid nesting aggregates)
    subq = (
        select(
            ChatLog.conversation_id,
            func.count(ChatLog.id).label("msg_count"),
        )
        .group_by(ChatLog.conversation_id)
        .subquery()
    )
    avg_result = db.query(func.avg(subq.c.msg_count)).scalar()
    avg_messages = round(float(avg_result or 0), 1)

    return StatsResponse(
        total_questions=total_questions,
        top_topics=top_topics,
        total_conversations=total_conversations,
        total_documents=total_documents,
        active_documents=active_documents,
        failed_documents=failed_documents,
        questions_per_day=questions_per_day,
        avg_messages_per_conversation=avg_messages,
    )


@router.get("/conversations", response_model=list[AdminConversationItem])
def admin_list_conversations(
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """List all conversations across all sessions (admin view)."""
    query = (
        db.query(
            Conversation,
            func.count(ChatLog.id).label("message_count"),
        )
        .outerjoin(ChatLog, Conversation.id == ChatLog.conversation_id)
        .group_by(Conversation.id)
    )

    if search:
        query = query.filter(
            Conversation.title.ilike(f"%{search}%")
            | Conversation.session_id.ilike(f"%{search}%")
        )

    results = (
        query.order_by(Conversation.updated_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    items = []
    for row in results:
        conv = row.Conversation
        last_log = (
            db.query(ChatLog.question)
            .filter(ChatLog.conversation_id == conv.id)
            .order_by(ChatLog.created_at.desc())
            .first()
        )
        items.append(
            AdminConversationItem(
                id=conv.id,
                session_id=conv.session_id,
                title=conv.title,
                created_at=conv.created_at,
                updated_at=conv.updated_at,
                message_count=row.message_count,
                last_question=last_log[0] if last_log else None,
            )
        )

    return items


@router.get("/export/conversations")
def export_conversations_csv(db: Session = Depends(get_db)):
    """Export all conversations with messages as CSV."""
    conversations = db.query(Conversation).order_by(Conversation.created_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Conversation ID",
        "Session ID",
        "Title",
        "Created At",
        "Updated At",
        "Message Count",
        "Messages",
    ])

    for conv in conversations:
        chat_logs = (
            db.query(ChatLog)
            .filter(ChatLog.conversation_id == conv.id)
            .order_by(ChatLog.created_at)
            .all()
        )
        messages_str = "\n---\n".join(
            f"[{log.created_at}] Q: {log.question}\nA: {log.answer}"
            for log in chat_logs
        )
        writer.writerow([
            conv.id,
            conv.session_id,
            conv.title,
            conv.created_at.isoformat(),
            conv.updated_at.isoformat(),
            len(chat_logs),
            messages_str,
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=conversations_export.csv"},
    )


@router.get("/export/documents")
def export_documents_csv(db: Session = Depends(get_db)):
    """Export all documents as CSV."""
    documents = db.query(Document).order_by(Document.created_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Document ID",
        "Filename",
        "MIME Type",
        "Status",
        "Gemini File ID",
        "Supabase URL",
        "Created At",
    ])

    for doc in documents:
        writer.writerow([
            doc.id,
            doc.filename,
            doc.mime_type,
            doc.status,
            doc.gemini_file_id,
            doc.supabase_file_url or "",
            doc.created_at.isoformat(),
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=documents_export.csv"},
    )


@router.get("/export/chat-logs")
def export_chat_logs_csv(db: Session = Depends(get_db)):
    """Export all chat logs as CSV."""
    logs = db.query(ChatLog).order_by(ChatLog.created_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Log ID",
        "Conversation ID",
        "Question",
        "Answer",
        "Created At",
    ])

    for log in logs:
        writer.writerow([
            log.id,
            log.conversation_id or "",
            log.question,
            log.answer,
            log.created_at.isoformat(),
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=chat_logs_export.csv"},
    )


@router.get("/settings", response_model=SettingResponse)
def get_settings(db: Session = Depends(get_db)):
    """Return the current chatbot settings."""
    return get_or_create_settings(db)


@router.put("/settings", response_model=SettingResponse)
def update_settings(payload: SettingUpdate, db: Session = Depends(get_db)):
    """Update the chatbot settings (system prompt and strictness/temperature)."""
    setting = get_or_create_settings(db)
    setting.system_prompt = payload.system_prompt
    setting.strictness = payload.strictness
    db.commit()
    db.refresh(setting)
    return setting
