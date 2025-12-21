from django.db import migrations


def seed_categories(apps, schema_editor):
    Category = apps.get_model("market", "Category")

    def upsert(slug, name_ar, name_en="", parent_slug=None):
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

        # Keep names/parent aligned if you tweak seed values later.
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

        return obj

    # Top-level categories (Syria-first, Arabic primary)
    upsert("vehicles", "سيارات ومركبات", "Vehicles")
    upsert("real-estate", "عقارات", "Real Estate")
    upsert("electronics", "إلكترونيات", "Electronics")
    upsert("home", "المنزل والحديقة", "Home & Garden")
    upsert("fashion", "أزياء", "Fashion")
    upsert("kids", "أطفال", "Kids")
    upsert("jobs", "وظائف", "Jobs")
    upsert("services", "خدمات", "Services")
    upsert("animals", "حيوانات", "Animals")

    # Vehicles
    upsert("cars", "سيارات", "Cars", parent_slug="vehicles")
    upsert("motorcycles", "دراجات نارية", "Motorcycles", parent_slug="vehicles")
    upsert("car-parts", "قطع غيار", "Parts", parent_slug="vehicles")

    # Real estate
    upsert("apartments-rent", "شقق للإيجار", "Apartments for Rent", parent_slug="real-estate")
    upsert("apartments-sale", "شقق للبيع", "Apartments for Sale", parent_slug="real-estate")
    upsert("shops", "محلات", "Shops", parent_slug="real-estate")

    # Electronics
    upsert("phones", "هواتف", "Phones", parent_slug="electronics")
    upsert("computers", "كمبيوتر ولابتوب", "Computers", parent_slug="electronics")
    upsert("tv-audio", "تلفزيون وصوتيات", "TV & Audio", parent_slug="electronics")

    # Home
    upsert("furniture", "أثاث", "Furniture", parent_slug="home")
    upsert("appliances", "أجهزة منزلية", "Appliances", parent_slug="home")

    # Fashion
    upsert("mens-fashion", "رجالي", "Men", parent_slug="fashion")
    upsert("womens-fashion", "نسائي", "Women", parent_slug="fashion")

    # Jobs
    upsert("jobs-offered", "فرص عمل", "Jobs Offered", parent_slug="jobs")
    upsert("jobs-wanted", "باحث عن عمل", "Job Wanted", parent_slug="jobs")

    # Services
    upsert("delivery", "توصيل", "Delivery", parent_slug="services")
    upsert("repairs", "صيانة وإصلاح", "Repairs", parent_slug="services")


def unseed_categories(apps, schema_editor):
    # Leave data in place on rollback to avoid accidental data loss.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("market", "0002_seed_syria_locations"),
    ]

    operations = [
        migrations.RunPython(seed_categories, unseed_categories),
    ]
