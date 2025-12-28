from __future__ import annotations

import io
import random
from dataclasses import dataclass
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from market.models import (
    Category,
    CategoryAttributeDefinition,
    CategoryAttributeType,
    City,
    Governorate,
    Listing,
    ListingAttributeValue,
    ListingImage,
    ListingStatus,
    ModerationStatus,
    Neighborhood,
)
from market.seeding import ensure_minimum_lookups, is_admin_seeding_enabled

User = get_user_model()


@dataclass
class SeedCounts:
    created: dict[str, int]
    updated: dict[str, int]
    skipped: dict[str, int]

    def inc(self, bucket: str, key: str, n: int = 1) -> None:
        target = getattr(self, bucket)
        target[key] = int(target.get(key, 0)) + int(n)


def _safe_slug(s: str) -> str:
    s = (s or "").strip().lower()
    out = []
    for ch in s:
        if ch.isalnum() or ch in {"-", "_"}:
            out.append(ch)
        elif ch.isspace():
            out.append("_")
    return "".join(out)[:80] or "x"


def _effective_attr_defs(category: Category) -> list[CategoryAttributeDefinition]:
    ancestor_ids = category.ancestor_ids_including_self()
    if not ancestor_ids:
        return []

    order = list(reversed(ancestor_ids))
    pos = {cid: idx for idx, cid in enumerate(order)}

    defs = list(CategoryAttributeDefinition.objects.filter(category_id__in=ancestor_ids))
    defs.sort(key=lambda d: (pos.get(d.category_id, 10_000), d.sort_order, d.key))

    by_key: dict[str, CategoryAttributeDefinition] = {}
    for d in defs:
        by_key[d.key] = d

    out = list(by_key.values())
    out.sort(key=lambda d: (d.sort_order, d.key))
    return out


def _pick_location(rnd: random.Random) -> tuple[Governorate, City, Neighborhood | None]:
    govs = list(Governorate.objects.all())
    if not govs:
        raise ValueError("No governorates available")

    gov = rnd.choice(govs)
    cities = list(City.objects.filter(governorate=gov))
    if not cities:
        cities = list(City.objects.all())
    city = rnd.choice(cities)

    nbs = list(Neighborhood.objects.filter(city=city))
    neighborhood = rnd.choice(nbs) if nbs and rnd.random() < 0.8 else None

    return gov, city, neighborhood


def _pick_syria_lat_lng(rnd: random.Random) -> tuple[Decimal, Decimal]:
    # Rough Syria bounding box.
    # Latitude: 32.3 .. 37.3
    # Longitude: 35.7 .. 42.4
    lat = Decimal(str(rnd.uniform(32.3, 37.3))).quantize(Decimal("0.000001"))
    lng = Decimal(str(rnd.uniform(35.7, 42.4))).quantize(Decimal("0.000001"))
    return lat, lng


def _gen_attr_value(defn: CategoryAttributeDefinition, rnd: random.Random):
    key = str(defn.key or "").strip().lower()
    t = defn.type

    if t == CategoryAttributeType.BOOL:
        if key == "show_phone":
            return True
        if key == "price_on_inquiry":
            return rnd.random() < 0.15
        return rnd.random() < 0.5

    if t == CategoryAttributeType.ENUM:
        choices = defn.choices or []
        if isinstance(choices, list) and choices:
            return rnd.choice(choices)
        return ""

    if t == CategoryAttributeType.INT:
        if "year" in key:
            return rnd.randint(1998, 2025)
        if "bed" in key:
            return rnd.randint(0, 6)
        if "bath" in key:
            return rnd.randint(0, 5)
        if key.endswith("_gb"):
            return rnd.choice([2, 4, 8, 16, 32, 64, 128])
        if key.endswith("_mah"):
            return rnd.choice([2000, 3000, 4000, 5000, 6000])
        if "doors" in key:
            return rnd.choice([2, 3, 4, 5])
        if "seats" in key:
            return rnd.choice([2, 4, 5, 7, 9, 12, 18, 30, 50])
        if "area" in key:
            return rnd.randint(20, 1200)
        return rnd.randint(1, 100)

    if t == CategoryAttributeType.DECIMAL:
        if "engine" in key:
            return Decimal(str(round(rnd.uniform(0.8, 6.5), 1)))
        if "area" in key:
            return Decimal(str(round(rnd.uniform(20, 900), 1)))
        return Decimal(str(round(rnd.uniform(1, 999), 2)))

    # TEXT
    samples = [
        "Excellent",
        "Good",
        "Like new",
        "Used",
        "Original",
        "Imported",
        "Limited edition",
        "With box",
        "Under warranty",
    ]
    if "color" in key:
        return rnd.choice(["Black", "White", "Silver", "Gold", "Blue", "Red", "Green"])
    if "material" in key:
        return rnd.choice(["Wood", "Metal", "Plastic", "Leather", "Fabric"])
    if "brand" in key or "make" in key:
        return rnd.choice(["Samsung", "Apple", "Xiaomi", "Toyota", "Hyundai", "Sony", "HP", "Dell"])
    if "model" in key:
        return rnd.choice(["A1", "X Pro", "2020", "S", "GT", "Plus"])
    return rnd.choice(samples)


def _set_attr_value(listing: Listing, defn: CategoryAttributeDefinition, value, counts: SeedCounts) -> None:
    if value in (None, ""):
        return

    defaults = {
        "int_value": None,
        "decimal_value": None,
        "text_value": None,
        "bool_value": None,
        "enum_value": None,
    }

    if defn.type == CategoryAttributeType.INT:
        defaults["int_value"] = int(value)
    elif defn.type == CategoryAttributeType.DECIMAL:
        defaults["decimal_value"] = Decimal(str(value))
    elif defn.type == CategoryAttributeType.BOOL:
        defaults["bool_value"] = bool(value)
    elif defn.type == CategoryAttributeType.ENUM:
        defaults["enum_value"] = str(value)
    else:
        defaults["text_value"] = str(value)

    obj, created = ListingAttributeValue.objects.update_or_create(
        listing=listing,
        definition=defn,
        defaults=defaults,
    )

    counts.inc("created" if created else "updated", "attribute_values")


def _render_seed_image(*, text: str, seed: int, width: int = 1200, height: int = 900) -> bytes:
    # Pillow is already installed in this repo's venv (ImageField usage).
    from PIL import Image, ImageDraw

    rnd = random.Random(seed)

    bg = (rnd.randint(10, 40), rnd.randint(40, 80), rnd.randint(60, 110))
    fg = (245, 245, 245)
    accent = (rnd.randint(160, 220), rnd.randint(120, 210), rnd.randint(80, 180))

    img = Image.new("RGB", (width, height), bg)
    draw = ImageDraw.Draw(img)

    # Simple geometric accents (no external fonts needed).
    pad = 40
    draw.rounded_rectangle([pad, pad, width - pad, height - pad], radius=40, outline=accent, width=8)
    draw.rectangle([pad, height - 160, width - pad, height - pad], fill=(0, 0, 0, 120))

    # Basic text (default PIL bitmap font).
    lines = [ln.strip() for ln in (text or "").split("\n") if ln.strip()]
    if not lines:
        lines = ["Beebol"]

    y = height - 150
    for ln in lines[:3]:
        draw.text((pad + 20, y), ln, fill=fg)
        y += 28

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


class Command(BaseCommand):
    help = "Seed lots of listings across all leaf categories (optionally with images + attribute values)."

    def add_arguments(self, parser):
        parser.add_argument("--per-category", type=int, default=15, help="Listings per leaf category (default: 15)")
        parser.add_argument("--max-categories", type=int, default=0, help="Limit number of categories (0 = all)")
        parser.add_argument("--sellers", type=int, default=4, help="Number of seed sellers to create/use")
        parser.add_argument("--seed", type=int, default=1337, help="RNG seed")
        parser.add_argument("--images-per-listing", type=int, default=2, help="Images per listing (default: 2)")
        parser.add_argument(
            "--no-images",
            action="store_true",
            help="Do not attach images",
        )
        parser.add_argument(
            "--no-attributes",
            action="store_true",
            help="Do not generate attribute values",
        )
        parser.add_argument(
            "--status",
            default="published",
            choices=["draft", "published", "archived"],
            help="Listing status for seeded listings (default: published)",
        )
        parser.add_argument(
            "--moderation",
            default="approved",
            choices=["pending", "approved", "rejected"],
            help="Moderation status for seeded listings (default: approved)",
        )

    def handle(self, *args, **options):
        if not is_admin_seeding_enabled():
            raise CommandError("Seeding is disabled. Set ADMIN_SEEDING_ENABLED=true (or run with DEBUG=true).")

        per_category = max(0, int(options.get("per_category") or 0))
        max_categories = int(options.get("max_categories") or 0)
        sellers = max(1, int(options.get("sellers") or 1))
        seed = int(options.get("seed") or 1337)
        images_per_listing = max(0, int(options.get("images_per_listing") or 0))
        no_images = bool(options.get("no_images"))
        no_attributes = bool(options.get("no_attributes"))

        status = str(options.get("status") or "published")
        moderation = str(options.get("moderation") or "approved")

        status_choice = {
            "draft": ListingStatus.DRAFT,
            "published": ListingStatus.PUBLISHED,
            "archived": ListingStatus.ARCHIVED,
        }[status]

        moderation_choice = {
            "pending": ModerationStatus.PENDING,
            "approved": ModerationStatus.APPROVED,
            "rejected": ModerationStatus.REJECTED,
        }[moderation]

        rnd = random.Random(seed)

        counts = SeedCounts(created={}, updated={}, skipped={})

        with transaction.atomic():
            ensure_minimum_lookups(created=counts.created, updated=counts.updated, skipped=counts.skipped)

            # Sellers
            seller_users = []
            for i in range(1, sellers + 1):
                username = f"seed_seller_tax_{i}"
                u, created = User.objects.get_or_create(
                    username=username,
                    defaults={"email": f"{username}@example.com", "is_staff": False},
                )
                if created:
                    u.set_unusable_password()
                    u.save(update_fields=["password"])
                counts.inc("created" if created else "skipped", "users")
                seller_users.append(u)

            # Leaf categories (cover everything the UI can post to)
            all_cats = list(Category.objects.all().order_by("slug"))
            children = set(Category.objects.exclude(parent_id=None).values_list("parent_id", flat=True))
            leaf_cats = [c for c in all_cats if c.id not in children]

            if max_categories and max_categories > 0:
                leaf_cats = leaf_cats[: max_categories]

            if not leaf_cats:
                raise CommandError("No leaf categories found to seed listings")

            adjectives = ["Great", "Clean", "Original", "New", "Used", "Premium", "Budget", "Limited"]
            selling_lines = [
                "Fast sale.",
                "Serious buyers only.",
                "Delivery available.",
                "Negotiable.",
                "Test before you buy.",
                "In good condition.",
            ]

            for cat_idx, cat in enumerate(leaf_cats):
                for n in range(1, per_category + 1):
                    seller = seller_users[(cat_idx + n) % len(seller_users)]

                    adj = rnd.choice(adjectives)
                    base_name = (cat.name_en or cat.name_ar or cat.slug).strip()
                    title = f"{adj} {base_name} #{n:02d}"

                    gov, city, neighborhood = _pick_location(rnd)
                    lat, lng = _pick_syria_lat_lng(rnd)

                    # Defaults for a newly created listing; existing ones get updated lightly.
                    defaults = {
                        "description": " ".join(["Seeded listing for testing.", rnd.choice(selling_lines)]),
                        "price": Decimal(rnd.randint(10_000, 2_500_000)),
                        "currency": "SYP",
                        "category": cat,
                        "governorate": gov,
                        "city": city,
                        "neighborhood": neighborhood,
                        "latitude": lat,
                        "longitude": lng,
                        "status": status_choice,
                        "moderation_status": moderation_choice,
                        "is_flagged": False,
                        "is_removed": False,
                    }

                    listing, created = Listing.objects.get_or_create(seller=seller, title=title, defaults=defaults)
                    if created:
                        counts.inc("created", "listings")
                    else:
                        changed = False
                        for k, v in defaults.items():
                            if getattr(listing, k) != v:
                                setattr(listing, k, v)
                                changed = True
                        if changed:
                            listing.save()
                            counts.inc("updated", "listings")
                        else:
                            counts.inc("skipped", "listings")

                    # Attributes
                    price_on_inquiry = False
                    if not no_attributes:
                        defs = _effective_attr_defs(cat)
                        for d in defs:
                            val = _gen_attr_value(d, rnd)
                            if d.key == "price_on_inquiry":
                                price_on_inquiry = bool(val)
                            _set_attr_value(listing, d, val, counts)

                    # If price is on inquiry, store price as NULL (model supports it).
                    if price_on_inquiry and listing.price is not None:
                        listing.price = None
                        listing.save(update_fields=["price"])
                        counts.inc("updated", "listings")
                    elif not price_on_inquiry and listing.price is None:
                        listing.price = Decimal(rnd.randint(10_000, 2_500_000))
                        listing.save(update_fields=["price"])
                        counts.inc("updated", "listings")

                    # Sometimes make things free (price=0) so the UI gets coverage.
                    if not price_on_inquiry and listing.price is not None and rnd.random() < 0.05:
                        listing.price = Decimal("0")
                        listing.save(update_fields=["price"])
                        counts.inc("updated", "listings")

                    # Images
                    if not no_images and images_per_listing > 0:
                        existing_count = listing.images.count()
                        needed = max(0, images_per_listing - existing_count)
                        for img_i in range(existing_count, existing_count + needed):
                            label = f"{cat.slug}\n{title}"
                            png = _render_seed_image(text=label, seed=seed + (listing.id * 31) + img_i)
                            filename = f"seed_{_safe_slug(cat.slug)}_{listing.id}_{img_i + 1}.png"
                            cf = ContentFile(png, name=filename)
                            ListingImage.objects.create(
                                listing=listing,
                                image=cf,
                                alt_text=title,
                                sort_order=img_i,
                            )
                            counts.inc("created", "images")
                    else:
                        counts.inc("skipped", "images")

        self.stdout.write(self.style.SUCCESS("Listing seeding complete"))
        self.stdout.write(f"MEDIA_ROOT: {getattr(settings, 'MEDIA_ROOT', None)}")
        self.stdout.write(f"Leaf categories targeted: {len(leaf_cats)}")
        self.stdout.write(str({"created": counts.created, "updated": counts.updated, "skipped": counts.skipped}))
