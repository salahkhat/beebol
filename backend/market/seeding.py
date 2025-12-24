from __future__ import annotations

from dataclasses import dataclass
from typing import Any
import random

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from market.models import Category, City, Governorate, Listing, ListingStatus, ModerationStatus, Neighborhood
from messaging.models import PrivateMessage, PrivateThread, PublicQuestion
from reports.models import ListingReport, ReportStatus


User = get_user_model()


@dataclass
class SeedResult:
    scenario: str
    created: dict[str, int]
    updated: dict[str, int]
    skipped: dict[str, int]

    def as_dict(self) -> dict[str, Any]:
        return {
            "scenario": self.scenario,
            "created": self.created,
            "updated": self.updated,
            "skipped": self.skipped,
        }


def _inc(d: dict[str, int], key: str, n: int = 1) -> None:
    d[key] = int(d.get(key, 0)) + int(n)


def ensure_minimum_lookups(*, created: dict[str, int], updated: dict[str, int], skipped: dict[str, int]) -> tuple[Category, Governorate, City, Neighborhood | None]:
    """Ensure the app has at least one category and a basic location chain.

    NOTE: Your migrations already seed Syria locations + categories; this is just a
    safe fallback for empty/new DBs.
    """

    cat, cat_created = Category.objects.get_or_create(
        slug="general",
        defaults={"name_ar": "عام", "name_en": "General", "parent": None},
    )
    _inc(created if cat_created else skipped, "categories")

    gov, gov_created = Governorate.objects.get_or_create(
        slug="damascus",
        defaults={"name_ar": "دمشق", "name_en": "Damascus"},
    )
    _inc(created if gov_created else skipped, "governorates")

    city, city_created = City.objects.get_or_create(
        governorate=gov,
        slug="damascus",
        defaults={"name_ar": "دمشق", "name_en": "Damascus"},
    )
    _inc(created if city_created else skipped, "cities")

    nb, nb_created = Neighborhood.objects.get_or_create(
        city=city,
        slug="center",
        defaults={"name_ar": "المركز", "name_en": "Center"},
    )
    _inc(created if nb_created else skipped, "neighborhoods")

    return cat, gov, city, nb


def seed_demo_data(
    *,
    listings_per_seller: int = 12,
    sellers: int = 2,
    buyers: int = 1,
    rng_seed: int | None = 1337,
    create_users: bool = True,
    set_usable_password: str | None = None,
) -> SeedResult:
    """Seed a small, visible dataset for local/dev/staging.

    Designed to be idempotent-ish by using deterministic usernames and titles.
    """

    rnd = random.Random(rng_seed)

    created: dict[str, int] = {}
    updated: dict[str, int] = {}
    skipped: dict[str, int] = {}

    with transaction.atomic():
        category, gov, city, neighborhood = ensure_minimum_lookups(created=created, updated=updated, skipped=skipped)

        seller_users: list[Any] = []
        buyer_users: list[Any] = []

        if create_users:
            for i in range(1, int(sellers) + 1):
                username = f"seed_seller_{i}"
                u, is_created = User.objects.get_or_create(
                    username=username,
                    defaults={"email": f"{username}@example.com", "is_staff": False},
                )
                if is_created:
                    if set_usable_password:
                        u.set_password(set_usable_password)
                    else:
                        u.set_unusable_password()
                    u.save(update_fields=["password"])
                    _inc(created, "users")
                else:
                    _inc(skipped, "users")
                seller_users.append(u)

            for i in range(1, int(buyers) + 1):
                username = f"seed_buyer_{i}"
                u, is_created = User.objects.get_or_create(
                    username=username,
                    defaults={"email": f"{username}@example.com", "is_staff": False},
                )
                if is_created:
                    if set_usable_password:
                        u.set_password(set_usable_password)
                    else:
                        u.set_unusable_password()
                    u.save(update_fields=["password"])
                    _inc(created, "users")
                else:
                    _inc(skipped, "users")
                buyer_users.append(u)
        else:
            seller_users = list(User.objects.filter(is_staff=False).order_by("id")[: max(1, int(sellers))])
            buyer_users = list(User.objects.filter(is_staff=False).order_by("-id")[: max(1, int(buyers))])

        if not seller_users or not buyer_users:
            # Fail fast: seeding listings/messages without principals isn't useful.
            raise ValueError("Unable to seed demo data: no suitable seller/buyer users available")

        # Listings + questions/threads/reports.
        for seller_idx, seller in enumerate(seller_users, start=1):
            for n in range(1, int(listings_per_seller) + 1):
                title = f"Seed Listing {seller_idx:02d}-{n:03d}"
                defaults = {
                    "description": "Seeded demo listing. You can delete these safely.",
                    "price": rnd.randint(10_000, 900_000),
                    "currency": "SYP",
                    "category": category,
                    "governorate": gov,
                    "city": city,
                    "neighborhood": neighborhood,
                    "status": ListingStatus.PUBLISHED,
                    "moderation_status": ModerationStatus.APPROVED,
                    "is_flagged": False,
                    "is_removed": False,
                }

                listing, is_created = Listing.objects.get_or_create(seller=seller, title=title, defaults=defaults)
                if is_created:
                    _inc(created, "listings")
                else:
                    # Keep key fields aligned so the seeded data remains visible.
                    changed = False
                    for k, v in defaults.items():
                        if getattr(listing, k) != v:
                            setattr(listing, k, v)
                            changed = True
                    if changed:
                        listing.save()
                        _inc(updated, "listings")
                    else:
                        _inc(skipped, "listings")

                buyer = buyer_users[(n - 1) % len(buyer_users)]

                q_text = "Is this still available?"
                q, q_created = PublicQuestion.objects.get_or_create(
                    listing=listing,
                    author=buyer,
                    question=q_text,
                    defaults={
                        "answer": "Yes, available.",
                        "answered_by": seller,
                        "answered_at": timezone.now(),
                    },
                )
                _inc(created if q_created else skipped, "questions")

                thread, thread_created = PrivateThread.objects.get_or_create(
                    listing=listing,
                    buyer=buyer,
                    defaults={"seller": seller},
                )
                _inc(created if thread_created else skipped, "threads")

                # Ensure at least 2 messages exist.
                if not thread.messages.exists():
                    PrivateMessage.objects.create(thread=thread, sender=buyer, body="Hi! Is this negotiable?")
                    PrivateMessage.objects.create(thread=thread, sender=seller, body="A little, yes.")
                    _inc(created, "messages", 2)
                else:
                    _inc(skipped, "messages")

                # Create a small number of reports.
                if n % 6 == 0:
                    rep, rep_created = ListingReport.objects.get_or_create(
                        listing=listing,
                        reporter=buyer,
                        reason="spam",
                        defaults={"message": "Seeded report for moderation testing", "status": ReportStatus.OPEN},
                    )
                    _inc(created if rep_created else skipped, "reports")

    return SeedResult(scenario="demo", created=created, updated=updated, skipped=skipped)


def run_admin_seed(*, scenario: str, options: dict[str, Any] | None = None) -> SeedResult:
    options = options or {}
    scenario = (scenario or "").strip().lower()

    if scenario in {"demo", "dev", "development"}:
        return seed_demo_data(
            listings_per_seller=int(options.get("listings_per_seller", 12)),
            sellers=int(options.get("sellers", 2)),
            buyers=int(options.get("buyers", 1)),
            rng_seed=options.get("seed", 1337),
            create_users=bool(options.get("create_users", True)),
            set_usable_password=options.get("password"),
        )

    raise ValueError(f"Unknown scenario: {scenario}")


def is_admin_seeding_enabled() -> bool:
    # Default safe behavior: allow in DEBUG only unless explicitly enabled.
    enabled = getattr(settings, "ADMIN_SEEDING_ENABLED", None)
    if enabled is None:
        return bool(getattr(settings, "DEBUG", False))
    return bool(enabled)
