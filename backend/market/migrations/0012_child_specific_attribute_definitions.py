from __future__ import annotations

from django.db import migrations


def seed_child_specific_attribute_definitions(apps, schema_editor):
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
    # Make "vaccinated" apply only to cats/dogs (not birds/fish/etc) by moving it from parent to children.
    animals = get_cat("animals")
    if animals:
        CategoryAttributeDefinition.objects.filter(category=animals, key="vaccinated").delete()

    for slug in ["cats", "dogs"]:
        upsert_def(
            category_slug=slug,
            key="vaccinated",
            label_ar="مطعم",
            label_en="Vaccinated",
            type="bool",
            sort_order=60,
        )

    # --- Books ---
    upsert_def(category_slug="textbooks", key="subject", label_ar="المادة", label_en="Subject", type="text", sort_order=70)
    upsert_def(
        category_slug="textbooks",
        key="level",
        label_ar="المرحلة",
        label_en="Level",
        type="enum",
        choices=["primary", "middle", "high_school", "university", "other"],
        sort_order=80,
    )

    upsert_def(
        category_slug="novels",
        key="genre",
        label_ar="التصنيف",
        label_en="Genre",
        type="enum",
        choices=["romance", "thriller", "fantasy", "sci_fi", "history", "other"],
        sort_order=70,
    )

    upsert_def(
        category_slug="kids-books",
        key="age_range",
        label_ar="الفئة العمرية",
        label_en="Age Range",
        type="enum",
        choices=["0-3", "3-6", "6-9", "9-12", "12+"],
        sort_order=70,
    )

    # --- Mobile & Internet ---
    upsert_def(
        category_slug="sim-cards",
        key="sim_type",
        label_ar="نوع الشريحة",
        label_en="SIM Type",
        type="enum",
        choices=["prepaid", "postpaid", "esim"],
        sort_order=70,
    )

    upsert_def(
        category_slug="routers",
        key="wifi_standard",
        label_ar="معيار الواي فاي",
        label_en="Wi‑Fi Standard",
        type="enum",
        choices=["802.11n", "802.11ac", "802.11ax"],
        sort_order=70,
    )
    upsert_def(category_slug="routers", key="dual_band", label_ar="ثنائي النطاق", label_en="Dual Band", type="bool", sort_order=80)

    # --- Services ---
    upsert_def(
        category_slug="repairs",
        key="repair_type",
        label_ar="نوع الصيانة",
        label_en="Repair Type",
        type="enum",
        choices=["phones", "computers", "appliances", "cars", "home", "other"],
        sort_order=70,
    )

    upsert_def(
        category_slug="lessons",
        key="subject",
        label_ar="المادة",
        label_en="Subject",
        type="enum",
        choices=["languages", "math", "school", "music", "programming", "other"],
        sort_order=70,
    )

    upsert_def(
        category_slug="delivery",
        key="delivery_type",
        label_ar="نوع التوصيل",
        label_en="Delivery Type",
        type="enum",
        choices=["food", "packages", "furniture", "same_day", "intercity"],
        sort_order=70,
    )

    # --- Beauty & Health ---
    upsert_def(
        category_slug="skincare",
        key="skin_type",
        label_ar="نوع البشرة",
        label_en="Skin Type",
        type="enum",
        choices=["normal", "dry", "oily", "combination", "sensitive"],
        sort_order=70,
    )

    upsert_def(
        category_slug="haircare",
        key="hair_type",
        label_ar="نوع الشعر",
        label_en="Hair Type",
        type="enum",
        choices=["normal", "dry", "oily", "curly", "damaged", "other"],
        sort_order=70,
    )

    upsert_def(
        category_slug="supplements",
        key="supplement_type",
        label_ar="نوع المكمل",
        label_en="Supplement Type",
        type="enum",
        choices=["vitamins", "protein", "omega", "minerals", "other"],
        sort_order=70,
    )

    upsert_def(
        category_slug="makeup",
        key="makeup_type",
        label_ar="نوع المكياج",
        label_en="Makeup Type",
        type="enum",
        choices=["foundation", "lipstick", "mascara", "eyeliner", "palette", "other"],
        sort_order=70,
    )

    # --- Business & Industrial ---
    upsert_def(
        category_slug="restaurant-equipment",
        key="equipment_type",
        label_ar="نوع المعدات",
        label_en="Equipment Type",
        type="enum",
        choices=["ovens", "refrigeration", "coffee", "prep", "tables", "other"],
        sort_order=70,
    )

    upsert_def(
        category_slug="machines-tools",
        key="tool_type",
        label_ar="نوع الأداة",
        label_en="Tool Type",
        type="enum",
        choices=["hand_tools", "power_tools", "welding", "compressors", "other"],
        sort_order=70,
    )

    # --- Sports & Hobbies ---
    upsert_def(
        category_slug="gym-fitness",
        key="equipment_type",
        label_ar="نوع الجهاز",
        label_en="Equipment Type",
        type="enum",
        choices=["treadmill", "bike", "weights", "bench", "accessories", "other"],
        sort_order=70,
    )

    upsert_def(
        category_slug="cycling",
        key="bike_type",
        label_ar="نوع الدراجة",
        label_en="Bike Type",
        type="enum",
        choices=["road", "mountain", "hybrid", "electric", "kids", "other"],
        sort_order=70,
    )

    upsert_def(
        category_slug="camping",
        key="gear_type",
        label_ar="نوع المعدات",
        label_en="Gear Type",
        type="enum",
        choices=["tents", "sleeping", "cooking", "lights", "chairs", "other"],
        sort_order=70,
    )

    upsert_def(
        category_slug="music",
        key="instrument",
        label_ar="الآلة",
        label_en="Instrument",
        type="enum",
        choices=["guitar", "keyboard", "oud", "violin", "drums", "other"],
        sort_order=70,
    )

    # --- Kids ---
    upsert_def(
        category_slug="toys",
        key="toy_type",
        label_ar="نوع اللعبة",
        label_en="Toy Type",
        type="enum",
        choices=["educational", "outdoor", "board", "dolls", "vehicles", "other"],
        sort_order=70,
    )

    upsert_def(
        category_slug="strollers-seats",
        key="item_type",
        label_ar="النوع",
        label_en="Type",
        type="enum",
        choices=["stroller", "car_seat", "booster", "accessories"],
        sort_order=70,
    )

    upsert_def(
        category_slug="school-supplies",
        key="supply_type",
        label_ar="النوع",
        label_en="Type",
        type="enum",
        choices=["bags", "stationery", "uniforms", "books", "electronics", "other"],
        sort_order=70,
    )

    upsert_def(
        category_slug="baby-supplies",
        key="baby_supply_type",
        label_ar="النوع",
        label_en="Type",
        type="enum",
        choices=["diapers", "feeding", "bath", "health", "carriers", "other"],
        sort_order=70,
    )


def unseed_child_specific_attribute_definitions(apps, schema_editor):
    # Keep seeded data on rollback.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("market", "0011_restore_core_children_for_top_level_buckets"),
    ]

    operations = [
        migrations.RunPython(
            seed_child_specific_attribute_definitions,
            unseed_child_specific_attribute_definitions,
        ),
    ]
