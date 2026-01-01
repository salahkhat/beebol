import logging
import time
import uuid


logger = logging.getLogger("beebol.request")


class RequestIdAndLoggingMiddleware:
    """Attach a request id to each request and log API requests with useful fields.

    - Accepts an incoming X-Request-ID if provided.
    - Always emits X-Request-ID in the response.
    - Logs API requests (path starting with /api/) with request_id, user_id, status_code, duration_ms.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start = time.perf_counter()

        request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex
        request.request_id = request_id

        response = self.get_response(request)

        duration_ms = (time.perf_counter() - start) * 1000.0

        try:
            response["X-Request-ID"] = request_id
        except Exception:
            # Some streaming responses may not behave like a dict.
            pass

        if request.path.startswith("/api/"):
            user_id = None
            try:
                if getattr(request, "user", None) is not None and request.user.is_authenticated:
                    user_id = request.user.id
            except Exception:
                user_id = None

            logger.info(
                "request",
                extra={
                    "request_id": request_id,
                    "user_id": user_id,
                    "method": request.method,
                    "path": request.path,
                    "status_code": getattr(response, "status_code", None),
                    "duration_ms": round(duration_ms, 2),
                },
            )

        return response
