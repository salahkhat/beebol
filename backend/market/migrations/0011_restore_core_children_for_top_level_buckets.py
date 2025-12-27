from __future__ import annotations

from django.db import migrations


def restore_core_children(apps, schema_editor):
    Category = apps.get_model("market", "Category")

    def upsert(slug: str, name_ar: str, name_en: str = "", parent_slug: str | None = None) -> None:
        parent = None
        if parent_slug:
            parent = Category.objects.filter(slug=parent_slug).first()

        obj, _created = Category.objects.get_or_create(
            slug=slug,
            defaults={
                "name_ar": name_ar,
                "name_en": name_en,
                "parent": parent,
            },
        )

        updates = {}
        if obj.name_ar != name_ar:
            updates["name_ar"] = name_ar
        if obj.name_en != name_en:
            updates["name_en"] = name_en
        if obj.parent_id != (parent.id if parent else None):
            updates["parent"] = parent

        if updates:
            for k, v in updates.items():
                setattr(obj, k, v)
            obj.save(update_fields=list(updates.keys()))

    # Animals
    upsert("cats", "قطط", "Cats", parent_slug="animals")
    upsert("dogs", "كلاب", "Dogs", parent_slug="animals")
    upsert("birds", "طيور", "Birds", parent_slug="animals")
    upsert("fish", "أسماك", "Fish", parent_slug="animals")
    upsert("farm-animals", "حيوانات مزرعة", "Farm Animals", parent_slug="animals")
    upsert("pet-supplies", "مستلزمات الحيوانات", "Pet Supplies", parent_slug="animals")

    # Books (keep existing textbooks; add a few common buckets)
    upsert("textbooks", "كتب دراسية", "Textbooks", parent_slug="books")
    upsert("novels", "روايات", "Novels", parent_slug="books")
    upsert("kids-books", "كتب أطفال", "Kids Books", parent_slug="books")
    upsert("religion", "دين", "Religion", parent_slug="books")
    upsert("business", "إدارة وأعمال", "Business", parent_slug="books")
    upsert("tech", "تقنية", "Technology", parent_slug="books")

    # Mobile & Internet
    upsert("sim-cards", "شرائح اتصال", "SIM Cards", parent_slug="mobile-internet")
    upsert("routers", "راوترات", "Routers", parent_slug="mobile-internet")
    upsert("internet-devices", "أجهزة إنترنت", "Internet Devices", parent_slug="mobile-internet")
    upsert("plans", "باقات", "Plans", parent_slug="mobile-internet")

    # Services
    upsert("repairs", "صيانة وإصلاح", "Repairs", parent_slug="services")
    upsert("delivery", "توصيل", "Delivery", parent_slug="services")
    upsert("home-services", "خدمات منزلية", "Home Services", parent_slug="services")
    upsert("lessons", "دروس وتعليم", "Lessons & Tutoring", parent_slug="services")
    upsert("design-media", "تصميم وإعلام", "Design & Media", parent_slug="services")
    upsert("events", "مناسبات", "Events", parent_slug="services")

    # Beauty & Health
    upsert("skincare", "عناية بالبشرة", "Skincare", parent_slug="beauty-health")
    upsert("haircare", "عناية بالشعر", "Haircare", parent_slug="beauty-health")
    upsert("makeup", "مكياج", "Makeup", parent_slug="beauty-health")
    upsert("fragrance", "عطور", "Fragrance", parent_slug="beauty-health")
    upsert("supplements", "مكملات", "Supplements", parent_slug="beauty-health")

    # Business & Industrial
    upsert("office-supplies", "مستلزمات مكتب", "Office Supplies", parent_slug="business-industrial")
    upsert("machines-tools", "آلات وأدوات", "Machines & Tools", parent_slug="business-industrial")
    upsert("restaurant-equipment", "معدات مطاعم", "Restaurant Equipment", parent_slug="business-industrial")
    upsert("industrial-supplies", "مستلزمات صناعية", "Industrial Supplies", parent_slug="business-industrial")

    # Sports & Hobbies
    upsert("gym-fitness", "لياقة بدنية", "Gym & Fitness", parent_slug="sports")
    upsert("football", "كرة قدم", "Football", parent_slug="sports")
    upsert("cycling", "دراجات", "Cycling", parent_slug="sports")
    upsert("camping", "تخييم", "Camping", parent_slug="sports")
    upsert("music", "موسيقى", "Music", parent_slug="sports")

    # Kids
    upsert("baby-supplies", "مستلزمات أطفال", "Baby Supplies", parent_slug="kids")
    upsert("toys", "ألعاب", "Toys", parent_slug="kids")
    upsert("strollers-seats", "عربات ومقاعد سيارة", "Strollers & Car Seats", parent_slug="kids")
    upsert("school-supplies", "مستلزمات مدرسية", "School Supplies", parent_slug="kids")


def unrestore_core_children(apps, schema_editor):
    # Non-reversible on purpose.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("market", "0010_prune_unused_top_level_categories"),
    ]

    operations = [
        migrations.RunPython(restore_core_children, unrestore_core_children),
    ]
