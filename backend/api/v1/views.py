from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework.views import APIView

from market.models import (
    Category,
    City,
    Governorate,
    Listing,
    ListingImage,
    ModerationStatus,
    Neighborhood,
    ListingStatus,
)
from messaging.models import PrivateMessage, PrivateThread, PublicQuestion

from .permissions import IsOwnerOrReadOnly
from .serializers import (
    CategorySerializer,
    CitySerializer,
    CreateThreadSerializer,
    GovernorateSerializer,
    ListingDetailSerializer,
    ListingImageSerializer,
    ListingListSerializer,
    ListingWriteSerializer,
    NeighborhoodSerializer,
    PrivateMessageSerializer,
    PrivateThreadSerializer,
    PublicQuestionAnswerSerializer,
    PublicQuestionCreateSerializer,
    PublicQuestionSerializer,
    RegisterSerializer,
    UserMeSerializer,
)

User = get_user_model()


class HealthView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"status": "ok"})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserMeSerializer(request.user).data)


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserMeSerializer(user).data, status=status.HTTP_201_CREATED)


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer


class GovernorateViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Governorate.objects.all()
    serializer_class = GovernorateSerializer


class CityViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = City.objects.select_related("governorate").all()
    serializer_class = CitySerializer

    def get_queryset(self):
        qs = super().get_queryset()
        gov = self.request.query_params.get("governorate")
        if gov:
            qs = qs.filter(governorate_id=gov)
        return qs


class NeighborhoodViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Neighborhood.objects.select_related("city", "city__governorate").all()
    serializer_class = NeighborhoodSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        city = self.request.query_params.get("city")
        if city:
            qs = qs.filter(city_id=city)
        return qs


class ListingViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
    search_fields = ["title", "description"]
    ordering_fields = ["created_at", "price"]

    def get_queryset(self):
        qs = Listing.objects.select_related(
            "category",
            "governorate",
            "city",
            "neighborhood",
            "seller",
        ).prefetch_related("images")

        user = self.request.user
        public_visibility = Q(
            status=ListingStatus.PUBLISHED,
            moderation_status=ModerationStatus.APPROVED,
        )

        if user.is_authenticated:
            if getattr(user, "is_staff", False):
                qs = qs
            else:
                qs = qs.filter(public_visibility | Q(seller=user))
        else:
            qs = qs.filter(public_visibility)

        qs = qs.filter(is_removed=False)

        # Basic filters
        qp = self.request.query_params
        if qp.get("category"):
            qs = qs.filter(category_id=qp.get("category"))
        if qp.get("governorate"):
            qs = qs.filter(governorate_id=qp.get("governorate"))
        if qp.get("city"):
            qs = qs.filter(city_id=qp.get("city"))
        if qp.get("neighborhood"):
            qs = qs.filter(neighborhood_id=qp.get("neighborhood"))

        return qs

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return ListingWriteSerializer
        if self.action == "retrieve":
            return ListingDetailSerializer
        return ListingListSerializer

    def perform_create(self, serializer):
        serializer.save(seller=self.request.user)

    @action(detail=True, methods=["get", "post"], permission_classes=[IsAuthenticatedOrReadOnly])
    def images(self, request, pk=None):
        listing = self.get_object()
        if request.method == "GET":
            return Response(ListingImageSerializer(listing.images.all(), many=True).data)

        if listing.seller != request.user:
            return Response({"detail": "Not allowed"}, status=status.HTTP_403_FORBIDDEN)

        serializer = ListingImageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        image = ListingImage.objects.create(listing=listing, **serializer.validated_data)
        return Response(ListingImageSerializer(image).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get", "post"], permission_classes=[IsAuthenticatedOrReadOnly])
    def questions(self, request, pk=None):
        listing = self.get_object()
        if request.method == "GET":
            qs = PublicQuestion.objects.filter(listing=listing).select_related("author", "answered_by")
            return Response(PublicQuestionSerializer(qs, many=True).data)

        if not request.user.is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)

        serializer = PublicQuestionCreateSerializer(data={**request.data, "listing": listing.id})
        serializer.is_valid(raise_exception=True)
        q = PublicQuestion.objects.create(
            listing=listing,
            author=request.user,
            question=serializer.validated_data["question"],
        )
        return Response(PublicQuestionSerializer(q).data, status=status.HTTP_201_CREATED)


class PublicQuestionViewSet(mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = PublicQuestion.objects.select_related("listing", "author", "answered_by").all()
    serializer_class = PublicQuestionSerializer

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def answer(self, request, pk=None):
        q = self.get_object()
        if q.listing.seller != request.user:
            return Response({"detail": "Only the seller can answer"}, status=status.HTTP_403_FORBIDDEN)
        serializer = PublicQuestionAnswerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        q.answer = serializer.validated_data["answer"]
        q.answered_by = request.user
        q.answered_at = timezone.now()
        q.save(update_fields=["answer", "answered_by", "answered_at"])
        return Response(PublicQuestionSerializer(q).data)


class PrivateThreadViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = PrivateThreadSerializer

    def get_queryset(self):
        user = self.request.user
        return PrivateThread.objects.select_related("listing", "buyer", "seller").filter(
            Q(buyer=user) | Q(seller=user)
        )

    def create(self, request, *args, **kwargs):
        serializer = CreateThreadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        listing_id = serializer.validated_data["listing_id"]

        try:
            listing = Listing.objects.select_related("seller").get(
                id=listing_id,
                is_removed=False,
                status=ListingStatus.PUBLISHED,
                moderation_status=ModerationStatus.APPROVED,
            )
        except Listing.DoesNotExist:
            return Response({"detail": "Listing not found"}, status=status.HTTP_404_NOT_FOUND)

        if listing.seller_id == request.user.id:
            return Response({"detail": "Cannot message yourself"}, status=status.HTTP_400_BAD_REQUEST)

        thread, _created = PrivateThread.objects.get_or_create(
            listing=listing,
            buyer=request.user,
            defaults={"seller": listing.seller},
        )
        return Response(PrivateThreadSerializer(thread).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get", "post"], url_path="messages")
    def messages(self, request, pk=None):
        thread = self.get_object()
        if request.method == "GET":
            msgs = thread.messages.select_related("sender").all()
            return Response(PrivateMessageSerializer(msgs, many=True).data)

        serializer = PrivateMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        msg = PrivateMessage.objects.create(
            thread=thread,
            sender=request.user,
            body=serializer.validated_data["body"],
        )
        return Response(PrivateMessageSerializer(msg).data, status=status.HTTP_201_CREATED)
