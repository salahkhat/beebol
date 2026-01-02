from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from market.models import Category, City, Governorate, Listing, ListingImage, ListingStatus, ModerationStatus

User = get_user_model()


class ModerationApiTests(APITestCase):
    def setUp(self):
        self.staff = User.objects.create_user(username="staff", password="pass1234")
        self.staff.is_staff = True
        self.staff.save(update_fields=["is_staff"])

        self.user = User.objects.create_user(username="u1", password="pass1234")
        self.seller = User.objects.create_user(username="seller", password="pass1234")

        self.cat = Category.objects.create(name_ar="C", name_en="C", slug="c")
        self.gov = Governorate.objects.create(name_ar="G", name_en="G", slug="g")
        self.city = City.objects.create(governorate=self.gov, name_ar="City", name_en="City", slug="city")

    def test_moderation_queue_requires_staff(self):
        url = reverse("listing-moderation-queue")

        self.client.force_authenticate(self.user)
        r = self.client.get(url)
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_moderation_queue_default_pending(self):
        pending = Listing.objects.create(
            seller=self.seller,
            title="Pending listing",
            description="Pending desc",
            category=self.cat,
            governorate=self.gov,
            city=self.city,
            status=ListingStatus.PUBLISHED,
            moderation_status=ModerationStatus.PENDING,
            is_removed=False,
        )
        approved = Listing.objects.create(
            seller=self.seller,
            title="Approved listing",
            description="Approved desc",
            category=self.cat,
            governorate=self.gov,
            city=self.city,
            status=ListingStatus.PUBLISHED,
            moderation_status=ModerationStatus.APPROVED,
            is_removed=False,
        )

        self.client.force_authenticate(self.staff)
        url = reverse("listing-moderation-queue")
        r = self.client.get(url)
        self.assertEqual(r.status_code, status.HTTP_200_OK)

        items = r.data.get("results") if isinstance(r.data, dict) else r.data
        ids = [x.get("id") for x in items]
        self.assertIn(pending.id, ids)
        self.assertNotIn(approved.id, ids)

    def test_bulk_moderate_staff_only(self):
        url = reverse("listing-bulk-moderate")
        self.client.force_authenticate(self.user)
        r = self.client.post(url, {"ids": [1], "action": "approve"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_listing_admin_preview_staff_can_view_removed(self):
        listing = Listing.objects.create(
            seller=self.seller,
            title="Removed listing",
            description="Removed desc",
            category=self.cat,
            governorate=self.gov,
            city=self.city,
            status=ListingStatus.PUBLISHED,
            moderation_status=ModerationStatus.REJECTED,
            is_removed=True,
        )

        url = reverse("listing-admin-preview", kwargs={"pk": listing.id})

        self.client.force_authenticate(self.user)
        r1 = self.client.get(url)
        self.assertEqual(r1.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.staff)
        r2 = self.client.get(url)
        self.assertEqual(r2.status_code, status.HTTP_200_OK)
        self.assertEqual(r2.data.get("id"), listing.id)

    def test_bulk_moderate_approve_skips_publish_quality(self):
        # No images: should trigger publish-quality errors under default settings.
        listing = Listing.objects.create(
            seller=self.seller,
            title="Bad",
            description="Bad",
            category=self.cat,
            governorate=self.gov,
            city=self.city,
            status=ListingStatus.PUBLISHED,
            moderation_status=ModerationStatus.PENDING,
            is_removed=False,
        )

        self.client.force_authenticate(self.staff)
        url = reverse("listing-bulk-moderate")
        r = self.client.post(url, {"ids": [listing.id], "action": "approve"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data.get("updated"), 0)
        self.assertEqual(r.data.get("updated_ids"), [])

        skipped = r.data.get("skipped") or []
        self.assertEqual(len(skipped), 1)
        self.assertEqual(skipped[0].get("id"), listing.id)
        self.assertEqual(skipped[0].get("reason"), "publish_quality")
        self.assertIn("errors", skipped[0])

    def test_bulk_moderate_approve_updates_and_reports_not_found(self):
        listing = Listing.objects.create(
            seller=self.seller,
            title="Okay title",
            description="Okay description",
            category=self.cat,
            governorate=self.gov,
            city=self.city,
            status=ListingStatus.PUBLISHED,
            moderation_status=ModerationStatus.PENDING,
            is_removed=False,
        )

        # Ensure publish-quality passes (requires at least one image by default).
        from io import BytesIO
        from PIL import Image
        from django.core.files.uploadedfile import SimpleUploadedFile

        buf = BytesIO()
        img = Image.new("RGB", (800, 600), color=(10, 10, 10))
        img.save(buf, format="PNG")
        buf.seek(0)
        file = SimpleUploadedFile("listing.png", buf.read(), content_type="image/png")
        ListingImage.objects.create(listing=listing, image=file)

        self.client.force_authenticate(self.staff)
        url = reverse("listing-bulk-moderate")
        r = self.client.post(
            url,
            {"ids": [listing.id, 9999999], "action": "approve"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data.get("updated"), 1)
        self.assertEqual(r.data.get("updated_ids"), [listing.id])
        self.assertEqual(r.data.get("not_found"), [9999999])

        listing.refresh_from_db()
        self.assertEqual(listing.moderation_status, ModerationStatus.APPROVED)
