from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from market.models import Category, City, Governorate, Listing, ListingStatus, ModerationStatus

User = get_user_model()


class MessagingSpamApiTests(APITestCase):
    def setUp(self):
        self.buyer = User.objects.create_user(username="buyer", password="pass1234")
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

    def _create_thread(self):
        self.client.force_authenticate(self.buyer)
        url = reverse("thread-list")
        r = self.client.post(url, {"listing_id": self.listing.id}, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        return r.data["id"]

    def test_send_message_accepts_body_only(self):
        thread_id = self._create_thread()
        url = reverse("thread-messages", kwargs={"pk": thread_id})
        r = self.client.post(url, {"body": "hello"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data.get("body"), "hello")

    def test_cannot_create_thread_for_non_public_listing(self):
        self.client.force_authenticate(self.buyer)
        url = reverse("thread-list")
        r = self.client.post(url, {"listing_id": self.non_public_listing.id}, format="json")
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_create_thread_nonexistent_listing_returns_404(self):
        self.client.force_authenticate(self.buyer)
        url = reverse("thread-list")
        r = self.client.post(url, {"listing_id": 999999}, format="json")
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_create_thread_invalid_listing_id_returns_404(self):
        self.client.force_authenticate(self.buyer)
        url = reverse("thread-list")
        r = self.client.post(url, {"listing_id": "not-an-int"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_send_message_rejects_contact_info(self):
        thread_id = self._create_thread()
        url = reverse("thread-messages", kwargs={"pk": thread_id})
        r = self.client.post(url, {"body": "wa.me/963933333333"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("body", r.data)

    def test_question_rejects_contact_info(self):
        self.client.force_authenticate(self.buyer)
        url = reverse("listing-questions", kwargs={"pk": self.listing.id})
        r = self.client.post(url, {"question": "call me 0933333333"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("question", r.data)
