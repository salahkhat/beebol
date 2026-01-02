from django.db import migrations


def reseed_syria_locations_if_missing(apps, schema_editor):
    Governorate = apps.get_model("market", "Governorate")
    City = apps.get_model("market", "City")
    Neighborhood = apps.get_model("market", "Neighborhood")

    # Some environments may have the original seed migration marked as applied
    # but end up missing rows (e.g. old db snapshots). Repair that here.
    if Governorate.objects.exists():
        return

    data = [
        {
            "name_ar": "دمشق",
            "name_en": "Damascus",
            "slug": "damascus",
            "cities": [
                {
                    "name_ar": "دمشق",
                    "name_en": "Damascus",
                    "slug": "damascus-city",
                    "neighborhoods": [
                        {"name_ar": "المزة", "name_en": "Mazzeh", "slug": "mazzeh"},
                        {"name_ar": "الميدان", "name_en": "Midan", "slug": "midan"},
                    ],
                }
            ],
        },
        {
            "name_ar": "ريف دمشق",
            "name_en": "Rif Dimashq",
            "slug": "rif-dimashq",
            "cities": [
                {"name_ar": "دوما", "name_en": "Douma", "slug": "douma", "neighborhoods": []},
                {"name_ar": "جرمانا", "name_en": "Jaramana", "slug": "jaramana", "neighborhoods": []},
            ],
        },
        {
            "name_ar": "حلب",
            "name_en": "Aleppo",
            "slug": "aleppo",
            "cities": [
                {
                    "name_ar": "حلب",
                    "name_en": "Aleppo",
                    "slug": "aleppo-city",
                    "neighborhoods": [
                        {"name_ar": "الحمدانية", "name_en": "Hamdaniyeh", "slug": "hamdaniyeh"},
                        {"name_ar": "السليمانية", "name_en": "Suleimaniyah", "slug": "suleimaniyah"},
                    ],
                }
            ],
        },
        {
            "name_ar": "حمص",
            "name_en": "Homs",
            "slug": "homs",
            "cities": [{"name_ar": "حمص", "name_en": "Homs", "slug": "homs-city", "neighborhoods": []}],
        },
        {
            "name_ar": "حماة",
            "name_en": "Hama",
            "slug": "hama",
            "cities": [{"name_ar": "حماة", "name_en": "Hama", "slug": "hama-city", "neighborhoods": []}],
        },
        {
            "name_ar": "اللاذقية",
            "name_en": "Latakia",
            "slug": "latakia",
            "cities": [{"name_ar": "اللاذقية", "name_en": "Latakia", "slug": "latakia-city", "neighborhoods": []}],
        },
        {
            "name_ar": "طرطوس",
            "name_en": "Tartus",
            "slug": "tartus",
            "cities": [{"name_ar": "طرطوس", "name_en": "Tartus", "slug": "tartus-city", "neighborhoods": []}],
        },
        {
            "name_ar": "إدلب",
            "name_en": "Idlib",
            "slug": "idlib",
            "cities": [{"name_ar": "إدلب", "name_en": "Idlib", "slug": "idlib-city", "neighborhoods": []}],
        },
        {
            "name_ar": "دير الزور",
            "name_en": "Deir ez-Zor",
            "slug": "deir-ez-zor",
            "cities": [{"name_ar": "دير الزور", "name_en": "Deir ez-Zor", "slug": "deir-city", "neighborhoods": []}],
        },
        {
            "name_ar": "الحسكة",
            "name_en": "Al-Hasakah",
            "slug": "hasakah",
            "cities": [{"name_ar": "الحسكة", "name_en": "Hasakah", "slug": "hasakah-city", "neighborhoods": []}],
        },
        {
            "name_ar": "الرقة",
            "name_en": "Raqqa",
            "slug": "raqqa",
            "cities": [{"name_ar": "الرقة", "name_en": "Raqqa", "slug": "raqqa-city", "neighborhoods": []}],
        },
        {
            "name_ar": "درعا",
            "name_en": "Daraa",
            "slug": "daraa",
            "cities": [{"name_ar": "درعا", "name_en": "Daraa", "slug": "daraa-city", "neighborhoods": []}],
        },
        {
            "name_ar": "السويداء",
            "name_en": "As-Suwayda",
            "slug": "suwayda",
            "cities": [{"name_ar": "السويداء", "name_en": "As-Suwayda", "slug": "suwayda-city", "neighborhoods": []}],
        },
        {
            "name_ar": "القنيطرة",
            "name_en": "Quneitra",
            "slug": "quneitra",
            "cities": [{"name_ar": "القنيطرة", "name_en": "Quneitra", "slug": "quneitra-city", "neighborhoods": []}],
        },
    ]

    for gov in data:
        governorate, _ = Governorate.objects.get_or_create(
            slug=gov["slug"],
            defaults={"name_ar": gov["name_ar"], "name_en": gov.get("name_en", "")},
        )

        for city in gov.get("cities", []):
            city_obj, _ = City.objects.get_or_create(
                governorate=governorate,
                slug=city["slug"],
                defaults={"name_ar": city["name_ar"], "name_en": city.get("name_en", "")},
            )

            for n in city.get("neighborhoods", []):
                Neighborhood.objects.get_or_create(
                    city=city_obj,
                    slug=n["slug"],
                    defaults={"name_ar": n["name_ar"], "name_en": n.get("name_en", "")},
                )


class Migration(migrations.Migration):
    dependencies = [
        ("market", "0025_listing_view_count"),
    ]

    operations = [
        migrations.RunPython(reseed_syria_locations_if_missing, migrations.RunPython.noop),
    ]
