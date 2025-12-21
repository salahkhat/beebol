from __future__ import annotations

from django.conf import settings
from django.db import models

from market.models import Listing, TimestampedModel


class PublicQuestion(TimestampedModel):
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name="questions")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="public_questions")
    question = models.TextField()
    answer = models.TextField(blank=True)
    answered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="answered_public_questions",
    )
    answered_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]


class PrivateThread(TimestampedModel):
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name="threads")
    buyer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="threads_as_buyer")
    seller = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="threads_as_seller")

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["listing", "buyer"], name="uq_thread_listing_buyer"),
        ]
        ordering = ["-created_at"]


class PrivateMessage(TimestampedModel):
    thread = models.ForeignKey(PrivateThread, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="private_messages")
    body = models.TextField()

    class Meta:
        ordering = ["created_at"]
