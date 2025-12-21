from django.urls import include, path

from .views import health

urlpatterns = [
    path("health/", health, name="health"),
    path("v1/", include("api.v1.urls")),
]
