from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .health_checks import build_health_payload


@api_view(["GET"])
def health(request):
    payload, ok = build_health_payload()
    return Response(payload, status=status.HTTP_200_OK if ok else status.HTTP_503_SERVICE_UNAVAILABLE)
