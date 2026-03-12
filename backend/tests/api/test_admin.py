from app.models.chat_log import ChatLog


def test_get_stats_empty(client):
    """Stats should return zero totals and no topics when there is no chat data."""
    response = client.get("/admin/stats")

    assert response.status_code == 200, response.json()
    data = response.json()
    assert data["total_questions"] == 0
    assert data["top_topics"] == []


def test_get_stats_with_topics(client):
    """Stats should include total question count and extracted top topics."""
    # Seed data through chat endpoint side effects by writing directly to DB models.
    from tests.conftest import TestingSessionLocal

    db = TestingSessionLocal()
    try:
        db.add_all(
            [
                ChatLog(question="What is the admission process?", answer="A"),
                ChatLog(question="Admission fees and admission dates", answer="B"),
                ChatLog(question="What are hostel fees?", answer="C"),
            ]
        )
        db.commit()
    finally:
        db.close()

    response = client.get("/admin/stats")
    assert response.status_code == 200, response.json()
    data = response.json()

    assert data["total_questions"] == 3
    assert isinstance(data["top_topics"], list)
    assert len(data["top_topics"]) > 0

    topics = {item["topic"]: item["count"] for item in data["top_topics"]}
    assert topics.get("admission", 0) >= 2


def test_get_settings_creates_default_row(client):
    """Settings endpoint should create and return defaults when no row exists."""
    response = client.get("/admin/settings")

    assert response.status_code == 200, response.json()
    data = response.json()
    assert "id" in data
    assert "system_prompt" in data
    assert "strictness" in data


def test_update_settings(client):
    """Settings should be updatable through the admin API."""
    payload = {
        "system_prompt": "You are a strict assistant.",
        "strictness": 0.75,
    }

    response = client.put("/admin/settings", json=payload)

    assert response.status_code == 200, response.json()
    data = response.json()
    assert data["system_prompt"] == payload["system_prompt"]
    assert data["strictness"] == payload["strictness"]


def test_update_settings_validation_error(client):
    """Strictness should stay within [0.0, 1.0]."""
    payload = {
        "system_prompt": "Invalid strictness test",
        "strictness": 1.5,
    }

    response = client.put("/admin/settings", json=payload)

    assert response.status_code == 422
