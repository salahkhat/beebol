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
    category = CategorySerializer(read_only=True)
    governorate = GovernorateSerializer(read_only=True)
    city = CitySerializer(read_only=True)
    neighborhood = NeighborhoodSerializer(read_only=True)

    class Meta:
        model = Listing
        fields = [
            "id",
            "title",
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
    class Meta:
        model = PrivateMessage
        fields = ["id", "thread", "sender", "body", "created_at"]
        read_only_fields = ["id", "sender", "created_at"]


class PrivateThreadSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrivateThread
        fields = ["id", "listing", "buyer", "seller", "created_at"]
        read_only_fields = ["id", "buyer", "seller", "created_at"]


class CreateThreadSerializer(serializers.Serializer):
    listing_id = serializers.IntegerField()
