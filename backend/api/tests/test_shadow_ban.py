from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from market.models import Category, City, Governorate, Listing, ListingStatus, ModerationStatus, Profile

User = get_user_model()


class ShadowBanApiTests(APITestCase):
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

        p, _ = Profile.objects.get_or_create(user=self.buyer)
        p.metadata = {"shadow_banned": True}
        p.save(update_fields=["metadata", "updated_at"])

    def test_shadow_banned_message_hidden_from_other_user(self):
        # Buyer creates thread
        self.client.force_authenticate(self.buyer)
        create_url = reverse("thread-list")
        r = self.client.post(create_url, {"listing_id": self.listing.id}, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        thread_id = r.data["id"]

        # Buyer sends message (shadowed)
        send_url = reverse("thread-messages", kwargs={"pk": thread_id})
        r2 = self.client.post(send_url, {"body": "hello"}, format="json")
        self.assertEqual(r2.status_code, status.HTTP_201_CREATED)

        # Buyer can see own message
        r3 = self.client.get(send_url)
        self.assertEqual(r3.status_code, status.HTTP_200_OK)
        self.assertEqual(len(r3.data), 1)

        # Seller should not see shadowed message
        self.client.force_authenticate(self.seller)
        r4 = self.client.get(send_url)
        self.assertEqual(r4.status_code, status.HTTP_200_OK)
        self.assertEqual(len(r4.data), 0)

    def test_shadow_banned_question_hidden_from_public(self):
        self.client.force_authenticate(self.buyer)
        q_url = reverse("listing-questions", kwargs={"pk": self.listing.id})
        r = self.client.post(q_url, {"question": "is this available?"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

        # Buyer sees own question
        r2 = self.client.get(q_url)
        self.assertEqual(r2.status_code, status.HTTP_200_OK)
        self.assertEqual(len(r2.data), 1)

        # Public (anon) does not
        self.client.force_authenticate(user=None)
        r3 = self.client.get(q_url)
        self.assertEqual(r3.status_code, status.HTTP_200_OK)
        self.assertEqual(len(r3.data), 0)
