from __future__ import annotations

import io
import time
import traceback

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import close_old_connections, transaction
from django.utils import timezone

from market.models import AdminSeedJob, AdminSeedJobStatus


class Command(BaseCommand):
    help = "Run queued admin seed jobs in the background (Render worker-friendly)."

    def add_arguments(self, parser):
        parser.add_argument("--once", action="store_true", help="Process at most one job, then exit")
        parser.add_argument("--poll-seconds", type=float, default=3.0, help="Sleep time when no jobs are pending")

    def handle(self, *args, **options):
        once = bool(options.get("once"))
        poll_seconds = float(options.get("poll_seconds") or 3.0)

        self.stdout.write(self.style.SUCCESS("Seed job worker started"))

        while True:
            close_old_connections()

            job = None
            with transaction.atomic():
                # Lock one pending job (skip if another worker took it).
                job = (
                    AdminSeedJob.objects.select_for_update(skip_locked=True)
                    .filter(status=AdminSeedJobStatus.PENDING)
                    .order_by("created_at", "id")
                    .first()
                )
                if job:
                    job.status = AdminSeedJobStatus.RUNNING
                    job.started_at = timezone.now()
                    job.error = ""
                    job.output = ""
                    job.save(update_fields=["status", "started_at", "error", "output", "updated_at"])

            if not job:
                if once:
                    return
                time.sleep(poll_seconds)
                continue

            buf = io.StringIO()
            try:
                scenario = str(job.scenario or "demo")
                opts = job.options or {}
                if not isinstance(opts, dict):
                    opts = {}

                # Run built-in demo seed synchronously.
                if scenario == "demo":
                    from market.seeding import run_admin_seed

                    res = run_admin_seed(scenario="demo", options=opts)
                    job.result = res.as_dict()
                elif scenario == "seed_listings":
                    # Heavy seed via management command (supports sleep_seconds in options).
                    call_command("seed_listings", stdout=buf, stderr=buf, **opts)
                    job.result = {"scenario": "seed_listings", "detail": "completed"}
                else:
                    raise ValueError(f"Unknown scenario: {scenario}")

                job.status = AdminSeedJobStatus.SUCCEEDED
            except Exception:
                job.status = AdminSeedJobStatus.FAILED
                job.error = traceback.format_exc()
            finally:
                job.output = (buf.getvalue() or "")[:200_000]
                job.finished_at = timezone.now()
                job.save(
                    update_fields=[
                        "status",
                        "finished_at",
                        "result",
                        "output",
                        "error",
                        "updated_at",
                    ]
                )

            if once:
                return
