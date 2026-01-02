import logging
import time
import uuid


def _get_client_ip(request) -> str | None:
    # Prefer X-Forwarded-For when behind a proxy (e.g., Render).
    # We do not validate proxy trust here; this is best-effort for logging only.
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        # XFF format: client, proxy1, proxy2
        ip = str(xff).split(",")[0].strip()
        return ip or None
    ip = request.META.get("REMOTE_ADDR")
    return str(ip).strip() if ip else None


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

        # Best-effort: ensure API error responses include request correlation fields
        # even when views return Response(...) directly (bypassing DRF exception handler).
        try:
            status_code = getattr(response, "status_code", None)
            if status_code is not None and int(status_code) >= 400 and request.path.startswith("/api/"):
                data = getattr(response, "data", None)
                if isinstance(data, dict):
                    if request_id and "request_id" not in data:
                        data["request_id"] = request_id

                    if "detail" in data and "error" not in data:
                        try:
                            data["error"] = {"message": str(data.get("detail"))}
                        except Exception:
                            pass
        except Exception:
            # Never fail requests due to logging/envelope logic.
            pass

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

            view_name = None
            route = None
            try:
                match = getattr(request, "resolver_match", None)
                if match is not None:
                    view_name = getattr(match, "view_name", None)
                    route = getattr(match, "route", None)
            except Exception:
                view_name = None
                route = None

            client_ip = None
            try:
                client_ip = _get_client_ip(request)
            except Exception:
                client_ip = None

            logger.info(
                "request",
                extra={
                    "request_id": request_id,
                    "user_id": user_id,
                    "client_ip": client_ip,
                    "method": request.method,
                    "path": request.path,
                    "view": view_name,
                    "route": route,
                    "status_code": getattr(response, "status_code", None),
                    "duration_ms": round(duration_ms, 2),
                },
            )

        return response
