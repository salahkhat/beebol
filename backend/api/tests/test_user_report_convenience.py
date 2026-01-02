import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from market.models import Category, City, Governorate, Listing, ListingStatus, ModerationStatus
from messaging.models import PrivateThread
from reports.models import UserReport


@pytest.mark.django_db
def test_report_seller_from_listing_creates_user_report():
    User = get_user_model()
    reporter = User.objects.create_user(username="reporter", password="pass")
    seller = User.objects.create_user(username="seller", password="pass")

    cat = Category.objects.create(name_ar="Cat", name_en="Cat", slug="cat")
    gov = Governorate.objects.create(name_ar="Gov", name_en="Gov", slug="gov")
    city = City.objects.create(governorate=gov, name_ar="City", name_en="City", slug="city")

    listing = Listing.objects.create(
        seller=seller,
        title="Item",
        description="Desc",
        category=cat,
        governorate=gov,
        city=city,
        status=ListingStatus.PUBLISHED,
        moderation_status=ModerationStatus.APPROVED,
        is_removed=False,
    )

    client = APIClient()
    client.force_authenticate(user=reporter)

    res = client.post(
        f"/api/v1/listings/{listing.id}/report-seller/",
        {"reason": "spam", "message": "spammy"},
        format="json",
    )
    assert res.status_code == 201

    report = UserReport.objects.get(id=res.data["id"])
    assert report.reporter_id == reporter.id
    assert report.reported_id == seller.id
    assert report.listing_id == listing.id
    assert report.thread_id is None


@pytest.mark.django_db
def test_report_seller_from_listing_rejects_self_report():
    User = get_user_model()
    seller = User.objects.create_user(username="seller", password="pass")

    cat = Category.objects.create(name_ar="Cat", name_en="Cat", slug="cat")
    gov = Governorate.objects.create(name_ar="Gov", name_en="Gov", slug="gov")
    city = City.objects.create(governorate=gov, name_ar="City", name_en="City", slug="city")

    listing = Listing.objects.create(
        seller=seller,
        title="Item",
        description="Desc",
        category=cat,
        governorate=gov,
        city=city,
        status=ListingStatus.PUBLISHED,
        moderation_status=ModerationStatus.APPROVED,
        is_removed=False,
    )

    client = APIClient()
    client.force_authenticate(user=seller)

    res = client.post(
        f"/api/v1/listings/{listing.id}/report-seller/",
        {"reason": "spam", "message": "spammy"},
        format="json",
    )
    assert res.status_code == 400
    assert "reported" in res.data


@pytest.mark.django_db
def test_report_user_from_thread_creates_user_report_with_thread_context():
    User = get_user_model()
    buyer = User.objects.create_user(username="buyer", password="pass")
    seller = User.objects.create_user(username="seller", password="pass")

    cat = Category.objects.create(name_ar="Cat", name_en="Cat", slug="cat")
    gov = Governorate.objects.create(name_ar="Gov", name_en="Gov", slug="gov")
    city = City.objects.create(governorate=gov, name_ar="City", name_en="City", slug="city")

    listing = Listing.objects.create(
        seller=seller,
        title="Item",
        description="Desc",
        category=cat,
        governorate=gov,
        city=city,
        status=ListingStatus.PUBLISHED,
        moderation_status=ModerationStatus.APPROVED,
        is_removed=False,
    )
    thread = PrivateThread.objects.create(buyer=buyer, seller=seller, listing=listing)

    client = APIClient()
    client.force_authenticate(user=buyer)

    res = client.post(
        f"/api/v1/threads/{thread.id}/report/",
        {"reason": "spam", "message": "abusive"},
        format="json",
    )
    assert res.status_code == 201

    report = UserReport.objects.get(id=res.data["id"])
    assert report.reporter_id == buyer.id
    assert report.reported_id == seller.id
    assert report.listing_id == listing.id
    assert report.thread_id == thread.id
