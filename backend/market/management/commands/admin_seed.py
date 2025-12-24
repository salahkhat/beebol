from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError

from market.seeding import is_admin_seeding_enabled, run_admin_seed


class Command(BaseCommand):
    help = "Seed demo/dev data (admin-only, guarded by ADMIN_SEEDING_ENABLED)."

    def add_arguments(self, parser):
        parser.add_argument("--scenario", default="demo", help="Seed scenario (default: demo)")
        parser.add_argument("--listings-per-seller", type=int, default=12)
        parser.add_argument("--sellers", type=int, default=2)
        parser.add_argument("--buyers", type=int, default=1)
        parser.add_argument("--seed", type=int, default=1337)
        parser.add_argument(
            "--no-create-users",
            action="store_true",
            help="Do not create users; reuse existing non-staff users instead",
        )
        parser.add_argument(
            "--password",
            default=None,
            help="Optional: set a usable password for any newly created seed users",
        )

    def handle(self, *args, **options):
        if not is_admin_seeding_enabled():
            raise CommandError("Admin seeding is disabled. Set ADMIN_SEEDING_ENABLED=true (or run with DEBUG=true).")

        scenario = options.get("scenario")
        result = run_admin_seed(
            scenario=scenario,
            options={
                "listings_per_seller": options.get("listings_per_seller"),
                "sellers": options.get("sellers"),
                "buyers": options.get("buyers"),
                "seed": options.get("seed"),
                "create_users": not bool(options.get("no_create_users")),
                "password": options.get("password"),
            },
        )

        self.stdout.write(self.style.SUCCESS("Seeding complete"))
        self.stdout.write(str(result.as_dict()))
