from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from market.models import Category, City, Governorate, Listing, ListingStatus, ModerationStatus
from messaging.models import Offer, OfferStatus, PrivateMessage, PrivateThread

User = get_user_model()


class OfferApiTests(APITestCase):
    def setUp(self):
        self.buyer = User.objects.create_user(username="buyer_offer", password="pass1234")
        self.seller = User.objects.create_user(username="seller_offer", password="pass1234")

        self.category = Category.objects.create(name_ar="Test", name_en="Test", slug="test-offer")
        self.gov = Governorate.objects.create(name_ar="G", name_en="G", slug="g-offer")
        self.city = City.objects.create(governorate=self.gov, name_ar="C", name_en="C", slug="c-offer")

        self.listing = Listing.objects.create(
            seller=self.seller,
            title="Item",
            description="Desc",
            category=self.category,
            governorate=self.gov,
            city=self.city,
            status=ListingStatus.PUBLISHED,
            moderation_status=ModerationStatus.APPROVED,
            price=50,
            currency="USD",
        )

    def test_buyer_can_create_offer_and_seller_can_accept(self):
        self.client.force_authenticate(self.buyer)
        url = reverse("offer-list")
        r = self.client.post(url, {"listing_id": self.listing.id, "amount": "42", "currency": "USD"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

        offer_id = r.data["id"]
        thread_id = r.data["thread"]

        offer = Offer.objects.get(id=offer_id)
        self.assertEqual(offer.status, OfferStatus.PENDING)
        self.assertEqual(offer.buyer_id, self.buyer.id)
        self.assertEqual(offer.seller_id, self.seller.id)
        self.assertEqual(offer.listing_id, self.listing.id)

        thread = PrivateThread.objects.get(id=thread_id)
        self.assertEqual(thread.listing_id, self.listing.id)
        self.assertEqual(thread.buyer_id, self.buyer.id)
        self.assertEqual(thread.seller_id, self.seller.id)

        self.assertTrue(PrivateMessage.objects.filter(thread=thread, offer=offer).exists())

        self.client.force_authenticate(self.seller)
        accept_url = reverse("offer-accept", kwargs={"pk": offer_id})
        r2 = self.client.post(accept_url, {}, format="json")
        self.assertEqual(r2.status_code, status.HTTP_200_OK)

        offer.refresh_from_db()
        self.assertEqual(offer.status, OfferStatus.ACCEPTED)
        self.assertIsNotNone(offer.decided_at)

        self.assertTrue(
            PrivateMessage.objects.filter(thread=thread, offer=offer, body__icontains="accepted").exists()
        )

    def test_seller_cannot_make_offer_on_own_listing(self):
        self.client.force_authenticate(self.seller)
        url = reverse("offer-list")
        r = self.client.post(url, {"listing_id": self.listing.id, "amount": "10"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
