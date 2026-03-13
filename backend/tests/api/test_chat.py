import pytest
import socket
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
