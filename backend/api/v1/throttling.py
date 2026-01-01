from rest_framework.throttling import ScopedRateThrottle


class MethodScopedRateThrottle(ScopedRateThrottle):
    """Scoped throttle that can pick a scope based on HTTP method.

    Views can define:
      throttle_scope_map = {"POST": "write", "PATCH": "write"}

    If no scope matches, throttling is skipped for this throttle instance.
    """

    def allow_request(self, request, view):
        scope_map = getattr(view, "throttle_scope_map", None)
        if not isinstance(scope_map, dict):
            return True

        scope = scope_map.get(str(request.method).upper())
        if not scope:
            return True

        # ScopedRateThrottle reads `view.throttle_scope`.
        setattr(view, "throttle_scope", scope)
        return super().allow_request(request, view)
