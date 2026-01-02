from django.contrib.auth import get_user_model
from django.conf import settings
from django.utils import timezone

from datetime import timedelta
import re

from rest_framework import serializers

from decimal import Decimal, InvalidOperation

try:
    from PIL import Image
except Exception:  # pragma: no cover
    Image = None

from market.models import (
    Category,
    CategoryAttributeDefinition,
    CategoryAttributeType,
    City,
    Governorate,
    Listing,
    ListingStatus,
    ModerationStatus,
    ListingAttributeValue,
    ListingImage,
    Neighborhood,
    ListingFavorite,
    SavedSearch,
    ListingWatch,
)
from messaging.models import PrivateMessage, PrivateThread, PublicQuestion, UserBlock
from notifications.models import Notification, NotificationPreference
from reports.models import ListingReport, ListingReportEvent, ReportStatus, UserReport, UserReportEvent

User = get_user_model()


class NonLeakyPrimaryKeyRelatedField(serializers.PrimaryKeyRelatedField):
    def __init__(self, *args, not_found_message: str = "Not found.", **kwargs):
        self.not_found_message = not_found_message
        super().__init__(*args, **kwargs)

    def to_internal_value(self, data):
        try:
            pk = int(data)
        except Exception:
            raise serializers.ValidationError(self.not_found_message)

        if pk <= 0:
            raise serializers.ValidationError(self.not_found_message)

        qs = self.get_queryset()
        obj = qs.filter(pk=pk).first() if qs is not None else None
        if obj is None:
            raise serializers.ValidationError(self.not_found_message)
        return obj


_ARABIC_INDIC_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")


def looks_like_contact_info(text: str) -> bool:
    if not text:
        return False

    normalized = str(text).lower().translate(_ARABIC_INDIC_DIGITS)

    # Fast-path for common contact spam markers.
    if any(token in normalized for token in ("whatsapp", "wa.me", "tel:", "واتساب", "واتس", "تليجرام", "telegram")):
        return True

    digits = re.sub(r"[^0-9]", "", normalized)
    if len(digits) < 8:
        return False

    if digits.startswith("09") and len(digits) >= 9:
        return True
    if digits.startswith("963") and len(digits) >= 11:
        return True
    if digits.startswith("00963") and len(digits) >= 13:
        return True
    if "+" in normalized and len(digits) >= 10:
        return True

    return False


def _normalize_spam_text(text: str) -> str:
    if not text:
        return ""
    normalized = str(text).lower().translate(_ARABIC_INDIC_DIGITS)
    tokens = re.findall(r"[0-9a-z\u0600-\u06FF]+", normalized)
    return " ".join(tokens)


def looks_like_repeated_text(text: str) -> bool:
    if not text:
        return False

    raw = str(text)
    if len(raw) < 40:
        return False

    normalized = _normalize_spam_text(raw)
    tokens = normalized.split()
    if len(tokens) < 10:
        return False

    unique_count = len(set(tokens))
    ratio = unique_count / max(1, len(tokens))
    if ratio < 0.3:
        return True

    # Also catch extreme repetition of a single token.
    counts: dict[str, int] = {}
    for t in tokens:
        counts[t] = counts.get(t, 0) + 1
    if counts and max(counts.values()) >= 8:
        return True

    # Catch repeated single-character spam (e.g. "هههههههه..." or "!!!!!!...").
    collapsed = re.sub(r"\s+", "", raw)
    if len(collapsed) >= 60 and len(set(collapsed)) <= 3:
        return True

    return False


class UserMeSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "is_staff"]

class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    password = serializers.CharField(min_length=8, write_only=True)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username already taken")
        return value

    def create(self, validated_data):
        email = validated_data.get("email") or ""
        user = User.objects.create_user(
            username=validated_data["username"],
            email=email,
            password=validated_data["password"],
        )
        return user


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name_ar", "name_en", "slug", "parent"]


class CategoryAttributeDefinitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CategoryAttributeDefinition
        fields = [
            "id",
            "category",
            "key",
            "label_ar",
            "label_en",
            "type",
            "unit",
            "choices",
            "is_required_in_post",
            "is_filterable",
            "sort_order",
        ]


def _effective_attribute_definitions(category: Category) -> list[CategoryAttributeDefinition]:
    # Child overrides parent on key collision.
    ancestor_ids = category.ancestor_ids_including_self()
    if not ancestor_ids:
        return []

    # ancestor_ids is [self, parent, ...] so reverse for root->leaf ordering.
    order = list(reversed(ancestor_ids))
    pos = {cid: idx for idx, cid in enumerate(order)}

    defs = list(CategoryAttributeDefinition.objects.filter(category_id__in=ancestor_ids))
    defs.sort(key=lambda d: (pos.get(d.category_id, 10_000), d.sort_order, d.key))

    by_key: dict[str, CategoryAttributeDefinition] = {}
    for d in defs:
        by_key[d.key] = d

    # Preserve display ordering (sort_order/key) of the final effective definitions.
    out = list(by_key.values())
    out.sort(key=lambda d: (d.sort_order, d.key))
    return out


def _parse_bool(raw) -> bool:
    if isinstance(raw, bool):
        return raw
    s = str(raw).strip().lower()
    if s in {"1", "true", "yes", "y", "on"}:
        return True
    if s in {"0", "false", "no", "n", "off"}:
        return False
    raise serializers.ValidationError("Invalid boolean")


class GovernorateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Governorate
        fields = ["id", "name_ar", "name_en", "slug"]


class CitySerializer(serializers.ModelSerializer):
    governorate = GovernorateSerializer(read_only=True)
    governorate_id = serializers.PrimaryKeyRelatedField(
        queryset=Governorate.objects.all(),
        source="governorate",
        write_only=True,
        required=False,
    )

    class Meta:
        model = City
        fields = ["id", "name_ar", "name_en", "slug", "governorate", "governorate_id"]


class NeighborhoodSerializer(serializers.ModelSerializer):
    city = CitySerializer(read_only=True)
    city_id = serializers.PrimaryKeyRelatedField(
        queryset=City.objects.all(),
        source="city",
        write_only=True,
        required=False,
    )

    class Meta:
        model = Neighborhood
        fields = ["id", "name_ar", "name_en", "slug", "city", "city_id"]


class ProfileSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    avatar = serializers.SerializerMethodField()
    avatar_medium = serializers.SerializerMethodField()
    avatar_thumbnail = serializers.SerializerMethodField()
    cover = serializers.SerializerMethodField()
    cover_medium = serializers.SerializerMethodField()
    avatar_cache_control = serializers.SerializerMethodField()
    governorate = GovernorateSerializer(read_only=True)
    governorate_id = serializers.PrimaryKeyRelatedField(
        queryset=Governorate.objects.all(), source="governorate", write_only=True, required=False
    )
    city = CitySerializer(read_only=True)
    city_id = serializers.PrimaryKeyRelatedField(queryset=City.objects.all(), source="city", write_only=True, required=False)
    neighborhood = NeighborhoodSerializer(read_only=True)
    neighborhood_id = serializers.PrimaryKeyRelatedField(
        queryset=Neighborhood.objects.all(), source="neighborhood", write_only=True, required=False
    )

    class Meta:
        model = getattr(__import__('market.models', fromlist=['Profile']), 'Profile')
        fields = [
            "id",
            "user_id",
            "display_name",
            "bio",
            "avatar",
            "cover",
            "cover_medium",
            "governorate",
            "governorate_id",
            "city",
            "city_id",
            "neighborhood",
            "neighborhood_id",
            "social_links",
            "seller_rating",
            "listings_count",
            "followers_count",
            "verification_flags",
            "privacy_settings",
            "metadata",
            "created_at",
            "avatar_medium",
            "avatar_thumbnail",
            "avatar_cache_control",
            "updated_at",
        ]
        read_only_fields = ["id", "user_id", "seller_rating", "listings_count", "followers_count", "created_at", "updated_at"]

    def get_avatar(self, obj):
        try:
            request = self.context.get("request")
            url = getattr(obj, "avatar")
            if url:
                url = str(url.url) if hasattr(url, 'url') else str(url)
                if request is not None and not url.startswith("http://") and not url.startswith("https://"):
                    return request.build_absolute_uri(url)
                return url
        except Exception:
            pass
        return None

    def _build_url(self, request, url):
        try:
            if not url:
                return None
            url = str(url.url) if hasattr(url, 'url') else str(url)
            if request is not None and not url.startswith("http://") and not url.startswith("https://"):
                return request.build_absolute_uri(url)
            return url
        except Exception:
            return None

    def get_avatar(self, obj):
        try:
            request = self.context.get("request")
            return self._build_url(request, getattr(obj, "avatar", None))
        except Exception:
            return None

    def get_avatar_medium(self, obj):
        try:
            request = self.context.get("request")
            return self._build_url(request, getattr(obj, "avatar_medium", None))
        except Exception:
            return None

    def get_avatar_thumbnail(self, obj):
        try:
            request = self.context.get("request")
            return self._build_url(request, getattr(obj, "avatar_thumbnail", None))
        except Exception:
            return None

    def get_cover(self, obj):
        try:
            request = self.context.get("request")
            url = getattr(obj, "cover")
            return self._build_url(request, url)
        except Exception:
            pass
        return None

    def get_cover_medium(self, obj):
        try:
            request = self.context.get("request")
            return self._build_url(request, getattr(obj, "cover_medium", None))
        except Exception:
            return None

    def get_avatar_cache_control(self, obj):
        # Provide a simple hint that clients can use for caching variants.
        # This is a static heuristic for now; can be replaced with storage metadata.
        return "max-age=86400"


class ListingImageSerializer(serializers.ModelSerializer):
    def validate_image(self, value):
        # Django ImageField typically requires Pillow; keep this defensive.
        if Image is None:
            return value

        # Enforce a minimal resolution to filter out tiny/low-quality uploads.
        min_w = int(getattr(settings, "LISTING_IMAGE_MIN_WIDTH", 400) or 400)
        min_h = int(getattr(settings, "LISTING_IMAGE_MIN_HEIGHT", 400) or 400)

        try:
            pos = value.tell()
        except Exception:
            pos = None

        try:
            img = Image.open(value)
            w, h = img.size
            if w < min_w or h < min_h:
                raise serializers.ValidationError(f"Image is too small (min {min_w}x{min_h})")
        finally:
            try:
                if pos is not None:
                    value.seek(pos)
                else:
                    value.seek(0)
            except Exception:
                pass

        return value

    def to_representation(self, instance):
        data = super().to_representation(instance)
        try:
            request = self.context.get("request")
        except Exception:
            request = None

        # DRF ImageField usually returns a relative URL (e.g. /media/...).
        # The web app is often hosted on a different origin, so make it absolute.
        try:
            if request is not None and data and data.get("image"):
                url = str(data["image"])
                if url and not url.startswith("http://") and not url.startswith("https://"):
                    data["image"] = request.build_absolute_uri(url)
        except Exception:
            pass

        return data

    class Meta:
        model = ListingImage
        fields = ["id", "image", "alt_text", "sort_order", "created_at"]
        read_only_fields = ["id", "created_at"]


class ListingListSerializer(serializers.ModelSerializer):
    seller_id = serializers.IntegerField(source="seller.id", read_only=True)
    seller_username = serializers.CharField(source="seller.username", read_only=True)
    thumbnail = serializers.SerializerMethodField()
    view_count = serializers.SerializerMethodField()
    favorites_count = serializers.SerializerMethodField()
    messages_count = serializers.SerializerMethodField()
    category = CategorySerializer(read_only=True)
    governorate = GovernorateSerializer(read_only=True)
    city = CitySerializer(read_only=True)
    neighborhood = NeighborhoodSerializer(read_only=True)

    def get_thumbnail(self, obj):
        img = None
        try:
            img = obj.images.order_by("sort_order", "id").first()
        except Exception:
            img = None

        if not img or not getattr(img, "image", None):
            return None

        try:
            url = img.image.url
            request = self.context.get("request")
            if request is not None:
                return request.build_absolute_uri(url)
            return url
        except Exception:
            return None

    def get_view_count(self, obj):
        try:
            return int(getattr(obj, "view_count", 0) or 0)
        except Exception:
            return 0

    def get_favorites_count(self, obj):
        try:
            v = getattr(obj, "favorites_count", None)
            if v is None:
                return 0
            return int(v or 0)
        except Exception:
            return 0

    def get_messages_count(self, obj):
        try:
            v = getattr(obj, "messages_count", None)
            if v is None:
                return 0
            return int(v or 0)
        except Exception:
            return 0

    class Meta:
        model = Listing
        fields = [
            "id",
            "title",
            "seller_id",
            "seller_username",
            "thumbnail",
            "view_count",
            "favorites_count",
            "messages_count",
            "price",
            "currency",
            "status",
            "moderation_status",
            "is_flagged",
            "is_removed",
            "category",
            "governorate",
            "city",
            "neighborhood",
            "latitude",
            "longitude",
            "created_at",
        ]


class ListingDetailSerializer(ListingListSerializer):
    images = ListingImageSerializer(many=True, read_only=True)
    attributes = serializers.SerializerMethodField()

    def get_attributes(self, obj):
        # Return a simple key->value map.
        out = {}
        try:
            values = list(getattr(obj, "attribute_values").all())
        except Exception:
            values = []

        for v in values:
            d = getattr(v, "definition", None)
            if not d or not getattr(d, "key", None):
                continue

            if v.int_value is not None:
                out[d.key] = v.int_value
            elif v.decimal_value is not None:
                out[d.key] = str(v.decimal_value)
            elif v.bool_value is not None:
                out[d.key] = bool(v.bool_value)
            elif v.enum_value not in (None, ""):
                out[d.key] = v.enum_value
            elif v.text_value not in (None, ""):
                out[d.key] = v.text_value

        return out

    class Meta(ListingListSerializer.Meta):
        fields = ListingListSerializer.Meta.fields + ["description", "images", "attributes"]


class ListingWriteSerializer(serializers.ModelSerializer):
    attributes = serializers.DictField(required=False)

    def validate(self, attrs):
        incoming_attributes = attrs.get("attributes")
        if incoming_attributes is not None and not isinstance(incoming_attributes, dict):
            raise serializers.ValidationError({"attributes": "attributes must be an object"})

        # Coordinate validation (optional)
        lat = attrs.get("latitude")
        lng = attrs.get("longitude")
        if lat is not None and (lat < Decimal("-90") or lat > Decimal("90")):
            raise serializers.ValidationError({"latitude": "Latitude must be between -90 and 90"})
        if lng is not None and (lng < Decimal("-180") or lng > Decimal("180")):
            raise serializers.ValidationError({"longitude": "Longitude must be between -180 and 180"})

        governorate = attrs.get("governorate")
        city = attrs.get("city")
        neighborhood = attrs.get("neighborhood")

        if governorate and city and city.governorate_id != governorate.id:
            raise serializers.ValidationError({"city": "City must belong to the selected governorate"})

        if neighborhood and city and neighborhood.city_id != city.id:
            raise serializers.ValidationError({"neighborhood": "Neighborhood must belong to the selected city"})

        if neighborhood and not city:
            raise serializers.ValidationError({"neighborhood": "City is required when neighborhood is set"})

        # Listing quality enforcement when publishing.
        # Sellers should not be able to publish empty/low-quality listings.
        final_status = attrs.get("status") or getattr(self.instance, "status", None)
        if final_status == ListingStatus.PUBLISHED:
            min_images = int(getattr(settings, "LISTING_MIN_IMAGES_PUBLISH", 1) or 1)
            min_title_len = int(getattr(settings, "LISTING_MIN_TITLE_LEN", 5) or 5)
            min_desc_len = int(getattr(settings, "LISTING_MIN_DESCRIPTION_LEN", 10) or 10)

            title = (attrs.get("title") if attrs.get("title") is not None else getattr(self.instance, "title", ""))
            title = (title or "").strip()
            if len(title) < min_title_len:
                raise serializers.ValidationError({"title": "Title is too short"})

            description = (
                attrs.get("description")
                if attrs.get("description") is not None
                else getattr(self.instance, "description", "")
            )
            description = (description or "").strip()
            if len(description) < min_desc_len:
                raise serializers.ValidationError({"description": "Description is required"})

            img_count = 0
            if self.instance is not None:
                try:
                    img_count = self.instance.images.count()
                except Exception:
                    img_count = 0

            if img_count < min_images:
                raise serializers.ValidationError({"images": f"At least {min_images} image(s) is required"})

        category = attrs.get("category") or getattr(self.instance, "category", None)
        if category is not None:
            defs = _effective_attribute_definitions(category)
            defs_by_key = {d.key: d for d in defs}

            if incoming_attributes is not None:
                unknown = [k for k in incoming_attributes.keys() if k not in defs_by_key]
                if unknown:
                    raise serializers.ValidationError({"attributes": f"Unknown attribute(s): {', '.join(sorted(unknown))}"})

                # Type validation for provided values.
                for k, raw in incoming_attributes.items():
                    d = defs_by_key[k]
                    if raw is None or (isinstance(raw, str) and not raw.strip()):
                        continue
                    try:
                        if d.type == CategoryAttributeType.INT:
                            int(str(raw).strip())
                        elif d.type == CategoryAttributeType.DECIMAL:
                            Decimal(str(raw).strip())
                        elif d.type == CategoryAttributeType.BOOL:
                            _parse_bool(raw)
                        elif d.type == CategoryAttributeType.ENUM:
                            s = str(raw).strip()
                            allowed = d.choices or []
                            if s not in allowed:
                                raise serializers.ValidationError(f"Invalid choice for {k}")
                        elif d.type == CategoryAttributeType.TEXT:
                            str(raw)
                        else:
                            raise serializers.ValidationError(f"Unsupported attribute type for {k}")
                    except InvalidOperation:
                        raise serializers.ValidationError({"attributes": f"Invalid decimal for {k}"})
                    except ValueError:
                        raise serializers.ValidationError({"attributes": f"Invalid integer for {k}"})

            # Required validation is based on the *final state*:
            # existing values (on PATCH) + incoming changes.
            final_status = attrs.get("status") or getattr(self.instance, "status", None)
            require = final_status not in (None, "draft")
            if require:
                required_keys = [d.key for d in defs if d.is_required_in_post]

                current: dict[str, object] = {}
                if self.instance is not None:
                    existing = ListingAttributeValue.objects.filter(listing=self.instance).select_related("definition")
                    for ev in existing:
                        dk = getattr(ev.definition, "key", None)
                        if not dk:
                            continue
                        if ev.int_value is not None:
                            current[dk] = ev.int_value
                        elif ev.decimal_value is not None:
                            current[dk] = ev.decimal_value
                        elif ev.bool_value is not None:
                            current[dk] = ev.bool_value
                        elif ev.enum_value not in (None, ""):
                            current[dk] = ev.enum_value
                        elif ev.text_value not in (None, ""):
                            current[dk] = ev.text_value

                # Apply incoming delta.
                for k, v in (incoming_attributes or {}).items():
                    if v is None or (isinstance(v, str) and not v.strip()):
                        current.pop(k, None)
                    else:
                        current[k] = v

                missing = []
                for k in required_keys:
                    v = current.get(k)
                    if v is None:
                        missing.append(k)
                        continue
                    if isinstance(v, str) and not v.strip():
                        missing.append(k)
                        continue

                if missing:
                    raise serializers.ValidationError({"attributes": f"Missing required attribute(s): {', '.join(sorted(missing))}"})

        return attrs

    def _upsert_attributes(self, listing: Listing, incoming: dict):
        defs = _effective_attribute_definitions(listing.category)
        defs_by_key = {d.key: d for d in defs}

        for k, raw in (incoming or {}).items():
            d = defs_by_key.get(k)
            if not d:
                continue

            # Null/empty string means delete the value (useful for PATCH).
            if raw is None or (isinstance(raw, str) and not raw.strip()):
                ListingAttributeValue.objects.filter(listing=listing, definition=d).delete()
                continue

            v, _created = ListingAttributeValue.objects.get_or_create(listing=listing, definition=d)
            v.int_value = None
            v.decimal_value = None
            v.text_value = None
            v.bool_value = None
            v.enum_value = None

            if d.type == CategoryAttributeType.INT:
                v.int_value = int(str(raw).strip())
            elif d.type == CategoryAttributeType.DECIMAL:
                v.decimal_value = Decimal(str(raw).strip())
            elif d.type == CategoryAttributeType.TEXT:
                v.text_value = str(raw)
            elif d.type == CategoryAttributeType.BOOL:
                v.bool_value = _parse_bool(raw)
            elif d.type == CategoryAttributeType.ENUM:
                v.enum_value = str(raw).strip()
            else:
                # Should not happen due to validation.
                continue

            v.save()

    def create(self, validated_data):
        incoming_attributes = validated_data.pop("attributes", None)
        listing = super().create(validated_data)
        if incoming_attributes is not None:
            self._upsert_attributes(listing, incoming_attributes)

        # Basic duplicate detection (soft flag): if seller posts the same title+price
        # within a short window, flag for moderation review.
        try:
            window = timezone.now() - timedelta(days=7)
            title = (listing.title or "").strip()
            if title and listing.price is not None:
                dup_qs = (
                    Listing.objects.filter(
                        seller_id=listing.seller_id,
                        created_at__gte=window,
                        is_removed=False,
                    )
                    .exclude(id=listing.id)
                    .filter(title__iexact=title, price=listing.price)
                )
                if dup_qs.exists() and not listing.is_flagged:
                    listing.is_flagged = True
                    listing.save(update_fields=["is_flagged", "updated_at"])
        except Exception:
            pass

        return listing

    def update(self, instance, validated_data):
        incoming_attributes = validated_data.pop("attributes", None)
        listing = super().update(instance, validated_data)
        if incoming_attributes is not None:
            self._upsert_attributes(listing, incoming_attributes)
        return listing

    class Meta:
        model = Listing
        fields = [
            "id",
            "title",
            "description",
            "price",
            "currency",
            "status",
            "category",
            "governorate",
            "city",
            "neighborhood",
            "latitude",
            "longitude",
            "attributes",
        ]
        read_only_fields = ["id"]


class PublicQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PublicQuestion
        fields = ["id", "listing", "author", "question", "answer", "answered_by", "answered_at", "created_at"]
        read_only_fields = ["id", "author", "answer", "answered_by", "answered_at", "created_at"]


class PublicQuestionCreateSerializer(serializers.ModelSerializer):
    def validate_question(self, value: str) -> str:
        request = self.context.get("request")
        if request and getattr(request.user, "is_staff", False):
            return value
        if looks_like_contact_info(value):
            raise serializers.ValidationError("Phone numbers and contact info are not allowed in questions")
        if looks_like_repeated_text(value):
            raise serializers.ValidationError("Repeated text is not allowed")
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        request = self.context.get("request")
        if not request or not getattr(request, "user", None) or not request.user.is_authenticated:
            return attrs
        if getattr(request.user, "is_staff", False):
            return attrs

        listing = attrs.get("listing") or self.context.get("listing")
        if not listing:
            return attrs

        now = timezone.now()

        cooldown_seconds = int(getattr(settings, "SPAM_QUESTION_COOLDOWN_SECONDS", 10) or 0)
        if cooldown_seconds > 0:
            since = now - timedelta(seconds=cooldown_seconds)
            if PublicQuestion.objects.filter(listing=listing, author=request.user, created_at__gte=since).exists():
                raise serializers.ValidationError({"question": "Please wait a moment before posting another question"})

        duplicate_window_seconds = int(getattr(settings, "SPAM_DUPLICATE_QUESTION_WINDOW_SECONDS", 60) or 0)
        if duplicate_window_seconds > 0:
            since = now - timedelta(seconds=duplicate_window_seconds)
            recent = (
                PublicQuestion.objects.filter(listing=listing, author=request.user, created_at__gte=since)
                .order_by("-created_at")
                .only("question")[:5]
            )
            new_norm = _normalize_spam_text(attrs.get("question") or "")
            for q in recent:
                if _normalize_spam_text(q.question) == new_norm and new_norm:
                    raise serializers.ValidationError({"question": "Please don't post the same question repeatedly"})

        return attrs

    class Meta:
        model = PublicQuestion
        fields = ["id", "listing", "question", "created_at"]
        read_only_fields = ["id", "created_at"]


class PublicQuestionAnswerSerializer(serializers.Serializer):
    answer = serializers.CharField()

    def validate_answer(self, value: str) -> str:
        request = self.context.get("request")
        if request and getattr(request.user, "is_staff", False):
            return value
        if looks_like_contact_info(value):
            raise serializers.ValidationError("Phone numbers and contact info are not allowed in answers")
        if looks_like_repeated_text(value):
            raise serializers.ValidationError("Repeated text is not allowed")
        return value


class PrivateMessageCreateSerializer(serializers.Serializer):
    body = serializers.CharField()

    def validate_body(self, value: str) -> str:
        request = self.context.get("request")
        if request and getattr(request.user, "is_staff", False):
            return value
        if looks_like_contact_info(value):
            raise serializers.ValidationError("Phone numbers and contact info are not allowed in messages")

        if looks_like_repeated_text(value):
            raise serializers.ValidationError("Repeated text is not allowed")

        user = getattr(request, "user", None) if request else None
        if user and getattr(user, "is_authenticated", False):
            thread = self.context.get("thread")
            now = timezone.now()

            cooldown_seconds = int(getattr(settings, "SPAM_MESSAGE_COOLDOWN_SECONDS", 3) or 0)
            if cooldown_seconds > 0 and thread is not None:
                since = now - timedelta(seconds=cooldown_seconds)
                if PrivateMessage.objects.filter(thread=thread, sender=user, created_at__gte=since).exists():
                    raise serializers.ValidationError("Please wait a moment before sending another message")

            duplicate_window_seconds = int(getattr(settings, "SPAM_DUPLICATE_MESSAGE_WINDOW_SECONDS", 60) or 0)
            if duplicate_window_seconds > 0 and thread is not None:
                since = now - timedelta(seconds=duplicate_window_seconds)
                recent = (
                    PrivateMessage.objects.filter(thread=thread, sender=user, created_at__gte=since)
                    .order_by("-created_at")
                    .only("body")[:5]
                )
                new_norm = _normalize_spam_text(value)
                for m in recent:
                    if _normalize_spam_text(m.body) == new_norm and new_norm:
                        raise serializers.ValidationError("Please don't send the same message repeatedly")

        return value


class PrivateMessageSerializer(serializers.ModelSerializer):
    sender_username = serializers.CharField(source="sender.username", read_only=True)

    class Meta:
        model = PrivateMessage
        fields = ["id", "thread", "sender", "sender_username", "body", "created_at"]
        read_only_fields = ["id", "sender", "created_at"]


class PrivateThreadSerializer(serializers.ModelSerializer):
    listing_title = serializers.CharField(source="listing.title", read_only=True)
    last_message_body = serializers.CharField(read_only=True)
    last_message_at = serializers.DateTimeField(read_only=True)
    last_message_sender_username = serializers.CharField(read_only=True)
    unread_count = serializers.IntegerField(read_only=True)
    my_last_read_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = PrivateThread
        fields = [
            "id",
            "listing",
            "listing_title",
            "buyer",
            "seller",
            "created_at",
            "last_message_body",
            "last_message_at",
            "last_message_sender_username",
            "unread_count",
            "my_last_read_at",
        ]
        read_only_fields = ["id", "buyer", "seller", "created_at"]


class CreateThreadSerializer(serializers.Serializer):
    listing_id = serializers.CharField()


class NotificationSerializer(serializers.ModelSerializer):
    is_read = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            "id",
            "kind",
            "title",
            "body",
            "payload",
            "is_read",
            "read_at",
            "created_at",
        ]
        read_only_fields = fields

    def get_is_read(self, obj) -> bool:
        return bool(getattr(obj, "read_at", None))


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = [
            "inapp_private_message",
            "inapp_question_answered",
            "inapp_listing_status",
            "email_private_message",
            "email_question_answered",
            "email_listing_status",
        ]


class UserBlockSerializer(serializers.ModelSerializer):
    blocked_username = serializers.CharField(source="blocked.username", read_only=True)

    class Meta:
        model = UserBlock
        fields = ["id", "blocked", "blocked_username", "created_at"]
        read_only_fields = ["id", "created_at"]


class UserBlockCreateSerializer(serializers.Serializer):
    blocked_user_id = NonLeakyPrimaryKeyRelatedField(
        queryset=User.objects.all(),
        not_found_message="User not found",
    )

    def validate_blocked_user_id(self, value) -> int:
        request = self.context.get("request")
        if request and getattr(request, "user", None) is not None:
            if request.user.is_authenticated and request.user.id == getattr(value, "id", None):
                raise serializers.ValidationError("Cannot block yourself")
        return value


class ListingReportSerializer(serializers.ModelSerializer):
    listing_title = serializers.CharField(source="listing.title", read_only=True)
    reporter_username = serializers.CharField(source="reporter.username", read_only=True)
    handled_by_username = serializers.CharField(source="handled_by.username", read_only=True)

    class Meta:
        model = ListingReport
        fields = [
            "id",
            "listing",
            "listing_title",
            "reporter",
            "reporter_username",
            "reason",
            "message",
            "status",
            "handled_by",
            "handled_by_username",
            "handled_at",
            "staff_note",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "reporter",
            "handled_by",
            "handled_by_username",
            "handled_at",
            "created_at",
        ]


class UserReportSerializer(serializers.ModelSerializer):
    reporter_username = serializers.CharField(source="reporter.username", read_only=True)
    reported_username = serializers.CharField(source="reported.username", read_only=True)
    handled_by_username = serializers.CharField(source="handled_by.username", read_only=True)

    class Meta:
        model = UserReport
        fields = [
            "id",
            "reporter",
            "reporter_username",
            "reported",
            "reported_username",
            "listing",
            "thread",
            "reason",
            "message",
            "status",
            "handled_by",
            "handled_by_username",
            "handled_at",
            "staff_note",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "reporter",
            "handled_by",
            "handled_by_username",
            "handled_at",
            "created_at",
        ]


class UserReportCreateSerializer(serializers.ModelSerializer):
    reported = NonLeakyPrimaryKeyRelatedField(
        queryset=User.objects.all(),
        not_found_message="User not found.",
    )

    # Custom pk field to normalize errors without leaking existence.
    listing = NonLeakyPrimaryKeyRelatedField(
        queryset=Listing.objects.all(),
        required=False,
        allow_null=True,
        not_found_message="Listing not found.",
    )
    thread = NonLeakyPrimaryKeyRelatedField(
        queryset=PrivateThread.objects.select_related("listing").all(),
        required=False,
        allow_null=True,
        not_found_message="Thread not found.",
    )

    class Meta:
        model = UserReport
        fields = ["id", "reported", "listing", "thread", "reason", "message", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)

        reported = attrs.get("reported")
        if user and getattr(user, "is_authenticated", False) and reported and reported.id == user.id:
            raise serializers.ValidationError({"reported": "You cannot report yourself."})

        is_staff = bool(user and getattr(user, "is_staff", False))

        thread = attrs.get("thread")
        if thread is not None and user and getattr(user, "is_authenticated", False):
            if not is_staff and user.id not in {thread.buyer_id, thread.seller_id}:
                raise serializers.ValidationError({"thread": "Thread not found."})

        listing = attrs.get("listing")
        if listing is not None and user and getattr(user, "is_authenticated", False):
            if not is_staff:
                is_public = (
                    not listing.is_removed
                    and listing.status == ListingStatus.PUBLISHED
                    and listing.moderation_status == ModerationStatus.APPROVED
                )
                if not is_public and listing.seller_id != user.id:
                    # Avoid confirming existence of non-public listings.
                    raise serializers.ValidationError({"listing": "Listing not found."})

        # If both provided, ensure the thread context matches the listing context.
        if thread is not None and listing is not None:
            if getattr(thread, "listing_id", None) != getattr(listing, "id", None):
                raise serializers.ValidationError({"thread": "Thread not found."})

        return attrs


class UserReportStaffUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=list(ReportStatus.values))
    staff_note = serializers.CharField(required=False, allow_blank=True)


class UserReportEventSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source="actor.username", read_only=True)

    class Meta:
        model = UserReportEvent
        fields = ["id", "report", "actor", "actor_username", "from_status", "to_status", "note", "created_at"]
        read_only_fields = ["id", "created_at"]


class ListingReportCreateSerializer(serializers.ModelSerializer):
    listing = NonLeakyPrimaryKeyRelatedField(
        queryset=Listing.objects.all(),
        not_found_message="Listing not found.",
    )

    class Meta:
        model = ListingReport
        fields = ["id", "listing", "reason", "message", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)

        listing = attrs.get("listing")
        if listing is not None and user and getattr(user, "is_authenticated", False):
            if not getattr(user, "is_staff", False):
                is_public = (
                    not listing.is_removed
                    and listing.status == ListingStatus.PUBLISHED
                    and listing.moderation_status == ModerationStatus.APPROVED
                )
                if not is_public:
                    # Avoid confirming existence of non-public listings.
                    raise serializers.ValidationError({"listing": "Listing not found."})

        return attrs


class ListingReportStaffUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[ReportStatus.OPEN, ReportStatus.RESOLVED, ReportStatus.DISMISSED])
    staff_note = serializers.CharField(required=False, allow_blank=True)


class ListingReportEventSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source="actor.username", read_only=True)

    class Meta:
        model = ListingReportEvent
        fields = [
            "id",
            "actor",
            "actor_username",
            "from_status",
            "to_status",
            "note",
            "created_at",
        ]
        read_only_fields = fields


class ListingFavoriteSerializer(serializers.ModelSerializer):
    listing_title = serializers.CharField(source="listing.title", read_only=True)

    class Meta:
        model = ListingFavorite
        fields = ["id", "listing", "listing_title", "created_at"]
        read_only_fields = ["id", "created_at"]


class ListingFavoriteCreateSerializer(serializers.Serializer):
    listing_id = NonLeakyPrimaryKeyRelatedField(
        queryset=Listing.objects.all(),
        not_found_message="Listing not found",
    )


class SavedSearchSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedSearch
        fields = [
            "id",
            "name",
            "querystring",
            "query_params",
            "notify_enabled",
            "last_checked_at",
            "last_result_count",
            "last_new_count",
            "created_at",
        ]
        read_only_fields = ["id", "created_at", "last_checked_at", "last_result_count", "last_new_count"]


class ListingWatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = ListingWatch
        fields = [
            "id",
            "listing",
            "created_at",
            "last_seen_price",
            "last_seen_currency",
            "last_seen_at",
        ]
        read_only_fields = ["id", "created_at"]


class ListingWatchCreateSerializer(serializers.Serializer):
    listing_id = NonLeakyPrimaryKeyRelatedField(
        queryset=Listing.objects.all(),
        not_found_message="Listing not found",
    )
