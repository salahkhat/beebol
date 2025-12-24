from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone


class TimestampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class ReportStatus(models.TextChoices):
    OPEN = "open", "Open"
    RESOLVED = "resolved", "Resolved"
    DISMISSED = "dismissed", "Dismissed"


class ListingReport(TimestampedModel):
    listing = models.ForeignKey(
        "market.Listing",
        on_delete=models.CASCADE,
        related_name="reports",
    )
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="listing_reports",
    )

    reason = models.CharField(max_length=40)
    message = models.TextField(blank=True)

    status = models.CharField(max_length=16, choices=ReportStatus.choices, default=ReportStatus.OPEN)

    handled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="handled_listing_reports",
    )
    handled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["listing", "status"]),
            models.Index(fields=["reporter", "created_at"]),
        ]
        ordering = ["-created_at"]

    def set_status(self, status: str, *, actor) -> None:
        self.status = status
        self.handled_by = actor
        self.handled_at = timezone.now()

    def __str__(self) -> str:
        return f"ListingReport({self.id})"
