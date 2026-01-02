import pytest
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_v1_error_responses_include_request_id_and_error_message():
    client = APIClient()

    # Unauthenticated -> DRF error handler path
    r1 = client.get("/api/v1/me/")
    assert r1.status_code in (401, 403)
    assert "X-Request-ID" in r1
    assert r1.data.get("request_id") == r1["X-Request-ID"]
    assert isinstance(r1.data.get("error"), dict)
    assert isinstance(r1.data["error"].get("message"), str)

    # Manually-built Response(...) path (bypasses DRF exception handler)
    r2 = client.get("/api/v1/users/999999/profile/")
    assert r2.status_code == 404
    assert "X-Request-ID" in r2
    assert r2.data.get("request_id") == r2["X-Request-ID"]
    assert isinstance(r2.data.get("error"), dict)
    assert isinstance(r2.data["error"].get("message"), str)
