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

    def ancestor_ids_including_self(self) -> list[int]:
        out: list[int] = []
        cur: Category | None = self
        seen: set[int] = set()
        while cur is not None and cur.id is not None:
            if cur.id in seen:
                break
            seen.add(cur.id)
            out.append(cur.id)
            cur = cur.parent
        return out


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

    # Optional precise coordinates for map views.
    # Keep null when unknown.
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

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

        if self.latitude is not None and (self.latitude < Decimal("-90") or self.latitude > Decimal("90")):
            raise ValidationError({"latitude": "Latitude must be between -90 and 90"})
        if self.longitude is not None and (self.longitude < Decimal("-180") or self.longitude > Decimal("180")):
            raise ValidationError({"longitude": "Longitude must be between -180 and 180"})

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


class AdminSeedJobStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    RUNNING = "running", "Running"
    SUCCEEDED = "succeeded", "Succeeded"
    FAILED = "failed", "Failed"


class AdminSeedJob(TimestampedModel):
    scenario = models.CharField(max_length=64, default="demo")
    options = models.JSONField(default=dict, blank=True)

    status = models.CharField(
        max_length=16,
        choices=AdminSeedJobStatus.choices,
        default=AdminSeedJobStatus.PENDING,
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="admin_seed_jobs",
    )
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    result = models.JSONField(null=True, blank=True)
    output = models.TextField(blank=True, default="")
    error = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-created_at", "-id"]


# -- Profile model ----------------------------------------------------------------

def profile_avatar_upload_to(instance: "Profile", filename: str) -> str:
    return f"profiles/{instance.user_id}/avatars/{filename}"


def profile_cover_upload_to(instance: "Profile", filename: str) -> str:
    return f"profiles/{instance.user_id}/covers/{filename}"


class Profile(TimestampedModel):
    # Use distinct related_name to avoid clashes with existing `django_classified.Profile`
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="market_profile")

    display_name = models.CharField(max_length=80, blank=True)
    bio = models.TextField(blank=True)

    avatar = models.ImageField(upload_to=profile_avatar_upload_to, null=True, blank=True)
    # Derived sizes for responsive delivery
    avatar_medium = models.ImageField(upload_to=lambda instance, fn: f"profiles/{instance.user_id}/avatars/medium/{fn}", null=True, blank=True)
    avatar_thumbnail = models.ImageField(upload_to=lambda instance, fn: f"profiles/{instance.user_id}/avatars/thumb/{fn}", null=True, blank=True)
    cover = models.ImageField(upload_to=profile_cover_upload_to, null=True, blank=True)
    # Derived cover variant for responsive delivery
    cover_medium = models.ImageField(upload_to=lambda instance, fn: f"profiles/{instance.user_id}/covers/medium/{fn}", null=True, blank=True)

    governorate = models.ForeignKey(Governorate, on_delete=models.SET_NULL, null=True, blank=True)
    city = models.ForeignKey(City, on_delete=models.SET_NULL, null=True, blank=True)
    neighborhood = models.ForeignKey(Neighborhood, on_delete=models.SET_NULL, null=True, blank=True)

    social_links = models.JSONField(default=list, blank=True)  # list of {type, url}

    seller_rating = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True)
    listings_count = models.IntegerField(default=0)
    followers_count = models.IntegerField(default=0)

    verification_flags = models.JSONField(default=dict, blank=True)

    privacy_settings = models.JSONField(default=lambda: {"show_contact": False, "show_activity": True, "followers_visible": True}, blank=True)

    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [models.Index(fields=["display_name"])]

    def __str__(self) -> str:
        return f"Profile({self.user_id})"


class CategoryAttributeType(models.TextChoices):
    INT = "int", "Integer"
    DECIMAL = "decimal", "Decimal"
    TEXT = "text", "Text"
    BOOL = "bool", "Boolean"
    ENUM = "enum", "Enum"


class CategoryAttributeDefinition(TimestampedModel):
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name="attribute_definitions")

    # Stable identifier used in API and query params (e.g. bedrooms, area_m2, ram_gb)
    key = models.SlugField(max_length=64)

    label_ar = models.CharField(max_length=120)
    label_en = models.CharField(max_length=120, blank=True)

    type = models.CharField(max_length=16, choices=CategoryAttributeType.choices)
    unit = models.CharField(max_length=24, blank=True)

    # Only relevant for ENUM
    choices = models.JSONField(null=True, blank=True)

    is_required_in_post = models.BooleanField(default=False)
    is_filterable = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["category", "key"], name="uq_cat_attrdef_category_key"),
        ]
        indexes = [
            models.Index(fields=["category", "key"]),
        ]
        ordering = ["category_id", "sort_order", "key"]

    def clean(self):
        if self.type == CategoryAttributeType.ENUM:
            if self.choices is None:
                raise ValidationError({"choices": "choices is required for enum attributes"})
            if not isinstance(self.choices, list) or not all(isinstance(x, str) and x.strip() for x in self.choices):
                raise ValidationError({"choices": "choices must be a non-empty list of strings"})
        else:
            if self.choices not in (None, [], {}):
                raise ValidationError({"choices": "choices is only allowed for enum attributes"})

    def __str__(self) -> str:
        return f"{self.category_id}:{self.key}"


class ListingAttributeValue(TimestampedModel):
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name="attribute_values")
    definition = models.ForeignKey(
        CategoryAttributeDefinition,
        on_delete=models.CASCADE,
        related_name="values",
    )

    int_value = models.IntegerField(null=True, blank=True)
    decimal_value = models.DecimalField(max_digits=18, decimal_places=6, null=True, blank=True)
    text_value = models.TextField(null=True, blank=True)
    bool_value = models.BooleanField(null=True, blank=True)
    enum_value = models.CharField(max_length=120, null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["listing", "definition"], name="uq_listing_attrvalue_listing_def"),
        ]
        indexes = [
            models.Index(fields=["definition", "int_value"]),
            models.Index(fields=["definition", "decimal_value"]),
            models.Index(fields=["definition", "enum_value"]),
        ]

    def clean(self):
        # Ensure at most one typed value is set.
        vals = [
            self.int_value is not None,
            self.decimal_value is not None,
            self.text_value not in (None, ""),
            self.bool_value is not None,
            self.enum_value not in (None, ""),
        ]
        if sum(1 for v in vals if v) > 1:
            raise ValidationError("Only one value field can be set")

    def __str__(self) -> str:
        return f"ListingAttributeValue({self.listing_id},{self.definition_id})"
