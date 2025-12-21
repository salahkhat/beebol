from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import (
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
)

router = DefaultRouter()
router.register(r"categories", CategoryViewSet, basename="category")
router.register(r"governorates", GovernorateViewSet, basename="governorate")
router.register(r"cities", CityViewSet, basename="city")
router.register(r"neighborhoods", NeighborhoodViewSet, basename="neighborhood")
router.register(r"listings", ListingViewSet, basename="listing")
router.register(r"questions", PublicQuestionViewSet, basename="question")
router.register(r"threads", PrivateThreadViewSet, basename="thread")

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("me/", MeView.as_view(), name="me"),
    path("", include(router.urls)),
]
