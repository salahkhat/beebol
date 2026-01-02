from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from market.models import Category, City, Governorate, Listing, ListingImage, ListingStatus, ModerationStatus

User = get_user_model()


class ListingQualityApiTests(APITestCase):
    def setUp(self):
        self.seller = User.objects.create_user(username="seller", password="pass1234")
        self.cat = Category.objects.create(name_ar="C", name_en="C", slug="c")
        self.gov = Governorate.objects.create(name_ar="G", name_en="G", slug="g")
        self.city = City.objects.create(governorate=self.gov, name_ar="City", name_en="City", slug="city")

        self.listing = Listing.objects.create(
            seller=self.seller,
            title="Nice item",
            description="A decent description",
            category=self.cat,
            governorate=self.gov,
            city=self.city,
            status=ListingStatus.DRAFT,
            moderation_status=ModerationStatus.PENDING,
            is_removed=False,
        )

    def _make_png(self, size=(800, 600)):
        from PIL import Image

        buf = BytesIO()
        img = Image.new("RGB", size, color=(10, 10, 10))
        img.save(buf, format="PNG")
        buf.seek(0)
        return SimpleUploadedFile("listing.png", buf.read(), content_type="image/png")

    @override_settings(LISTING_MIN_IMAGES_PUBLISH=1)
    def test_cannot_publish_without_min_images(self):
        self.client.force_authenticate(self.seller)
        url = reverse("listing-detail", kwargs={"pk": self.listing.id})
        r = self.client.patch(url, {"status": ListingStatus.PUBLISHED}, format="json")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("images", r.data)

    @override_settings(LISTING_MIN_IMAGES_PUBLISH=1)
    def test_can_publish_after_adding_image(self):
        ListingImage.objects.create(listing=self.listing, image=self._make_png())

        self.client.force_authenticate(self.seller)
        url = reverse("listing-detail", kwargs={"pk": self.listing.id})
        r = self.client.patch(url, {"status": ListingStatus.PUBLISHED}, format="json")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data.get("status"), ListingStatus.PUBLISHED)

    @override_settings(LISTING_IMAGE_MIN_WIDTH=400, LISTING_IMAGE_MIN_HEIGHT=400)
    def test_bulk_image_upload_rejects_too_small(self):
        self.client.force_authenticate(self.seller)
        url = reverse("listing-add-images-bulk", kwargs={"pk": self.listing.id})
        small = self._make_png(size=(100, 100))
        r = self.client.post(url, {"images": [small]})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", r.data)

    @override_settings(LISTING_IMAGE_MIN_WIDTH=400, LISTING_IMAGE_MIN_HEIGHT=400)
    def test_bulk_image_upload_accepts_large_enough(self):
        self.client.force_authenticate(self.seller)
        url = reverse("listing-add-images-bulk", kwargs={"pk": self.listing.id})
        ok = self._make_png(size=(800, 600))
        r = self.client.post(url, {"images": [ok]})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertTrue(isinstance(r.data, list))
        self.assertEqual(len(r.data), 1)
