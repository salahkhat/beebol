from __future__ import annotations

from django.conf import settings
from django.db import models

from market.models import TimestampedModel


class NotificationKind(models.TextChoices):
    PRIVATE_MESSAGE = "private_message", "Private message"
    QUESTION_ANSWERED = "question_answered", "Question answered"


class Notification(TimestampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    kind = models.CharField(max_length=64, choices=NotificationKind.choices, db_index=True)
    title = models.CharField(max_length=140, blank=True)
    body = models.TextField(blank=True)
    payload = models.JSONField(default=dict, blank=True)

    read_at = models.DateTimeField(null=True, blank=True, db_index=True)
    emailed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["user", "read_at", "created_at"], name="notif_user_read_created_idx"),
        ]


class NotificationPreference(TimestampedModel):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notification_preferences",
    )

    inapp_private_message = models.BooleanField(default=True)
    inapp_question_answered = models.BooleanField(default=True)

    email_private_message = models.BooleanField(default=False)
    email_question_answered = models.BooleanField(default=False)

    class Meta:
        ordering = ["user_id"]
