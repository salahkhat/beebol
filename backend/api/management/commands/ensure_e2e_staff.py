from __future__ import annotations

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Ensure an E2E staff user exists (idempotent)."

    def add_arguments(self, parser):
        parser.add_argument("--username", default="e2e_staff")
        parser.add_argument("--password", default="e2e_staff_pass")

    def handle(self, *args, **options):
        username = str(options.get("username") or "e2e_staff").strip()
        password = str(options.get("password") or "e2e_staff_pass")

        User = get_user_model()
        user, created = User.objects.get_or_create(username=username, defaults={"is_staff": True, "is_superuser": True})

        changed = False
        if not user.is_staff:
            user.is_staff = True
            changed = True
        if not getattr(user, "is_superuser", False):
            user.is_superuser = True
            changed = True

        # Always set a usable password to keep CI/local runs predictable.
        user.set_password(password)
        changed = True

        if changed:
            user.save()

        self.stdout.write(
            self.style.SUCCESS(
                f"E2E staff user ready: username={username} (created={created})"
            )
        )
