from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from market.models import Category, City, Governorate, Listing, ListingStatus, ModerationStatus

User = get_user_model()


class FavoritesAndBlocksApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="u1", password="pass1234")
        self.other = User.objects.create_user(username="u2", password="pass1234")

        self.category = Category.objects.create(name_ar="Test", name_en="Test", slug="test")
        self.gov = Governorate.objects.create(name_ar="G", name_en="G", slug="g")
        self.city = City.objects.create(governorate=self.gov, name_ar="C", name_en="C", slug="c")

        self.listing = Listing.objects.create(
            seller=self.other,
            title="Item",
            description="Desc",
            category=self.category,
            governorate=self.gov,
            city=self.city,
            status=ListingStatus.PUBLISHED,
            moderation_status=ModerationStatus.APPROVED,
        )

        self.non_public_listing = Listing.objects.create(
            seller=self.other,
            title="Draft",
            description="Desc",
            category=self.category,
            governorate=self.gov,
            city=self.city,
            status=ListingStatus.DRAFT,
            moderation_status=ModerationStatus.PENDING,
        )

    def test_favorites_create_list_delete(self):
        self.client.force_authenticate(self.user)

        create_url = reverse("favorite-list")
        r1 = self.client.post(create_url, {"listing_id": self.listing.id}, format="json")
        self.assertIn(r1.status_code, (status.HTTP_201_CREATED, status.HTTP_200_OK))
        self.assertIn("id", r1.data)
        self.assertEqual(r1.data.get("listing"), self.listing.id)
        fav_id = r1.data["id"]

        # Idempotent create
        r2 = self.client.post(create_url, {"listing_id": self.listing.id}, format="json")
        self.assertIn(r2.status_code, (status.HTTP_201_CREATED, status.HTTP_200_OK))
        self.assertEqual(r2.data.get("id"), fav_id)

        list_res = self.client.get(create_url)
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        items = list_res.data.get("results") if isinstance(list_res.data, dict) else list_res.data
        self.assertTrue(any(x.get("id") == fav_id for x in items))

        del_url = reverse("favorite-detail", kwargs={"pk": fav_id})
        r3 = self.client.delete(del_url)
        self.assertIn(r3.status_code, (status.HTTP_204_NO_CONTENT, status.HTTP_200_OK))

        list_res2 = self.client.get(create_url)
        items2 = list_res2.data.get("results") if isinstance(list_res2.data, dict) else list_res2.data
        self.assertFalse(any(x.get("id") == fav_id for x in items2))

    def test_cannot_favorite_non_public_listing(self):
        self.client.force_authenticate(self.user)

        create_url = reverse("favorite-list")
        r1 = self.client.post(create_url, {"listing_id": self.non_public_listing.id}, format="json")
        self.assertEqual(r1.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn("detail", r1.data)

    def test_favorite_nonexistent_listing_returns_404(self):
        self.client.force_authenticate(self.user)

        create_url = reverse("favorite-list")
        r1 = self.client.post(create_url, {"listing_id": 999999}, format="json")
        self.assertEqual(r1.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn("detail", r1.data)

    def test_favorite_invalid_listing_id_returns_404(self):
        self.client.force_authenticate(self.user)

        create_url = reverse("favorite-list")
        r1 = self.client.post(create_url, {"listing_id": "not-an-int"}, format="json")
        self.assertEqual(r1.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn("detail", r1.data)

    def test_favorites_list_hides_removed_but_delete_still_works(self):
        self.client.force_authenticate(self.user)

        create_url = reverse("favorite-list")
        created = self.client.post(create_url, {"listing_id": self.listing.id}, format="json")
        self.assertIn(created.status_code, (status.HTTP_201_CREATED, status.HTTP_200_OK))
        fav_id = created.data["id"]

        # Listing becomes non-public after it was favorited.
        self.listing.is_removed = True
        self.listing.save(update_fields=["is_removed"])

        # List should not include it for non-staff.
        listed = self.client.get(create_url)
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        items = listed.data.get("results") if isinstance(listed.data, dict) else listed.data
        self.assertFalse(any(x.get("id") == fav_id for x in items))

        # But delete by id should still succeed.
        del_url = reverse("favorite-detail", kwargs={"pk": fav_id})
        deleted = self.client.delete(del_url)
        self.assertIn(deleted.status_code, (status.HTTP_204_NO_CONTENT, status.HTTP_200_OK))

    def test_blocks_create_list_delete(self):
        self.client.force_authenticate(self.user)

        create_url = reverse("block-list")
        r1 = self.client.post(create_url, {"blocked_user_id": self.other.id}, format="json")
        self.assertIn(r1.status_code, (status.HTTP_201_CREATED, status.HTTP_200_OK))
        self.assertIn("id", r1.data)
        self.assertEqual(r1.data.get("blocked"), self.other.id)
        block_id = r1.data["id"]

        list_res = self.client.get(create_url)
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        items = list_res.data.get("results") if isinstance(list_res.data, dict) else list_res.data
        self.assertTrue(any(x.get("id") == block_id for x in items))

        del_url = reverse("block-detail", kwargs={"pk": block_id})
        r2 = self.client.delete(del_url)
        self.assertIn(r2.status_code, (status.HTTP_204_NO_CONTENT, status.HTTP_200_OK))

        list_res2 = self.client.get(create_url)
        items2 = list_res2.data.get("results") if isinstance(list_res2.data, dict) else list_res2.data
        self.assertFalse(any(x.get("id") == block_id for x in items2))

    def test_block_nonexistent_user_returns_404(self):
        self.client.force_authenticate(self.user)

        create_url = reverse("block-list")
        r1 = self.client.post(create_url, {"blocked_user_id": 999999}, format="json")
        self.assertEqual(r1.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn("detail", r1.data)

    def test_cannot_block_self_returns_400(self):
        self.client.force_authenticate(self.user)

        create_url = reverse("block-list")
        r1 = self.client.post(create_url, {"blocked_user_id": self.user.id}, format="json")
        self.assertEqual(r1.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("blocked_user_id", r1.data)
