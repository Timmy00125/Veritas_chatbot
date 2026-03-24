from types import SimpleNamespace
from unittest.mock import MagicMock

from app.models.document import Document
from app.services.gemini_documents import (
    build_active_document_parts,
    extract_file_ids_from_permission_error,
    is_file_permission_error,
    normalize_file_status,
    refresh_document_statuses,
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


def test_is_file_permission_error_detects_gemini_denials() -> None:
    """Gemini permission errors should be recognized for self-healing updates."""
    error = Exception(
        "403 PERMISSION_DENIED. You do not have permission to access the File dbgkvsx0ix19 or it may not exist."
    )
    assert is_file_permission_error(error) is True


def test_refresh_document_statuses_marks_permission_denied_file_failed() -> None:
    """Inaccessible files should be marked FAILED and excluded from future prompts."""
    document = Document(
        filename="policy.pdf",
        gemini_file_id="files/dbgkvsx0ix19",
        gemini_file_uri="gs://bucket/policy.pdf",
        mime_type="application/pdf",
        status="ACTIVE",
    )

    db = MagicMock()

    mock_files = MagicMock()
    mock_files.get.side_effect = Exception(
        "403 PERMISSION_DENIED. You do not have permission to access the File dbgkvsx0ix19 or it may not exist."
    )

    gemini_client = MagicMock()
    gemini_client.files = mock_files

    refresh_document_statuses(db, [document], gemini_client)

    assert document.status == "FAILED"
    assert document.gemini_file_uri is None
    db.commit.assert_called_once()


def test_extract_file_ids_from_permission_error_returns_ids() -> None:
    """File identifiers should be parsed from Gemini permission messages."""
    error = Exception(
        "You do not have permission to access the File dbgkvsx0ix19 or it may not exist."
    )

    assert extract_file_ids_from_permission_error(error) == {"dbgkvsx0ix19"}
