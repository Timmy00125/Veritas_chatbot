import pytest
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
