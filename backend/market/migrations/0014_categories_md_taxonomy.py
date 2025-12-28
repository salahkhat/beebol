from __future__ import annotations

from dataclasses import dataclass

from django.db import migrations


@dataclass(frozen=True)
class Node:
    slug: str
    name_en: str
    name_ar: str
    children: tuple["Node", ...] = ()


def _n(slug: str, name_en: str, name_ar: str, *children: "Node") -> Node:
    return Node(slug=slug, name_en=name_en, name_ar=name_ar, children=tuple(children))


# Taxonomy based on docs/Categories.md (2025-12-27)
TAXONOMY = _n(
    "general",
    "General",
    "عام",
    _n(
        "real-estate",
        "Real Estate",
        "عقارات",
        _n("apartment", "Apartment", "شقة"),
        _n("house", "House", "بيت"),
        _n("building", "Building", "بناء"),
        _n("land", "Land", "أرض"),
        _n("office", "Office", "مكتب"),
        _n("shop", "Shop", "محل"),
        _n("warehouse", "Warehouse", "مستودع"),
    ),
    _n(
        "vehicles",
        "Vehicles",
        "سيارات ومركبات",
        _n(
            "cars",
            "Cars",
            "سيارات",
            _n("sedan", "Sedan", "سيدان"),
            _n("suv", "SUV", "دفع رباعي"),
            _n("hatchback", "Hatchback", "هاتشباك"),
            _n("pickup", "Pickup", "بيك أب"),
            _n("coupe", "Coupe", "كوبيه"),
            _n("convertible", "Convertible", "مكشوفة"),
            _n("van", "Van", "فان"),
        ),
        _n(
            "motorcycles",
            "Motorcycles",
            "دراجات نارية",
            _n("scooter", "Scooter", "سكوتر"),
            _n("naked", "Naked", "ناكد"),
            _n("adventure", "Adventure", "مغامرة"),
            _n("enduro", "Enduro", "إندورو"),
            _n("sport", "Sport", "رياضية"),
            _n("cruiser", "Cruiser", "كروزر"),
        ),
        _n("trucks", "Trucks", "شاحنات"),
        _n("buses", "Buses", "باصات"),
        _n("construction-vehicles", "Construction Vehicles", "آليات إنشائية"),
        _n("agricultural-vehicles", "Agricultural Vehicles", "آليات زراعية"),
        _n(
            "vehicle-parts-accessories",
            "Vehicle Parts & Accessories",
            "قطع واكسسوارات المركبات",
            _n("spare-parts", "Spare Parts", "قطع غيار"),
            _n("tires", "Tires", "إطارات"),
            _n("vehicle-electronics", "Vehicle Electronics", "إلكترونيات مركبات"),
            _n("interior-accessories", "Interior Accessories", "اكسسوارات داخلية"),
            _n("exterior-accessories", "Exterior Accessories", "اكسسوارات خارجية"),
        ),
    ),
    _n(
        "electronics",
        "Electronics",
        "إلكترونيات",
        _n("mobile-phones", "Mobile Phones", "هواتف موبايل"),
        _n("mobile-accessories", "Mobile Accessories", "اكسسوارات موبايل"),
        _n("tablets", "Tablets", "تابلت"),
        _n("smart-watches", "Smart Watches", "ساعات ذكية"),
        _n("laptops", "Laptops", "لابتوب"),
        _n("desktop-computers", "Desktop Computers", "كمبيوتر مكتبي"),
        _n("monitors", "Monitors", "شاشات"),
        _n("computer-parts", "Computer Parts", "قطع كمبيوتر"),
        _n("headphones", "Headphones", "سماعات"),
        _n("cameras", "Cameras", "كاميرات"),
        _n("photography-equipments", "Photography Equipments", "معدات تصوير"),
        _n("drones", "Drones", "درون"),
        _n("camera-accessories", "Camera Accessories", "اكسسوارات كاميرا"),
        _n("gaming-consoles", "Gaming Consoles", "أجهزة ألعاب"),
        _n("video-games", "Video Games", "ألعاب فيديو"),
        _n("gaming-console-accessories", "Gaming Console Accessories", "اكسسوارات أجهزة ألعاب"),
    ),
    _n(
        "home",
        "Home & Furniture",
        "المنزل والأثاث",
        _n(
            "living-room-furniture",
            "Living Room Furniture",
            "أثاث غرفة المعيشة",
            _n("sofas", "Sofas", "كنب"),
            _n("armchairs", "Armchairs", "كراسي مفردة"),
            _n("coffee-tables", "Coffee Tables", "طاولات قهوة"),
            _n("side-tables", "Side Tables", "طاولات جانبية"),
            _n("tv-stands", "TV Stands", "طاولات تلفاز"),
            _n("bookcases", "Bookcases", "مكتبات"),
        ),
        _n(
            "bedroom-furniture",
            "Bedroom Furniture",
            "أثاث غرفة النوم",
            _n("beds", "Beds", "أسرة"),
            _n("mattresses", "Mattresses", "مراتب"),
            _n("wardrobes", "Wardrobes", "خزائن"),
            _n("nightstands", "Nightstands", "كومود"),
            _n("dressers", "Dressers", "تسريحات"),
        ),
        _n(
            "dining-furniture",
            "Dining Furniture",
            "أثاث سفرة",
            _n("dining-tables", "Dining Tables", "طاولات سفرة"),
            _n("dining-chairs", "Dining Chairs", "كراسي سفرة"),
            _n("dining-sets", "Dining Sets", "طقم سفرة"),
            _n("sideboards", "Sideboards", "بوفيه"),
        ),
        _n(
            "office-furniture",
            "Office Furniture",
            "أثاث مكتبي",
            _n("office-desks", "Office Desks", "مكاتب"),
            _n("office-chairs", "Office Chairs", "كراسي مكتب"),
            _n("storage-cabinets", "Storage Cabinets", "خزائن تخزين"),
            _n("office-bookcases", "Bookcases", "مكتبات"),
        ),
        _n(
            "kitchen-items",
            "Kitchen Items",
            "مستلزمات مطبخ",
            _n("kitchen-cabinets", "Kitchen Cabinets", "خزائن مطبخ"),
            _n("kitchen-tables", "Kitchen Tables", "طاولات مطبخ"),
            _n("kitchen-stools", "Kitchen Stools", "كراسي مطبخ"),
            _n("kitchen-shelving", "Kitchen Shelving", "رفوف مطبخ"),
            _n("kitchen-appliances", "Kitchen Appliances", "أجهزة مطبخ"),
        ),
        _n("home-decor", "Home Decor", "ديكور منزلي"),
        _n("lighting", "Lighting", "إضاءة"),
        _n("curtains", "Curtains", "ستائر"),
        _n("carpets", "Carpets", "سجاد"),
        _n(
            "home-appliances",
            "Home Appliances",
            "أجهزة منزلية",
            _n("refrigerators", "Refrigerators", "برادات"),
            _n("washing-machines", "Washing Machines", "غسالات"),
            _n("dishwashers", "Dishwashers", "جلايات"),
            _n("ovens", "Ovens", "أفران"),
            _n("microwaves", "Microwaves", "ميكروويف"),
            _n("air-conditioners", "Air Conditioners", "مكيفات"),
            _n("vacuum-cleaners", "Vacuum Cleaners", "مكانس كهربائية"),
        ),
    ),
    _n(
        "fashion",
        "Fashion",
        "أزياء",
        _n("mens-clothing", "Men’s Clothing", "ملابس رجالية"),
        _n("womens-clothing", "Women’s Clothing", "ملابس نسائية"),
        _n("kids-clothing", "Kids’ Clothing", "ملابس أطفال"),
        _n("accessories", "Accessories", "اكسسوارات"),
        _n("shoes", "Shoes", "أحذية"),
        _n("bags", "Bags", "حقائب"),
        _n("watches", "Watches", "ساعات"),
        _n("jewelry", "Jewelry", "مجوهرات"),
        _n("makeup", "Makeup", "مكياج"),
        _n("skincare", "Skincare", "عناية بالبشرة"),
        _n("perfumes", "Perfumes", "عطور"),
    ),
    _n(
        "kids",
        "Baby & Kids",
        "أطفال ورضع",
        _n("baby-clothes", "Baby Clothes", "ملابس أطفال"),
        _n("toys", "Toys", "ألعاب"),
        _n("strollers", "Strollers", "عربات أطفال"),
        _n("car-seats", "Car Seats", "مقاعد سيارة للأطفال"),
        _n("cribs-furniture", "Cribs & Furniture", "أسرة وأثاث أطفال"),
        _n("school-supplies", "School Supplies", "مستلزمات مدرسية"),
    ),
    _n(
        "sports",
        "Hobbies, Sports & Leisure",
        "هوايات ورياضة",
        _n("sports-equipment", "Sports Equipment", "معدات رياضية"),
        _n("fitness-gear", "Fitness Gear", "معدات لياقة"),
        _n("bicycles", "Bicycles", "دراجات"),
        _n("camping-outdoor-gear", "Camping & Outdoor Gear", "تخييم وخارجية"),
        _n("musical-instruments", "Musical Instruments", "آلات موسيقية"),
        _n("books", "Books", "كتب"),
        _n("board-games", "Board Games", "ألعاب لوحية"),
        _n("collectibles", "Collectibles", "مقتنيات"),
        _n("antiques", "Antiques", "تحف"),
    ),
    _n(
        "animals",
        "Pets & Animals",
        "حيوانات",
        _n(
            "pets",
            "Pets",
            "حيوانات أليفة",
            _n("cats", "Cats", "قطط"),
            _n("dogs", "Dogs", "كلاب"),
            _n("birds", "Birds", "طيور"),
            _n("fish", "Fish", "أسماك"),
        ),
        _n("pet-food", "Pet Food", "طعام حيوانات"),
        _n("pet-accessories", "Pet Accessories", "مستلزمات الحيوانات"),
        _n("cages", "Cages", "أقفاص"),
        _n("aquariums", "Aquariums", "أحواض أسماك"),
        _n(
            "pet-services",
            "Pet Services",
            "خدمات الحيوانات",
            _n("grooming", "Grooming", "تنظيف"),
            _n("training", "Training", "تدريب"),
            _n("veterinary", "Veterinary", "بيطري"),
            _n("pet-hotel", "Pet Hotel", "فندق حيوانات"),
        ),
    ),
    _n(
        "tools-equipment",
        "Tools & Equipment",
        "أدوات ومعدات",
        _n("power-tools", "Power Tools", "أدوات كهربائية"),
        _n("hand-tools", "Hand Tools", "أدوات يدوية"),
        _n("construction-equipment", "Construction Equipment", "معدات بناء"),
        _n("gardening-tools", "Gardening Tools", "أدوات زراعة"),
        _n("industrial-equipment", "Industrial Equipment", "معدات صناعية"),
    ),
    _n(
        "business-industrial",
        "Business & Industry",
        "أعمال وصناعة",
        _n("office-equipment", "Office Equipment", "معدات مكتبية"),
        _n("shop-equipment", "Shop Equipment", "معدات محلات"),
        _n("pos-systems", "POS Systems", "أنظمة نقاط بيع"),
        _n("industrial-machines", "Industrial Machines", "آلات صناعية"),
        _n("wholesale-items", "Wholesale Items", "جملة"),
        _n("business-for-sale", "Business for Sale", "مشروع للبيع"),
    ),
    _n(
        "jobs-services",
        "Jobs & Services",
        "وظائف وخدمات",
        _n(
            "jobs",
            "Jobs",
            "وظائف",
            _n("full-time-jobs", "Full-time Jobs", "دوام كامل"),
            _n("part-time-jobs", "Part-time Jobs", "دوام جزئي"),
            _n("freelance-remote-jobs", "Freelance / Remote Jobs", "عمل حر / عن بعد"),
            _n("temporary-work", "Temporary Work", "عمل مؤقت"),
        ),
        _n(
            "services",
            "Services",
            "خدمات",
            _n("home-services", "Home Services (plumbing, electrical)", "خدمات منزلية"),
            _n("cleaning-services", "Cleaning Services", "خدمات تنظيف"),
            _n("moving-transport", "Moving & Transport", "نقل وشحن"),
            _n("repair-services", "Repair Services", "صيانة وإصلاح"),
            _n("it-tech-services", "IT & Tech Services", "خدمات تقنية"),
            _n("tutoring-education", "Tutoring & Education", "تعليم ودروس"),
            _n("event-services", "Event Services", "خدمات مناسبات"),
        ),
    ),
    _n("miscellaneous", "Miscellaneous", "متفرقات"),
)


def _walk(node: Node):
    yield node
    for c in node.children:
        yield from _walk(c)


def _taxonomy_slugs() -> set[str]:
    return {n.slug for n in _walk(TAXONOMY)}


def _rename_slug(Category, old: str, new: str):
    if old == new:
        return
    try:
        src = Category.objects.get(slug=old)
    except Category.DoesNotExist:
        return
    if Category.objects.filter(slug=new).exists():
        return
    src.slug = new
    src.save(update_fields=["slug"])


def _get_by_slug(Category, slug: str):
    try:
        return Category.objects.get(slug=slug)
    except Category.DoesNotExist:
        return None


def _ensure_node(Category, parent, node: Node):
    obj, _ = Category.objects.get_or_create(
        slug=node.slug,
        defaults={
            "name_en": node.name_en,
            "name_ar": node.name_ar,
            "parent": parent,
        },
    )

    # Keep names aligned with spec.
    updates = []
    if (obj.name_en or "") != (node.name_en or ""):
        obj.name_en = node.name_en
        updates.append("name_en")
    if (obj.name_ar or "") != (node.name_ar or ""):
        obj.name_ar = node.name_ar
        updates.append("name_ar")

    # Enforce parent.
    if getattr(obj, "parent_id", None) != (parent.id if parent else None):
        obj.parent = parent
        updates.append("parent")

    if updates:
        obj.save(update_fields=updates)

    for child in node.children:
        _ensure_node(Category, obj, child)


def forward(apps, schema_editor):
    Category = apps.get_model("market", "Category")
    Listing = apps.get_model("market", "Listing")

    # 1) Rename legacy slugs to fit the new taxonomy where possible.
    _rename_slug(Category, "apartments-sale", "apartment")
    _rename_slug(Category, "houses-villas", "house")
    _rename_slug(Category, "offices", "office")
    _rename_slug(Category, "shops", "shop")
    _rename_slug(Category, "trucks-vans", "trucks")

    _rename_slug(Category, "phones", "mobile-phones")
    _rename_slug(Category, "mobile-internet", "mobile-accessories")
    _rename_slug(Category, "computers", "laptops")

    _rename_slug(Category, "appliances", "home-appliances")
    _rename_slug(Category, "furniture", "living-room-furniture")

    _rename_slug(Category, "mens-fashion", "mens-clothing")
    _rename_slug(Category, "womens-fashion", "womens-clothing")
    _rename_slug(Category, "kids-fashion", "kids-clothing")

    _rename_slug(Category, "pet-supplies", "pet-accessories")

    _rename_slug(Category, "gym-fitness", "fitness-gear")
    _rename_slug(Category, "cycling", "bicycles")
    _rename_slug(Category, "camping", "camping-outdoor-gear")
    _rename_slug(Category, "music", "musical-instruments")

    _rename_slug(Category, "office-supplies", "office-equipment")
    _rename_slug(Category, "restaurant-equipment", "shop-equipment")
    _rename_slug(Category, "machines-tools", "industrial-machines")

    # car-parts becomes the spec parent bucket.
    _rename_slug(Category, "car-parts", "vehicle-parts-accessories")

    # 2) Ensure full taxonomy exists, with General as the single root.
    _ensure_node(Category, None, TAXONOMY)

    general = _get_by_slug(Category, "general")
    if general is None:
        return

    # 3) All categories should have General as parent (except General itself).
    Category.objects.filter(parent__isnull=True).exclude(id=general.id).update(parent=general)

    # 4) Move Jobs and Services under Jobs & Services (if they already exist).
    jobs_services = _get_by_slug(Category, "jobs-services")
    jobs = _get_by_slug(Category, "jobs")
    services = _get_by_slug(Category, "services")
    if jobs_services is not None:
        if jobs is not None and jobs.parent_id != jobs_services.id:
            jobs.parent_id = jobs_services.id
            jobs.save(update_fields=["parent"])
        if services is not None and services.parent_id != jobs_services.id:
            services.parent_id = jobs_services.id
            services.save(update_fields=["parent"])

    # 5) Real-estate merge: apartments-rent -> apartment (single category; deal_type handles rent/sale).
    apartment = _get_by_slug(Category, "apartment")
    apartments_rent = _get_by_slug(Category, "apartments-rent")

    if apartment is not None and apartments_rent is not None:
        Listing.objects.filter(category_id=apartments_rent.id).update(category_id=apartment.id)
        # Best-effort delete if no longer referenced.
        try:
            apartments_rent.delete()
        except Exception:
            pass

    # 6) Beauty & Health was split into Fashion subcategories in the spec.
    # Keep existing node if referenced, but place it under Fashion.
    beauty = _get_by_slug(Category, "beauty-health")
    fashion = _get_by_slug(Category, "fashion")
    if beauty is not None and fashion is not None and beauty.parent_id != fashion.id:
        beauty.parent_id = fashion.id
        beauty.save(update_fields=["parent"])

    # 7) Books belongs under Hobbies/Sports/Leisure in the spec.
    books = _get_by_slug(Category, "books")
    sports = _get_by_slug(Category, "sports")
    if books is not None and sports is not None and books.parent_id != sports.id:
        books.parent_id = sports.id
        books.save(update_fields=["parent"])


def backward(apps, schema_editor):
    # Non-trivial to reverse safely (would require remembering previous parents and merges).
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("market", "0013_more_child_specific_attribute_definitions"),
    ]

    operations = [
        migrations.RunPython(forward, backward),
    ]
