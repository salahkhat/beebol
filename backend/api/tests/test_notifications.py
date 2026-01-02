from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from market.models import Category, City, Governorate, Listing, ListingStatus, ModerationStatus, Profile
from messaging.models import PrivateThread

User = get_user_model()


class NotificationsApiTests(APITestCase):
    def setUp(self):
        self.buyer = User.objects.create_user(username="buyer", password="pass1234")
        self.seller = User.objects.create_user(username="seller", password="pass1234")

        self.category = Category.objects.create(name_ar="Test", name_en="Test", slug="test")
        self.gov = Governorate.objects.create(name_ar="G", name_en="G", slug="g")
        self.city = City.objects.create(governorate=self.gov, name_ar="C", name_en="C", slug="c")

        self.listing = Listing.objects.create(
            seller=self.seller,
            title="Item",
            description="Desc",
            category=self.category,
            governorate=self.gov,
            city=self.city,
            status=ListingStatus.PUBLISHED,
            moderation_status=ModerationStatus.APPROVED,
        )

    def _create_thread(self) -> int:
        self.client.force_authenticate(self.buyer)
        url = reverse("thread-list")
        r = self.client.post(url, {"listing_id": self.listing.id}, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        return r.data["id"]

    def _list_notifications(self):
        url = reverse("notification-list")
        return self.client.get(url)

    def _notif_results(self, response):
        data = response.data
        if isinstance(data, dict):
            return data.get("results", [])
        return data

    def test_private_message_creates_inapp_notification_for_recipient(self):
        thread_id = self._create_thread()

        # Seller sends a message -> buyer gets notified.
        self.client.force_authenticate(self.seller)
        send_url = reverse("thread-messages", kwargs={"pk": thread_id})
        r = self.client.post(send_url, {"body": "hello"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

        self.client.force_authenticate(self.buyer)
        r = self._list_notifications()
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        items = self._notif_results(r)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["kind"], "private_message")
        self.assertEqual(items[0]["payload"].get("thread_id"), thread_id)
        self.assertEqual(items[0]["payload"].get("listing_id"), self.listing.id)

        # Mark read.
        notif_id = items[0]["id"]
        read_url = reverse("notification-mark-read", kwargs={"pk": notif_id})
        r = self.client.post(read_url, {}, format="json")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertTrue(r.data.get("is_read"))

    def test_shadowed_private_message_does_not_notify_other_user(self):
        # Shadow-ban seller, so their message is shadowed and invisible to buyer.
        p, _ = Profile.objects.get_or_create(user=self.seller)
        p.metadata = {"shadow_banned": True}
        p.save(update_fields=["metadata", "updated_at"])

        thread_id = self._create_thread()

        self.client.force_authenticate(self.seller)
        send_url = reverse("thread-messages", kwargs={"pk": thread_id})
        r = self.client.post(send_url, {"body": "hello"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

        self.client.force_authenticate(self.buyer)
        r = self._list_notifications()
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(len(self._notif_results(r)), 0)

    def test_question_answer_creates_notification_for_author(self):
        # Buyer asks a question.
        self.client.force_authenticate(self.buyer)
        ask_url = reverse("listing-questions", kwargs={"pk": self.listing.id})
        r = self.client.post(ask_url, {"question": "Is it available?"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        question_id = r.data["id"]

        # Seller answers.
        self.client.force_authenticate(self.seller)
        answer_url = reverse("question-answer", kwargs={"pk": question_id})
        r = self.client.post(answer_url, {"answer": "Yes"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_200_OK)

        # Buyer sees notification.
        self.client.force_authenticate(self.buyer)
        r = self._list_notifications()
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        items = self._notif_results(r)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["kind"], "question_answered")
        self.assertEqual(items[0]["payload"].get("listing_id"), self.listing.id)
        self.assertEqual(items[0]["payload"].get("question_id"), question_id)

    def test_can_view_and_update_notification_preferences(self):
        self.client.force_authenticate(self.buyer)

        url = reverse("v1-me-notification-preferences")
        r = self.client.get(url)
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn("inapp_private_message", r.data)

        r = self.client.patch(url, {"email_private_message": True}, format="json")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data["email_private_message"], True)
