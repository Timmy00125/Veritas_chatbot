from __future__ import annotations

from typing import Any, Iterable

from google.genai import types
from sqlalchemy.orm import Session

from app.models.document import Document

_ALLOWED_STATUSES = {"ACTIVE", "PROCESSING", "FAILED"}


def normalize_file_status(raw_status: object) -> str:
    """Map Gemini file state values to API document status values."""
    if raw_status is None:
        return "PROCESSING"

    if hasattr(raw_status, "name"):
        status = str(getattr(raw_status, "name"))
    else:
        status = str(raw_status)

    normalized = status.split(".")[-1].strip().upper()
    # Gemini may return enum-style tokens such as STATE_ACTIVE.
    if normalized.startswith("STATE_"):
        normalized = normalized.removeprefix("STATE_")

    if normalized in _ALLOWED_STATUSES:
        return normalized

    return "PROCESSING"


def refresh_document_statuses(
    db: Session,
    documents: Iterable[Document],
    gemini_client: Any | None,
) -> None:
    """Update local document statuses using Gemini File API state."""
    if not gemini_client:
        return

    has_changes = False
    for document in documents:
        if document.gemini_file_id.startswith("mock_file_"):
            if document.status != "ACTIVE":
                document.status = "ACTIVE"
                has_changes = True
            continue

        try:
            remote_file = gemini_client.files.get(name=document.gemini_file_id)
        except Exception:
            # Keep existing status when the upstream lookup fails transiently.
            continue

        remote_status = normalize_file_status(getattr(remote_file, "state", None))
        remote_uri = getattr(remote_file, "uri", None)

        if isinstance(remote_uri, str) and document.gemini_file_uri != remote_uri:
            document.gemini_file_uri = remote_uri
            has_changes = True

        if document.status != remote_status:
            document.status = remote_status
            has_changes = True

    if has_changes:
        db.commit()


def build_active_document_parts(documents: Iterable[Document]) -> list[types.Part]:
    """Build Gemini content parts from active documents with valid URIs."""
    parts: list[types.Part] = []
    for document in documents:
        if document.status != "ACTIVE" or not document.gemini_file_uri:
            continue

        parts.append(
            types.Part.from_uri(
                file_uri=document.gemini_file_uri,
                mime_type=document.mime_type,
            )
        )

    return parts
