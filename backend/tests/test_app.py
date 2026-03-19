from fastapi.testclient import TestClient

from ai_job_copilot_backend.main import create_app


def test_create_app_exposes_health_endpoint_and_metadata() -> None:
    app = create_app()
    client = TestClient(app)

    response = client.get("/healthz")

    assert response.status_code == 200
    assert app.title == "AI Job Copilot API"
    assert response.json() == {
        "status": "ok",
        "service": "ai-job-copilot-api",
        "environment": "development",
    }
