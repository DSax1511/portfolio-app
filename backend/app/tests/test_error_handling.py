from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app


@app.get("/__test-error")
def _raise_unhandled_error():
    raise RuntimeError("boom")


@app.get("/__test-http-error")
def _raise_http_error():
    raise HTTPException(status_code=418, detail="teapot")


client = TestClient(app, raise_server_exceptions=False)


def test_general_exception_handler_sanitizes_detail():
    original_env = settings.environment
    settings.environment = "production"
    try:
        response = client.get("/__test-error")
    finally:
        settings.environment = original_env
    assert response.status_code == 500
    payload = response.json()
    assert payload.get("detail") == "An internal server error occurred. Please try again later."
    assert payload.get("code") == "INTERNAL_ERROR"


def test_http_exception_handler_returns_structured_payload():
    response = client.get("/__test-http-error")
    assert response.status_code == 418
    payload = response.json()
    assert payload.get("code") == "HTTP_418"
    assert payload.get("detail") == "teapot"
