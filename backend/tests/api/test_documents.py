import pytest
import socket
from io import BytesIO
from unittest.mock import patch, MagicMock


@patch("app.api.endpoints.documents.client")
def test_upload_document(mock_client, client):
    """Test the document upload endpoint."""

    # Configure the mock client
    mock_file = MagicMock()
    mock_file.name = "mock_gemini_file_id"
    mock_file.uri = "mock://gemini_uri"

    # When client.files.upload is called, return mock_file
    mock_files = MagicMock()
    mock_files.upload.return_value = mock_file
    mock_client.files = mock_files

    file_content = b"This is a test document."
    files = {"file": ("test.txt", BytesIO(file_content), "text/plain")}

    response = client.post("/documents/upload", files=files)

    assert response.status_code == 200, response.json()
    data = response.json()
    assert "id" in data
    assert data["filename"] == "test.txt"
    assert data["gemini_file_id"] == "mock_gemini_file_id"
    assert data["status"] == "PROCESSING"


def test_upload_document_invalid_type(client):
    """Test upload endpoint with unsupported file type."""
    file_content = b"invalid content"
    files = {"file": ("test.bin", BytesIO(file_content), "application/octet-stream")}

    response = client.post("/documents/upload", files=files)

    assert response.status_code == 400
    assert "detail" in response.json()


@patch("app.api.endpoints.documents.client")
def test_list_documents(mock_client, client):
    """Test listing uploaded documents."""
    mock_file = MagicMock()
    mock_file.name = "mock_list_file_id"
    mock_file.uri = "mock://list_uri"

    mock_files = MagicMock()
    mock_files.upload.return_value = mock_file
    mock_client.files = mock_files

    files = {"file": ("list-test.txt", BytesIO(b"list test"), "text/plain")}
    upload_response = client.post("/documents/upload", files=files)
    assert upload_response.status_code == 200, upload_response.json()

    response = client.get("/documents/")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["filename"] == "list-test.txt"


@patch("app.api.endpoints.documents.client")
def test_delete_document(mock_client, client):
    """Test deleting an uploaded document by ID."""
    mock_file = MagicMock()
    mock_file.name = "mock_delete_file_id"
    mock_file.uri = "mock://delete_uri"

    mock_files = MagicMock()
    mock_files.upload.return_value = mock_file
    mock_client.files = mock_files

    files = {"file": ("delete-test.txt", BytesIO(b"delete test"), "text/plain")}
    upload_response = client.post("/documents/upload", files=files)
    assert upload_response.status_code == 200, upload_response.json()
    document_id = upload_response.json()["id"]

    response = client.delete(f"/documents/{document_id}")
    assert response.status_code == 204

    list_response = client.get("/documents/")
    assert list_response.status_code == 200
    assert list_response.json() == []


def test_delete_document_not_found(client):
    """Test deleting a missing document returns 404."""
    response = client.delete("/documents/99999")
    assert response.status_code == 404
    assert response.json()["detail"] == "Document not found"


@patch("app.api.endpoints.documents.client")
def test_upload_document_dns_resolution_failure(mock_client, client):
    """Return 503 when Gemini hostname resolution fails inside container."""
    mock_files = MagicMock()
    mock_files.upload.side_effect = socket.gaierror(
        -3,
        "Temporary failure in name resolution",
    )
    mock_client.files = mock_files

    files = {"file": ("dns-test.txt", BytesIO(b"dns test"), "text/plain")}
    response = client.post("/documents/upload", files=files)

    assert response.status_code == 503
    assert "could not be resolved" in response.json()["detail"]
