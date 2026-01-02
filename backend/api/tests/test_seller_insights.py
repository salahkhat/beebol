from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from market.models import Category, City, Governorate, Listing, ListingFavorite, ListingStatus, ModerationStatus
from messaging.models import PrivateMessage, PrivateThread

User = get_user_model()


class SellerInsightsApiTests(APITestCase):
    def setUp(self):
        self.seller = User.objects.create_user(username="seller", password="pass1234")
        self.buyer = User.objects.create_user(username="buyer", password="pass1234")
        self.u2 = User.objects.create_user(username="u2", password="pass1234")

        self.cat = Category.objects.create(name_ar="C", name_en="C", slug="c")
        self.gov = Governorate.objects.create(name_ar="G", name_en="G", slug="g")
        self.city = City.objects.create(governorate=self.gov, name_ar="City", name_en="City", slug="city")

        self.listing = Listing.objects.create(
            seller=self.seller,
            title="Item",
            description="Good description",
            category=self.cat,
            governorate=self.gov,
            city=self.city,
            status=ListingStatus.PUBLISHED,
            moderation_status=ModerationStatus.APPROVED,
            is_removed=False,
        )

    def test_mine_includes_counts(self):
        ListingFavorite.objects.create(user=self.buyer, listing=self.listing)
        ListingFavorite.objects.create(user=self.u2, listing=self.listing)

        thread = PrivateThread.objects.create(listing=self.listing, buyer=self.buyer, seller=self.seller)
        PrivateMessage.objects.create(thread=thread, sender=self.buyer, body="hello")
        PrivateMessage.objects.create(thread=thread, sender=self.seller, body="hi")

        self.client.force_authenticate(self.seller)
        url = reverse("listing-mine")
        r = self.client.get(url)
        self.assertEqual(r.status_code, status.HTTP_200_OK)

        results = r.data.get("results") if isinstance(r.data, dict) else r.data
        row = next((x for x in results if x.get("id") == self.listing.id), None)
        self.assertIsNotNone(row)

        self.assertEqual(row.get("favorites_count"), 2)
        self.assertEqual(row.get("messages_count"), 2)
        self.assertEqual(row.get("view_count"), 0)

    def test_public_retrieve_increments_view_count(self):
        url = reverse("listing-detail", kwargs={"pk": self.listing.id})

        r1 = self.client.get(url)
        self.assertEqual(r1.status_code, status.HTTP_200_OK)

        # Seller views should not increment.
        self.client.force_authenticate(self.seller)
        r2 = self.client.get(url)
        self.assertEqual(r2.status_code, status.HTTP_200_OK)

        # Another user view should increment.
        self.client.force_authenticate(self.buyer)
        r3 = self.client.get(url)
        self.assertEqual(r3.status_code, status.HTTP_200_OK)

        self.listing.refresh_from_db()
        self.assertEqual(self.listing.view_count, 2)
