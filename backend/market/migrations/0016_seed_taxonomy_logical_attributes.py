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
                "is_required_in_post": bool(is_required_in_post),
                "is_filterable": bool(is_filterable),
                "sort_order": int(sort_order),
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
            obj.is_required_in_post = bool(is_required_in_post)
            updates.append("is_required_in_post")
        if bool(obj.is_filterable) != bool(is_filterable):
            obj.is_filterable = bool(is_filterable)
            updates.append("is_filterable")
        if int(obj.sort_order) != int(sort_order):
            obj.sort_order = int(sort_order)
            updates.append("sort_order")

        if updates:
            obj.save(update_fields=updates)

    # --- Vehicles: newly added nodes that should behave like vehicle listings ---
    fuel_choices = ["gasoline", "diesel", "hybrid", "electric", "lpg"]
    transmission_choices = ["manual", "automatic", "cvt"]

    for cat_slug in ["buses", "construction-vehicles", "agricultural-vehicles"]:
        upsert_def(category_slug=cat_slug, key="make", label_ar="الشركة", label_en="Make", type="text", is_required_in_post=True, sort_order=20)
        upsert_def(category_slug=cat_slug, key="model", label_ar="الموديل", label_en="Model", type="text", is_required_in_post=True, sort_order=30)
        upsert_def(category_slug=cat_slug, key="year", label_ar="سنة الصنع", label_en="Year", type="int", is_required_in_post=True, sort_order=40)
        upsert_def(category_slug=cat_slug, key="mileage_km", label_ar="الممشى (كم)", label_en="Mileage (km)", type="int", unit="km", is_required_in_post=False, sort_order=50)
        upsert_def(category_slug=cat_slug, key="fuel", label_ar="الوقود", label_en="Fuel", type="enum", choices=fuel_choices, is_required_in_post=False, sort_order=60)
        upsert_def(category_slug=cat_slug, key="transmission", label_ar="ناقل الحركة", label_en="Transmission", type="enum", choices=transmission_choices, is_required_in_post=False, sort_order=70)

    # --- Real estate: newly added nodes ---
    # Keep required set minimal and consistent with older real-estate defs.
    for cat_slug in ["building", "warehouse"]:
        upsert_def(category_slug=cat_slug, key="area_m2", label_ar="المساحة (م²)", label_en="Area (m²)", type="decimal", unit="m²", is_required_in_post=True, sort_order=20)
        upsert_def(category_slug=cat_slug, key="bathrooms", label_ar="حمامات", label_en="Bathrooms", type="int", is_required_in_post=False, sort_order=30)
        upsert_def(category_slug=cat_slug, key="floor", label_ar="الطابق", label_en="Floor", type="int", is_required_in_post=False, sort_order=40)

    # --- Electronics: apply basic device attrs to new device categories ---
    # brand/model keys already exist elsewhere and are used by UI formatting.
    for cat_slug in [
        "tablets",
        "smart-watches",
        "desktop-computers",
        "monitors",
        "headphones",
        "cameras",
        "photography-equipments",
        "drones",
        "gaming-consoles",
    ]:
        upsert_def(category_slug=cat_slug, key="brand", label_ar="العلامة التجارية", label_en="Brand", type="text", is_required_in_post=False, sort_order=20)
        upsert_def(category_slug=cat_slug, key="model", label_ar="الموديل", label_en="Model", type="text", is_required_in_post=False, sort_order=30)

    # Monitors also benefit from size/resolution for filtering.
    upsert_def(category_slug="monitors", key="screen_size_in", label_ar="حجم الشاشة (إنش)", label_en="Screen Size (in)", type="decimal", unit="in", is_required_in_post=False, sort_order=40)
    upsert_def(category_slug="monitors", key="resolution", label_ar="الدقة", label_en="Resolution", type="enum", choices=["hd", "fhd", "2k", "4k", "8k"], is_required_in_post=False, sort_order=50)

    # Desktop computers: typical specs.
    upsert_def(category_slug="desktop-computers", key="cpu", label_ar="المعالج", label_en="CPU", type="text", is_required_in_post=False, sort_order=40)
    upsert_def(category_slug="desktop-computers", key="ram_gb", label_ar="الرام (GB)", label_en="RAM (GB)", type="int", unit="GB", is_required_in_post=False, sort_order=50)
    upsert_def(category_slug="desktop-computers", key="storage_gb", label_ar="سعة التخزين (GB)", label_en="Storage (GB)", type="int", unit="GB", is_required_in_post=False, sort_order=60)
    upsert_def(category_slug="desktop-computers", key="storage_type", label_ar="نوع التخزين", label_en="Storage Type", type="enum", choices=["hdd", "ssd", "nvme"], is_required_in_post=False, sort_order=70)
    upsert_def(category_slug="desktop-computers", key="gpu", label_ar="كرت الشاشة", label_en="GPU", type="text", is_required_in_post=False, sort_order=80)

    # Gaming / media accessories: basic compatibility.
    for cat_slug in ["camera-accessories", "gaming-console-accessories", "mobile-accessories"]:
        upsert_def(category_slug=cat_slug, key="brand", label_ar="العلامة التجارية", label_en="Brand", type="text", is_required_in_post=False, sort_order=20)
        upsert_def(category_slug=cat_slug, key="compatibility", label_ar="التوافق", label_en="Compatibility", type="text", is_required_in_post=False, sort_order=30)

    # Video games: platform is the main logical filter.
    upsert_def(
        category_slug="video-games",
        key="platform",
        label_ar="المنصة",
        label_en="Platform",
        type="enum",
        choices=["ps4", "ps5", "xbox_one", "xbox_series", "pc", "switch", "mobile", "other"],
        is_required_in_post=False,
        sort_order=20,
    )

    # --- Home & Furniture: extend furniture attributes to new furniture branches ---
    material_choices = ["wood", "metal", "plastic", "fabric", "leather", "glass", "other"]
    for cat_slug in ["bedroom-furniture", "dining-furniture", "office-furniture", "kitchen-items"]:
        upsert_def(category_slug=cat_slug, key="material", label_ar="الخامة", label_en="Material", type="enum", choices=material_choices, is_required_in_post=False, sort_order=20)
        upsert_def(category_slug=cat_slug, key="color", label_ar="اللون", label_en="Color", type="text", is_required_in_post=False, sort_order=30)
        upsert_def(category_slug=cat_slug, key="dimensions", label_ar="الأبعاد", label_en="Dimensions", type="text", is_required_in_post=False, sort_order=40)

    for cat_slug in ["curtains", "carpets"]:
        upsert_def(category_slug=cat_slug, key="material", label_ar="الخامة", label_en="Material", type="enum", choices=material_choices, is_required_in_post=False, sort_order=20)
        upsert_def(category_slug=cat_slug, key="color", label_ar="اللون", label_en="Color", type="text", is_required_in_post=False, sort_order=30)
        upsert_def(category_slug=cat_slug, key="dimensions", label_ar="الأبعاد", label_en="Dimensions", type="text", is_required_in_post=False, sort_order=40)

    # --- Jobs: new job-type categories should have core job fields ---
    education_choices = ["none", "high_school", "diploma", "bachelor", "master", "phd"]
    upsert_def(category_slug="jobs", key="job_title", label_ar="المسمى الوظيفي", label_en="Job Title", type="text", is_required_in_post=True, sort_order=20)
    upsert_def(category_slug="jobs", key="experience_years", label_ar="سنوات الخبرة", label_en="Experience (years)", type="int", is_required_in_post=False, sort_order=30)
    upsert_def(category_slug="jobs", key="education", label_ar="المؤهل العلمي", label_en="Education", type="enum", choices=education_choices, is_required_in_post=False, sort_order=40)
    upsert_def(category_slug="jobs", key="remote", label_ar="عن بعد", label_en="Remote", type="bool", is_required_in_post=False, sort_order=50)

    # --- Pets: new nodes ---
    for_pet_choices = ["cat", "dog", "bird", "fish", "farm", "other"]
    for cat_slug in ["pet-food", "pet-services"]:
        upsert_def(category_slug=cat_slug, key="for_pet", label_ar="لأي حيوان", label_en="For pet", type="enum", choices=for_pet_choices, is_required_in_post=False, sort_order=20)


def backward(apps, schema_editor):
    # No-op: keep attribute definitions stable.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("market", "0015_seed_general_and_dealtype_attributes"),
    ]

    operations = [
        migrations.RunPython(forward, backward),
    ]
