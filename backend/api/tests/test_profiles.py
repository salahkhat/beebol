from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.core.files.uploadedfile import SimpleUploadedFile

User = get_user_model()


class ProfileApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="u1", password="pass1234")
        self.other = User.objects.create_user(username="u2", password="pass1234")

    def test_me_profile_get_and_patch(self):
        self.client.force_authenticate(self.user)
        url = reverse("v1-me-profile")
        r = self.client.get(url)
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        # patch display_name
        r = self.client.patch(url, {"display_name": "NewName"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data.get("display_name"), "NewName")

    def test_user_profile_public(self):
        url = reverse("v1-user-profile", kwargs={"user_id": self.user.id})
        r = self.client.get(url)
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn("user_id", r.data)

    def test_privacy_hides_social_links(self):
        # When a user disables show_contact, public view should not include social_links
        from market.models import Profile
        p, _ = Profile.objects.get_or_create(user=self.user)
        p.social_links = [{"type": "twitter", "url": "https://twitter.com/me"}]
        p.privacy_settings = {"show_contact": False}
        p.save()

        url = reverse("v1-user-profile", kwargs={"user_id": self.user.id})
        r = self.client.get(url)
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertNotIn("social_links", r.data)

        # Owner should still see social_links via /me/profile/
        self.client.force_authenticate(self.user)
        url_me = reverse("v1-me-profile")
        r2 = self.client.get(url_me)
        self.assertEqual(r2.status_code, status.HTTP_200_OK)
        self.assertIn("social_links", r2.data)

    def test_avatar_upload(self):
        # Upload a real generated image and assert medium/thumbnail generation
        from io import BytesIO
        from PIL import Image

        self.client.force_authenticate(self.user)
        url = reverse("v1-me-avatar")

        buf = BytesIO()
        img = Image.new("RGB", (800, 600), color=(255, 0, 0))
        img.save(buf, format="PNG")
        buf.seek(0)

        file = SimpleUploadedFile("avatar.png", buf.read(), content_type="image/png")
        r = self.client.post(url, {"avatar": file})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn("avatar", r.data)

        # Serializer should expose medium and thumbnail URLs and cache metadata
        self.assertIn("avatar_medium", r.data)
        self.assertIn("avatar_thumbnail", r.data)
        self.assertIn("avatar_cache_control", r.data)
        self.assertEqual(r.data.get("avatar_cache_control"), "max-age=86400")

        # URLs should be absolute (testserver)
        self.assertTrue(str(r.data.get("avatar_medium")).startswith("http://testserver/"))
        self.assertTrue(str(r.data.get("avatar_thumbnail")).startswith("http://testserver/"))

        # Verify files exist on disk and sizes are respected
        from market.models import Profile
        profile = Profile.objects.get(user=self.user)
        self.assertTrue(bool(profile.avatar_medium))
        self.assertTrue(bool(profile.avatar_thumbnail))

        from PIL import Image as PilImage
        med_path = profile.avatar_medium.path
        thumb_path = profile.avatar_thumbnail.path

        m = PilImage.open(med_path)
        t = PilImage.open(thumb_path)

        # Medium should be resized to fit within 400x400
        self.assertTrue(m.width <= 400 and m.height <= 400)
        # Thumbnail should be at most 128x128
        self.assertTrue(t.width <= 128 and t.height <= 128)

    def test_cover_upload(self):
        from io import BytesIO
        from PIL import Image

        self.client.force_authenticate(self.user)
        url = reverse("v1-me-cover")

        buf = BytesIO()
        img = Image.new("RGB", (1600, 800), color=(0, 120, 200))
        img.save(buf, format="PNG")
        buf.seek(0)

        file = SimpleUploadedFile("cover.png", buf.read(), content_type="image/png")
        r = self.client.post(url, {"cover": file})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn("cover", r.data)
        self.assertIn("cover_medium", r.data)

        from market.models import Profile
        profile = Profile.objects.get(user=self.user)
        self.assertTrue(bool(profile.cover_medium))
        cm = Image.open(profile.cover_medium.path)
        self.assertTrue(cm.width <= 1200 and cm.height <= 400)

        # A subsequent GET to MeProfileView should include absolute cover URL
        url_me = reverse("v1-me-profile")
        r2 = self.client.get(url_me)
        self.assertEqual(r2.status_code, status.HTTP_200_OK)
        self.assertIn("cover_medium", r2.data)
        self.assertTrue(str(r2.data.get("cover_medium")).startswith("http://testserver/"))
        profile = Profile.objects.get(user=self.user)
        self.assertTrue(bool(profile.cover_medium))
