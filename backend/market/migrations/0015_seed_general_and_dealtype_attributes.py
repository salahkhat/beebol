from __future__ import annotations

from django.db import migrations


def forward(apps, schema_editor):
    Category = apps.get_model("market", "Category")
    CategoryAttributeDefinition = apps.get_model("market", "CategoryAttributeDefinition")

    def get_cat(slug: str):
        try:
            return Category.objects.get(slug=slug)
        except Category.DoesNotExist:
            return None

    def upsert_def(*, cat_slug: str, key: str, label_ar: str, label_en: str, type: str, unit: str = "", choices=None, is_required_in_post: bool = False, is_filterable: bool = True, sort_order: int = 0):
        cat = get_cat(cat_slug)
        if cat is None:
            return

        obj, _ = CategoryAttributeDefinition.objects.get_or_create(
            category_id=cat.id,
            key=key,
            defaults={
                "label_ar": label_ar,
                "label_en": label_en,
                "type": type,
                "unit": unit,
                "choices": choices,
                "is_required_in_post": is_required_in_post,
                "is_filterable": is_filterable,
                "sort_order": sort_order,
            },
        )

        updates = []
        if obj.label_ar != label_ar:
            obj.label_ar = label_ar
            updates.append("label_ar")
        if obj.label_en != label_en:
            obj.label_en = label_en
            updates.append("label_en")
        if obj.type != type:
            obj.type = type
            updates.append("type")
        if (obj.unit or "") != (unit or ""):
            obj.unit = unit
            updates.append("unit")
        if obj.choices != choices:
            obj.choices = choices
            updates.append("choices")
        if bool(obj.is_required_in_post) != bool(is_required_in_post):
            obj.is_required_in_post = is_required_in_post
            updates.append("is_required_in_post")
        if bool(obj.is_filterable) != bool(is_filterable):
            obj.is_filterable = is_filterable
            updates.append("is_filterable")
        if int(obj.sort_order) != int(sort_order):
            obj.sort_order = sort_order
            updates.append("sort_order")

        if updates:
            obj.save(update_fields=updates)

    # General: global attrs (shown on all categories because General is root).
    upsert_def(
        cat_slug="general",
        key="show_phone",
        label_ar="إظهار رقم الهاتف",
        label_en="Show phone number",
        type="bool",
        is_required_in_post=False,
        is_filterable=False,
        sort_order=10,
    )

    upsert_def(
        cat_slug="general",
        key="price_on_inquiry",
        label_ar="السعر عند الاستفسار",
        label_en="Price on inquiry",
        type="bool",
        is_required_in_post=False,
        is_filterable=True,
        sort_order=20,
    )

    # Vehicles + Real Estate: rent/sale enum.
    upsert_def(
        cat_slug="vehicles",
        key="deal_type",
        label_ar="للبيع أم للإيجار",
        label_en="For sale or for rent",
        type="enum",
        choices=["sale", "rent"],
        is_required_in_post=False,
        is_filterable=True,
        sort_order=5,
    )

    upsert_def(
        cat_slug="real-estate",
        key="deal_type",
        label_ar="للبيع أم للإيجار",
        label_en="For sale or for rent",
        type="enum",
        choices=["sale", "rent"],
        is_required_in_post=False,
        is_filterable=True,
        sort_order=5,
    )


def backward(apps, schema_editor):
    # Intentionally no-op (defs may have user data).
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("market", "0014_categories_md_taxonomy"),
    ]

    operations = [
        migrations.RunPython(forward, backward),
    ]
