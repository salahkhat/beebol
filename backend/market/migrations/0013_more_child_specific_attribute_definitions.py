from __future__ import annotations

from django.db import migrations


def seed_more_child_specific_attribute_definitions(apps, schema_editor):
    Category = apps.get_model("market", "Category")
    CategoryAttributeDefinition = apps.get_model("market", "CategoryAttributeDefinition")

    def get_cat(slug: str):
        return Category.objects.filter(slug=slug).first()

    def upsert_def(
        *,
        category_slug: str,
        key: str,
        label_ar: str,
        label_en: str,
        type: str,
        unit: str = "",
        choices=None,
        is_required_in_post: bool = False,
        is_filterable: bool = True,
        sort_order: int = 0,
    ) -> None:
        cat = get_cat(category_slug)
        if not cat:
            return

        defaults = {
            "label_ar": label_ar,
            "label_en": label_en,
            "type": type,
            "unit": unit,
            "choices": choices,
            "is_required_in_post": bool(is_required_in_post),
            "is_filterable": bool(is_filterable),
            "sort_order": int(sort_order),
        }

        obj, _created = CategoryAttributeDefinition.objects.get_or_create(
            category=cat,
            key=key,
            defaults=defaults,
        )

        updates = {}
        for field, value in defaults.items():
            if getattr(obj, field) != value:
                updates[field] = value
        if updates:
            for k, v in updates.items():
                setattr(obj, k, v)
            obj.save(update_fields=list(updates.keys()))

    # --- Animals ---
    upsert_def(
        category_slug="birds",
        key="bird_species",
        label_ar="نوع الطائر",
        label_en="Bird Species",
        type="enum",
        choices=["parrot", "canary", "finch", "pigeon", "other"],
        sort_order=70,
    )
    upsert_def(category_slug="birds", key="cage_included", label_ar="قفص مع الطائر", label_en="Cage Included", type="bool", sort_order=80)

    upsert_def(
        category_slug="fish",
        key="water_type",
        label_ar="نوع الماء",
        label_en="Water Type",
        type="enum",
        choices=["freshwater", "saltwater"],
        sort_order=70,
    )
    upsert_def(category_slug="fish", key="aquarium_included", label_ar="حوض مع الأسماك", label_en="Aquarium Included", type="bool", sort_order=80)

    upsert_def(
        category_slug="farm-animals",
        key="farm_animal_type",
        label_ar="نوع الحيوان",
        label_en="Farm Animal Type",
        type="enum",
        choices=["sheep", "goat", "cow", "chicken", "horse", "other"],
        sort_order=70,
    )
    upsert_def(category_slug="farm-animals", key="quantity", label_ar="العدد", label_en="Quantity", type="int", sort_order=80)

    upsert_def(
        category_slug="pet-supplies",
        key="pet_supply_type",
        label_ar="نوع المستلزمات",
        label_en="Supply Type",
        type="enum",
        choices=["food", "cage", "litter", "aquarium", "toys", "accessories", "other"],
        sort_order=70,
    )
    upsert_def(
        category_slug="pet-supplies",
        key="for_pet",
        label_ar="مناسب لـ",
        label_en="For Pet",
        type="enum",
        choices=["cat", "dog", "bird", "fish", "farm", "other"],
        sort_order=80,
    )

    # --- Services ---
    upsert_def(
        category_slug="design-media",
        key="design_service",
        label_ar="نوع الخدمة",
        label_en="Service Type",
        type="enum",
        choices=["logo", "branding", "social_media", "photography", "video_editing", "other"],
        sort_order=70,
    )

    upsert_def(
        category_slug="events",
        key="event_service",
        label_ar="نوع الخدمة",
        label_en="Service Type",
        type="enum",
        choices=["wedding", "birthday", "catering", "decoration", "dj", "other"],
        sort_order=70,
    )

    upsert_def(
        category_slug="home-services",
        key="home_service_type",
        label_ar="نوع الخدمة",
        label_en="Service Type",
        type="enum",
        choices=["cleaning", "plumbing", "electrical", "painting", "carpentry", "other"],
        sort_order=70,
    )

    # --- Books ---
    upsert_def(
        category_slug="business",
        key="business_topic",
        label_ar="الموضوع",
        label_en="Topic",
        type="enum",
        choices=["management", "marketing", "finance", "entrepreneurship", "other"],
        sort_order=70,
    )

    upsert_def(
        category_slug="tech",
        key="tech_topic",
        label_ar="الموضوع",
        label_en="Topic",
        type="enum",
        choices=["programming", "networking", "security", "data", "ai", "other"],
        sort_order=70,
    )

    upsert_def(
        category_slug="religion",
        key="religion_topic",
        label_ar="الموضوع",
        label_en="Topic",
        type="enum",
        choices=["quran", "hadith", "fiqh", "seerah", "general", "other"],
        sort_order=70,
    )

    # --- Mobile & Internet ---
    upsert_def(
        category_slug="plans",
        key="network_type",
        label_ar="نوع الشبكة",
        label_en="Network Type",
        type="enum",
        choices=["3g", "4g", "5g", "fiber", "adsl", "other"],
        sort_order=70,
    )

    upsert_def(
        category_slug="internet-devices",
        key="device_type",
        label_ar="نوع الجهاز",
        label_en="Device Type",
        type="enum",
        choices=["modem", "repeater", "access_point", "switch", "antenna", "other"],
        sort_order=70,
    )
    upsert_def(category_slug="internet-devices", key="brand", label_ar="العلامة التجارية", label_en="Brand", type="text", sort_order=80)

    # --- Sports ---
    upsert_def(
        category_slug="football",
        key="football_item_type",
        label_ar="نوع المنتج",
        label_en="Item Type",
        type="enum",
        choices=["ball", "shoes", "jersey", "goal", "accessories", "other"],
        sort_order=70,
    )

    # --- Business & Industrial ---
    upsert_def(
        category_slug="office-supplies",
        key="office_supply_type",
        label_ar="النوع",
        label_en="Type",
        type="enum",
        choices=["paper", "stationery", "printer_ink", "filing", "labels", "other"],
        sort_order=70,
    )

    upsert_def(
        category_slug="industrial-supplies",
        key="industrial_supply_type",
        label_ar="النوع",
        label_en="Type",
        type="enum",
        choices=["safety", "electrical", "plumbing", "fasteners", "chemicals", "other"],
        sort_order=70,
    )
    upsert_def(category_slug="industrial-supplies", key="quantity", label_ar="العدد", label_en="Quantity", type="int", sort_order=80)

    # --- Beauty & Health ---
    upsert_def(
        category_slug="fragrance",
        key="fragrance_type",
        label_ar="نوع العطر",
        label_en="Fragrance Type",
        type="enum",
        choices=["perfume", "eau_de_toilette", "body_spray", "oil", "other"],
        sort_order=70,
    )
    upsert_def(category_slug="fragrance", key="size_ml", label_ar="الحجم (مل)", label_en="Size (ml)", type="int", unit="ml", sort_order=80)


def unseed_more_child_specific_attribute_definitions(apps, schema_editor):
    # Keep seeded data on rollback.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("market", "0012_child_specific_attribute_definitions"),
    ]

    operations = [
        migrations.RunPython(
            seed_more_child_specific_attribute_definitions,
            unseed_more_child_specific_attribute_definitions,
        ),
    ]
