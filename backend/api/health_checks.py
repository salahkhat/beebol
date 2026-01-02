from __future__ import annotations

import os

from dataclasses import dataclass

from django.core.files.storage import default_storage
from django.db import connections


def _env_truthy(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return str(raw).strip().lower() in {"1", "true", "yes", "y", "on"}


@dataclass(frozen=True)
class HealthStatus:
    ok: bool
    payload: dict


def _check_db() -> HealthStatus:
    try:
        with connections["default"].cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        return HealthStatus(ok=True, payload={"ok": True})
    except Exception as exc:
        return HealthStatus(ok=False, payload={"ok": False, "error": str(exc)})


def _check_migrations() -> HealthStatus:
    # This can be moderately expensive on large projects; keep it opt-in.
    try:
        from django.db.migrations.executor import MigrationExecutor

        executor = MigrationExecutor(connections["default"])
        targets = executor.loader.graph.leaf_nodes()
        plan = executor.migration_plan(targets)
        pending = len(plan)
        return HealthStatus(ok=pending == 0, payload={"ok": pending == 0, "pending": pending})
    except Exception as exc:
        return HealthStatus(ok=False, payload={"ok": False, "error": str(exc)})


def _check_storage() -> HealthStatus:
    # Keep it very lightweight: ensure the storage backend can be instantiated and responds.
    # For remote backends, even a list/exists call can be slow or require credentials, so keep it opt-in.
    try:
        _ = default_storage
        return HealthStatus(ok=True, payload={"ok": True, "backend": f"{default_storage.__class__.__module__}.{default_storage.__class__.__name__}"})
    except Exception as exc:
        return HealthStatus(ok=False, payload={"ok": False, "error": str(exc)})


def build_health_payload() -> tuple[dict, bool]:
    """Return (payload, overall_ok)."""

    db = _check_db()

    payload: dict = {
        "status": "ok" if db.ok else "degraded",
        "db": db.payload,
    }

    overall_ok = db.ok

    if _env_truthy("HEALTH_CHECK_MIGRATIONS", default=False):
        migrations = _check_migrations()
        payload["migrations"] = migrations.payload
        overall_ok = overall_ok and migrations.ok
    else:
        payload["migrations"] = {"skipped": True}

    if _env_truthy("HEALTH_CHECK_STORAGE", default=False):
        storage = _check_storage()
        payload["storage"] = storage.payload
        overall_ok = overall_ok and storage.ok
    else:
        payload["storage"] = {"skipped": True}

    payload["status"] = "ok" if overall_ok else "degraded"

    return payload, overall_ok
