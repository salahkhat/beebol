from __future__ import annotations

from django.conf import settings
from django.db import models

from market.models import Listing, TimestampedModel


class PublicQuestion(TimestampedModel):
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name="questions")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="public_questions")
    question = models.TextField()
    # When true, only the author (and staff) can see this question.
    is_shadowed = models.BooleanField(default=False, db_index=True)
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

    buyer_last_read_at = models.DateTimeField(null=True, blank=True)
    seller_last_read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["listing", "buyer"], name="uq_thread_listing_buyer"),
        ]
        ordering = ["-created_at"]


class PrivateMessage(TimestampedModel):
    thread = models.ForeignKey(PrivateThread, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="private_messages")
    body = models.TextField()
    # When true, only the sender (and staff) can see this message.
    is_shadowed = models.BooleanField(default=False, db_index=True)

    class Meta:
        ordering = ["created_at"]


class UserBlock(TimestampedModel):
    blocker = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="blocks_initiated",
    )
    blocked = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="blocked_by",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["blocker", "blocked"], name="uq_userblock_blocker_blocked"),
        ]
        indexes = [
            models.Index(fields=["blocker", "created_at"], name="ub_blocker_created_idx"),
        ]
        ordering = ["-created_at"]
