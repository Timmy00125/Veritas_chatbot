from types import SimpleNamespace

from app.models.document import Document
from app.services.gemini_documents import (
    build_active_document_parts,
    normalize_file_status,
)


def test_normalize_file_status_handles_state_prefix() -> None:
    """Enum-style Gemini status values should map to API statuses."""
    assert normalize_file_status("STATE_ACTIVE") == "ACTIVE"
    assert normalize_file_status("FileState.STATE_PROCESSING") == "PROCESSING"
    assert normalize_file_status("state_failed") == "FAILED"


def test_normalize_file_status_handles_object_with_name() -> None:
    """Objects exposing a `.name` value should be normalized consistently."""
    raw_state = SimpleNamespace(name="FileState.STATE_ACTIVE")
    assert normalize_file_status(raw_state) == "ACTIVE"


def test_build_active_document_parts_uses_only_active_documents() -> None:
    """Only ACTIVE docs with URIs should be passed as Gemini parts."""
    active_doc = Document(
        filename="handbook.pdf",
        gemini_file_id="files/1",
        gemini_file_uri="gs://bucket/handbook.pdf",
        mime_type="application/pdf",
        status="ACTIVE",
    )
    processing_doc = Document(
        filename="notes.txt",
        gemini_file_id="files/2",
        gemini_file_uri="gs://bucket/notes.txt",
        mime_type="text/plain",
        status="PROCESSING",
    )
    missing_uri_doc = Document(
        filename="missing.pdf",
        gemini_file_id="files/3",
        gemini_file_uri=None,
        mime_type="application/pdf",
        status="ACTIVE",
    )

    parts = build_active_document_parts([active_doc, processing_doc, missing_uri_doc])

    assert len(parts) == 1
    assert parts[0].file_data.file_uri == "gs://bucket/handbook.pdf"
    assert parts[0].file_data.mime_type == "application/pdf"
