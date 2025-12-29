from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import (
    AdminSeedView,
    AdminSeedJobView,
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

urlpatterns = [
    path("health/", HealthView.as_view(), name="v1-health"),
    path("admin/seed/", AdminSeedView.as_view(), name="v1-admin-seed"),
    path("admin/seed/jobs/<int:job_id>/", AdminSeedJobView.as_view(), name="v1-admin-seed-job"),
    path("auth/register/", RegisterView.as_view(), name="v1-register"),
    path("auth/token/", TokenObtainPairView.as_view(), name="v1-token-obtain-pair"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="v1-token-refresh"),
    path("me/", MeView.as_view(), name="v1-me"),
    path("", include(router.urls)),
]
