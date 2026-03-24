from __future__ import annotations

from collections import deque
import re
import socket
from typing import Any, Iterable

from google.genai import types
from sqlalchemy.orm import Session

from app.models.document import Document

_ALLOWED_STATUSES = {"ACTIVE", "PROCESSING", "FAILED"}

_FILE_PERMISSION_ERROR_PATTERNS = (
    "permission_denied",
    "do not have permission to access the file",
    "or it may not exist",
)
_FILE_ID_PATTERN = re.compile(r"File\s+([A-Za-z0-9_\-/]+)", re.IGNORECASE)


def is_dns_resolution_error(error: Exception) -> bool:
    """Return True when an exception chain contains a DNS resolution failure."""
    queue: deque[BaseException] = deque([error])
    visited_ids: set[int] = set()

    while queue:
        current = queue.popleft()
        current_id = id(current)
        if current_id in visited_ids:
            continue
        visited_ids.add(current_id)

        if isinstance(current, socket.gaierror):
            return True

        text = str(current).lower()
        if "temporary failure in name resolution" in text:
            return True
        if "name or service not known" in text:
            return True

        cause = getattr(current, "__cause__", None)
        context = getattr(current, "__context__", None)

        if isinstance(cause, BaseException):
            queue.append(cause)
        if isinstance(context, BaseException):
            queue.append(context)

    return False


def is_file_permission_error(error: Exception) -> bool:
    """Return True when an exception chain indicates file access is denied."""
    queue: deque[BaseException] = deque([error])
    visited_ids: set[int] = set()

    while queue:
        current = queue.popleft()
        current_id = id(current)
        if current_id in visited_ids:
            continue
        visited_ids.add(current_id)

        text = str(current).lower()
        if any(pattern in text for pattern in _FILE_PERMISSION_ERROR_PATTERNS):
            return True

        cause = getattr(current, "__cause__", None)
        context = getattr(current, "__context__", None)

        if isinstance(cause, BaseException):
            queue.append(cause)
        if isinstance(context, BaseException):
            queue.append(context)

    return False


def extract_file_ids_from_permission_error(error: Exception) -> set[str]:
    """Extract Gemini file IDs embedded in permission error messages."""
    queue: deque[BaseException] = deque([error])
    visited_ids: set[int] = set()
    file_ids: set[str] = set()

    while queue:
        current = queue.popleft()
        current_id = id(current)
        if current_id in visited_ids:
            continue
        visited_ids.add(current_id)

        matches = _FILE_ID_PATTERN.findall(str(current))
        for match in matches:
            file_ids.add(match.strip())

        cause = getattr(current, "__cause__", None)
        context = getattr(current, "__context__", None)

        if isinstance(cause, BaseException):
            queue.append(cause)
        if isinstance(context, BaseException):
            queue.append(context)

    return file_ids


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
        except Exception as error:
            # Quarantine documents that are no longer accessible with current API key.
            if is_file_permission_error(error) and document.status != "FAILED":
                document.status = "FAILED"
                document.gemini_file_uri = None
                has_changes = True
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
