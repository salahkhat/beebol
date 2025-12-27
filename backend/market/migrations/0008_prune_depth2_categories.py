from __future__ import annotations

from django.db import migrations


def prune_depth2_categories(apps, schema_editor):
    Category = apps.get_model("market", "Category")
    Listing = apps.get_model("market", "Listing")

    # Delete only depth>=2 nodes (grandchildren): parent and grandparent exist.
    depth2_qs = Category.objects.filter(parent__isnull=False, parent__parent__isnull=False).select_related("parent")

    # Reassign listings pointing to depth2 nodes to their parent (depth1).
    # Do this before deletion because Listing.category is PROTECT.
    mapping = {}
    for c in depth2_qs.iterator():
        if c.parent_id:
            mapping[c.id] = c.parent_id

    if mapping:
        # Bulk update in batches using CASE
        from django.db.models import Case, IntegerField, Value, When

        ids = list(mapping.keys())
        CHUNK = 500
        for i in range(0, len(ids), CHUNK):
            chunk = ids[i : i + CHUNK]
            whens = [When(category_id=cid, then=Value(mapping[cid])) for cid in chunk]
            Listing.objects.filter(category_id__in=chunk).update(category_id=Case(*whens, output_field=IntegerField()))

    # Now delete depth2 categories. This will cascade-delete any attribute definitions under them.
    Category.objects.filter(id__in=list(mapping.keys())).delete()


def unprune_depth2_categories(apps, schema_editor):
    # Intentionally non-reversible: destructive cleanup.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("market", "0007_more_category_attribute_definitions"),
    ]

    operations = [
        migrations.RunPython(prune_depth2_categories, unprune_depth2_categories),
    ]
