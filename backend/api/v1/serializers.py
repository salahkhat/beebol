from django.contrib.auth import get_user_model
from rest_framework import serializers

from decimal import Decimal, InvalidOperation

from market.models import (
    Category,
    CategoryAttributeDefinition,
    CategoryAttributeType,
    City,
    Governorate,
    Listing,
    ListingAttributeValue,
    ListingImage,
    Neighborhood,
)
from messaging.models import PrivateMessage, PrivateThread, PublicQuestion
from reports.models import ListingReport, ReportStatus

User = get_user_model()


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

    class Meta:
        model = Listing
        fields = [
            "id",
            "title",
            "seller_id",
            "seller_username",
            "thumbnail",
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
    class Meta:
        model = PublicQuestion
        fields = ["id", "listing", "question", "created_at"]
        read_only_fields = ["id", "created_at"]


class PublicQuestionAnswerSerializer(serializers.Serializer):
    answer = serializers.CharField()


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
        ]
        read_only_fields = ["id", "buyer", "seller", "created_at"]


class CreateThreadSerializer(serializers.Serializer):
    listing_id = serializers.IntegerField()


class ListingReportSerializer(serializers.ModelSerializer):
    listing_title = serializers.CharField(source="listing.title", read_only=True)
    reporter_username = serializers.CharField(source="reporter.username", read_only=True)

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
            "handled_at",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "reporter",
            "status",
            "handled_by",
            "handled_at",
            "created_at",
        ]


class ListingReportCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ListingReport
        fields = ["id", "listing", "reason", "message", "created_at"]
        read_only_fields = ["id", "created_at"]


class ListingReportStaffUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[ReportStatus.RESOLVED, ReportStatus.DISMISSED])
