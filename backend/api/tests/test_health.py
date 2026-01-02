import pytest
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_health_endpoints_include_expected_sections(monkeypatch):
    client = APIClient()

    # Default behavior: only DB is checked; other checks are present but skipped.
    r1 = client.get("/api/health/")
    assert r1.status_code in (200, 503)
    assert "db" in r1.data
    assert "migrations" in r1.data
    assert r1.data["migrations"].get("skipped") is True
    assert "storage" in r1.data
    assert r1.data["storage"].get("skipped") is True

    r2 = client.get("/api/v1/health/")
    assert r2.status_code in (200, 503)
    assert "db" in r2.data
    assert "migrations" in r2.data
    assert "storage" in r2.data


@pytest.mark.django_db
def test_health_migrations_check_can_be_enabled(monkeypatch):
    monkeypatch.setenv("HEALTH_CHECK_MIGRATIONS", "1")

    client = APIClient()
    r = client.get("/api/v1/health/")
    assert r.status_code in (200, 503)

    mig = r.data.get("migrations")
    assert isinstance(mig, dict)
    assert "ok" in mig
    assert "pending" in mig
    assert isinstance(mig["pending"], int)
