from __future__ import annotations

from django.db import migrations


def prune_unused_depth1_categories(apps, schema_editor):
    Category = apps.get_model("market", "Category")
    Listing = apps.get_model("market", "Listing")
    CategoryAttributeDefinition = apps.get_model("market", "CategoryAttributeDefinition")

    # Depth-1 categories: they have a parent, but no grandparent.
    qs = Category.objects.filter(parent__isnull=False, parent__parent__isnull=True)

    # Keep anything that is in use (listings) or has attribute definitions.
    listing_cat_ids = set(Listing.objects.values_list("category_id", flat=True))
    attr_cat_ids = set(CategoryAttributeDefinition.objects.values_list("category_id", flat=True))

    to_delete = []
    for c in qs.iterator():
        if c.id in listing_cat_ids:
            continue
        if c.id in attr_cat_ids:
            continue
        to_delete.append(c.id)

    if not to_delete:
        return

    # Safety: if any listings still point here (race/edge), reassign to the parent.
    # This should normally be a no-op because we filtered listing_cat_ids above.
    from django.db.models import Case, IntegerField, Value, When

    CHUNK = 500
    for i in range(0, len(to_delete), CHUNK):
        chunk = to_delete[i : i + CHUNK]
        parent_map = dict(Category.objects.filter(id__in=chunk).values_list("id", "parent_id"))
        whens = [When(category_id=cid, then=Value(parent_map.get(cid))) for cid in chunk if parent_map.get(cid)]
        if whens:
            Listing.objects.filter(category_id__in=chunk).update(category_id=Case(*whens, output_field=IntegerField()))

    # Now delete.
    Category.objects.filter(id__in=to_delete).delete()


def unprune_unused_depth1_categories(apps, schema_editor):
    # Intentionally non-reversible.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("market", "0008_prune_depth2_categories"),
    ]

    operations = [
        migrations.RunPython(prune_unused_depth1_categories, unprune_unused_depth1_categories),
    ]
