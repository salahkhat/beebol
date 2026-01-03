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
        indexes = [
            models.Index(fields=["listing", "created_at"], name="pq_listing_created_idx"),
        ]
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
        indexes = [
            models.Index(fields=["buyer", "created_at"], name="pth_buyer_created_idx"),
            models.Index(fields=["seller", "created_at"], name="pth_seller_created_idx"),
            models.Index(fields=["listing", "created_at"], name="pth_listing_created_idx"),
        ]
        ordering = ["-created_at"]


class OfferStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    ACCEPTED = "accepted", "Accepted"
    REJECTED = "rejected", "Rejected"
    COUNTERED = "countered", "Countered"


class Offer(TimestampedModel):
    thread = models.ForeignKey(PrivateThread, on_delete=models.CASCADE, related_name="offers")
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name="offers")

    buyer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="offers_as_buyer")
    seller = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="offers_as_seller")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="offers_created",
    )

    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=8, default="SYP")

    status = models.CharField(max_length=16, choices=OfferStatus.choices, default=OfferStatus.PENDING, db_index=True)
    decided_at = models.DateTimeField(null=True, blank=True)

    counter_of = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="counters",
    )

    class Meta:
        indexes = [
            models.Index(fields=["thread", "created_at"], name="offer_thread_created_idx"),
            models.Index(fields=["listing", "created_at"], name="offer_listing_created_idx"),
        ]
        ordering = ["created_at"]


class PrivateMessage(TimestampedModel):
    thread = models.ForeignKey(PrivateThread, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="private_messages")
    body = models.TextField()
    offer = models.ForeignKey(
        Offer,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="messages",
    )
    # When true, only the sender (and staff) can see this message.
    is_shadowed = models.BooleanField(default=False, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=["thread", "created_at"], name="pm_thread_created_idx"),
            models.Index(fields=["sender", "created_at"], name="pm_sender_created_idx"),
        ]
        ordering = ["created_at"]


class ThreadBuyerChecklist(TimestampedModel):
    thread = models.OneToOneField(PrivateThread, on_delete=models.CASCADE, related_name="buyer_checklist")
    buyer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="buyer_checklists")

    confirmed_condition = models.BooleanField(default=False)
    confirmed_location = models.BooleanField(default=False)

    class Meta:
        indexes = [
            models.Index(fields=["buyer", "created_at"], name="tbc_buyer_created_idx"),
        ]
        ordering = ["-created_at"]


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
