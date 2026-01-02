from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from market.models import Category, City, Governorate, Listing, ListingStatus, ModerationStatus
from reports.models import ListingReport, ListingReportEvent, ReportStatus

User = get_user_model()


class ReportsApiTests(APITestCase):
    def setUp(self):
        self.reporter = User.objects.create_user(username="reporter", password="pass1234")
        self.staff = User.objects.create_user(username="staff", password="pass1234", is_staff=True)
        self.seller = User.objects.create_user(username="seller", password="pass1234")

        self.category = Category.objects.create(name_ar="Test", name_en="Test", slug="test")
        self.gov = Governorate.objects.create(name_ar="G", name_en="G", slug="g")
        self.city = City.objects.create(governorate=self.gov, name_ar="C", name_en="C", slug="c")

        self.listing = Listing.objects.create(
            seller=self.seller,
            title="Item",
            description="Desc",
            category=self.category,
            governorate=self.gov,
            city=self.city,
            status=ListingStatus.PUBLISHED,
            moderation_status=ModerationStatus.APPROVED,
        )

        self.non_public_listing = Listing.objects.create(
            seller=self.seller,
            title="Draft",
            description="Desc",
            category=self.category,
            governorate=self.gov,
            city=self.city,
            status=ListingStatus.DRAFT,
            moderation_status=ModerationStatus.PENDING,
        )

    def test_staff_can_update_status_and_note_and_reopen(self):
        self.client.force_authenticate(self.reporter)
        url = reverse("report-list")
        r = self.client.post(url, {"listing": self.listing.id, "reason": "spam", "message": "bad"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        report_id = r.data["id"]

        report = ListingReport.objects.get(id=report_id)
        self.assertEqual(report.status, ReportStatus.OPEN)
        self.assertIsNone(report.handled_by)
        self.assertIsNone(report.handled_at)

        # Resolve with note
        self.client.force_authenticate(self.staff)
        detail = reverse("report-detail", kwargs={"pk": report_id})
        r2 = self.client.patch(detail, {"status": "resolved", "staff_note": "Handled"}, format="json")
        self.assertEqual(r2.status_code, status.HTTP_200_OK)

        report.refresh_from_db()
        self.assertEqual(report.status, ReportStatus.RESOLVED)
        self.assertEqual(report.staff_note, "Handled")
        self.assertEqual(report.handled_by_id, self.staff.id)
        self.assertIsNotNone(report.handled_at)
        self.assertEqual(ListingReportEvent.objects.filter(report=report).count(), 1)

        # Reopen clears handled fields
        r3 = self.client.patch(detail, {"status": "open"}, format="json")
        self.assertEqual(r3.status_code, status.HTTP_200_OK)
        report.refresh_from_db()
        self.assertEqual(report.status, ReportStatus.OPEN)
        self.assertIsNone(report.handled_by)
        self.assertIsNone(report.handled_at)
        self.assertEqual(ListingReportEvent.objects.filter(report=report).count(), 2)

    def test_events_endpoint_access(self):
        report = ListingReport.objects.create(listing=self.listing, reporter=self.reporter, reason="spam", message="", status=ReportStatus.OPEN)
        ListingReportEvent.objects.create(report=report, actor=self.staff, from_status="open", to_status="resolved", note="ok")

        events_url = reverse("report-events", kwargs={"pk": report.id})

        # Reporter can view
        self.client.force_authenticate(self.reporter)
        r1 = self.client.get(events_url)
        self.assertEqual(r1.status_code, status.HTTP_200_OK)
        self.assertIn("results", r1.data)

        # Random non-staff cannot
        other = User.objects.create_user(username="other", password="pass1234")
        self.client.force_authenticate(other)
        r2 = self.client.get(events_url)
        self.assertIn(r2.status_code, (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND))

    def test_non_staff_cannot_report_non_public_listing(self):
        self.client.force_authenticate(self.reporter)
        url = reverse("report-list")
        r = self.client.post(
            url,
            {"listing": self.non_public_listing.id, "reason": "spam", "message": "bad"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("listing", r.data)

    def test_non_staff_reporting_nonexistent_listing_returns_400_without_enumeration(self):
        self.client.force_authenticate(self.reporter)
        url = reverse("report-list")
        r = self.client.post(
            url,
            {"listing": 999999, "reason": "spam", "message": "bad"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("listing", r.data)
