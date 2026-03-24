import pytest
import socket
from io import BytesIO
from unittest.mock import patch, MagicMock


@patch("app.api.endpoints.chat.client")
def test_chat_query(mock_client, client):
    """Test the chat query endpoint."""

    # Configure the mock client
    mock_response = MagicMock()
    mock_response.text = "This is a grounded answer from the mock."

    mock_models = MagicMock()
    mock_models.generate_content.return_value = mock_response
    mock_client.models = mock_models

    payload = {"message": "What is the policy?"}

    response = client.post("/chat/query", json=payload)

    assert response.status_code == 200, response.json()
    data = response.json()
    assert "answer" in data
    assert data["answer"] == "This is a grounded answer from the mock."


def test_chat_query_missing_message(client):
    """Test the chat query endpoint with missing message."""
    payload = {}
    response = client.post("/chat/query", json=payload)
    assert response.status_code == 422  # Unprocessable Entity validation error


@patch("app.api.endpoints.chat.client")
def test_chat_query_dns_resolution_failure(mock_client, client):
    """Return 503 when Gemini hostname resolution fails inside container."""
    mock_models = MagicMock()
    mock_models.generate_content.side_effect = socket.gaierror(
        -3,
        "Temporary failure in name resolution",
    )
    mock_client.models = mock_models

    payload = {"message": "What is the policy?"}
    response = client.post("/chat/query", json=payload)

    assert response.status_code == 503
    assert "could not be resolved" in response.json()["detail"]


@patch("app.api.endpoints.chat.client")
@patch("app.api.endpoints.documents.client")
def test_chat_query_retries_after_permission_denied(
    mock_documents_client,
    mock_chat_client,
    client,
):
    """Chat should quarantine denied document IDs and retry once."""
    upload_file = MagicMock()
    upload_file.name = "files/dbgkvsx0ix19"
    upload_file.uri = "gs://bucket/policy.pdf"
    upload_file.state = "STATE_ACTIVE"

    upload_files = MagicMock()
    upload_files.upload.return_value = upload_file
    mock_documents_client.files = upload_files

    upload_response = client.post(
        "/documents/upload",
        files={"file": ("policy.txt", BytesIO(b"policy"), "text/plain")},
    )
    assert upload_response.status_code == 200, upload_response.json()

    mock_chat_file = MagicMock()
    mock_chat_file.state = "STATE_ACTIVE"
    mock_chat_file.uri = "gs://bucket/policy.pdf"

    mock_chat_files = MagicMock()
    mock_chat_files.get.return_value = mock_chat_file
    mock_chat_client.files = mock_chat_files

    mock_response = MagicMock()
    mock_response.text = "Recovered after quarantining inaccessible document."

    mock_chat_models = MagicMock()
    mock_chat_models.generate_content.side_effect = [
        Exception(
            "403 PERMISSION_DENIED. You do not have permission to access the File dbgkvsx0ix19 or it may not exist."
        ),
        mock_response,
    ]
    mock_chat_client.models = mock_chat_models

    payload = {"message": "What is the policy?"}
    response = client.post("/chat/query", json=payload)

    assert response.status_code == 200, response.json()
    assert response.json()["answer"] == (
        "Recovered after quarantining inaccessible document."
    )
    assert mock_chat_models.generate_content.call_count == 2


@patch("app.api.endpoints.chat.client")
@patch("app.api.endpoints.documents.client")
def test_chat_query_isolates_document_when_permission_error_has_no_file_id(
    mock_documents_client,
    mock_chat_client,
    client,
):
    """Chat should isolate one bad document even when error message omits ID."""
    upload_file = MagicMock()
    upload_file.name = "files/no-id-file"
    upload_file.uri = "gs://bucket/problematic.pdf"
    upload_file.state = "STATE_ACTIVE"

    upload_files = MagicMock()
    upload_files.upload.return_value = upload_file
    mock_documents_client.files = upload_files

    upload_response = client.post(
        "/documents/upload",
        files={"file": ("problematic.pdf", BytesIO(b"pdf"), "text/plain")},
    )
    assert upload_response.status_code == 200, upload_response.json()

    mock_chat_file = MagicMock()
    mock_chat_file.state = "STATE_ACTIVE"
    mock_chat_file.uri = "gs://bucket/problematic.pdf"

    mock_chat_files = MagicMock()
    mock_chat_files.get.return_value = mock_chat_file
    mock_chat_client.files = mock_chat_files

    recovered_response = MagicMock()
    recovered_response.text = "Recovered after isolating unknown denied file."

    mock_chat_models = MagicMock()
    mock_chat_models.generate_content.side_effect = [
        Exception("403 PERMISSION_DENIED"),
        recovered_response,
    ]
    mock_chat_client.models = mock_chat_models

    payload = {"message": "What is the policy?"}
    response = client.post("/chat/query", json=payload)

    assert response.status_code == 200, response.json()
    assert response.json()["answer"] == "Recovered after isolating unknown denied file."
    assert mock_chat_models.generate_content.call_count == 2
