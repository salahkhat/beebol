from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .auth_views import ThrottledTokenObtainPairView, ThrottledTokenRefreshView

from .views import (
    AdminSeedView,
    AdminSeedJobView,
    AdminShadowBannedUsersView,
    AdminUserShadowBanView,
    CategoryViewSet,
    CityViewSet,
    GovernorateViewSet,
    HealthView,
    ListingViewSet,
    MeView,
    NeighborhoodViewSet,
    PrivateThreadViewSet,
    PublicQuestionViewSet,
    RegisterView,
    ListingReportViewSet,
    UserReportViewSet,
    UserBlockViewSet,
    ListingFavoriteViewSet,
    SavedSearchViewSet,
    UserProfileView,
    MeProfileView,
    AvatarUploadView,
    CoverUploadView,
    NotificationPreferenceMeView,
    NotificationViewSet,
)

router = DefaultRouter()
router.register(r"categories", CategoryViewSet, basename="category")
router.register(r"governorates", GovernorateViewSet, basename="governorate")
router.register(r"cities", CityViewSet, basename="city")
router.register(r"neighborhoods", NeighborhoodViewSet, basename="neighborhood")
router.register(r"listings", ListingViewSet, basename="listing")
router.register(r"questions", PublicQuestionViewSet, basename="question")
router.register(r"threads", PrivateThreadViewSet, basename="thread")
router.register(r"reports", ListingReportViewSet, basename="report")
router.register(r"user-reports", UserReportViewSet, basename="user-report")
router.register(r"blocks", UserBlockViewSet, basename="block")
router.register(r"favorites", ListingFavoriteViewSet, basename="favorite")
router.register(r"saved-searches", SavedSearchViewSet, basename="saved-search")
router.register(r"notifications", NotificationViewSet, basename="notification")

urlpatterns = [
    path("health/", HealthView.as_view(), name="v1-health"),
    path("admin/seed/", AdminSeedView.as_view(), name="v1-admin-seed"),
    path("admin/seed/jobs/<int:job_id>/", AdminSeedJobView.as_view(), name="v1-admin-seed-job"),
    path(
        "admin/users/shadow-banned/",
        AdminShadowBannedUsersView.as_view(),
        name="v1-admin-shadow-banned-users",
    ),
    path(
        "admin/users/<int:user_id>/shadow-ban/",
        AdminUserShadowBanView.as_view(),
        name="v1-admin-user-shadow-ban",
    ),
    path("auth/register/", RegisterView.as_view(), name="v1-register"),
    path("auth/token/", ThrottledTokenObtainPairView.as_view(), name="v1-token-obtain-pair"),
    path("auth/token/refresh/", ThrottledTokenRefreshView.as_view(), name="v1-token-refresh"),
    path("me/", MeView.as_view(), name="v1-me"),
    path("me/notification-preferences/", NotificationPreferenceMeView.as_view(), name="v1-me-notification-preferences"),
    path("users/<int:user_id>/profile/", UserProfileView.as_view(), name="v1-user-profile"),
    path("me/profile/", MeProfileView.as_view(), name="v1-me-profile"),
    path("me/profile/avatar/", AvatarUploadView.as_view(), name="v1-me-avatar"),
    path("me/profile/cover/", CoverUploadView.as_view(), name="v1-me-cover"),
    path("", include(router.urls)),
]
