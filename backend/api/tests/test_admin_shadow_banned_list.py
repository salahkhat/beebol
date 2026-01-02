from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from market.models import Profile

User = get_user_model()


class AdminShadowBannedUsersListApiTests(APITestCase):
    def setUp(self):
        self.staff = User.objects.create_user(username="staff", password="pass1234")
        self.staff.is_staff = True
        self.staff.save(update_fields=["is_staff"])

        self.u1 = User.objects.create_user(username="u1", password="pass1234")
        self.u2 = User.objects.create_user(username="u2", password="pass1234")

        p1, _ = Profile.objects.get_or_create(user=self.u1)
        p1.metadata = {"shadow_banned": True}
        p1.save(update_fields=["metadata", "updated_at"])

        p2, _ = Profile.objects.get_or_create(user=self.u2)
        p2.metadata = {"shadow_banned": False}
        p2.save(update_fields=["metadata", "updated_at"])

    def test_requires_staff(self):
        self.client.force_authenticate(self.u1)
        url = reverse("v1-admin-shadow-banned-users")
        r = self.client.get(url)
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_lists_shadow_banned_users(self):
        self.client.force_authenticate(self.staff)
        url = reverse("v1-admin-shadow-banned-users")
        r = self.client.get(url)
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        results = r.data.get("results")
        self.assertIsInstance(results, list)

        ids = {row.get("user_id") for row in results}
        self.assertIn(self.u1.id, ids)
        self.assertNotIn(self.u2.id, ids)

    def test_query_filter(self):
        self.client.force_authenticate(self.staff)
        url = reverse("v1-admin-shadow-banned-users")
        r = self.client.get(url, {"q": "u1"})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        ids = {row.get("user_id") for row in (r.data.get("results") or [])}
        self.assertIn(self.u1.id, ids)
