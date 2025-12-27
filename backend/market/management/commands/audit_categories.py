from __future__ import annotations

import re
from collections import Counter

from django.core.management.base import BaseCommand
from django.db.models import Count

from market.models import Category, CategoryAttributeDefinition


class Command(BaseCommand):
    help = "Audit category taxonomy and attribute coverage."

    def add_arguments(self, parser):
        parser.add_argument("--show-suspect", type=int, default=30, help="Show up to N suspect categories")

    def handle(self, *args, **options):
        show_suspect = int(options.get("show_suspect") or 0)

        cats = Category.objects.all()
        total = cats.count()
        top_level = cats.filter(parent__isnull=True).count()
        leaf = cats.annotate(ch=Count("children")).filter(ch=0).count()
        defs_total = CategoryAttributeDefinition.objects.count()

        self.stdout.write(f"categories_total={total}")
        self.stdout.write(f"top_level={top_level}")
        self.stdout.write(f"leaf={leaf}")
        self.stdout.write(f"attribute_defs_total={defs_total}")

        # Depth distribution
        def depth(c: Category) -> int:
            d = 0
            cur = c
            seen = set()
            while cur.parent_id:
                if cur.id in seen:
                    break
                seen.add(cur.id)
                d += 1
                cur = cur.parent  # type: ignore[assignment]
                if d > 20:
                    break
            return d

        ctr = Counter()
        for c in cats.select_related("parent"):
            ctr[depth(c)] += 1
        self.stdout.write(f"depth_counts={dict(sorted(ctr.items()))}")

        # “Suspect” labels: Arabic name equals English, or Arabic is ASCII-only.
        latin = re.compile(r"^[\x00-\x7F]+$")
        suspects = []
        for c in cats.iterator():
            ar = (c.name_ar or "").strip()
            en = (c.name_en or "").strip()
            if not ar:
                continue
            if en and ar == en:
                suspects.append(c)
            elif latin.match(ar):
                suspects.append(c)

        self.stdout.write(f"suspect_labels={len(suspects)}")
        if show_suspect > 0 and suspects:
            self.stdout.write("suspect_examples=")
            for c in suspects[:show_suspect]:
                parent_slug = c.parent.slug if c.parent_id else None
                self.stdout.write(f"- {c.slug} parent={parent_slug} ar={c.name_ar} en={c.name_en}")

        # Attribute coverage by category
        self.stdout.write("top_categories_by_attr_defs=")
        for row in (
            CategoryAttributeDefinition.objects.values("category__slug")
            .annotate(n=Count("id"))
            .order_by("-n", "category__slug")[:25]
        ):
            self.stdout.write(f"- {row['category__slug']}: {row['n']}")
