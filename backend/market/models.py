from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.db import models
from django.core.exceptions import ValidationError
from django.utils.text import slugify


class TimestampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Category(TimestampedModel):
    name_ar = models.CharField(max_length=120)
    name_en = models.CharField(max_length=120, blank=True)
    slug = models.SlugField(max_length=140, unique=True)
    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="children",
    )

    class Meta:
        indexes = [models.Index(fields=["parent", "slug"]) ]
        ordering = ["slug"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name_en or self.name_ar)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name_ar


class Governorate(TimestampedModel):
    name_ar = models.CharField(max_length=120, unique=True)
    name_en = models.CharField(max_length=120, blank=True)
    slug = models.SlugField(max_length=140, unique=True)

    class Meta:
        ordering = ["slug"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name_en or self.name_ar)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name_ar


class City(TimestampedModel):
    governorate = models.ForeignKey(
        Governorate,
        on_delete=models.PROTECT,
        related_name="cities",
    )
    name_ar = models.CharField(max_length=120)
    name_en = models.CharField(max_length=120, blank=True)
    slug = models.SlugField(max_length=140)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["governorate", "slug"], name="uq_city_gov_slug"),
        ]
        ordering = ["governorate__slug", "slug"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name_en or self.name_ar)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.name_ar} ({self.governorate.name_ar})"


class Neighborhood(TimestampedModel):
    city = models.ForeignKey(
        City,
        on_delete=models.PROTECT,
        related_name="neighborhoods",
    )
    name_ar = models.CharField(max_length=120)
    name_en = models.CharField(max_length=120, blank=True)
    slug = models.SlugField(max_length=140)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["city", "slug"], name="uq_neighborhood_city_slug"),
        ]
        ordering = ["city__slug", "slug"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name_en or self.name_ar)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.name_ar} ({self.city.name_ar})"


class ListingStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    PUBLISHED = "published", "Published"
    ARCHIVED = "archived", "Archived"


class ModerationStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"


class Listing(TimestampedModel):
    seller = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="listings")

    title = models.CharField(max_length=140)
    description = models.TextField(blank=True)

    price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=8, default="SYP")

    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="listings")
    governorate = models.ForeignKey(Governorate, on_delete=models.PROTECT, related_name="listings")
    city = models.ForeignKey(City, on_delete=models.PROTECT, related_name="listings")
    neighborhood = models.ForeignKey(
        Neighborhood,
        on_delete=models.PROTECT,
        related_name="listings",
        null=True,
        blank=True,
    )

    status = models.CharField(max_length=16, choices=ListingStatus.choices, default=ListingStatus.DRAFT)
    moderation_status = models.CharField(
        max_length=16,
        choices=ModerationStatus.choices,
        default=ModerationStatus.PENDING,
    )

    is_flagged = models.BooleanField(default=False)
    is_removed = models.BooleanField(default=False)

    class Meta:
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["city", "status", "created_at"]),
            models.Index(fields=["category", "status", "created_at"]),
        ]
        ordering = ["-created_at"]

    def clean(self):
        if self.price is not None and self.price < Decimal("0"):
            raise ValidationError({"price": "Price cannot be negative"})

    def __str__(self) -> str:
        return self.title


def listing_image_upload_to(instance: "ListingImage", filename: str) -> str:
    return f"listings/{instance.listing_id}/{filename}"


class ListingImage(TimestampedModel):
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to=listing_image_upload_to)
    alt_text = models.CharField(max_length=140, blank=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self) -> str:
        return f"ListingImage({self.listing_id})"
