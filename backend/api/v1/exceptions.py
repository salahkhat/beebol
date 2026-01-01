from __future__ import annotations

from typing import Any

from rest_framework.views import exception_handler as drf_exception_handler


def api_exception_handler(exc: Exception, context: dict[str, Any]):
    """DRF exception handler that adds request correlation without breaking clients.

    This keeps DRF's default error shapes, but:
    - Adds `request_id` to dict-based error responses when available.
    - Adds a lightweight `error` object for common `detail` errors (additive).
    """

    response = drf_exception_handler(exc, context)
    if response is None:
        return None

    request = context.get("request")
    request_id = getattr(request, "request_id", None)

    data = getattr(response, "data", None)

    if isinstance(data, dict) and request_id and "request_id" not in data:
        data["request_id"] = request_id

    if isinstance(data, dict) and "detail" in data and "error" not in data:
        try:
            message = data.get("detail")
            data["error"] = {"message": str(message)}

            code = getattr(exc, "default_code", None)
            if code:
                data["error"]["code"] = str(code)
        except Exception:
            # Never fail the error handler.
            pass

    return response
