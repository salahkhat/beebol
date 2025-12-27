from __future__ import annotations

from django.db import migrations


def prune_unused_top_level_categories(apps, schema_editor):
    Category = apps.get_model("market", "Category")
    Listing = apps.get_model("market", "Listing")
    CategoryAttributeDefinition = apps.get_model("market", "CategoryAttributeDefinition")

    # Top-level categories.
    top = Category.objects.filter(parent__isnull=True)

    # Category IDs with children, listings, or attribute defs.
    with_children = set(Category.objects.filter(parent__isnull=False).values_list("parent_id", flat=True))
    with_listings = set(Listing.objects.values_list("category_id", flat=True))
    with_attrs = set(CategoryAttributeDefinition.objects.values_list("category_id", flat=True))

    to_delete = []
    for c in top.iterator():
        if c.id in with_children:
            continue
        if c.id in with_listings:
            continue
        if c.id in with_attrs:
            continue
        to_delete.append(c.id)

    if not to_delete:
        return

    # Extra safety: if any listings exist (unexpected), reassign to "general" if present.
    general = Category.objects.filter(slug="general", parent__isnull=True).first()
    if general:
        Listing.objects.filter(category_id__in=to_delete).update(category_id=general.id)

    Category.objects.filter(id__in=to_delete).delete()


def unprune_unused_top_level_categories(apps, schema_editor):
    # Intentionally non-reversible.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("market", "0009_prune_unused_depth1_categories"),
    ]

    operations = [
        migrations.RunPython(prune_unused_top_level_categories, unprune_unused_top_level_categories),
    ]
