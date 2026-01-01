from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from market.models import Category, City, Governorate, Listing

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
