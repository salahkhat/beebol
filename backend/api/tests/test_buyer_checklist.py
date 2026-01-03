from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from market.models import Category, City, Governorate, Listing, ListingStatus, ModerationStatus

User = get_user_model()


class BuyerChecklistApiTests(APITestCase):
    def setUp(self):
        self.buyer = User.objects.create_user(username="buyer_check", password="pass1234")
        self.seller = User.objects.create_user(username="seller_check", password="pass1234")

        self.category = Category.objects.create(name_ar="Test", name_en="Test", slug="test-check")
        self.gov = Governorate.objects.create(name_ar="G", name_en="G", slug="g-check")
        self.city = City.objects.create(governorate=self.gov, name_ar="C", name_en="C", slug="c-check")

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

    def _create_thread(self) -> int:
        self.client.force_authenticate(self.buyer)
        url = reverse("thread-list")
        r = self.client.post(url, {"listing_id": self.listing.id}, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        return r.data["id"]

    def test_buyer_checklist_get_and_patch(self):
        thread_id = self._create_thread()

        self.client.force_authenticate(self.buyer)
        url = reverse("thread-buyer-checklist", kwargs={"pk": thread_id})

        r = self.client.get(url)
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertFalse(r.data["confirmed_condition"])
        self.assertFalse(r.data["confirmed_location"])

        r2 = self.client.patch(url, {"confirmed_condition": True}, format="json")
        self.assertEqual(r2.status_code, status.HTTP_200_OK)
        self.assertTrue(r2.data["confirmed_condition"])
        self.assertFalse(r2.data["confirmed_location"])

        r3 = self.client.get(url)
        self.assertEqual(r3.status_code, status.HTTP_200_OK)
        self.assertTrue(r3.data["confirmed_condition"])

    def test_seller_cannot_update_buyer_checklist(self):
        thread_id = self._create_thread()
        self.client.force_authenticate(self.seller)
        url = reverse("thread-buyer-checklist", kwargs={"pk": thread_id})
        r = self.client.patch(url, {"confirmed_condition": True}, format="json")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)
