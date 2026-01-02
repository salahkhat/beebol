from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import connections
from django.db import models
from django.db.models import Case, Count, DateTimeField, F, IntegerField, OuterRef, Q, Subquery, Value, When
from django.db.models.functions import Coalesce
from django.utils import timezone
from datetime import datetime, timedelta, timezone as dt_timezone
from decimal import Decimal, InvalidOperation
import re
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from django.core.mail import send_mail

from api.health_checks import build_health_payload

from market.models import (
    Category,
    CategoryAttributeDefinition,
    City,
    Governorate,
    Listing,
    ListingAttributeValue,
    ListingImage,
    ModerationStatus,
    Neighborhood,
    ListingStatus,
    AdminSeedJob,
    ListingFavorite,
    SavedSearch,
    Profile,
)
from messaging.models import PrivateMessage, PrivateThread, PublicQuestion, UserBlock
from notifications.models import Notification, NotificationKind, NotificationPreference
from reports.models import ListingReport, ListingReportEvent, ReportStatus, UserReport, UserReportEvent

from market.seeding import is_admin_seeding_enabled, run_admin_seed

from .permissions import IsOwnerOrReadOnly
from .serializers import (
    CategorySerializer,
    CategoryAttributeDefinitionSerializer,
    CitySerializer,
    CreateThreadSerializer,
    GovernorateSerializer,
    ListingDetailSerializer,
    ListingImageSerializer,
    ListingListSerializer,
    ListingWriteSerializer,
    NeighborhoodSerializer,
    PrivateMessageSerializer,
    PrivateMessageCreateSerializer,
    PrivateThreadSerializer,
    PublicQuestionAnswerSerializer,
    PublicQuestionCreateSerializer,
    PublicQuestionSerializer,
    RegisterSerializer,
    UserMeSerializer,
    ListingReportCreateSerializer,
    ListingReportSerializer,
    ListingReportStaffUpdateSerializer,
    ListingReportEventSerializer,
    UserReportCreateSerializer,
    UserReportSerializer,
    UserReportStaffUpdateSerializer,
    UserReportEventSerializer,
    UserBlockCreateSerializer,
    UserBlockSerializer,
    ListingFavoriteCreateSerializer,
    ListingFavoriteSerializer,
    SavedSearchSerializer,
    NotificationSerializer,
    NotificationPreferenceSerializer,
)

User = get_user_model()


def is_shadow_banned_user(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_staff", False):
        return False

    profile = getattr(user, "market_profile", None)
    if not isinstance(profile, Profile):
        return False

    metadata = getattr(profile, "metadata", None) or {}
    if not isinstance(metadata, dict):
        return False

    return bool(metadata.get("shadow_banned"))


def blocked_user_ids_for(user) -> set[int]:
    if not user or not getattr(user, "is_authenticated", False):
        return set()

    blocked_by_me = set(UserBlock.objects.filter(blocker=user).values_list("blocked_id", flat=True))
    blocked_me = set(UserBlock.objects.filter(blocked=user).values_list("blocker_id", flat=True))
    return blocked_by_me | blocked_me


def _get_or_create_notification_preferences(user) -> NotificationPreference:
    prefs = getattr(user, "notification_preferences", None)
    if isinstance(prefs, NotificationPreference):
        return prefs
    prefs, _ = NotificationPreference.objects.get_or_create(user=user)
    return prefs


def _send_notification_email(*, to_user, subject: str, message: str) -> bool:
    if not getattr(settings, "EMAIL_NOTIFICATIONS_ENABLED", False):
        return False
    email = getattr(to_user, "email", "") or ""
    if not email.strip():
        return False
    try:
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [email], fail_silently=True)
        return True
    except Exception:
        return False


class NotificationPreferenceMeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        prefs = _get_or_create_notification_preferences(request.user)
        return Response(NotificationPreferenceSerializer(prefs).data)

    def patch(self, request):
        prefs = _get_or_create_notification_preferences(request.user)
        serializer = NotificationPreferenceSerializer(prefs, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class NotificationViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user).order_by("-created_at", "-id")

    @action(detail=True, methods=["post"], url_path="read")
    def mark_read(self, request, pk=None):
        notif = self.get_object()
        if notif.read_at is None:
            notif.read_at = timezone.now()
            notif.save(update_fields=["read_at", "updated_at"])
        return Response(NotificationSerializer(notif).data)


class HealthView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        db_ok = True
        db_error = None
        try:
            with connections["default"].cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
        except Exception as exc:
            db_ok = False
            db_error = str(exc)

        payload, ok = build_health_payload()
        return Response(payload, status=status.HTTP_200_OK if ok else status.HTTP_503_SERVICE_UNAVAILABLE)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserMeSerializer(request.user).data)


class UserProfileView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, user_id: int):
        user = User.objects.filter(id=user_id).first()
        if not user:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        # market-specific profile is available as user.market_profile
        profile = getattr(user, 'market_profile', None)
        # Ensure market profile exists if needed
        if profile is None:
            from market.models import Profile

            profile, _ = Profile.objects.get_or_create(user=user)
        from .serializers import ProfileSerializer

        data = ProfileSerializer(profile, context={"request": request}).data

        # Enforce privacy settings for public callers: hide contact-related fields when disabled
        try:
            is_owner = request.user and request.user.is_authenticated and request.user.id == user.id
        except Exception:
            is_owner = False

        if not is_owner:
            try:
                ps = getattr(profile, 'privacy_settings', {}) or {}
                # debugging: print privacy evaluation
                # print(f'UserProfileView: is_owner={is_owner} show_contact={ps.get("show_contact", False)}')
                if not ps.get('show_contact', False):
                    if 'social_links' in data:
                        data.pop('social_links', None)
            except Exception:
                pass

        return Response(data)


class MeProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        profile = getattr(user, "market_profile", None)
        if profile is None:
            from market.models import Profile

            profile = Profile.objects.create(user=user)
        from .serializers import ProfileSerializer

        return Response(ProfileSerializer(profile, context={"request": request}).data)

    def patch(self, request):
        user = request.user
        profile = getattr(user, "market_profile", None)
        if profile is None:
            from market.models import Profile

            profile = Profile.objects.create(user=user)
        from .serializers import ProfileSerializer

        serializer = ProfileSerializer(profile, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class AvatarUploadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        file = request.FILES.get("avatar")
        if not file:
            return Response({"detail": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST)

        # Basic validations
        if file.size > 5 * 1024 * 1024:
            return Response({"detail": "File too large"}, status=status.HTTP_400_BAD_REQUEST)
        if not getattr(file, "content_type", "").startswith("image/"):
            return Response({"detail": "Invalid file type"}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        profile = getattr(user, "market_profile", None)
        if profile is None:
            from market.models import Profile

            profile = Profile.objects.create(user=user)

        # Process image: create thumbnail and a medium version.
        try:
            from PIL import Image
            from io import BytesIO
            from django.core.files.base import ContentFile

            img = Image.open(file)
            img = img.convert("RGB")

            # Save medium 400x400
            med = img.copy()
            med.thumbnail((400, 400))
            buf = BytesIO()
            med.save(buf, format="JPEG", quality=85)
            med_content = ContentFile(buf.getvalue(), name=file.name)

            # Save thumb 128x128
            thumb = img.copy()
            thumb.thumbnail((128, 128))
            buf2 = BytesIO()
            thumb.save(buf2, format="JPEG", quality=85)
            thumb_content = ContentFile(buf2.getvalue(), name=file.name)

            # Store the medium and thumbnail variants
            profile.avatar.save(file.name, med_content, save=False)
            # Also save explicit medium and thumbnail fields for direct access
            try:
                profile.avatar_medium.save(file.name, med_content, save=False)
                profile.avatar_thumbnail.save(f"thumb_{file.name}", thumb_content, save=False)
            except Exception:
                # In case fields not present for older deployments, ignore
                pass

            profile.save()
        except Exception:
            # fallback: save raw file
            profile.avatar = file
            profile.save()

        from .serializers import ProfileSerializer

        return Response(ProfileSerializer(profile, context={"request": request}).data)


class CoverUploadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        file = request.FILES.get("cover")
        if not file:
            return Response({"detail": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST)

        # Basic validations
        if file.size > 8 * 1024 * 1024:
            return Response({"detail": "File too large"}, status=status.HTTP_400_BAD_REQUEST)
        if not getattr(file, "content_type", "").startswith("image/"):
            return Response({"detail": "Invalid file type"}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        profile = getattr(user, "market_profile", None)
        if profile is None:
            from market.models import Profile

            profile = Profile.objects.create(user=user)

        try:
            from PIL import Image
            from io import BytesIO
            from django.core.files.base import ContentFile

            img = Image.open(file)
            img = img.convert("RGB")

            # Save medium cover: max 1200x400
            med = img.copy()
            med.thumbnail((1200, 400))
            buf = BytesIO()
            med.save(buf, format="JPEG", quality=85)
            med_content = ContentFile(buf.getvalue(), name=file.name)

            # Save the primary cover and the medium variant
            profile.cover.save(file.name, med_content, save=False)
            try:
                profile.cover_medium.save(file.name, med_content, save=False)
            except Exception:
                pass
            profile.save()
        except Exception:
            profile.cover = file
            profile.save()

        from .serializers import ProfileSerializer

        return Response(ProfileSerializer(profile, context={"request": request}).data)


class RegisterView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserMeSerializer(user).data, status=status.HTTP_201_CREATED)


class AdminSeedView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "write"

    def post(self, request):
        if not getattr(request.user, "is_staff", False):
            return Response({"detail": "Not allowed."}, status=status.HTTP_403_FORBIDDEN)

        if not is_admin_seeding_enabled():
            return Response({"detail": "Admin seeding is disabled."}, status=status.HTTP_403_FORBIDDEN)

        scenario = request.data.get("scenario", "demo")
        options = request.data.get("options", {})
        if options is None:
            options = {}
        if not isinstance(options, dict):
            return Response({"detail": "options must be an object."}, status=status.HTTP_400_BAD_REQUEST)

        job = AdminSeedJob.objects.create(
            scenario=str(scenario or "demo"),
            options=options,
            requested_by=request.user,
        )

        return Response(
            {"id": job.id, "status": job.status, "scenario": job.scenario, "created_at": job.created_at},
            status=status.HTTP_202_ACCEPTED,
        )


class AdminSeedJobView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, job_id: int):
        if not getattr(request.user, "is_staff", False):
            return Response({"detail": "Not allowed."}, status=status.HTTP_403_FORBIDDEN)

        job = AdminSeedJob.objects.filter(id=job_id).first()
        if not job:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response(
            {
                "id": job.id,
                "status": job.status,
                "scenario": job.scenario,
                "options": job.options,
                "created_at": job.created_at,
                "started_at": job.started_at,
                "finished_at": job.finished_at,
                "result": job.result,
                "output": job.output,
                "error": job.error,
            }
        )


class AdminUserShadowBanView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "write"

    def patch(self, request, user_id: int):
        if not getattr(request.user, "is_staff", False):
            return Response({"detail": "Not allowed"}, status=status.HTTP_403_FORBIDDEN)

        target = User.objects.filter(id=user_id).first()
        if not target:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        desired = (request.data or {}).get("shadow_banned")
        if not isinstance(desired, bool):
            return Response({"detail": "shadow_banned must be a boolean"}, status=status.HTTP_400_BAD_REQUEST)

        profile = getattr(target, "market_profile", None)
        if profile is None:
            profile = Profile.objects.create(user=target)

        metadata = getattr(profile, "metadata", None) or {}
        if not isinstance(metadata, dict):
            metadata = {}

        if bool(metadata.get("shadow_banned")) != desired:
            metadata = dict(metadata)
            metadata["shadow_banned"] = desired
            profile.metadata = metadata
            profile.save(update_fields=["metadata", "updated_at"])

        return Response({"user_id": target.id, "shadow_banned": bool(profile.metadata.get("shadow_banned"))})


class AdminShadowBannedUsersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not getattr(request.user, "is_staff", False):
            return Response({"detail": "Not allowed"}, status=status.HTTP_403_FORBIDDEN)

        q = (request.query_params.get("q") or "").strip()
        try:
            limit = int(request.query_params.get("limit") or 50)
        except Exception:
            limit = 50
        limit = max(1, min(limit, 200))

        users_qs = User.objects.all().order_by("id")
        if q:
            users_qs = users_qs.filter(username__icontains=q)

        # Avoid relying on JSONField querying support in SQLite; filter in Python.
        results = []
        for user in users_qs[:1000]:
            profile = getattr(user, "market_profile", None)
            if profile is None:
                continue
            metadata = getattr(profile, "metadata", None) or {}
            if not isinstance(metadata, dict):
                continue
            if not bool(metadata.get("shadow_banned")):
                continue

            results.append({"user_id": user.id, "username": user.username, "shadow_banned": True})
            if len(results) >= limit:
                break

        return Response({"results": results})


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    pagination_class = None

    @action(detail=True, methods=["get"], permission_classes=[AllowAny], url_path="attributes")
    def attributes(self, request, pk=None):
        category = self.get_object()

        ancestor_ids = category.ancestor_ids_including_self()
        if not ancestor_ids:
            return Response([])

        order = list(reversed(ancestor_ids))
        pos = {cid: idx for idx, cid in enumerate(order)}

        defs = list(CategoryAttributeDefinition.objects.filter(category_id__in=ancestor_ids))
        defs.sort(key=lambda d: (pos.get(d.category_id, 10_000), d.sort_order, d.key))

        by_key = {}
        for d in defs:
            by_key[d.key] = d

        out = list(by_key.values())
        out.sort(key=lambda d: (d.sort_order, d.key))
        return Response(CategoryAttributeDefinitionSerializer(out, many=True).data)


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


class ListingReportViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated]
    ordering_fields = ["created_at"]
    throttle_scope_map = {"POST": "write", "PATCH": "write", "PUT": "write"}

    def get_queryset(self):
        user = self.request.user
        qs = ListingReport.objects.select_related("listing", "reporter", "handled_by")

        if getattr(user, "is_staff", False):
            # Staff can access any report by id; only apply status filtering for the list view.
            if getattr(self, "action", None) == "list":
                status_q = (self.request.query_params.get("status") or "").strip().lower()
                if status_q:
                    qs = qs.filter(status=status_q)
                else:
                    qs = qs.filter(status=ReportStatus.OPEN)
            return qs

        return qs.filter(reporter=user)

    def get_serializer_class(self):
        if self.action == "create":
            return ListingReportCreateSerializer
        if self.action in {"update", "partial_update"}:
            return ListingReportStaffUpdateSerializer
        if self.action == "events":
            return ListingReportEventSerializer
        return ListingReportSerializer

    def perform_create(self, serializer):
        serializer.save(reporter=self.request.user, status=ReportStatus.OPEN)

    def partial_update(self, request, *args, **kwargs):
        if not getattr(request.user, "is_staff", False):
            return Response({"detail": "Not allowed"}, status=status.HTTP_403_FORBIDDEN)

        report = self.get_object()
        serializer = ListingReportStaffUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        desired = serializer.validated_data["status"]

        note_provided = "staff_note" in serializer.validated_data
        staff_note = serializer.validated_data.get("staff_note", "")

        old_status = report.status
        changed_status = old_status != desired
        changed_note = note_provided and (report.staff_note != staff_note)

        if changed_status:
            report.set_status(desired, actor=request.user)

        if note_provided:
            report.staff_note = staff_note

        if changed_status or changed_note:
            update_fields = ["updated_at"]
            if changed_status:
                update_fields += ["status", "handled_by", "handled_at"]
            if note_provided:
                update_fields += ["staff_note"]
            report.save(update_fields=update_fields)

            ListingReportEvent.objects.create(
                report=report,
                actor=request.user,
                from_status=old_status,
                to_status=report.status,
                note=staff_note if note_provided else "",
            )

        return Response(ListingReportSerializer(report, context={"request": request}).data)

    @action(detail=True, methods=["get"], url_path="events")
    def events(self, request, pk=None):
        report = self.get_object()
        user = request.user
        if not getattr(user, "is_staff", False) and getattr(report, "reporter_id", None) != getattr(user, "id", None):
            return Response({"detail": "Not allowed"}, status=status.HTTP_403_FORBIDDEN)

        qs = ListingReportEvent.objects.filter(report=report).select_related("actor")
        data = ListingReportEventSerializer(qs, many=True).data
        return Response({"results": data})


class UserReportViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated]
    ordering_fields = ["created_at"]
    throttle_scope_map = {"POST": "write", "PATCH": "write", "PUT": "write"}

    def get_queryset(self):
        user = self.request.user
        qs = UserReport.objects.select_related("reporter", "reported", "handled_by", "listing", "thread")

        if getattr(user, "is_staff", False):
            if getattr(self, "action", None) == "list":
                status_q = (self.request.query_params.get("status") or "").strip().lower()
                if status_q:
                    qs = qs.filter(status=status_q)
                else:
                    qs = qs.filter(status=ReportStatus.OPEN)
            return qs

        return qs.filter(reporter=user)

    def get_serializer_class(self):
        if self.action == "create":
            return UserReportCreateSerializer
        if self.action in {"update", "partial_update"}:
            return UserReportStaffUpdateSerializer
        if self.action == "events":
            return UserReportEventSerializer
        return UserReportSerializer

    def perform_create(self, serializer):
        serializer.save(reporter=self.request.user, status=ReportStatus.OPEN)

    def partial_update(self, request, *args, **kwargs):
        if not getattr(request.user, "is_staff", False):
            return Response({"detail": "Not allowed"}, status=status.HTTP_403_FORBIDDEN)

        report = self.get_object()
        serializer = UserReportStaffUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        desired = serializer.validated_data["status"]

        note_provided = "staff_note" in serializer.validated_data
        staff_note = serializer.validated_data.get("staff_note", "")

        old_status = report.status
        changed_status = old_status != desired
        changed_note = note_provided and (report.staff_note != staff_note)

        if changed_status:
            report.set_status(desired, actor=request.user)

        if note_provided:
            report.staff_note = staff_note

        if changed_status or changed_note:
            update_fields = ["updated_at"]
            if changed_status:
                update_fields += ["status", "handled_by", "handled_at"]
            if note_provided:
                update_fields += ["staff_note"]
            report.save(update_fields=update_fields)

            UserReportEvent.objects.create(
                report=report,
                actor=request.user,
                from_status=old_status,
                to_status=report.status,
                note=staff_note if note_provided else "",
            )

        return Response(UserReportSerializer(report, context={"request": request}).data)

    @action(detail=True, methods=["get"], url_path="events")
    def events(self, request, pk=None):
        report = self.get_object()
        user = request.user
        if not getattr(user, "is_staff", False) and getattr(report, "reporter_id", None) != getattr(user, "id", None):
            return Response({"detail": "Not allowed"}, status=status.HTTP_403_FORBIDDEN)

        qs = UserReportEvent.objects.filter(report=report).select_related("actor")
        data = UserReportEventSerializer(qs, many=True).data
        return Response({"results": data})


class ListingViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
    search_fields = ["title", "description"]
    ordering_fields = ["created_at", "price"]
    throttle_scope_map = {"POST": "write", "PATCH": "write", "PUT": "write", "DELETE": "write"}

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated], url_path="moderation_queue")
    def moderation_queue(self, request):
        if not getattr(request.user, "is_staff", False):
            return Response({"detail": "Not allowed"}, status=status.HTTP_403_FORBIDDEN)

        queue = (request.query_params.get("queue") or "").strip().lower() or "pending"
        allowed = {"pending", "flagged", "rejected", "removed", "all"}
        if queue not in allowed:
            return Response(
                {"detail": "queue must be one of: pending, flagged, rejected, removed, all"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        qs = Listing.objects.select_related(
            "category",
            "governorate",
            "city",
            "neighborhood",
            "seller",
        ).prefetch_related("images")

        if queue == "pending":
            qs = qs.filter(moderation_status=ModerationStatus.PENDING, is_removed=False)
        elif queue == "flagged":
            qs = qs.filter(is_flagged=True, is_removed=False)
        elif queue == "rejected":
            qs = qs.filter(moderation_status=ModerationStatus.REJECTED, is_removed=False)
        elif queue == "removed":
            qs = qs.filter(is_removed=True)
        else:
            qs = qs

        qs = qs.order_by("created_at")

        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = ListingListSerializer(page, many=True, context={"request": request})
            return self.get_paginated_response(serializer.data)

        return Response(ListingListSerializer(qs, many=True, context={"request": request}).data)

    @action(detail=True, methods=["get"], permission_classes=[IsAuthenticated], url_path="admin_preview")
    def admin_preview(self, request, pk=None):
        if not getattr(request.user, "is_staff", False):
            return Response({"detail": "Not allowed"}, status=status.HTTP_403_FORBIDDEN)

        listing = (
            Listing.objects.select_related(
                "category",
                "governorate",
                "city",
                "neighborhood",
                "seller",
            )
            .prefetch_related("images", "attribute_values", "attribute_values__definition")
            .filter(id=pk)
            .first()
        )
        if not listing:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        return Response(ListingDetailSerializer(listing, context={"request": request}).data)

    @action(detail=False, methods=["post"], permission_classes=[IsAuthenticated], url_path="bulk_moderate")
    def bulk_moderate(self, request):
        if not getattr(request.user, "is_staff", False):
            return Response({"detail": "Not allowed"}, status=status.HTTP_403_FORBIDDEN)

        ids = request.data.get("ids")
        if not isinstance(ids, list) or not ids:
            return Response({"detail": "ids must be a non-empty array"}, status=status.HTTP_400_BAD_REQUEST)

        action_name = (request.data.get("action") or "").strip().lower()
        allowed_actions = {
            "",
            "approve",
            "reject",
            "restore",
            "remove",
            "unremove",
            "flag",
            "unflag",
        }
        if action_name not in allowed_actions:
            return Response(
                {
                    "detail": "action must be one of: approve, reject, restore, remove, unremove, flag, unflag",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        moderation_status = request.data.get("moderation_status")
        set_removed = request.data.get("is_removed")
        set_flagged = request.data.get("is_flagged")

        allowed_ms = {ModerationStatus.PENDING, ModerationStatus.APPROVED, ModerationStatus.REJECTED}
        update_kwargs: dict[str, object] = {}

        if action_name == "approve":
            update_kwargs["moderation_status"] = ModerationStatus.APPROVED
        elif action_name == "reject":
            update_kwargs["moderation_status"] = ModerationStatus.REJECTED
        elif action_name == "restore":
            update_kwargs["moderation_status"] = ModerationStatus.PENDING
            update_kwargs["is_removed"] = False
        elif action_name == "remove":
            update_kwargs["is_removed"] = True
        elif action_name == "unremove":
            update_kwargs["is_removed"] = False
        elif action_name == "flag":
            update_kwargs["is_flagged"] = True
        elif action_name == "unflag":
            update_kwargs["is_flagged"] = False

        if moderation_status is not None:
            if action_name:
                return Response(
                    {"detail": "Specify either action or explicit fields, not both"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if moderation_status not in allowed_ms:
                return Response({"detail": "Invalid moderation_status"}, status=status.HTTP_400_BAD_REQUEST)
            update_kwargs["moderation_status"] = moderation_status

        if set_removed is not None:
            if action_name:
                return Response(
                    {"detail": "Specify either action or explicit fields, not both"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            update_kwargs["is_removed"] = bool(set_removed)

        if set_flagged is not None:
            if action_name:
                return Response(
                    {"detail": "Specify either action or explicit fields, not both"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            update_kwargs["is_flagged"] = bool(set_flagged)

        if not update_kwargs:
            return Response({"detail": "No updates specified"}, status=status.HTTP_400_BAD_REQUEST)

        requested_ids = []
        for raw in ids:
            try:
                requested_ids.append(int(raw))
            except Exception:
                continue

        qs = Listing.objects.filter(id__in=requested_ids).prefetch_related("images")
        found_ids = set(qs.values_list("id", flat=True))
        not_found = [i for i in requested_ids if i not in found_ids]

        updated_ids: list[int] = []
        skipped: list[dict] = []
        approve_requested = update_kwargs.get("moderation_status") == ModerationStatus.APPROVED

        for listing in qs:
            if approve_requested:
                errors = self._publish_quality_errors(listing)
                if errors:
                    skipped.append({"id": listing.id, "reason": "publish_quality", "errors": errors})
                    continue

            changed = False
            for k, v in update_kwargs.items():
                if getattr(listing, k) != v:
                    setattr(listing, k, v)
                    changed = True

            if changed:
                listing.save(update_fields=list(update_kwargs.keys()) + ["updated_at"])
                updated_ids.append(listing.id)

        return Response({"updated": len(updated_ids), "updated_ids": updated_ids, "skipped": skipped, "not_found": not_found})

    def _publish_quality_errors(self, listing: Listing) -> dict:
        errors: dict[str, str] = {}

        min_images = int(getattr(settings, "LISTING_MIN_IMAGES_PUBLISH", 1) or 1)
        min_title_len = int(getattr(settings, "LISTING_MIN_TITLE_LEN", 5) or 5)
        min_desc_len = int(getattr(settings, "LISTING_MIN_DESCRIPTION_LEN", 10) or 10)

        if listing.is_removed:
            errors["is_removed"] = "Cannot approve a removed listing"
        if listing.status != ListingStatus.PUBLISHED:
            errors["status"] = "Listing must be published to approve"

        title = (listing.title or "").strip()
        if len(title) < min_title_len:
            errors["title"] = "Title is too short"

        description = (listing.description or "").strip()
        if len(description) < min_desc_len:
            errors["description"] = "Description is required"

        try:
            img_count = listing.images.count()
        except Exception:
            img_count = 0
        if img_count < min_images:
            errors["images"] = f"At least {min_images} image(s) is required"

        return errors

    def _tokenize_search(self, raw: str) -> list[str]:
        s = (raw or "").strip()
        if not s:
            return []
        # Basic unicode-friendly tokenization (keeps Arabic letters).
        tokens = re.findall(r"[0-9A-Za-z_\u0600-\u06FF]+", s)
        out: list[str] = []
        seen: set[str] = set()
        for t in tokens:
            tt = t.strip()
            if len(tt) < 2:
                continue
            key = tt.lower()
            if key in seen:
                continue
            seen.add(key)
            out.append(tt)
        return out[:10]

    def filter_queryset(self, queryset):
        qs = super().filter_queryset(queryset)

        # Search v2: if `search` is present and no explicit ordering is set,
        # apply a simple relevance rank (title matches > description matches > recency).
        raw_q = (self.request.query_params.get("search") or "").strip()
        if not raw_q:
            return qs

        if (self.request.query_params.get("ordering") or "").strip():
            return qs

        tokens = self._tokenize_search(raw_q)
        if not tokens:
            return qs

        score = Value(0, output_field=IntegerField())

        # Prefer full-phrase matches.
        score = score + Case(
            When(title__icontains=raw_q, then=Value(8)),
            default=Value(0),
            output_field=IntegerField(),
        )
        score = score + Case(
            When(description__icontains=raw_q, then=Value(3)),
            default=Value(0),
            output_field=IntegerField(),
        )

        # Token-based ranking.
        for tok in tokens:
            score = score + Case(
                When(title__icontains=tok, then=Value(3)),
                default=Value(0),
                output_field=IntegerField(),
            )
            score = score + Case(
                When(description__icontains=tok, then=Value(1)),
                default=Value(0),
                output_field=IntegerField(),
            )

        return qs.annotate(_rank=score).order_by("-_rank", "-created_at")

    def _public_discovery_queryset(self):
        return (
            Listing.objects.select_related(
                "category",
                "governorate",
                "city",
                "neighborhood",
                "seller",
            )
            .prefetch_related("images")
            .filter(
                status=ListingStatus.PUBLISHED,
                moderation_status=ModerationStatus.APPROVED,
                is_removed=False,
            )
        )

    @action(detail=False, methods=["get"], permission_classes=[AllowAny], url_path="facets")
    def facets(self, request):
        # Uses the same filters/search as the listings endpoint, but returns
        # grouped counts to power a faceted filtering UX.
        qs = self.filter_queryset(self.get_queryset())

        categories = list(
            qs.values("category_id", "category__slug", "category__name_ar", "category__name_en")
            .annotate(count=Count("id"))
            .order_by("-count")[:30]
        )
        governorates = list(
            qs.values(
                "governorate_id",
                "governorate__slug",
                "governorate__name_ar",
                "governorate__name_en",
            )
            .annotate(count=Count("id"))
            .order_by("-count")[:30]
        )
        cities = list(
            qs.values("city_id", "city__slug", "city__name_ar", "city__name_en")
            .annotate(count=Count("id"))
            .order_by("-count")[:50]
        )

        return Response(
            {
                "categories": categories,
                "governorates": governorates,
                "cities": cities,
            }
        )

    @action(detail=False, methods=["get"], permission_classes=[AllowAny], url_path="trending")
    def trending(self, request):
        qs = self._public_discovery_queryset()
        city_id = (request.query_params.get("city") or "").strip()
        if city_id:
            qs = qs.filter(city_id=city_id)

        since = timezone.now() - timedelta(days=7)
        qs = qs.annotate(
            favorites_7d=Count(
                "favorited_by",
                filter=Q(favorited_by__created_at__gte=since),
            )
        ).order_by("-favorites_7d", "-created_at")

        return Response(ListingListSerializer(qs[:12], many=True, context={"request": request}).data)

    @action(detail=False, methods=["get"], permission_classes=[AllowAny], url_path="new-in-city")
    def new_in_city(self, request):
        city_id = (request.query_params.get("city") or "").strip()
        if not city_id:
            return Response({"detail": "city is required"}, status=status.HTTP_400_BAD_REQUEST)

        qs = self._public_discovery_queryset().filter(city_id=city_id).order_by("-created_at")
        return Response(ListingListSerializer(qs[:12], many=True, context={"request": request}).data)

    @action(detail=True, methods=["get"], permission_classes=[AllowAny], url_path="similar")
    def similar(self, request, pk=None):
        listing = self.get_object()
        qs = Listing.objects.select_related("category", "city", "seller").prefetch_related("images")
        qs = qs.filter(
            status=ListingStatus.PUBLISHED,
            moderation_status=ModerationStatus.APPROVED,
            is_removed=False,
        )
        qs = qs.filter(category=listing.category)

        # Prefer same city; fallback is still useful.
        qs = qs.filter(city=listing.city)

        qs = qs.exclude(id=listing.id).order_by("-created_at")[:12]
        return Response(ListingListSerializer(qs, many=True, context={"request": request}).data)

    def _mark_pending_if_seller_change(self, listing: Listing):
        user = self.request.user
        if not getattr(user, "is_authenticated", False):
            return
        if getattr(user, "is_staff", False):
            return
        if listing.seller_id != user.id:
            return
        if listing.moderation_status != ModerationStatus.PENDING:
            listing.moderation_status = ModerationStatus.PENDING
            listing.save(update_fields=["moderation_status", "updated_at"])

    def get_queryset(self):
        qs = Listing.objects.select_related(
            "category",
            "governorate",
            "city",
            "neighborhood",
            "seller",
        ).prefetch_related("images")

        if getattr(self, "action", None) == "retrieve":
            qs = qs.prefetch_related("attribute_values", "attribute_values__definition")

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

        selected_category_obj = None

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
            raw = str(qp.get("category") or "").strip()
            try:
                root_id = int(raw)
            except Exception:
                root_id = None

            if root_id is not None:
                selected_category_obj = Category.objects.filter(id=root_id).first()
                # Treat category as a subtree filter (selected category + all descendants).
                ids: list[int] = [root_id]
                frontier: list[int] = [root_id]
                seen: set[int] = {root_id}

                # Depth is expected to be small; this keeps queries bounded.
                while frontier:
                    child_ids = list(
                        Category.objects.filter(parent_id__in=frontier).values_list("id", flat=True)
                    )
                    frontier = []
                    for cid in child_ids:
                        if cid in seen:
                            continue
                        seen.add(cid)
                        ids.append(cid)
                        frontier.append(cid)

                qs = qs.filter(category_id__in=ids)
        if qp.get("governorate"):
            qs = qs.filter(governorate_id=qp.get("governorate"))
        if qp.get("city"):
            qs = qs.filter(city_id=qp.get("city"))
        if qp.get("neighborhood"):
            qs = qs.filter(neighborhood_id=qp.get("neighborhood"))

        # Price range filters
        # Supports both price_min/price_max and price__gte/price__lte.
        raw_price_min = (qp.get("price_min") if qp.get("price_min") is not None else qp.get("price__gte"))
        raw_price_max = (qp.get("price_max") if qp.get("price_max") is not None else qp.get("price__lte"))

        if raw_price_min is not None and str(raw_price_min).strip() != "":
            try:
                price_min = Decimal(str(raw_price_min).strip())
            except (InvalidOperation, ValueError):
                raise ValidationError({"detail": "Invalid decimal for price_min"})
            if price_min < 0:
                raise ValidationError({"detail": "price_min cannot be negative"})
            qs = qs.filter(price__gte=price_min)

        if raw_price_max is not None and str(raw_price_max).strip() != "":
            try:
                price_max = Decimal(str(raw_price_max).strip())
            except (InvalidOperation, ValueError):
                raise ValidationError({"detail": "Invalid decimal for price_max"})
            if price_max < 0:
                raise ValidationError({"detail": "price_max cannot be negative"})
            qs = qs.filter(price__lte=price_max)

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

        # Attribute filters: query params starting with attr_
        attr_params = [(k, v) for k, v in qp.items() if str(k).startswith("attr_")]
        if attr_params:
            if selected_category_obj is None:
                raise ValidationError({"detail": "attr_* filters require category to be set"})

            ancestor_ids = selected_category_obj.ancestor_ids_including_self()
            order = list(reversed(ancestor_ids))
            pos = {cid: idx for idx, cid in enumerate(order)}
            defs = list(CategoryAttributeDefinition.objects.filter(category_id__in=ancestor_ids))
            defs.sort(key=lambda d: (pos.get(d.category_id, 10_000), d.sort_order, d.key))
            defs_by_key = {}
            for d in defs:
                defs_by_key[d.key] = d

            def parse_bool(s: str) -> bool:
                ss = str(s).strip().lower()
                if ss in {"1", "true", "yes", "y", "on"}:
                    return True
                if ss in {"0", "false", "no", "n", "off"}:
                    return False
                raise ValidationError({"detail": "Invalid boolean value"})

            for idx, (raw_key, raw_val) in enumerate(attr_params):
                name = str(raw_key)
                raw_val = str(raw_val)
                base = name[len("attr_") :]
                if "__" in base:
                    key, op = base.split("__", 1)
                else:
                    key, op = base, "eq"

                d = defs_by_key.get(key)
                if not d:
                    raise ValidationError({"detail": f"Unknown attribute filter: {key}"})
                if not d.is_filterable:
                    raise ValidationError({"detail": f"Attribute is not filterable: {key}"})

                value_qs = ListingAttributeValue.objects.filter(listing_id=OuterRef("pk"), definition=d)

                if d.type == "int":
                    try:
                        num = int(raw_val)
                    except Exception:
                        raise ValidationError({"detail": f"Invalid integer for {key}"})
                    if op == "eq":
                        value_qs = value_qs.filter(int_value=num)
                    elif op == "gte":
                        value_qs = value_qs.filter(int_value__gte=num)
                    elif op == "lte":
                        value_qs = value_qs.filter(int_value__lte=num)
                    elif op == "gt":
                        value_qs = value_qs.filter(int_value__gt=num)
                    elif op == "lt":
                        value_qs = value_qs.filter(int_value__lt=num)
                    else:
                        raise ValidationError({"detail": f"Unsupported operator for {key}: {op}"})

                elif d.type == "decimal":
                    try:
                        num = Decimal(raw_val)
                    except Exception:
                        raise ValidationError({"detail": f"Invalid decimal for {key}"})
                    if op == "eq":
                        value_qs = value_qs.filter(decimal_value=num)
                    elif op == "gte":
                        value_qs = value_qs.filter(decimal_value__gte=num)
                    elif op == "lte":
                        value_qs = value_qs.filter(decimal_value__lte=num)
                    elif op == "gt":
                        value_qs = value_qs.filter(decimal_value__gt=num)
                    elif op == "lt":
                        value_qs = value_qs.filter(decimal_value__lt=num)
                    else:
                        raise ValidationError({"detail": f"Unsupported operator for {key}: {op}"})

                elif d.type == "bool":
                    if op != "eq":
                        raise ValidationError({"detail": f"Unsupported operator for {key}: {op}"})
                    value_qs = value_qs.filter(bool_value=parse_bool(raw_val))

                elif d.type == "enum":
                    if op == "eq":
                        value_qs = value_qs.filter(enum_value=str(raw_val))
                    elif op == "in":
                        items = [x.strip() for x in str(raw_val).split(",") if x.strip()]
                        if not items:
                            raise ValidationError({"detail": f"Invalid list for {key}"})
                        value_qs = value_qs.filter(enum_value__in=items)
                    else:
                        raise ValidationError({"detail": f"Unsupported operator for {key}: {op}"})

                elif d.type == "text":
                    if op == "eq":
                        value_qs = value_qs.filter(text_value=str(raw_val))
                    elif op == "icontains":
                        value_qs = value_qs.filter(text_value__icontains=str(raw_val))
                    else:
                        raise ValidationError({"detail": f"Unsupported operator for {key}: {op}"})
                else:
                    raise ValidationError({"detail": f"Unsupported attribute type for {key}"})

                qs = qs.annotate(**{f"_has_attr_{idx}": Subquery(value_qs.values("id")[:1])}).filter(
                    **{f"_has_attr_{idx}__isnull": False}
                )

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
            serializer = ListingListSerializer(page, many=True, context={"request": request})
            return self.get_paginated_response(serializer.data)
        return Response(ListingListSerializer(qs, many=True, context={"request": request}).data)

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

        if desired == ModerationStatus.APPROVED:
            errors = self._publish_quality_errors(listing)
            if errors:
                return Response(
                    {"detail": "Listing does not meet publish quality requirements", "errors": errors},
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

    def perform_update(self, serializer):
        listing = serializer.save()
        self._mark_pending_if_seller_change(listing)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = ListingWriteSerializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        instance.refresh_from_db()
        return Response(ListingDetailSerializer(instance, context={"request": request}).data)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    @action(detail=True, methods=["get", "post"], permission_classes=[IsAuthenticatedOrReadOnly])
    def images(self, request, pk=None):
        listing = self.get_object()
        if request.method == "GET":
            return Response(ListingImageSerializer(listing.images.all(), many=True, context={"request": request}).data)

        if listing.seller != request.user:
            return Response({"detail": "Not allowed"}, status=status.HTTP_403_FORBIDDEN)

        serializer = ListingImageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        image = ListingImage.objects.create(listing=listing, **serializer.validated_data)
        self._mark_pending_if_seller_change(listing)
        return Response(ListingImageSerializer(image, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=["post"],
        url_path="images/bulk",
        permission_classes=[IsAuthenticated],
    )
    def add_images_bulk(self, request, pk=None):
        """Upload multiple images in one request.

        Expects multipart form-data with one of:
        - images (multiple)
        - images[] (multiple)
        """

        listing = self.get_object()
        if listing.seller != request.user:
            return Response({"detail": "Not allowed"}, status=status.HTTP_403_FORBIDDEN)

        files = request.FILES.getlist("images")
        if not files:
            files = request.FILES.getlist("images[]")

        if not files:
            return Response({"detail": "No files uploaded"}, status=status.HTTP_400_BAD_REQUEST)

        # Basic guardrails.
        if len(files) > 12:
            return Response({"detail": "Too many files (max 12)"}, status=status.HTTP_400_BAD_REQUEST)

        existing_count = listing.images.count()
        if existing_count + len(files) > 24:
            return Response({"detail": "Listing image limit reached (max 24)"}, status=status.HTTP_400_BAD_REQUEST)

        max_sort = listing.images.aggregate(m=models.Max("sort_order")).get("m")
        if max_sort is None:
            max_sort = -1

        created = []
        for idx, f in enumerate(files, start=1):
            if getattr(f, "size", 0) > 8 * 1024 * 1024:
                return Response({"detail": "File too large (max 8MB)"}, status=status.HTTP_400_BAD_REQUEST)
            if not str(getattr(f, "content_type", "")).startswith("image/"):
                return Response({"detail": "Invalid file type"}, status=status.HTTP_400_BAD_REQUEST)

            img = ListingImage.objects.create(
                listing=listing,
                image=f,
                alt_text=str(request.data.get("alt_text") or ""),
                sort_order=max_sort + idx,
            )
            created.append(img)

        self._mark_pending_if_seller_change(listing)
        return Response(
            ListingImageSerializer(created, many=True, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["delete"],
        url_path=r"images/(?P<image_id>\d+)",
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
        self._mark_pending_if_seller_change(listing)
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

        self._mark_pending_if_seller_change(listing)

        refreshed = listing.images.order_by("sort_order", "id")
        return Response(ListingImageSerializer(refreshed, many=True, context={"request": request}).data)

    @action(detail=True, methods=["get", "post"], permission_classes=[IsAuthenticatedOrReadOnly])
    def questions(self, request, pk=None):
        listing = self.get_object()
        if request.method == "GET":
            qs = PublicQuestion.objects.filter(listing=listing).select_related("author", "answered_by")

            # Shadowed questions are only visible to the author (and staff).
            if not request.user.is_authenticated:
                qs = qs.filter(is_shadowed=False)
            elif not getattr(request.user, "is_staff", False):
                qs = qs.filter(Q(is_shadowed=False) | Q(author=request.user))

                blocked_ids = blocked_user_ids_for(request.user)
                if blocked_ids:
                    qs = qs.exclude(author_id__in=blocked_ids)

            return Response(PublicQuestionSerializer(qs, many=True).data)

        if not request.user.is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)

        # Respect user blocks (either direction) for seller-facing interactions.
        if UserBlock.objects.filter(blocker=request.user, blocked=listing.seller).exists() or UserBlock.objects.filter(
            blocker=listing.seller, blocked=request.user
        ).exists():
            return Response({"detail": "Not allowed"}, status=status.HTTP_403_FORBIDDEN)

        serializer = PublicQuestionCreateSerializer(data={**request.data, "listing": listing.id}, context={"request": request})
        serializer.is_valid(raise_exception=True)
        q = PublicQuestion.objects.create(
            listing=listing,
            author=request.user,
            question=serializer.validated_data["question"],
            is_shadowed=is_shadow_banned_user(request.user),
        )
        return Response(PublicQuestionSerializer(q).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated], url_path="report-seller")
    def report_seller(self, request, pk=None):
        listing = self.get_object()
        payload = request.data or {}

        serializer = UserReportCreateSerializer(
            data={
                "reported": getattr(listing.seller, "id", None),
                "listing": getattr(listing, "id", None),
                "reason": payload.get("reason"),
                "message": payload.get("message", ""),
            },
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        report = serializer.save(reporter=request.user, status=ReportStatus.OPEN)
        return Response(UserReportSerializer(report, context={"request": request}).data, status=status.HTTP_201_CREATED)


class PublicQuestionViewSet(mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = PublicQuestion.objects.select_related("listing", "author", "answered_by").all()
    serializer_class = PublicQuestionSerializer
    throttle_scope_map = {"POST": "messaging"}

    def get_queryset(self):
        qs = super().get_queryset()
        user = getattr(self.request, "user", None)

        public_listing = Q(
            listing__is_removed=False,
            listing__status=ListingStatus.PUBLISHED,
            listing__moderation_status=ModerationStatus.APPROVED,
        )

        if not user or not user.is_authenticated:
            return qs.filter(public_listing, is_shadowed=False)
        if getattr(user, "is_staff", False):
            return qs

        # For non-staff, only allow questions on public listings, or questions tied
        # to listings they own, or questions they authored.
        qs = qs.filter(public_listing | Q(listing__seller=user) | Q(author=user))

        blocked_ids = blocked_user_ids_for(user)
        if blocked_ids:
            qs = qs.exclude(author_id__in=blocked_ids)

        # Shadowed questions are only visible to the author (and staff).
        return qs.filter(Q(is_shadowed=False) | Q(author=user))

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def answer(self, request, pk=None):
        q = self.get_object()
        if q.listing.seller != request.user:
            return Response({"detail": "Only the seller can answer"}, status=status.HTTP_403_FORBIDDEN)

        # Respect user blocks (either direction) between the seller and question author.
        if UserBlock.objects.filter(blocker=request.user, blocked=q.author).exists() or UserBlock.objects.filter(
            blocker=q.author, blocked=request.user
        ).exists():
            return Response({"detail": "Not allowed"}, status=status.HTTP_403_FORBIDDEN)

        serializer = PublicQuestionAnswerSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        q.answer = serializer.validated_data["answer"]
        q.answered_by = request.user
        q.answered_at = timezone.now()
        q.save(update_fields=["answer", "answered_by", "answered_at"])

        # Notify the question author (in-app + optional email).
        try:
            prefs = _get_or_create_notification_preferences(q.author)
            if prefs.inapp_question_answered:
                Notification.objects.create(
                    user=q.author,
                    kind=NotificationKind.QUESTION_ANSWERED,
                    title="Question answered",
                    body="Your question got an answer.",
                    payload={"listing_id": q.listing_id, "question_id": q.id},
                )
            if prefs.email_question_answered:
                _send_notification_email(
                    to_user=q.author,
                    subject="Your question was answered",
                    message="Your question on a listing has been answered. Open Beebol to view it.",
                )
        except Exception:
            pass
        return Response(PublicQuestionSerializer(q).data)


class PrivateThreadViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = PrivateThreadSerializer
    throttle_scope_map = {"POST": "messaging"}

    def get_queryset(self):
        user = self.request.user
        last_msg = PrivateMessage.objects.filter(thread=OuterRef("pk")).order_by("-created_at")
        if not getattr(user, "is_staff", False):
            last_msg = last_msg.filter(Q(is_shadowed=False) | Q(sender=user))

        epoch = datetime(1970, 1, 1, tzinfo=dt_timezone.utc)

        my_last_read_at = Coalesce(
            models.Case(
                models.When(buyer=user, then=F("buyer_last_read_at")),
                models.When(seller=user, then=F("seller_last_read_at")),
                default=None,
                output_field=DateTimeField(),
            ),
            Value(epoch, output_field=DateTimeField()),
        )

        unread_filter = Q(messages__created_at__gt=my_last_read_at) & ~Q(messages__sender=user)
        if not getattr(user, "is_staff", False):
            unread_filter &= Q(messages__is_shadowed=False)

        return (
            PrivateThread.objects.select_related("listing", "buyer", "seller")
            .filter(Q(buyer=user) | Q(seller=user))
            .annotate(
                last_message_body=Subquery(last_msg.values("body")[:1]),
                last_message_at=Subquery(last_msg.values("created_at")[:1]),
                last_message_sender_username=Subquery(last_msg.values("sender__username")[:1]),
                my_last_read_at=my_last_read_at,
                unread_count=Count("messages", filter=unread_filter),
            )
            .order_by("-last_message_at", "-created_at")
        )

    def create(self, request, *args, **kwargs):
        serializer = CreateThreadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        raw_listing_id = serializer.validated_data["listing_id"]

        try:
            listing_id = int(str(raw_listing_id).strip())
        except Exception:
            return Response({"detail": "Listing not found"}, status=status.HTTP_404_NOT_FOUND)

        if listing_id <= 0:
            return Response({"detail": "Listing not found"}, status=status.HTTP_404_NOT_FOUND)

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

        # Respect user blocks (either direction).
        if UserBlock.objects.filter(blocker=request.user, blocked=listing.seller).exists() or UserBlock.objects.filter(
            blocker=listing.seller, blocked=request.user
        ).exists():
            return Response({"detail": "Not allowed"}, status=status.HTTP_403_FORBIDDEN)

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

            if not getattr(request.user, "is_staff", False):
                msgs = msgs.filter(Q(is_shadowed=False) | Q(sender=request.user))

            return Response(PrivateMessageSerializer(msgs, many=True).data)

        # Respect user blocks (either direction).
        other_user = thread.seller if request.user.id == thread.buyer_id else thread.buyer
        if UserBlock.objects.filter(blocker=request.user, blocked=other_user).exists() or UserBlock.objects.filter(
            blocker=other_user, blocked=request.user
        ).exists():
            return Response({"detail": "Not allowed"}, status=status.HTTP_403_FORBIDDEN)

        serializer = PrivateMessageCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        msg = PrivateMessage.objects.create(
            thread=thread,
            sender=request.user,
            body=serializer.validated_data["body"],
            is_shadowed=is_shadow_banned_user(request.user),
        )

        # Notify the other participant only if the message will be visible to them.
        if not msg.is_shadowed:
            try:
                recipient = thread.seller if request.user.id == thread.buyer_id else thread.buyer
                prefs = _get_or_create_notification_preferences(recipient)
                if prefs.inapp_private_message:
                    Notification.objects.create(
                        user=recipient,
                        kind=NotificationKind.PRIVATE_MESSAGE,
                        title="New message",
                        body="You have a new message.",
                        payload={
                            "thread_id": thread.id,
                            "listing_id": thread.listing_id,
                            "sender_id": request.user.id,
                        },
                    )
                if prefs.email_private_message:
                    _send_notification_email(
                        to_user=recipient,
                        subject="New private message",
                        message="You have a new private message on Beebol. Open the app to read it.",
                    )
            except Exception:
                pass

        # Mark the sender as having read up to now.
        now = timezone.now()
        if request.user.id == thread.buyer_id:
            PrivateThread.objects.filter(id=thread.id).update(buyer_last_read_at=now)
        elif request.user.id == thread.seller_id:
            PrivateThread.objects.filter(id=thread.id).update(seller_last_read_at=now)

        return Response(PrivateMessageSerializer(msg).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="report")
    def report(self, request, pk=None):
        thread = self.get_object()

        other_user = thread.seller if request.user.id == thread.buyer_id else thread.buyer
        payload = request.data or {}

        serializer = UserReportCreateSerializer(
            data={
                "reported": getattr(other_user, "id", None),
                "thread": getattr(thread, "id", None),
                "listing": getattr(thread.listing, "id", None),
                "reason": payload.get("reason"),
                "message": payload.get("message", ""),
            },
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        report = serializer.save(reporter=request.user, status=ReportStatus.OPEN)
        return Response(UserReportSerializer(report, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="read")
    def mark_read(self, request, pk=None):
        thread = self.get_object()
        now = timezone.now()

        if request.user.id == thread.buyer_id:
            PrivateThread.objects.filter(id=thread.id).update(buyer_last_read_at=now)
        elif request.user.id == thread.seller_id:
            PrivateThread.objects.filter(id=thread.id).update(seller_last_read_at=now)
        else:
            return Response({"detail": "Not allowed"}, status=status.HTTP_403_FORBIDDEN)

        thread.refresh_from_db(fields=["buyer_last_read_at", "seller_last_read_at", "updated_at"])
        return Response(PrivateThreadSerializer(thread).data)


class UserBlockViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated]
    throttle_scope_map = {"POST": "messaging", "DELETE": "messaging"}

    def get_queryset(self):
        return UserBlock.objects.select_related("blocked").filter(blocker=self.request.user)

    def get_serializer_class(self):
        if self.action == "create":
            return UserBlockCreateSerializer
        return UserBlockSerializer

    def create(self, request, *args, **kwargs):
        serializer = UserBlockCreateSerializer(data=request.data, context={"request": request})
        try:
            serializer.is_valid(raise_exception=True)
        except ValidationError as exc:
            detail = getattr(exc, "detail", None)
            if isinstance(detail, dict) and "blocked_user_id" in detail:
                msg = ""
                try:
                    raw = detail.get("blocked_user_id")
                    if isinstance(raw, (list, tuple)) and raw:
                        msg = str(raw[0])
                    else:
                        msg = str(raw)
                except Exception:
                    msg = ""
                if "not found" in msg.lower():
                    return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)
            raise

        blocked = serializer.validated_data["blocked_user_id"]

        if blocked.id == request.user.id:
            raise ValidationError({"blocked_user_id": "Cannot block yourself"})

        block, created = UserBlock.objects.get_or_create(blocker=request.user, blocked=blocked)
        data = UserBlockSerializer(block, context={"request": request}).data
        return Response(data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    def perform_create(self, serializer):
        blocked = serializer.validated_data["blocked_user_id"]

        if blocked.id == self.request.user.id:
            raise ValidationError({"blocked_user_id": "Cannot block yourself"})

        UserBlock.objects.get_or_create(blocker=self.request.user, blocked=blocked)


class ListingFavoriteViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated]
    throttle_scope_map = {"POST": "write", "DELETE": "write"}

    def get_queryset(self):
        user = self.request.user
        qs = ListingFavorite.objects.select_related("listing").filter(user=user)

        # For non-staff, only filter the list view. Keep non-public favorites
        # addressable for delete by id (so users can still unfavorite).
        if getattr(self, "action", None) == "list" and not getattr(user, "is_staff", False):
            qs = qs.filter(
                listing__is_removed=False,
                listing__status=ListingStatus.PUBLISHED,
                listing__moderation_status=ModerationStatus.APPROVED,
            )

        return qs

    def get_serializer_class(self):
        if self.action == "create":
            return ListingFavoriteCreateSerializer
        return ListingFavoriteSerializer

    def create(self, request, *args, **kwargs):
        serializer = ListingFavoriteCreateSerializer(data=request.data, context={"request": request})
        try:
            serializer.is_valid(raise_exception=True)
        except ValidationError as exc:
            detail = getattr(exc, "detail", None)
            if isinstance(detail, dict) and "listing_id" in detail:
                msg = ""
                try:
                    raw = detail.get("listing_id")
                    if isinstance(raw, (list, tuple)) and raw:
                        msg = str(raw[0])
                    else:
                        msg = str(raw)
                except Exception:
                    msg = ""
                if "not found" in msg.lower():
                    return Response({"detail": "Listing not found"}, status=status.HTTP_404_NOT_FOUND)
            raise

        listing = serializer.validated_data["listing_id"]

        # For non-staff, only allow favoriting publicly visible listings.
        if not getattr(request.user, "is_staff", False):
            if (
                listing.is_removed
                or listing.status != ListingStatus.PUBLISHED
                or listing.moderation_status != ModerationStatus.APPROVED
            ):
                return Response({"detail": "Listing not found"}, status=status.HTTP_404_NOT_FOUND)

        fav, created = ListingFavorite.objects.get_or_create(user=request.user, listing=listing)
        data = ListingFavoriteSerializer(fav, context={"request": request}).data
        return Response(data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class SavedSearchViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = SavedSearchSerializer
    throttle_scope_map = {"POST": "write", "PATCH": "write", "PUT": "write", "DELETE": "write"}

    def get_queryset(self):
        return SavedSearch.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["post"], url_path="check", permission_classes=[IsAuthenticated])
    def check_now(self, request, pk=None):
        saved = self.get_object()

        params = saved.query_params or {}
        if not isinstance(params, dict):
            params = {}

        user = request.user

        qs = Listing.objects.all()
        public_visibility = Q(
            status=ListingStatus.PUBLISHED,
            moderation_status=ModerationStatus.APPROVED,
        )

        if getattr(user, "is_staff", False):
            qs = qs
        else:
            qs = qs.filter(public_visibility | Q(seller=user))

        include_removed = str(params.get("include_removed") or "").lower() in {"1", "true", "yes"}
        if not (include_removed and getattr(user, "is_staff", False)):
            qs = qs.filter(is_removed=False)

        if params.get("status"):
            qs = qs.filter(status=params.get("status"))
        if params.get("moderation_status"):
            qs = qs.filter(moderation_status=params.get("moderation_status"))
        if params.get("seller"):
            qs = qs.filter(seller_id=params.get("seller"))

        selected_category_obj = None
        if params.get("category"):
            raw = str(params.get("category") or "").strip()
            try:
                root_id = int(raw)
            except Exception:
                root_id = None

            if root_id is not None:
                selected_category_obj = Category.objects.filter(id=root_id).first()
                ids: list[int] = [root_id]
                frontier: list[int] = [root_id]
                seen: set[int] = {root_id}
                while frontier:
                    child_ids = list(Category.objects.filter(parent_id__in=frontier).values_list("id", flat=True))
                    frontier = []
                    for cid in child_ids:
                        if cid in seen:
                            continue
                        seen.add(cid)
                        ids.append(cid)
                        frontier.append(cid)
                qs = qs.filter(category_id__in=ids)

        if params.get("governorate"):
            qs = qs.filter(governorate_id=params.get("governorate"))
        if params.get("city"):
            qs = qs.filter(city_id=params.get("city"))
        if params.get("neighborhood"):
            qs = qs.filter(neighborhood_id=params.get("neighborhood"))

        raw_price_min = params.get("price_min") if params.get("price_min") is not None else params.get("price__gte")
        raw_price_max = params.get("price_max") if params.get("price_max") is not None else params.get("price__lte")

        if raw_price_min is not None and str(raw_price_min).strip() != "":
            try:
                price_min = Decimal(str(raw_price_min).strip())
            except (InvalidOperation, ValueError):
                raise ValidationError({"detail": "Invalid decimal for price_min"})
            if price_min < 0:
                raise ValidationError({"detail": "price_min cannot be negative"})
            qs = qs.filter(price__gte=price_min)

        if raw_price_max is not None and str(raw_price_max).strip() != "":
            try:
                price_max = Decimal(str(raw_price_max).strip())
            except (InvalidOperation, ValueError):
                raise ValidationError({"detail": "Invalid decimal for price_max"})
            if price_max < 0:
                raise ValidationError({"detail": "price_max cannot be negative"})
            qs = qs.filter(price__lte=price_max)

        if params.get("is_flagged") is not None:
            raw = str(params.get("is_flagged") or "").lower()
            if raw in {"1", "true", "yes"}:
                qs = qs.filter(is_flagged=True)
            elif raw in {"0", "false", "no"}:
                qs = qs.filter(is_flagged=False)

        if include_removed and getattr(user, "is_staff", False) and params.get("is_removed") is not None:
            raw = str(params.get("is_removed") or "").lower()
            if raw in {"1", "true", "yes"}:
                qs = qs.filter(is_removed=True)
            elif raw in {"0", "false", "no"}:
                qs = qs.filter(is_removed=False)

        attr_params = [(k, v) for k, v in params.items() if str(k).startswith("attr_")]
        if attr_params:
            if selected_category_obj is None:
                raise ValidationError({"detail": "attr_* filters require category to be set"})

            ancestor_ids = selected_category_obj.ancestor_ids_including_self()
            order = list(reversed(ancestor_ids))
            pos = {cid: idx for idx, cid in enumerate(order)}
            defs = list(CategoryAttributeDefinition.objects.filter(category_id__in=ancestor_ids))
            defs.sort(key=lambda d: (pos.get(d.category_id, 10_000), d.sort_order, d.key))
            defs_by_key = {d.key: d for d in defs}

            def parse_bool(s: str) -> bool:
                ss = str(s).strip().lower()
                if ss in {"1", "true", "yes", "y", "on"}:
                    return True
                if ss in {"0", "false", "no", "n", "off"}:
                    return False
                raise ValidationError({"detail": "Invalid boolean value"})

            for idx, (raw_key, raw_val) in enumerate(attr_params):
                name = str(raw_key)
                raw_val = str(raw_val)
                base = name[len("attr_") :]
                if "__" in base:
                    key, op = base.split("__", 1)
                else:
                    key, op = base, "eq"

                d = defs_by_key.get(key)
                if not d:
                    raise ValidationError({"detail": f"Unknown attribute filter: {key}"})
                if not d.is_filterable:
                    raise ValidationError({"detail": f"Attribute is not filterable: {key}"})

                value_qs = ListingAttributeValue.objects.filter(listing_id=OuterRef("pk"), definition=d)

                if d.type == "int":
                    try:
                        num = int(raw_val)
                    except Exception:
                        raise ValidationError({"detail": f"Invalid integer for {key}"})
                    if op == "eq":
                        value_qs = value_qs.filter(int_value=num)
                    elif op == "gte":
                        value_qs = value_qs.filter(int_value__gte=num)
                    elif op == "lte":
                        value_qs = value_qs.filter(int_value__lte=num)
                    elif op == "gt":
                        value_qs = value_qs.filter(int_value__gt=num)
                    elif op == "lt":
                        value_qs = value_qs.filter(int_value__lt=num)
                    else:
                        raise ValidationError({"detail": f"Unsupported operator for {key}: {op}"})
                elif d.type == "decimal":
                    try:
                        num = Decimal(raw_val)
                    except Exception:
                        raise ValidationError({"detail": f"Invalid decimal for {key}"})
                    if op == "eq":
                        value_qs = value_qs.filter(decimal_value=num)
                    elif op == "gte":
                        value_qs = value_qs.filter(decimal_value__gte=num)
                    elif op == "lte":
                        value_qs = value_qs.filter(decimal_value__lte=num)
                    elif op == "gt":
                        value_qs = value_qs.filter(decimal_value__gt=num)
                    elif op == "lt":
                        value_qs = value_qs.filter(decimal_value__lt=num)
                    else:
                        raise ValidationError({"detail": f"Unsupported operator for {key}: {op}"})
                elif d.type == "bool":
                    if op != "eq":
                        raise ValidationError({"detail": f"Unsupported operator for {key}: {op}"})
                    value_qs = value_qs.filter(bool_value=parse_bool(raw_val))
                elif d.type == "enum":
                    if op == "eq":
                        value_qs = value_qs.filter(enum_value=str(raw_val))
                    elif op == "in":
                        items = [x.strip() for x in str(raw_val).split(",") if x.strip()]
                        if not items:
                            raise ValidationError({"detail": f"Invalid list for {key}"})
                        value_qs = value_qs.filter(enum_value__in=items)
                    else:
                        raise ValidationError({"detail": f"Unsupported operator for {key}: {op}"})
                elif d.type == "text":
                    if op == "eq":
                        value_qs = value_qs.filter(text_value=str(raw_val))
                    elif op == "icontains":
                        value_qs = value_qs.filter(text_value__icontains=str(raw_val))
                    else:
                        raise ValidationError({"detail": f"Unsupported operator for {key}: {op}"})
                else:
                    raise ValidationError({"detail": f"Unsupported attribute type for {key}"})

                qs = qs.annotate(**{f"_has_attr_{idx}": Subquery(value_qs.values("id")[:1])}).filter(
                    **{f"_has_attr_{idx}__isnull": False}
                )

        count = qs.count()
        saved.last_checked_at = timezone.now()
        saved.last_result_count = int(count)
        saved.save(update_fields=["last_checked_at", "last_result_count", "updated_at"])

        return Response(SavedSearchSerializer(saved).data)
