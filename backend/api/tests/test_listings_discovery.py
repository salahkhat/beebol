from datetime import timedelta

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from market.models import (
    Category,
    City,
    Governorate,
    Listing,
    ListingFavorite,
    ListingStatus,
    ModerationStatus,
)

User = get_user_model()


class ListingsDiscoveryApiTests(APITestCase):
    def setUp(self):
        self.seller = User.objects.create_user(username="seller", password="pass1234")
        self.u1 = User.objects.create_user(username="u1", password="pass1234")
        self.u2 = User.objects.create_user(username="u2", password="pass1234")

        self.cat1 = Category.objects.create(name_ar="C1", name_en="C1", slug="c1")
        self.cat2 = Category.objects.create(name_ar="C2", name_en="C2", slug="c2")

        self.gov = Governorate.objects.create(name_ar="G", name_en="G", slug="g")
        self.city = City.objects.create(governorate=self.gov, name_ar="City", name_en="City", slug="city")

        self.l1 = Listing.objects.create(
            seller=self.seller,
            title="iPhone 12 like new",
            description="Great condition",
            category=self.cat1,
            governorate=self.gov,
            city=self.city,
            status=ListingStatus.PUBLISHED,
            moderation_status=ModerationStatus.APPROVED,
            is_removed=False,
        )
        self.l2 = Listing.objects.create(
            seller=self.seller,
            title="Samsung A52",
            description="Includes iPhone 12 accessories",
            category=self.cat1,
            governorate=self.gov,
            city=self.city,
            status=ListingStatus.PUBLISHED,
            moderation_status=ModerationStatus.APPROVED,
            is_removed=False,
        )
        self.l3 = Listing.objects.create(
            seller=self.seller,
            title="iPhone case",
            description="Fits 12",
            category=self.cat1,
            governorate=self.gov,
            city=self.city,
            status=ListingStatus.PUBLISHED,
            moderation_status=ModerationStatus.APPROVED,
            is_removed=False,
        )

        # Ensure deterministic recency ordering inside rank buckets.
        now = timezone.now()
        Listing.objects.filter(id=self.l1.id).update(created_at=now - timedelta(days=3))
        Listing.objects.filter(id=self.l2.id).update(created_at=now - timedelta(days=2))
        Listing.objects.filter(id=self.l3.id).update(created_at=now - timedelta(days=1))

        self.l1.refresh_from_db()
        self.l2.refresh_from_db()
        self.l3.refresh_from_db()

        # A different category listing to validate facets grouping.
        self.other_cat_listing = Listing.objects.create(
            seller=self.seller,
            title="Other category item",
            description="Nothing special",
            category=self.cat2,
            governorate=self.gov,
            city=self.city,
            status=ListingStatus.PUBLISHED,
            moderation_status=ModerationStatus.APPROVED,
            is_removed=False,
        )

        # A non-public listing should never appear in public discovery.
        self.non_public = Listing.objects.create(
            seller=self.seller,
            title="Draft",
            description="Hidden",
            category=self.cat1,
            governorate=self.gov,
            city=self.city,
            status=ListingStatus.DRAFT,
            moderation_status=ModerationStatus.PENDING,
            is_removed=False,
        )

    def _ids_from_list_response(self, data):
        items = data.get("results") if isinstance(data, dict) else data
        return [x.get("id") for x in items]

    def test_search_relevance_orders_title_phrase_above_description_phrase(self):
        url = reverse("listing-list")
        res = self.client.get(url, {"search": "iPhone 12"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        ids = self._ids_from_list_response(res.data)
        # l1: title contains full phrase; l2: description contains phrase; l3: token match only.
        self.assertTrue(ids.index(self.l1.id) < ids.index(self.l2.id))
        self.assertTrue(ids.index(self.l2.id) < ids.index(self.l3.id))

    def test_facets_returns_grouped_counts(self):
        url = reverse("listing-facets")
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("categories", res.data)

        by_cat = {row["category_id"]: row["count"] for row in res.data["categories"]}

        # cat1 has three public listings; cat2 has one.
        self.assertEqual(by_cat.get(self.cat1.id), 3)
        self.assertEqual(by_cat.get(self.cat2.id), 1)

        # Non-public listing is excluded.
        self.assertNotIn(self.non_public.id, self._ids_from_list_response(self.client.get(reverse("listing-list")).data))

    def test_trending_orders_by_recent_favorites(self):
        # Create favorites within the last 7 days.
        ListingFavorite.objects.create(user=self.u1, listing=self.l2)
        ListingFavorite.objects.create(user=self.u1, listing=self.l1)
        ListingFavorite.objects.create(user=self.u2, listing=self.l1)

        url = reverse("listing-trending")
        res = self.client.get(url, {"city": self.city.id})
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        ids = self._ids_from_list_response(res.data)
        self.assertGreaterEqual(len(ids), 2)
        # l1 has 2 favorites, l2 has 1 → l1 should be first.
        self.assertEqual(ids[0], self.l1.id)

    def test_new_in_city_requires_city_param(self):
        url = reverse("listing-new-in-city")
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", res.data)

        res2 = self.client.get(url, {"city": self.city.id})
        self.assertEqual(res2.status_code, status.HTTP_200_OK)

    def test_similar_returns_same_category_city_excluding_self(self):
        # Similar should include l2/l3 for l1 (same category+city), but not itself.
        url = reverse("listing-similar", kwargs={"pk": self.l1.id})
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        ids = self._ids_from_list_response(res.data)
        self.assertNotIn(self.l1.id, ids)
        self.assertIn(self.l2.id, ids)
        self.assertIn(self.l3.id, ids)
