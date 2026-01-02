from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from market.models import Profile

User = get_user_model()


class AdminShadowBanApiTests(APITestCase):
    def setUp(self):
        self.staff = User.objects.create_user(username="staff", password="pass1234")
        self.staff.is_staff = True
        self.staff.save(update_fields=["is_staff"])

        self.user = User.objects.create_user(username="u1", password="pass1234")

    def test_staff_can_toggle_shadow_ban(self):
        self.client.force_authenticate(self.staff)
        url = reverse("v1-admin-user-shadow-ban", kwargs={"user_id": self.user.id})

        r1 = self.client.patch(url, {"shadow_banned": True}, format="json")
        self.assertEqual(r1.status_code, status.HTTP_200_OK)
        self.assertEqual(r1.data.get("user_id"), self.user.id)
        self.assertEqual(r1.data.get("shadow_banned"), True)

        profile = Profile.objects.get(user=self.user)
        self.assertEqual(bool(profile.metadata.get("shadow_banned")), True)

        r2 = self.client.patch(url, {"shadow_banned": False}, format="json")
        self.assertEqual(r2.status_code, status.HTTP_200_OK)
        profile.refresh_from_db()
        self.assertEqual(bool(profile.metadata.get("shadow_banned")), False)

    def test_requires_staff(self):
        self.client.force_authenticate(self.user)
        url = reverse("v1-admin-user-shadow-ban", kwargs={"user_id": self.user.id})
        r = self.client.patch(url, {"shadow_banned": True}, format="json")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_requires_boolean(self):
        self.client.force_authenticate(self.staff)
        url = reverse("v1-admin-user-shadow-ban", kwargs={"user_id": self.user.id})
        r = self.client.patch(url, {"shadow_banned": "yes"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
