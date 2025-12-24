from django.contrib.auth import get_user_model
from rest_framework import serializers

from market.models import Category, City, Governorate, Listing, ListingImage, Neighborhood
from messaging.models import PrivateMessage, PrivateThread, PublicQuestion

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


class ListingImageSerializer(serializers.ModelSerializer):
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
            "created_at",
        ]


class ListingDetailSerializer(ListingListSerializer):
    images = ListingImageSerializer(many=True, read_only=True)

    class Meta(ListingListSerializer.Meta):
        fields = ListingListSerializer.Meta.fields + ["description", "images"]


class ListingWriteSerializer(serializers.ModelSerializer):
    def validate(self, attrs):
        governorate = attrs.get("governorate")
        city = attrs.get("city")
        neighborhood = attrs.get("neighborhood")

        if governorate and city and city.governorate_id != governorate.id:
            raise serializers.ValidationError({"city": "City must belong to the selected governorate"})

        if neighborhood and city and neighborhood.city_id != city.id:
            raise serializers.ValidationError({"neighborhood": "Neighborhood must belong to the selected city"})

        if neighborhood and not city:
            raise serializers.ValidationError({"neighborhood": "City is required when neighborhood is set"})

        return attrs

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
