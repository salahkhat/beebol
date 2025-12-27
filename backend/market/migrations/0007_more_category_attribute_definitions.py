from __future__ import annotations

from django.db import migrations


def seed_more_category_attribute_definitions(apps, schema_editor):
    Category = apps.get_model("market", "Category")
    CategoryAttributeDefinition = apps.get_model("market", "CategoryAttributeDefinition")

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
        cat = Category.objects.filter(slug=category_slug).first()
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

    # Add a light "condition" attribute to remaining physical-goods top-level buckets
    # where it makes sense, but keep it optional.
    condition_choices = ["new", "like_new", "used", "for_parts"]
    for parent in [
        "books",
        "mobile-internet",
        "business-industrial",
        "beauty-health",
        "sports",
        "kids",
    ]:
        upsert_def(
            category_slug=parent,
            key="condition",
            label_ar="الحالة",
            label_en="Condition",
            type="enum",
            choices=condition_choices,
            is_required_in_post=False,
            is_filterable=True,
            sort_order=10,
        )

    # --- Books ---
    upsert_def(category_slug="books", key="title", label_ar="العنوان", label_en="Title", type="text", is_required_in_post=False, sort_order=20)
    upsert_def(category_slug="books", key="author", label_ar="المؤلف", label_en="Author", type="text", sort_order=30)
    upsert_def(category_slug="books", key="language", label_ar="اللغة", label_en="Language", type="enum", choices=["ar", "en", "other"], sort_order=40)
    upsert_def(category_slug="books", key="format", label_ar="النوع", label_en="Format", type="enum", choices=["paperback", "hardcover", "ebook", "other"], sort_order=50)
    upsert_def(category_slug="books", key="isbn", label_ar="ISBN", label_en="ISBN", type="text", sort_order=60)

    # --- Mobile & Internet ---
    upsert_def(category_slug="mobile-internet", key="provider", label_ar="المزود", label_en="Provider", type="text", sort_order=20)
    upsert_def(category_slug="mobile-internet", key="plan_type", label_ar="نوع الباقة", label_en="Plan Type", type="enum", choices=["data", "minutes", "combo", "home_internet"], sort_order=30)
    upsert_def(category_slug="mobile-internet", key="data_gb", label_ar="البيانات (GB)", label_en="Data (GB)", type="decimal", unit="GB", sort_order=40)
    upsert_def(category_slug="mobile-internet", key="minutes", label_ar="الدقائق", label_en="Minutes", type="int", sort_order=50)
    upsert_def(category_slug="mobile-internet", key="duration_days", label_ar="المدة (يوم)", label_en="Duration (days)", type="int", unit="day", sort_order=60)

    # --- Animals ---
    upsert_def(category_slug="animals", key="animal_type", label_ar="النوع", label_en="Type", type="enum", choices=["cat", "dog", "bird", "fish", "farm", "other"], sort_order=20)
    upsert_def(category_slug="animals", key="breed", label_ar="السلالة", label_en="Breed", type="text", sort_order=30)
    upsert_def(category_slug="animals", key="age_months", label_ar="العمر (بالأشهر)", label_en="Age (months)", type="int", sort_order=40)
    upsert_def(category_slug="animals", key="gender", label_ar="الجنس", label_en="Gender", type="enum", choices=["male", "female", "unknown"], sort_order=50)
    upsert_def(category_slug="animals", key="vaccinated", label_ar="مطعم", label_en="Vaccinated", type="bool", sort_order=60)

    # --- Kids ---
    upsert_def(category_slug="kids", key="age_range", label_ar="الفئة العمرية", label_en="Age Range", type="enum", choices=["0-6m", "6-12m", "1-3y", "3-6y", "6-12y", "12+y"], sort_order=20)
    upsert_def(category_slug="kids", key="brand", label_ar="العلامة التجارية", label_en="Brand", type="text", sort_order=30)

    # --- Services ---
    # Services are diverse; keep optional, generic attributes.
    upsert_def(category_slug="services", key="service_area", label_ar="نطاق الخدمة", label_en="Service Area", type="text", sort_order=20)
    upsert_def(category_slug="services", key="availability", label_ar="التوفر", label_en="Availability", type="text", sort_order=30)
    upsert_def(category_slug="services", key="price_type", label_ar="طريقة التسعير", label_en="Pricing", type="enum", choices=["fixed", "hourly", "negotiable"], sort_order=40)

    # --- Beauty & Health ---
    upsert_def(category_slug="beauty-health", key="brand", label_ar="العلامة التجارية", label_en="Brand", type="text", sort_order=20)
    upsert_def(category_slug="beauty-health", key="sealed", label_ar="مغلق", label_en="Sealed", type="bool", sort_order=30)
    upsert_def(category_slug="beauty-health", key="expiry", label_ar="تاريخ الانتهاء", label_en="Expiry", type="text", sort_order=40)

    # --- Sports ---
    upsert_def(category_slug="sports", key="brand", label_ar="العلامة التجارية", label_en="Brand", type="text", sort_order=20)
    upsert_def(category_slug="sports", key="sport", label_ar="الرياضة", label_en="Sport", type="enum", choices=["gym", "football", "cycling", "camping", "other"], sort_order=30)

    # --- Business & Industrial ---
    upsert_def(category_slug="business-industrial", key="brand", label_ar="العلامة التجارية", label_en="Brand", type="text", sort_order=20)
    upsert_def(category_slug="business-industrial", key="power_kw", label_ar="القدرة (kW)", label_en="Power (kW)", type="decimal", unit="kW", sort_order=30)
    upsert_def(category_slug="business-industrial", key="capacity", label_ar="السعة", label_en="Capacity", type="text", sort_order=40)


def unseed_more_category_attribute_definitions(apps, schema_editor):
    # Keep data on rollback.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("market", "0006_seed_category_attribute_definitions"),
    ]

    operations = [
        migrations.RunPython(seed_more_category_attribute_definitions, unseed_more_category_attribute_definitions),
    ]
