from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from market.models import Category, City, Governorate, Listing, ListingStatus, ModerationStatus
from messaging.models import PrivateMessage, PrivateThread

User = get_user_model()


class ThreadReadStateApiTests(APITestCase):
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

    def _list_threads(self):
        url = reverse("thread-list")
        return self.client.get(url)

    def _threads_payload(self, response):
        data = response.data
        if isinstance(data, dict):
            # DRF pagination
            return data.get("results", [])
        return data

    def test_unread_count_increments_and_clears_with_mark_read(self):
        thread_id = self._create_thread()

        # Seller sends a message -> should be unread for buyer.
        self.client.force_authenticate(self.seller)
        send_url = reverse("thread-messages", kwargs={"pk": thread_id})
        r = self.client.post(send_url, {"body": "hello"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

        # Buyer sees 1 unread.
        self.client.force_authenticate(self.buyer)
        r = self._list_threads()
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        thread = next(t for t in self._threads_payload(r) if t["id"] == thread_id)
        self.assertEqual(thread["unread_count"], 1)

        # Mark read clears unread.
        read_url = reverse("thread-mark-read", kwargs={"pk": thread_id})
        r = self.client.post(read_url, {}, format="json")
        self.assertEqual(r.status_code, status.HTTP_200_OK)

        r = self._list_threads()
        thread = next(t for t in self._threads_payload(r) if t["id"] == thread_id)
        self.assertEqual(thread["unread_count"], 0)

    def test_shadowed_messages_do_not_count_as_unread_for_non_staff(self):
        thread_id = self._create_thread()

        thread = PrivateThread.objects.get(id=thread_id)
        msg = PrivateMessage.objects.create(thread=thread, sender=self.seller, body="shadowed", is_shadowed=True)

        # Move the message into the future relative to epoch/reads to guarantee it would count if not shadowed.
        PrivateMessage.objects.filter(id=msg.id).update(created_at="2030-01-01T00:00:00Z")

        self.client.force_authenticate(self.buyer)
        r = self._list_threads()
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        thread_row = next(t for t in self._threads_payload(r) if t["id"] == thread_id)
        self.assertEqual(thread_row["unread_count"], 0)

        # A non-shadowed message should count.
        msg2 = PrivateMessage.objects.create(thread=thread, sender=self.seller, body="visible", is_shadowed=False)
        PrivateMessage.objects.filter(id=msg2.id).update(created_at="2030-01-02T00:00:00Z")

        r = self._list_threads()
        thread_row = next(t for t in self._threads_payload(r) if t["id"] == thread_id)
        self.assertEqual(thread_row["unread_count"], 1)
