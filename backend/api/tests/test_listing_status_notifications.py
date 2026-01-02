from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from market.models import Category, City, Governorate, Listing, ListingImage, ListingStatus, ModerationStatus
from notifications.models import Notification, NotificationKind, NotificationPreference

User = get_user_model()


class ListingStatusNotificationTests(APITestCase):
    def setUp(self):
        self.staff = User.objects.create_user(username="staff", password="pass1234")
        self.staff.is_staff = True
        self.staff.save(update_fields=["is_staff"])

        self.seller = User.objects.create_user(username="seller", password="pass1234")

        self.cat = Category.objects.create(name_ar="C", name_en="C", slug="c")
        self.gov = Governorate.objects.create(name_ar="G", name_en="G", slug="g")
        self.city = City.objects.create(governorate=self.gov, name_ar="City", name_en="City", slug="city")

    def _make_listing(self, *, moderation_status=ModerationStatus.PENDING):
        return Listing.objects.create(
            seller=self.seller,
            title="Okay title",
            description="Okay description",
            category=self.cat,
            governorate=self.gov,
            city=self.city,
            status=ListingStatus.PUBLISHED,
            moderation_status=moderation_status,
            is_removed=False,
        )

    def _attach_image(self, listing: Listing):
        from io import BytesIO
        from PIL import Image
        from django.core.files.uploadedfile import SimpleUploadedFile

        buf = BytesIO()
        img = Image.new("RGB", (800, 600), color=(10, 10, 10))
        img.save(buf, format="PNG")
        buf.seek(0)
        file = SimpleUploadedFile("listing.png", buf.read(), content_type="image/png")
        ListingImage.objects.create(listing=listing, image=file)

    def test_staff_moderate_creates_listing_status_notification(self):
        listing = self._make_listing(moderation_status=ModerationStatus.PENDING)
        self._attach_image(listing)

        self.client.force_authenticate(self.staff)
        url = reverse("listing-moderate", kwargs={"pk": listing.id})
        r = self.client.post(url, {"moderation_status": ModerationStatus.APPROVED}, format="json")
        self.assertEqual(r.status_code, status.HTTP_200_OK)

        listing.refresh_from_db()
        self.assertEqual(listing.moderation_status, ModerationStatus.APPROVED)

        qs = Notification.objects.filter(user=self.seller, kind=NotificationKind.LISTING_STATUS)
        self.assertEqual(qs.count(), 1)
        notif = qs.first()
        self.assertEqual(notif.payload.get("listing_id"), listing.id)
        self.assertEqual(notif.payload.get("previous_moderation_status"), ModerationStatus.PENDING)
        self.assertEqual(notif.payload.get("moderation_status"), ModerationStatus.APPROVED)

    def test_staff_moderate_no_change_does_not_create_duplicate_notification(self):
        listing = self._make_listing(moderation_status=ModerationStatus.APPROVED)
        self._attach_image(listing)

        self.client.force_authenticate(self.staff)
        url = reverse("listing-moderate", kwargs={"pk": listing.id})
        r = self.client.post(url, {"moderation_status": ModerationStatus.APPROVED}, format="json")
        self.assertEqual(r.status_code, status.HTTP_200_OK)

        qs = Notification.objects.filter(user=self.seller, kind=NotificationKind.LISTING_STATUS)
        self.assertEqual(qs.count(), 0)

    def test_inapp_listing_status_pref_disabled_prevents_notification(self):
        listing = self._make_listing(moderation_status=ModerationStatus.PENDING)

        prefs, _ = NotificationPreference.objects.get_or_create(user=self.seller)
        prefs.inapp_listing_status = False
        prefs.save(update_fields=["inapp_listing_status", "updated_at"])

        self.client.force_authenticate(self.staff)
        url = reverse("listing-moderate", kwargs={"pk": listing.id})
        r = self.client.post(url, {"moderation_status": ModerationStatus.REJECTED}, format="json")
        self.assertEqual(r.status_code, status.HTTP_200_OK)

        qs = Notification.objects.filter(user=self.seller, kind=NotificationKind.LISTING_STATUS)
        self.assertEqual(qs.count(), 0)
