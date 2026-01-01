from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class ProfileSocialTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="suser", password="pass1234")

    def test_patch_social_links(self):
        self.client.force_authenticate(self.user)
        url = reverse('v1-me-profile')
        data = {
            'social_links': [
                {'type': 'twitter', 'url': 'https://twitter.com/me'},
                {'type': 'website', 'url': 'https://example.com'},
            ]
        }
        r = self.client.patch(url, data, format='json')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn('social_links', r.data)
        self.assertEqual(len(r.data['social_links']), 2)

        # Public view should show social_links if privacy allows
        url_public = reverse('v1-user-profile', kwargs={'user_id': self.user.id})
        # Unauthenticate client to simulate public request
        self.client.force_authenticate(None)
        r2 = self.client.get(url_public)
        self.assertEqual(r2.status_code, status.HTTP_200_OK)
        # By default show_contact is False in model. If it's False, public shouldn't include links.
        self.assertNotIn('social_links', r2.data)

        # Enable contact and verify public contains them
        from market.models import Profile
        p = Profile.objects.get(user=self.user)
        p.privacy_settings = {'show_contact': True}
        p.save()
        r3 = self.client.get(url_public)
        self.assertEqual(r3.status_code, status.HTTP_200_OK)
        self.assertIn('social_links', r3.data)
        self.assertEqual(len(r3.data['social_links']), 2)
