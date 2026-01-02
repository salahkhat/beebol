import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from reports.models import ReportStatus, UserReport, UserReportEvent
from messaging.models import PrivateThread
from market.models import Category, City, Governorate, Listing
from market.models import ListingStatus, ModerationStatus


@pytest.mark.django_db
def test_create_user_report_requires_auth():
    client = APIClient()
    res = client.post("/api/v1/user-reports/", {"reported": 1, "reason": "spam"}, format="json")
    assert res.status_code in (401, 403)


@pytest.mark.django_db
def test_create_user_report_forbids_self_report():
    User = get_user_model()
    reporter = User.objects.create_user(username="u1", password="pass")

    client = APIClient()
    client.force_authenticate(user=reporter)

    res = client.post(
        "/api/v1/user-reports/",
        {"reported": reporter.id, "reason": "spam", "message": "bad"},
        format="json",
    )
    assert res.status_code == 400
    assert "reported" in res.data


@pytest.mark.django_db
def test_create_user_report_nonexistent_reported_returns_400():
    User = get_user_model()
    reporter = User.objects.create_user(username="rep2", password="pass")

    client = APIClient()
    client.force_authenticate(user=reporter)

    res = client.post(
        "/api/v1/user-reports/",
        {"reported": 999999, "reason": "spam", "message": "bad"},
        format="json",
    )
    assert res.status_code == 400
    assert "reported" in res.data


@pytest.mark.django_db
def test_non_staff_only_sees_own_reports():
    User = get_user_model()
    reporter1 = User.objects.create_user(username="u1", password="pass")
    reporter2 = User.objects.create_user(username="u2", password="pass")
    reported = User.objects.create_user(username="u3", password="pass")

    UserReport.objects.create(reporter=reporter1, reported=reported, reason="spam", status=ReportStatus.OPEN)
    UserReport.objects.create(reporter=reporter2, reported=reported, reason="spam", status=ReportStatus.OPEN)

    client = APIClient()
    client.force_authenticate(user=reporter1)

    res = client.get("/api/v1/user-reports/")
    assert res.status_code == 200
    # DRF list view should return paginated or plain list depending on settings;
    # current API generally returns plain list for many endpoints, but handle both.
    data = res.data
    items = data.get("results") if isinstance(data, dict) else data
    assert len(items) == 1
    assert items[0]["reporter"] == reporter1.id


@pytest.mark.django_db
def test_create_user_report_thread_context_requires_participant():
    User = get_user_model()
    reporter = User.objects.create_user(username="rep", password="pass")
    other1 = User.objects.create_user(username="b", password="pass")
    other2 = User.objects.create_user(username="s", password="pass")
    reported = User.objects.create_user(username="reported", password="pass")

    cat = Category.objects.create(name_ar="Cat", name_en="Cat", slug="cat")
    gov = Governorate.objects.create(name_ar="Gov", name_en="Gov", slug="gov")
    city = City.objects.create(governorate=gov, name_ar="City", name_en="City", slug="city")
    listing = Listing.objects.create(
        seller=other2,
        title="Test",
        description="",
        category=cat,
        governorate=gov,
        city=city,
    )
    thread = PrivateThread.objects.create(buyer=other1, seller=other2, listing=listing)

    client = APIClient()
    client.force_authenticate(user=reporter)

    res = client.post(
        "/api/v1/user-reports/",
        {"reported": reported.id, "reason": "spam", "thread": thread.id},
        format="json",
    )
    assert res.status_code == 400
    assert "thread" in res.data


@pytest.mark.django_db
def test_create_user_report_cannot_attach_non_public_listing_for_unrelated_user():
    User = get_user_model()
    reporter = User.objects.create_user(username="rep", password="pass")
    seller = User.objects.create_user(username="seller", password="pass")
    reported = User.objects.create_user(username="reported", password="pass")

    cat = Category.objects.create(name_ar="Cat", name_en="Cat", slug="cat")
    gov = Governorate.objects.create(name_ar="Gov", name_en="Gov", slug="gov")
    city = City.objects.create(governorate=gov, name_ar="City", name_en="City", slug="city")

    non_public_listing = Listing.objects.create(
        seller=seller,
        title="Draft",
        description="",
        category=cat,
        governorate=gov,
        city=city,
        status=ListingStatus.DRAFT,
        moderation_status=ModerationStatus.PENDING,
        is_removed=False,
    )

    client = APIClient()
    client.force_authenticate(user=reporter)

    res = client.post(
        "/api/v1/user-reports/",
        {"reported": reported.id, "reason": "spam", "listing": non_public_listing.id},
        format="json",
    )
    assert res.status_code == 400
    assert "listing" in res.data


@pytest.mark.django_db
def test_user_report_events_permissions():
    User = get_user_model()
    reporter = User.objects.create_user(username="rep", password="pass")
    other = User.objects.create_user(username="other", password="pass")
    staff = User.objects.create_user(username="staff", password="pass", is_staff=True)
    reported = User.objects.create_user(username="reported", password="pass")

    report = UserReport.objects.create(reporter=reporter, reported=reported, reason="spam", status=ReportStatus.OPEN)
    UserReportEvent.objects.create(report=report, actor=staff, from_status=ReportStatus.OPEN, to_status=ReportStatus.OPEN, note="init")

    client = APIClient()
    client.force_authenticate(user=reporter)
    res = client.get(f"/api/v1/user-reports/{report.id}/events/")
    assert res.status_code == 200
    assert isinstance(res.data, dict)
    assert len(res.data.get("results") or []) == 1

    client.force_authenticate(user=other)
    res = client.get(f"/api/v1/user-reports/{report.id}/events/")
    assert res.status_code in (403, 404)

    client.force_authenticate(user=staff)
    res = client.get(f"/api/v1/user-reports/{report.id}/events/")
    assert res.status_code == 200
    assert len(res.data.get("results") or []) == 1


@pytest.mark.django_db
def test_staff_user_reports_list_defaults_to_open():
    User = get_user_model()
    staff = User.objects.create_user(username="staff", password="pass", is_staff=True)
    reporter = User.objects.create_user(username="rep", password="pass")
    reported = User.objects.create_user(username="reported", password="pass")

    open_report = UserReport.objects.create(reporter=reporter, reported=reported, reason="spam", status=ReportStatus.OPEN)
    UserReport.objects.create(reporter=reporter, reported=reported, reason="spam", status=ReportStatus.RESOLVED)

    client = APIClient()
    client.force_authenticate(user=staff)

    res = client.get("/api/v1/user-reports/")
    assert res.status_code == 200
    data = res.data
    items = data.get("results") if isinstance(data, dict) else data
    assert len(items) == 1
    assert items[0]["id"] == open_report.id
