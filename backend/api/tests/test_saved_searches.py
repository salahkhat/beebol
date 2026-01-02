from datetime import timedelta

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from market.models import Category, City, Governorate, Listing, ListingStatus, ModerationStatus

User = get_user_model()


class SavedSearchesApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="u1", password="pass1234")
        self.other = User.objects.create_user(username="u2", password="pass1234")

        self.category = Category.objects.create(name_ar="Test", name_en="Test", slug="test")
        self.gov = Governorate.objects.create(name_ar="G", name_en="G", slug="g")
        self.city = City.objects.create(governorate=self.gov, name_ar="C", name_en="C", slug="c")

        # Two public-visible listings.
        Listing.objects.create(
            seller=self.other,
            title="Item1",
            description="Desc",
            category=self.category,
            governorate=self.gov,
            city=self.city,
            status=ListingStatus.PUBLISHED,
            moderation_status=ModerationStatus.APPROVED,
        )
        Listing.objects.create(
            seller=self.other,
            title="Item2",
            description="Desc",
            category=self.category,
            governorate=self.gov,
            city=self.city,
            status=ListingStatus.PUBLISHED,
            moderation_status=ModerationStatus.APPROVED,
        )
        # One non-public listing should not be counted.
        Listing.objects.create(
            seller=self.other,
            title="Draft",
            description="Desc",
            category=self.category,
            governorate=self.gov,
            city=self.city,
            status=ListingStatus.DRAFT,
            moderation_status=ModerationStatus.PENDING,
        )

        # Additional non-public variants should also not be counted.
        Listing.objects.create(
            seller=self.other,
            title="Published but pending",
            description="Desc",
            category=self.category,
            governorate=self.gov,
            city=self.city,
            status=ListingStatus.PUBLISHED,
            moderation_status=ModerationStatus.PENDING,
        )
        Listing.objects.create(
            seller=self.other,
            title="Removed listing",
            description="Desc",
            category=self.category,
            governorate=self.gov,
            city=self.city,
            status=ListingStatus.PUBLISHED,
            moderation_status=ModerationStatus.APPROVED,
            is_removed=True,
        )

    def test_crud_and_check_now(self):
        self.client.force_authenticate(self.user)

        list_url = reverse("saved-search-list")

        r1 = self.client.post(
            list_url,
            {
                "name": "All",
                "querystring": "",
                "query_params": {},
                "notify_enabled": False,
            },
            format="json",
        )
        self.assertEqual(r1.status_code, status.HTTP_201_CREATED)
        self.assertIn("id", r1.data)
        sid = r1.data["id"]

        # List returns only my items.
        r2 = self.client.get(list_url)
        self.assertEqual(r2.status_code, status.HTTP_200_OK)
        items = r2.data.get("results") if isinstance(r2.data, dict) else r2.data
        self.assertTrue(any(x.get("id") == sid for x in items))

        # Update notify_enabled
        detail_url = reverse("saved-search-detail", kwargs={"pk": sid})
        r3 = self.client.patch(detail_url, {"notify_enabled": True}, format="json")
        self.assertEqual(r3.status_code, status.HTTP_200_OK)
        self.assertEqual(r3.data.get("notify_enabled"), True)

        # Check now updates last_checked_at and last_result_count.
        check_url = reverse("saved-search-check-now", kwargs={"pk": sid})
        r4 = self.client.post(check_url, {}, format="json")
        self.assertEqual(r4.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(r4.data.get("last_checked_at"))
        self.assertEqual(r4.data.get("last_result_count"), 2)
        self.assertEqual(r4.data.get("last_new_count"), 2)

        # Add a new public-visible listing after the first check.
        new_listing = Listing.objects.create(
            seller=self.other,
            title="Item3",
            description="Desc",
            category=self.category,
            governorate=self.gov,
            city=self.city,
            status=ListingStatus.PUBLISHED,
            moderation_status=ModerationStatus.APPROVED,
        )
        Listing.objects.filter(id=new_listing.id).update(created_at=timezone.now() + timedelta(seconds=2))

        r4b = self.client.post(check_url, {}, format="json")
        self.assertEqual(r4b.status_code, status.HTTP_200_OK)
        self.assertEqual(r4b.data.get("last_result_count"), 3)
        self.assertEqual(r4b.data.get("last_new_count"), 1)

        # Delete
        r5 = self.client.delete(detail_url)
        self.assertIn(r5.status_code, (status.HTTP_204_NO_CONTENT, status.HTTP_200_OK))

        r6 = self.client.get(list_url)
        items2 = r6.data.get("results") if isinstance(r6.data, dict) else r6.data
        self.assertFalse(any(x.get("id") == sid for x in items2))

    def test_other_user_cannot_access(self):
        self.client.force_authenticate(self.user)
        list_url = reverse("saved-search-list")
        created = self.client.post(
            list_url,
            {"name": "Mine", "querystring": "", "query_params": {}},
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        sid = created.data["id"]

        self.client.force_authenticate(self.other)
        detail_url = reverse("saved-search-detail", kwargs={"pk": sid})
        r1 = self.client.get(detail_url)
        self.assertEqual(r1.status_code, status.HTTP_404_NOT_FOUND)

        check_url = reverse("saved-search-check-now", kwargs={"pk": sid})
        r2 = self.client.post(check_url, {}, format="json")
        self.assertEqual(r2.status_code, status.HTTP_404_NOT_FOUND)
