from django.contrib.auth import get_user_model
from django.db.models import OuterRef, Q, Subquery
from django.utils import timezone
from decimal import Decimal, InvalidOperation
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

        # Basic filters
        qp = self.request.query_params

        # Removed listings are hidden by default. Staff can opt-in via include_removed=1.
        include_removed = str(qp.get("include_removed") or "").lower() in {"1", "true", "yes"}
        if not (include_removed and getattr(user, "is_staff", False)):
            qs = qs.filter(is_removed=False)
        if qp.get("status"):
            qs = qs.filter(status=qp.get("status"))
        if qp.get("moderation_status"):
            qs = qs.filter(moderation_status=qp.get("moderation_status"))
        if qp.get("seller"):
            qs = qs.filter(seller_id=qp.get("seller"))
        if qp.get("category"):
            qs = qs.filter(category_id=qp.get("category"))
        if qp.get("governorate"):
            qs = qs.filter(governorate_id=qp.get("governorate"))
        if qp.get("city"):
            qs = qs.filter(city_id=qp.get("city"))
        if qp.get("neighborhood"):
            qs = qs.filter(neighborhood_id=qp.get("neighborhood"))

        if qp.get("is_flagged") is not None:
            raw = str(qp.get("is_flagged") or "").lower()
            if raw in {"1", "true", "yes"}:
                qs = qs.filter(is_flagged=True)
            elif raw in {"0", "false", "no"}:
                qs = qs.filter(is_flagged=False)

        # Staff-only: allow filtering by is_removed when include_removed is enabled.
        if include_removed and getattr(user, "is_staff", False) and qp.get("is_removed") is not None:
            raw = str(qp.get("is_removed") or "").lower()
            if raw in {"1", "true", "yes"}:
                qs = qs.filter(is_removed=True)
            elif raw in {"0", "false", "no"}:
                qs = qs.filter(is_removed=False)

        return qs

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def mine(self, request):
        qs = (
            Listing.objects.select_related(
                "category",
                "governorate",
                "city",
                "neighborhood",
                "seller",
            )
            .prefetch_related("images")
            .filter(seller=request.user, is_removed=False)
        )
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = ListingListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        return Response(ListingListSerializer(qs, many=True).data)

    @action(detail=False, methods=["post"], url_path="bulk_update", permission_classes=[IsAuthenticated])
    def bulk_update(self, request):
        payload = request.data or {}
        ids = payload.get("ids")
        if not isinstance(ids, list) or not ids:
            return Response({"detail": "ids must be a non-empty list"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            ids = [int(x) for x in ids]
        except (TypeError, ValueError):
            return Response({"detail": "ids must contain integer ids"}, status=status.HTTP_400_BAD_REQUEST)

        if len(ids) > 200:
            return Response({"detail": "ids is too large (max 200)"}, status=status.HTTP_400_BAD_REQUEST)

        data = payload.get("data")
        if data is None:
            data = {k: v for k, v in payload.items() if k != "ids"}
        if not isinstance(data, dict) or not data:
            return Response({"detail": "data must be a non-empty object"}, status=status.HTTP_400_BAD_REQUEST)

        # Note: we intentionally do NOT filter out removed listings here because staff may
        # need to restore them (is_removed=False). Non-staff updates below still prevent
        # modifying removed listings.
        qs_all = Listing.objects.filter(id__in=ids)
        found_ids = set(qs_all.values_list("id", flat=True))
        not_found = [i for i in ids if i not in found_ids]

        skipped = []

        # Staff: allow bulk moderation update.
        if "moderation_status" in data:
            if not getattr(request.user, "is_staff", False):
                return Response({"detail": "Not allowed"}, status=status.HTTP_403_FORBIDDEN)

            desired = data.get("moderation_status")
            if desired not in {ModerationStatus.APPROVED, ModerationStatus.REJECTED}:
                return Response(
                    {"detail": "moderation_status must be 'approved' or 'rejected'"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            to_change = qs_all.exclude(moderation_status=desired)
            updated_ids = list(to_change.values_list("id", flat=True))
            to_change.update(moderation_status=desired)
            visible = self.get_queryset().filter(id__in=list(found_ids))
            return Response(
                {
                    "updated": ListingListSerializer(visible, many=True, context={"request": request}).data,
                    "updated_ids": updated_ids,
                    "skipped": skipped,
                    "not_found": not_found,
                }
            )

        # Staff: allow flag/remove operations.
        staff_fields = {"is_flagged", "is_removed"}
        incoming_staff_fields = {k for k in data.keys() if k in staff_fields}
        if incoming_staff_fields:
            if not getattr(request.user, "is_staff", False):
                return Response({"detail": "Not allowed"}, status=status.HTTP_403_FORBIDDEN)

            update_data = {}
            for k in incoming_staff_fields:
                v = data.get(k)
                if not isinstance(v, bool):
                    return Response({"detail": f"{k} must be a boolean"}, status=status.HTTP_400_BAD_REQUEST)
                update_data[k] = v

            # Identify which listings will actually change.
            changed_qs = qs_all
            # Exclude listings that already match all desired values.
            already_match = {k: update_data[k] for k in update_data.keys()}
            changed_qs = changed_qs.exclude(**already_match)
            updated_ids = list(changed_qs.values_list("id", flat=True))

            if update_data:
                qs_all.update(**update_data)

            visible = self.get_queryset().filter(id__in=list(found_ids))
            return Response(
                {
                    "updated": ListingListSerializer(visible, many=True, context={"request": request}).data,
                    "updated_ids": updated_ids,
                    "skipped": skipped,
                    "not_found": not_found,
                }
            )

        # Sellers (and staff) can bulk update their own listings' editable fields.
        allowed_fields = {"status", "title", "price", "currency"}
        incoming_fields = {k for k in data.keys() if k in allowed_fields}
        if not incoming_fields:
            return Response({"detail": f"Only {sorted(allowed_fields)} can be updated"}, status=status.HTTP_400_BAD_REQUEST)

        if "status" in data and data["status"] not in {ListingStatus.DRAFT, ListingStatus.PUBLISHED, ListingStatus.ARCHIVED}:
            return Response({"detail": "status must be 'draft', 'published', or 'archived'"}, status=status.HTTP_400_BAD_REQUEST)

        if "title" in data:
            title = str(data.get("title") or "").strip()
            if not title:
                return Response({"detail": "title cannot be empty"}, status=status.HTTP_400_BAD_REQUEST)
            if len(title) > 140:
                return Response({"detail": "title is too long"}, status=status.HTTP_400_BAD_REQUEST)
            data["title"] = title

        if "currency" in data:
            currency = str(data.get("currency") or "").strip()
            if not currency:
                return Response({"detail": "currency cannot be empty"}, status=status.HTTP_400_BAD_REQUEST)
            if len(currency) > 8:
                return Response({"detail": "currency is too long"}, status=status.HTTP_400_BAD_REQUEST)
            data["currency"] = currency

        if "price" in data:
            raw = data.get("price")
            if raw is None or raw == "":
                data["price"] = None
            else:
                try:
                    price = Decimal(str(raw))
                except (InvalidOperation, TypeError, ValueError):
                    return Response({"detail": "price must be a number"}, status=status.HTTP_400_BAD_REQUEST)
                if price < Decimal("0"):
                    return Response({"detail": "price cannot be negative"}, status=status.HTTP_400_BAD_REQUEST)
                data["price"] = price

        if getattr(request.user, "is_staff", False):
            qs_allowed = qs_all
        else:
            qs_allowed = qs_all.filter(seller=request.user, is_removed=False)
            forbidden = list(qs_all.exclude(seller=request.user).values_list("id", flat=True))
            skipped.extend([{"id": i, "reason": "forbidden"} for i in forbidden])

            removed = list(qs_all.filter(seller=request.user, is_removed=True).values_list("id", flat=True))
            skipped.extend([{"id": i, "reason": "removed"} for i in removed])

        update_data = {k: data[k] for k in incoming_fields}
        changed_qs = qs_allowed
        already_match = {k: update_data[k] for k in update_data.keys()}
        changed_qs = changed_qs.exclude(**already_match)
        updated_ids = list(changed_qs.values_list("id", flat=True))
        if update_data:
            qs_allowed.update(**update_data)

        visible = self.get_queryset().filter(id__in=list(qs_allowed.values_list("id", flat=True)))
        return Response(
            {
                "updated": ListingListSerializer(visible, many=True, context={"request": request}).data,
                "updated_ids": updated_ids,
                "skipped": skipped,
                "not_found": not_found,
            }
        )

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def moderate(self, request, pk=None):
        if not getattr(request.user, "is_staff", False):
            return Response({"detail": "Not allowed"}, status=status.HTTP_403_FORBIDDEN)

        listing = self.get_object()
        desired = (request.data or {}).get("moderation_status")
        if desired not in {ModerationStatus.APPROVED, ModerationStatus.REJECTED}:
            return Response(
                {"detail": "moderation_status must be 'approved' or 'rejected'"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if listing.moderation_status != desired:
            listing.moderation_status = desired
            listing.save(update_fields=["moderation_status"])

        return Response(ListingDetailSerializer(listing).data)

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

    @action(
        detail=True,
        methods=["delete"],
        url_path=r"images/(?P<image_id>[^/.]+)",
        permission_classes=[IsAuthenticated],
    )
    def delete_image(self, request, pk=None, image_id=None):
        listing = self.get_object()

        if listing.seller != request.user:
            return Response({"detail": "Not allowed"}, status=status.HTTP_403_FORBIDDEN)

        try:
            image_id_int = int(image_id)
        except (TypeError, ValueError):
            return Response({"detail": "image_id must be an integer"}, status=status.HTTP_400_BAD_REQUEST)

        img = listing.images.filter(id=image_id_int).first()
        if not img:
            return Response({"detail": "Image not found"}, status=status.HTTP_404_NOT_FOUND)

        img.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="images/reorder", permission_classes=[IsAuthenticated])
    def reorder_images(self, request, pk=None):
        listing = self.get_object()

        if listing.seller != request.user:
            return Response({"detail": "Not allowed"}, status=status.HTTP_403_FORBIDDEN)

        payload = request.data or {}
        order = payload.get("order")
        if not isinstance(order, list):
            return Response({"detail": "order must be a list of image ids"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            desired_ids = [int(x) for x in order]
        except (TypeError, ValueError):
            return Response({"detail": "order must contain integer ids"}, status=status.HTTP_400_BAD_REQUEST)

        current_ids = list(listing.images.order_by("sort_order", "id").values_list("id", flat=True))
        current_set = set(current_ids)
        desired_set = set(desired_ids)

        if not desired_set.issubset(current_set):
            return Response({"detail": "order contains images that do not belong to this listing"}, status=status.HTTP_400_BAD_REQUEST)

        # Append any images not included in desired order, preserving current ordering.
        remaining = [i for i in current_ids if i not in desired_set]
        final_ids = desired_ids + remaining

        images = list(listing.images.filter(id__in=final_ids))
        by_id = {img.id: img for img in images}

        to_update = []
        for idx, image_id in enumerate(final_ids):
            img = by_id.get(image_id)
            if not img:
                continue
            if img.sort_order != idx:
                img.sort_order = idx
                to_update.append(img)

        if to_update:
            ListingImage.objects.bulk_update(to_update, ["sort_order"])

        refreshed = listing.images.order_by("sort_order", "id")
        return Response(ListingImageSerializer(refreshed, many=True).data)

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
        last_msg = PrivateMessage.objects.filter(thread=OuterRef("pk")).order_by("-created_at")
        return (
            PrivateThread.objects.select_related("listing", "buyer", "seller")
            .filter(Q(buyer=user) | Q(seller=user))
            .annotate(
                last_message_body=Subquery(last_msg.values("body")[:1]),
                last_message_at=Subquery(last_msg.values("created_at")[:1]),
                last_message_sender_username=Subquery(last_msg.values("sender__username")[:1]),
            )
            .order_by("-last_message_at", "-created_at")
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
