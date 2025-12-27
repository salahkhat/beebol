from __future__ import annotations

from django.db import migrations


def seed_category_attribute_definitions(apps, schema_editor):
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

    # --- Common building blocks (inheritable, optional) ---
    condition_choices = ["new", "like_new", "used", "for_parts"]

    for parent in [
        "electronics",
        "vehicles",
        "home",
        "fashion",
        "kids",
        "animals",
        "sports",
        "business-industrial",
        "beauty-health",
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

    # --- Vehicles ---
    fuel_choices = ["gasoline", "diesel", "hybrid", "electric", "lpg"]
    transmission_choices = ["manual", "automatic", "cvt"]

    for cat_slug in ["cars", "motorcycles", "trucks-vans"]:
        upsert_def(category_slug=cat_slug, key="make", label_ar="الشركة", label_en="Make", type="text", is_required_in_post=True, sort_order=20)
        upsert_def(category_slug=cat_slug, key="model", label_ar="الموديل", label_en="Model", type="text", is_required_in_post=True, sort_order=30)
        upsert_def(category_slug=cat_slug, key="year", label_ar="سنة الصنع", label_en="Year", type="int", is_required_in_post=True, sort_order=40)
        upsert_def(category_slug=cat_slug, key="mileage_km", label_ar="الممشى (كم)", label_en="Mileage (km)", type="int", unit="km", is_required_in_post=False, sort_order=50)
        upsert_def(category_slug=cat_slug, key="fuel", label_ar="الوقود", label_en="Fuel", type="enum", choices=fuel_choices, is_required_in_post=False, sort_order=60)
        upsert_def(category_slug=cat_slug, key="transmission", label_ar="ناقل الحركة", label_en="Transmission", type="enum", choices=transmission_choices, is_required_in_post=False, sort_order=70)

    upsert_def(category_slug="cars", key="body_type", label_ar="نوع الهيكل", label_en="Body Type", type="enum", choices=["sedan", "suv", "hatchback", "pickup", "van", "coupe"], sort_order=80)
    upsert_def(category_slug="cars", key="doors", label_ar="عدد الأبواب", label_en="Doors", type="int", sort_order=90)
    upsert_def(category_slug="cars", key="seats", label_ar="عدد المقاعد", label_en="Seats", type="int", sort_order=100)

    upsert_def(category_slug="motorcycles", key="engine_cc", label_ar="سعة المحرك (cc)", label_en="Engine (cc)", type="int", unit="cc", sort_order=80)

    # Car parts: keep it light so users can still list parts easily.
    upsert_def(
        category_slug="car-parts",
        key="part_type",
        label_ar="نوع القطعة",
        label_en="Part Type",
        type="enum",
        choices=["engine", "tires", "battery", "interior", "exterior", "electronics", "other"],
        is_required_in_post=False,
        sort_order=20,
    )
    upsert_def(category_slug="car-parts", key="compatibility", label_ar="التوافق", label_en="Compatibility", type="text", is_required_in_post=False, sort_order=30)

    # --- Electronics ---
    upsert_def(category_slug="electronics", key="brand", label_ar="العلامة التجارية", label_en="Brand", type="text", is_required_in_post=False, sort_order=20)
    upsert_def(category_slug="electronics", key="model", label_ar="الموديل", label_en="Model", type="text", is_required_in_post=False, sort_order=30)

    # Phones
    upsert_def(category_slug="phones", key="brand", label_ar="العلامة التجارية", label_en="Brand", type="text", is_required_in_post=True, sort_order=20)
    upsert_def(category_slug="phones", key="model", label_ar="الموديل", label_en="Model", type="text", is_required_in_post=True, sort_order=30)
    upsert_def(category_slug="phones", key="storage_gb", label_ar="سعة التخزين (GB)", label_en="Storage (GB)", type="int", unit="GB", sort_order=40)
    upsert_def(category_slug="phones", key="ram_gb", label_ar="الرام (GB)", label_en="RAM (GB)", type="int", unit="GB", sort_order=50)
    upsert_def(category_slug="phones", key="screen_size_in", label_ar="حجم الشاشة (إنش)", label_en="Screen Size (in)", type="decimal", unit="in", sort_order=60)
    upsert_def(category_slug="phones", key="dual_sim", label_ar="شريحتين", label_en="Dual SIM", type="bool", sort_order=70)

    # Computers
    upsert_def(category_slug="computers", key="brand", label_ar="العلامة التجارية", label_en="Brand", type="text", is_required_in_post=True, sort_order=20)
    upsert_def(category_slug="computers", key="model", label_ar="الموديل", label_en="Model", type="text", is_required_in_post=True, sort_order=30)
    upsert_def(category_slug="computers", key="cpu", label_ar="المعالج", label_en="CPU", type="text", sort_order=40)
    upsert_def(category_slug="computers", key="ram_gb", label_ar="الرام (GB)", label_en="RAM (GB)", type="int", unit="GB", sort_order=50)
    upsert_def(category_slug="computers", key="storage_gb", label_ar="سعة التخزين (GB)", label_en="Storage (GB)", type="int", unit="GB", sort_order=60)
    upsert_def(category_slug="computers", key="storage_type", label_ar="نوع التخزين", label_en="Storage Type", type="enum", choices=["hdd", "ssd", "nvme"], sort_order=70)
    upsert_def(category_slug="computers", key="gpu", label_ar="كرت الشاشة", label_en="GPU", type="text", sort_order=80)

    # TV & Audio
    upsert_def(category_slug="tv-audio", key="brand", label_ar="العلامة التجارية", label_en="Brand", type="text", sort_order=20)
    upsert_def(category_slug="tv-audio", key="screen_size_in", label_ar="حجم الشاشة (إنش)", label_en="Screen Size (in)", type="decimal", unit="in", sort_order=30)
    upsert_def(category_slug="tv-audio", key="resolution", label_ar="الدقة", label_en="Resolution", type="enum", choices=["hd", "fhd", "4k", "8k"], sort_order=40)
    upsert_def(category_slug="tv-audio", key="smart_tv", label_ar="سمارت", label_en="Smart", type="bool", sort_order=50)

    # --- Real estate ---
    # NOTE: we avoid making parent-level attrs required because land/shops/etc differ.
    # Apartments (rent/sale)
    for cat_slug in ["apartments-rent", "apartments-sale"]:
        upsert_def(category_slug=cat_slug, key="bedrooms", label_ar="غرف نوم", label_en="Bedrooms", type="int", is_required_in_post=True, sort_order=20)
        upsert_def(category_slug=cat_slug, key="bathrooms", label_ar="حمامات", label_en="Bathrooms", type="int", is_required_in_post=False, sort_order=30)
        upsert_def(category_slug=cat_slug, key="area_m2", label_ar="المساحة (م²)", label_en="Area (m²)", type="decimal", unit="m²", is_required_in_post=True, sort_order=40)
        upsert_def(category_slug=cat_slug, key="floor", label_ar="الطابق", label_en="Floor", type="int", sort_order=50)
        upsert_def(category_slug=cat_slug, key="has_elevator", label_ar="مصعد", label_en="Elevator", type="bool", sort_order=60)
        upsert_def(category_slug=cat_slug, key="furnished", label_ar="مفروشة", label_en="Furnished", type="bool", sort_order=70)
        upsert_def(category_slug=cat_slug, key="parking", label_ar="موقف سيارة", label_en="Parking", type="bool", sort_order=80)

    # Houses/Villas
    upsert_def(category_slug="houses-villas", key="bedrooms", label_ar="غرف نوم", label_en="Bedrooms", type="int", is_required_in_post=True, sort_order=20)
    upsert_def(category_slug="houses-villas", key="bathrooms", label_ar="حمامات", label_en="Bathrooms", type="int", sort_order=30)
    upsert_def(category_slug="houses-villas", key="area_m2", label_ar="مساحة البناء (م²)", label_en="Built Area (m²)", type="decimal", unit="m²", is_required_in_post=True, sort_order=40)
    upsert_def(category_slug="houses-villas", key="land_area_m2", label_ar="مساحة الأرض (م²)", label_en="Land Area (m²)", type="decimal", unit="m²", sort_order=50)
    upsert_def(category_slug="houses-villas", key="furnished", label_ar="مفروشة", label_en="Furnished", type="bool", sort_order=60)

    # Land
    upsert_def(category_slug="land", key="area_m2", label_ar="المساحة (م²)", label_en="Area (m²)", type="decimal", unit="m²", is_required_in_post=True, sort_order=20)
    upsert_def(category_slug="land", key="zoning", label_ar="التصنيف", label_en="Zoning", type="enum", choices=["residential", "commercial", "agricultural", "industrial"], sort_order=30)
    upsert_def(category_slug="land", key="frontage_m", label_ar="الواجهة (م)", label_en="Frontage (m)", type="decimal", unit="m", sort_order=40)

    # Shops / offices
    for cat_slug in ["shops", "offices"]:
        upsert_def(category_slug=cat_slug, key="area_m2", label_ar="المساحة (م²)", label_en="Area (m²)", type="decimal", unit="m²", is_required_in_post=True, sort_order=20)
        upsert_def(category_slug=cat_slug, key="floor", label_ar="الطابق", label_en="Floor", type="int", sort_order=30)
        upsert_def(category_slug=cat_slug, key="bathrooms", label_ar="حمامات", label_en="Bathrooms", type="int", sort_order=40)

    # --- Home & Garden ---
    upsert_def(category_slug="furniture", key="material", label_ar="الخامة", label_en="Material", type="enum", choices=["wood", "metal", "plastic", "fabric", "leather", "glass", "other"], sort_order=20)
    upsert_def(category_slug="furniture", key="color", label_ar="اللون", label_en="Color", type="text", sort_order=30)
    upsert_def(category_slug="furniture", key="dimensions", label_ar="الأبعاد", label_en="Dimensions", type="text", sort_order=40)

    upsert_def(category_slug="appliances", key="brand", label_ar="العلامة التجارية", label_en="Brand", type="text", sort_order=20)
    upsert_def(category_slug="appliances", key="energy_rating", label_ar="تصنيف الطاقة", label_en="Energy Rating", type="enum", choices=["A++", "A+", "A", "B", "C", "D"], sort_order=30)
    upsert_def(category_slug="appliances", key="warranty", label_ar="ضمان", label_en="Warranty", type="bool", sort_order=40)

    # --- Fashion ---
    upsert_def(category_slug="fashion", key="brand", label_ar="العلامة التجارية", label_en="Brand", type="text", sort_order=20)
    upsert_def(category_slug="fashion", key="color", label_ar="اللون", label_en="Color", type="text", sort_order=30)

    size_choices = ["xs", "s", "m", "l", "xl", "xxl"]
    for cat_slug in ["mens-fashion", "womens-fashion", "kids-fashion"]:
        upsert_def(category_slug=cat_slug, key="size", label_ar="المقاس", label_en="Size", type="enum", choices=size_choices, sort_order=40)

    upsert_def(category_slug="shoes", key="size_eu", label_ar="المقاس (EU)", label_en="Size (EU)", type="int", sort_order=40)

    # --- Jobs ---
    job_type_choices = ["full_time", "part_time", "contract", "temporary", "internship"]
    education_choices = ["none", "high_school", "diploma", "bachelor", "master", "phd"]

    upsert_def(category_slug="jobs-offered", key="job_title", label_ar="المسمى الوظيفي", label_en="Job Title", type="text", is_required_in_post=True, sort_order=20)
    upsert_def(category_slug="jobs-offered", key="job_type", label_ar="نوع الدوام", label_en="Job Type", type="enum", choices=job_type_choices, sort_order=30)
    upsert_def(category_slug="jobs-offered", key="experience_years", label_ar="سنوات الخبرة", label_en="Experience (years)", type="int", sort_order=40)
    upsert_def(category_slug="jobs-offered", key="education", label_ar="المؤهل العلمي", label_en="Education", type="enum", choices=education_choices, sort_order=50)
    upsert_def(category_slug="jobs-offered", key="remote", label_ar="عن بعد", label_en="Remote", type="bool", sort_order=60)

    upsert_def(category_slug="jobs-wanted", key="job_title", label_ar="المسمى الوظيفي", label_en="Job Title", type="text", is_required_in_post=True, sort_order=20)
    upsert_def(category_slug="jobs-wanted", key="experience_years", label_ar="سنوات الخبرة", label_en="Experience (years)", type="int", sort_order=30)
    upsert_def(category_slug="jobs-wanted", key="education", label_ar="المؤهل العلمي", label_en="Education", type="enum", choices=education_choices, sort_order=40)
    upsert_def(category_slug="jobs-wanted", key="remote", label_ar="عن بعد", label_en="Remote", type="bool", sort_order=50)


def unseed_category_attribute_definitions(apps, schema_editor):
    # Intentionally keep data on rollback to avoid deleting user edits.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("market", "0005_category_attributes"),
    ]

    operations = [
        migrations.RunPython(seed_category_attribute_definitions, unseed_category_attribute_definitions),
    ]
