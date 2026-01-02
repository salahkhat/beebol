from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from market.models import Category, City, Governorate, Listing, ListingStatus, ModerationStatus
from messaging.models import PublicQuestion, UserBlock

User = get_user_model()


class PublicQuestionVisibilityApiTests(APITestCase):
    def setUp(self):
        self.author = User.objects.create_user(username="author", password="pass1234")
        self.seller = User.objects.create_user(username="seller", password="pass1234")
        self.other = User.objects.create_user(username="other", password="pass1234")

        self.category = Category.objects.create(name_ar="Test", name_en="Test", slug="test")
        self.gov = Governorate.objects.create(name_ar="G", name_en="G", slug="g")
        self.city = City.objects.create(governorate=self.gov, name_ar="C", name_en="C", slug="c")

        self.public_listing = Listing.objects.create(
            seller=self.seller,
            title="Public",
            description="Desc",
            category=self.category,
            governorate=self.gov,
            city=self.city,
            status=ListingStatus.PUBLISHED,
            moderation_status=ModerationStatus.APPROVED,
            is_removed=False,
        )

        self.non_public_listing = Listing.objects.create(
            seller=self.seller,
            title="Draft",
            description="Desc",
            category=self.category,
            governorate=self.gov,
            city=self.city,
            status=ListingStatus.DRAFT,
            moderation_status=ModerationStatus.PENDING,
            is_removed=False,
        )

    def test_question_detail_public_listing_visible_to_anon(self):
        q = PublicQuestion.objects.create(
            listing=self.public_listing,
            author=self.author,
            question="Is it available?",
            is_shadowed=False,
        )

        self.client.force_authenticate(user=None)
        url = reverse("question-detail", kwargs={"pk": q.id})
        r = self.client.get(url)
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data.get("id"), q.id)

    def test_question_detail_non_public_listing_hidden_from_anon_and_unrelated_user(self):
        q = PublicQuestion.objects.create(
            listing=self.non_public_listing,
            author=self.author,
            question="Non public question",
            is_shadowed=False,
        )

        # Anon should not be able to retrieve it.
        self.client.force_authenticate(user=None)
        url = reverse("question-detail", kwargs={"pk": q.id})
        r1 = self.client.get(url)
        self.assertEqual(r1.status_code, status.HTTP_404_NOT_FOUND)

        # Authenticated unrelated user should not be able to retrieve it.
        self.client.force_authenticate(self.other)
        r2 = self.client.get(url)
        self.assertEqual(r2.status_code, status.HTTP_404_NOT_FOUND)

        # Author can retrieve it.
        self.client.force_authenticate(self.author)
        r3 = self.client.get(url)
        self.assertEqual(r3.status_code, status.HTTP_200_OK)
        self.assertEqual(r3.data.get("id"), q.id)

        # Seller can retrieve it.
        self.client.force_authenticate(self.seller)
        r4 = self.client.get(url)
        self.assertEqual(r4.status_code, status.HTTP_200_OK)
        self.assertEqual(r4.data.get("id"), q.id)

    def test_question_detail_shadowed_only_visible_to_author_and_staff(self):
        q = PublicQuestion.objects.create(
            listing=self.public_listing,
            author=self.author,
            question="Shadowed",
            is_shadowed=True,
        )

        url = reverse("question-detail", kwargs={"pk": q.id})

        self.client.force_authenticate(self.seller)
        r1 = self.client.get(url)
        self.assertEqual(r1.status_code, status.HTTP_404_NOT_FOUND)

        self.client.force_authenticate(self.author)
        r2 = self.client.get(url)
        self.assertEqual(r2.status_code, status.HTTP_200_OK)
        self.assertEqual(r2.data.get("id"), q.id)

    def test_question_detail_hidden_from_blocked_user(self):
        q = PublicQuestion.objects.create(
            listing=self.public_listing,
            author=self.author,
            question="Blocked visibility",
            is_shadowed=False,
        )
        UserBlock.objects.create(blocker=self.other, blocked=self.author)

        self.client.force_authenticate(self.other)
        url = reverse("question-detail", kwargs={"pk": q.id})
        r = self.client.get(url)
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_listing_questions_list_filters_blocked_authors(self):
        blocked_q = PublicQuestion.objects.create(
            listing=self.public_listing,
            author=self.author,
            question="Should be hidden",
            is_shadowed=False,
        )
        visible_q = PublicQuestion.objects.create(
            listing=self.public_listing,
            author=self.seller,
            question="Should be visible",
            is_shadowed=False,
        )
        UserBlock.objects.create(blocker=self.other, blocked=self.author)

        self.client.force_authenticate(self.other)
        url = reverse("listing-questions", kwargs={"pk": self.public_listing.id})
        r = self.client.get(url)
        self.assertEqual(r.status_code, status.HTTP_200_OK)

        ids = {row.get("id") for row in (r.data or [])}
        self.assertNotIn(blocked_q.id, ids)
        self.assertIn(visible_q.id, ids)

    def test_answer_hidden_when_block_exists(self):
        q = PublicQuestion.objects.create(
            listing=self.public_listing,
            author=self.author,
            question="Can you answer?",
            is_shadowed=False,
        )
        UserBlock.objects.create(blocker=self.seller, blocked=self.author)

        self.client.force_authenticate(self.seller)
        url = reverse("question-answer", kwargs={"pk": q.id})
        r = self.client.post(url, {"answer": "No"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)
