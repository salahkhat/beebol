from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from market.models import Category, City, Governorate, Listing, ListingStatus, ModerationStatus
from market.models import ListingWatch

User = get_user_model()


class WatchlistApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="u1", password="pass1234", email="u1@example.com")
        self.staff = User.objects.create_user(username="staff", password="pass1234", email="staff@example.com")
        self.staff.is_staff = True
        self.staff.save(update_fields=["is_staff"])

        self.seller = User.objects.create_user(username="seller", password="pass1234", email="seller@example.com")

        self.cat = Category.objects.create(name_ar="C", name_en="C", slug="c")
        self.gov = Governorate.objects.create(name_ar="G", name_en="G", slug="g")
        self.city = City.objects.create(governorate=self.gov, name_ar="City", name_en="City", slug="city")

    def _make_public_listing(self, *, price=123, currency="SYP"):
        return Listing.objects.create(
            seller=self.seller,
            title="T",
            description="D",
            category=self.cat,
            governorate=self.gov,
            city=self.city,
            status=ListingStatus.PUBLISHED,
            moderation_status=ModerationStatus.APPROVED,
            is_removed=False,
            price=price,
            currency=currency,
        )

    def test_watchlist_requires_auth(self):
        url = reverse("watch-list")
        r = self.client.get(url)
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_watchlist_create_and_list(self):
        listing = self._make_public_listing(price=100, currency="SYP")
        self.client.force_authenticate(self.user)

        url = reverse("watch-list")
        r1 = self.client.post(url, {"listing_id": listing.id}, format="json")
        self.assertIn(r1.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED))
        self.assertEqual(r1.data.get("listing"), listing.id)
        self.assertIsNotNone(r1.data.get("last_seen_at"))
        self.assertEqual(str(r1.data.get("last_seen_currency")), "SYP")

        r2 = self.client.get(url)
        self.assertEqual(r2.status_code, status.HTTP_200_OK)
        items = r2.data.get("results") if isinstance(r2.data, dict) else r2.data
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0].get("listing"), listing.id)

    def test_watchlist_mark_seen_updates_snapshot(self):
        listing = self._make_public_listing(price=100, currency="SYP")
        self.client.force_authenticate(self.user)

        create_url = reverse("watch-list")
        created = self.client.post(create_url, {"listing_id": listing.id}, format="json")
        self.assertIn(created.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED))
        watch_id = created.data.get("id")
        self.assertIsInstance(watch_id, int)

        listing.price = 80
        listing.save(update_fields=["price", "updated_at"])

        seen_url = reverse("watch-mark-seen", kwargs={"pk": watch_id})
        r = self.client.post(seen_url, {}, format="json")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(str(r.data.get("last_seen_price")), "80.00")

    def test_watchlist_list_hides_non_public_for_non_staff(self):
        public_listing = self._make_public_listing()
        hidden_listing = Listing.objects.create(
            seller=self.seller,
            title="Hidden",
            description="D",
            category=self.cat,
            governorate=self.gov,
            city=self.city,
            status=ListingStatus.DRAFT,
            moderation_status=ModerationStatus.PENDING,
            is_removed=False,
        )

        ListingWatch.objects.create(user=self.user, listing=public_listing)
        ListingWatch.objects.create(user=self.user, listing=hidden_listing)

        self.client.force_authenticate(self.user)
        url = reverse("watch-list")
        r = self.client.get(url)
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        items = r.data.get("results") if isinstance(r.data, dict) else r.data
        listing_ids = [x.get("listing") for x in items]
        self.assertIn(public_listing.id, listing_ids)
        self.assertNotIn(hidden_listing.id, listing_ids)
